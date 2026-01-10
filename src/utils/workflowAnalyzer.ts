import { SceneDocumentation } from '@/lib/types';

/**
 * Heuristic analysis of ComfyUI workflow JSON to extract parameters and prompts
 * without using AI.
 *
 * Updated Strategy:
 * 1. Find the main KSampler.
 * 2. Trace backwards from 'positive' and 'negative' inputs to find the Text Encode nodes.
 * 3. Recursively resolve text from those nodes (checking widgets and inputs).
 * 4. Fallback to a global scan for any nodes missed by the trace.
 */
export const analyzeWorkflowLocally = (workflow: any): SceneDocumentation => {
  const nodes = workflow.nodes || [];
  const links = workflow.links || [];

  const result: SceneDocumentation = {
    isOffline: true,
    sceneOverview: [],
    workflowAnalysis: [],
    parameters: {
      seed: '',
      steps: 0,
      cfg: 0,
      sampler: '',
      scheduler: '',
      denoise: 0,
      model: '',
      vae: '',
    },
    prompts: [],
    negativePrompt: '',
    qualityAnalysis: undefined,
    promptAnalysis: undefined,
    qa: [],
  };

  const processedNodeIds = new Set<number>();
  const getNodeById = (id: number) => nodes.find((n: any) => n.id === id);

  /**
   * Traces a connection backwards to find the functional source node.
   * Handles Reroutes transparently.
   */
  const findUpstreamNode = (node: any, inputName: string, depth = 0): any | null => {
    if (!node || !node.inputs || depth > 20) return null;

    const input = node.inputs.find((i: any) => i.name === inputName);
    if (!input || !input.link) return null;

    const link = links.find((l: any) => l[0] === input.link);
    if (!link) return null;

    // link: [id, origin_id, origin_slot, target_id, target_slot, type]
    const sourceNode = getNodeById(link[1]);
    if (!sourceNode) return null;

    const type = (sourceNode.type || '').toLowerCase();

    // 1. Pass through Reroutes
    if (type.includes('reroute')) {
      // Reroute nodes typically have one input. We continue tracing upstream.
      if (sourceNode.inputs && sourceNode.inputs.length > 0) {
        return findUpstreamNode(sourceNode, sourceNode.inputs[0].name, depth + 1);
      }
    }

    // 2. Pass through simple conditioning combiners (optional, simple logic for now)
    // If it's a "Combine" node, we might want to just return it and let the text resolver handle it,
    // or pick the first input. For now, we return the node found.

    return sourceNode;
  };

  /**
   * Recursively extracts text from a node.
   * Checks widgets first, then input connections (e.g. Primitive -> CLIPTextEncode).
   */
  const resolveTextFromNode = (node: any, visited = new Set<number>()): string | null => {
    if (!node || visited.has(node.id)) return null;
    visited.add(node.id);

    // Strategy A: Check Widgets (Standard)
    if (node.widgets_values && Array.isArray(node.widgets_values)) {
      for (const val of node.widgets_values) {
        if (typeof val === 'string' && val.trim().length > 0) {
          // Exclude likely filenames or non-prompt settings
          if (val.match(/\.(safetensors|ckpt|pt|pth|sft|json)$/i)) continue;
          if (
            [
              'fixed',
              'increment',
              'decrement',
              'randomized',
              'nearest-exact',
              'bilinear',
              'enable',
              'disable',
            ].includes(val.toLowerCase())
          )
            continue;
          return val;
        }
      }
    }

    // Strategy B: Check Inputs (for Primitives or SDXL nodes)
    if (node.inputs) {
      // Common input names for text strings
      const textInputNames = [
        'text',
        'string',
        'text_g',
        'text_l',
        'prompt',
        'text_positive',
        'text_negative',
      ];

      for (const input of node.inputs) {
        if (textInputNames.includes(input.name.toLowerCase())) {
          const upstream = findUpstreamNode(node, input.name);
          if (upstream) {
            const val = resolveTextFromNode(upstream, visited);
            if (val) return val;
          }
        }
      }
    }

    return null;
  };

  // --- Main Extraction Logic ---

  // 1. Find Main KSampler
  // Sort by number of inputs descending to find the most "connected" sampler
  const samplers = nodes
    .filter((n: any) => {
      const t = (n.type || '').toLowerCase();
      return (t.includes('ksampler') || t.includes('sampler')) && !t.includes('box'); // exclude layout nodes if any
    })
    .sort((a: any, b: any) => (b.inputs?.length || 0) - (a.inputs?.length || 0));

  const kSampler = samplers[0];

  if (kSampler) {
    // Extract Parameters
    const widgets = kSampler.widgets_values || [];
    if (widgets.length > 0) result.parameters.seed = String(widgets[0]);

    widgets.forEach((w: any) => {
      if (typeof w === 'number') {
        if (w > 0 && w < 200 && w % 1 === 0 && !result.parameters.steps) result.parameters.steps = w;
        else if (w > 0 && w <= 50 && !result.parameters.cfg) result.parameters.cfg = w;
        else if (w >= 0 && w <= 1.0 && !result.parameters.denoise) result.parameters.denoise = w;
      }
      if (typeof w === 'string') {
        const s = w.toLowerCase();
        if (['euler', 'dpm', 'ddim', 'uni_pc', 'lms'].some((t) => s.includes(t)))
          result.parameters.sampler = w;
        if (['normal', 'karras', 'exponential', 'simple', 'sgm_uniform'].some((t) => s.includes(t)))
          result.parameters.scheduler = w;
      }
    });

    // Extract Model Name
    const modelNode = findUpstreamNode(kSampler, 'model');
    if (modelNode) {
      // It might be a Lora chain, traverse up
      let curr = modelNode;
      let depth = 0;
      while (curr && depth < 10) {
        const t = (curr.type || '').toLowerCase();
        if (t.includes('checkpoint') || t.includes('loader')) {
          const modelName = curr.widgets_values?.find(
            (v: any) => typeof v === 'string' && v.match(/\.(safetensors|ckpt|sft)$/i)
          );
          if (modelName) result.parameters.model = modelName;
          break;
        }
        if (t.includes('lora')) {
          curr = findUpstreamNode(curr, 'model');
        } else {
          break;
        }
        depth++;
      }
    }

    // 2. Trace Prompts
    // Positive
    const posNode = findUpstreamNode(kSampler, 'positive');
    if (posNode) {
      const text = resolveTextFromNode(posNode);
      if (text) {
        const label = posNode.title || posNode.type || 'Positive';
        result.prompts.push({ label: `Positive (${label})`, text });
        processedNodeIds.add(posNode.id);
      }
    }

    // Negative
    const negNode = findUpstreamNode(kSampler, 'negative');
    if (negNode) {
      const text = resolveTextFromNode(negNode);
      if (text) {
        result.negativePrompt = text;
        processedNodeIds.add(negNode.id);
      }
    }
  }

  // 3. Fallback: Scan remaining nodes for prompts
  // This catches prompts in workflows that don't follow standard KSampler connections
  // or if tracing failed.
  nodes.forEach((n: any) => {
    if (processedNodeIds.has(n.id)) return;

    const type = (n.type || '').toLowerCase();
    const title = (n.title || '').toLowerCase();

    // Identify likely prompt nodes
    const isPromptLike =
      type.includes('cliptextencode') ||
      type.includes('showtext') ||
      type === 'primitive' ||
      (type.includes('string') && !type.includes('convert')) ||
      title.includes('prompt');

    if (isPromptLike) {
      const text = resolveTextFromNode(n);
      if (text && text.length > 2) {
        // Heuristic labeling based on title
        if (title.includes('negative')) {
          if (!result.negativePrompt.includes(text)) {
            result.negativePrompt += (result.negativePrompt ? '\n' : '') + `[${n.title}]: ${text}`;
          }
        } else if (title.includes('positive') || title.includes('prompt')) {
          result.prompts.push({ label: n.title || 'Prompt', text });
        } else if (type.includes('cliptextencode')) {
          // If it's explicitly a text encode node but we don't know the role, assume positive/general
          result.prompts.push({ label: `Prompt (${n.title || n.id})`, text });
        }
      }
    }
  });

  return result;
};
