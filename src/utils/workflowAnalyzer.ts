import { SceneDocumentation } from '@/lib/types';
import { LintResult, LintConfig, LintedQualityIssue } from '@/lib/lintTypes';
import { runLinter, lintToQualityAnalysis, DEFAULT_LINT_CONFIG } from './lintEngine';
import { registerBuiltinRules, areRulesRegistered } from '@/rules';

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
type WidgetValue = string | number | boolean | null | Record<string, unknown>;

type NodeInput = { name: string; link?: number | null };

type WorkflowNode = {
  id: number;
  type?: string;
  title?: string;
  inputs?: NodeInput[];
  widgets_values?: WidgetValue[];
};

type Workflow = {
  nodes?: WorkflowNode[];
  links?: (number | string)[][];
};

export const analyzeWorkflowLocally = (workflow: Workflow): SceneDocumentation => {
  const nodes: WorkflowNode[] = workflow.nodes || [];
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
  const getNodeById = (id: number) => nodes.find((n) => n.id === id);

  /**
   * Traces a connection backwards to find the functional source node.
   * Handles Reroutes transparently.
   */
  const findUpstreamNode = (
    node: WorkflowNode | undefined,
    inputName: string,
    depth = 0,
  ): WorkflowNode | null => {
    if (!node || !node.inputs || depth > 20) return null;

    const input = node.inputs.find((i) => i.name === inputName);
    if (!input || input.link == null) return null;

    const link = links.find((l) => Number(l[0]) === input.link || l[0] === input.link);
    if (!link) return null;

    // link: [id, origin_id, origin_slot, target_id, target_slot, type]
    const sourceNode = getNodeById(Number(link[1]));
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
  const resolveTextFromNode = (
    node: WorkflowNode | undefined,
    visited = new Set<number>(),
  ): string | null => {
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
    .filter((n) => {
      const t = (n.type || '').toLowerCase();
      return (t.includes('ksampler') || t.includes('sampler')) && !t.includes('box'); // exclude layout nodes if any
    })
    .sort((a, b) => (b.inputs?.length || 0) - (a.inputs?.length || 0));

  const kSampler = samplers[0];

  if (kSampler) {
    // Extract Parameters
    const widgets: WidgetValue[] = kSampler.widgets_values || [];
    if (widgets.length > 0) result.parameters.seed = String(widgets[0]);

    widgets.forEach((w) => {
      if (typeof w === 'number') {
        if (w > 0 && w < 200 && w % 1 === 0 && !result.parameters.steps)
          result.parameters.steps = w;
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
      let curr: WorkflowNode | null = modelNode;
      let depth = 0;
      while (curr && depth < 10) {
        const t = (curr.type || '').toLowerCase();
        if (t.includes('checkpoint') || t.includes('loader')) {
          const modelName = curr.widgets_values?.find(
            (v) => typeof v === 'string' && v.match(/\.(safetensors|ckpt|sft)$/i),
          );
          if (typeof modelName === 'string') result.parameters.model = modelName;
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
  for (const n of nodes) {
    if (processedNodeIds.has(n.id)) continue;

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
  }

  return result;
};

// ============================================================================
// LINTING INTEGRATION
// ============================================================================

/**
 * Ensures lint rules are registered.
 * Call this before running the linter.
 */
function ensureRulesRegistered(): void {
  if (!areRulesRegistered()) {
    registerBuiltinRules();
  }
}

/**
 * Runs the linting engine on a workflow.
 * This is a low-level API that returns raw lint results.
 *
 * @param workflow - Raw ComfyUI workflow JSON
 * @param config - Optional lint configuration
 * @returns LintResult with all diagnostics and metadata
 */
export function lintWorkflow(
  workflow: unknown,
  config: LintConfig = DEFAULT_LINT_CONFIG
): LintResult {
  ensureRulesRegistered();
  return runLinter(workflow, config);
}

/**
 * Analyzes a workflow with both heuristic extraction AND rule-based linting.
 * This is the recommended high-level API for comprehensive offline analysis.
 *
 * @param workflow - Raw ComfyUI workflow JSON
 * @param config - Optional lint configuration
 * @returns SceneDocumentation with quality analysis from linting
 */
export function analyzeWorkflowWithLinting(
  workflow: Workflow,
  config?: Partial<LintConfig>
): SceneDocumentation {
  // Run heuristic analysis first
  const baseResult = analyzeWorkflowLocally(workflow);

  // Run linting
  ensureRulesRegistered();
  const mergedConfig = config
    ? { ...DEFAULT_LINT_CONFIG, ...config }
    : DEFAULT_LINT_CONFIG;
  const lintResult = lintToQualityAnalysis(workflow, mergedConfig);

  // Merge lint results into SceneDocumentation
  return {
    ...baseResult,
    qualityAnalysis: {
      overallScore: lintResult.overallScore,
      issues: lintResult.issues as unknown as import('@/lib/types').QualityIssue[],
    },
    // Add workflow analysis hints from linting
    workflowAnalysis: generateWorkflowAnalysisHints(lintResult.issues),
  };
}

/**
 * Generates workflow analysis text from lint issues.
 */
function generateWorkflowAnalysisHints(issues: LintedQualityIssue[]): string[] {
  const hints: string[] = [];

  // Group issues by category
  const issuesByCategory = new Map<string, LintedQualityIssue[]>();
  for (const issue of issues) {
    const category = issue.type || 'General';
    const existing = issuesByCategory.get(category) || [];
    existing.push(issue);
    issuesByCategory.set(category, existing);
  }

  // Generate summary hints
  for (const [category, categoryIssues] of issuesByCategory) {
    const criticalCount = categoryIssues.filter(
      (i) => i.severity === 'Critical'
    ).length;
    const majorCount = categoryIssues.filter(
      (i) => i.severity === 'Major'
    ).length;

    if (criticalCount > 0) {
      hints.push(
        `${category}: ${criticalCount} critical issue(s) detected that may prevent proper generation.`
      );
    } else if (majorCount > 0) {
      hints.push(
        `${category}: ${majorCount} issue(s) found that may affect output quality.`
      );
    } else if (categoryIssues.length > 0) {
      hints.push(
        `${category}: ${categoryIssues.length} suggestion(s) for potential improvement.`
      );
    }
  }

  if (hints.length === 0) {
    hints.push('No significant issues detected in workflow configuration.');
  }

  return hints;
}

/**
 * Quick lint check that returns only error-level issues.
 * Useful for validation before generation.
 *
 * @param workflow - Raw ComfyUI workflow JSON
 * @returns Array of critical issues, empty if workflow looks valid
 */
export function getWorkflowErrors(workflow: unknown): LintedQualityIssue[] {
  ensureRulesRegistered();

  const result = lintToQualityAnalysis(workflow, {
    ...DEFAULT_LINT_CONFIG,
    includeInfo: false,
  });

  return result.issues.filter((i) => i.severity === 'Critical');
}

/**
 * Checks if a workflow passes basic validation.
 *
 * @param workflow - Raw ComfyUI workflow JSON
 * @returns True if no critical errors, false otherwise
 */
export function isWorkflowValid(workflow: unknown): boolean {
  const errors = getWorkflowErrors(workflow);
  return errors.length === 0;
}

// Re-export linting types and utilities for convenience
export { DEFAULT_LINT_CONFIG } from './lintEngine';
export type { LintResult, LintConfig, LintedQualityIssue } from '@/lib/lintTypes';
