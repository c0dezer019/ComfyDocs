/**
 * ComfyDocs AST Builder
 *
 * Transforms raw ComfyUI workflow JSON into a normalized Abstract Syntax Tree (AST)
 * optimized for linting operations. Provides O(1) lookups for nodes, links, and
 * graph relationships.
 */

import {
  WorkflowAST,
  WorkflowNode,
  WorkflowLink,
  NodeConnection,
  WidgetValue,
  NodeCategory,
  LintContext,
  ExtractedParameters,
} from '@/lib/lintTypes';

// ============================================================================
// RAW WORKFLOW TYPE (from ComfyUI)
// ============================================================================

/**
 * Shape of raw ComfyUI workflow JSON.
 * This is what we receive from PNG metadata.
 */
interface RawWorkflow {
  nodes?: RawNode[];
  links?: RawLink[];
  last_node_id?: number;
  last_link_id?: number;
  version?: number;
}

interface RawNode {
  id: number;
  type?: string;
  title?: string;
  pos?: [number, number] | { 0: number; 1: number };
  size?:
    | [number, number]
    | { 0: number; 1: number }
    | { width: number; height: number };
  inputs?: RawInput[];
  outputs?: RawOutput[];
  widgets_values?: unknown[];
  properties?: Record<string, unknown>;
  mode?: number;
}

interface RawInput {
  name: string;
  type?: string;
  link?: number | null;
  widget?: { name: string };
}

interface RawOutput {
  name: string;
  type?: string;
  links?: number[] | null;
  slot_index?: number;
}

/**
 * Raw link format: [link_id, source_node, source_slot, target_node, target_slot, type]
 */
type RawLink = [
  number | string, // link_id
  number | string, // source_node_id
  number | string, // source_slot
  number | string, // target_node_id
  number | string, // target_slot
  string?, // type
];

// ============================================================================
// NODE CATEGORIZATION
// ============================================================================

/**
 * Node type patterns for categorization.
 * Order matters - first match wins.
 */
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: NodeCategory }> = [
  // Sampling nodes
  { pattern: /ksampler|sampler(?!custom)/i, category: 'sampling' },

  // Model loading and manipulation
  {
    pattern: /checkpoint|unclipcheckpoint|diffusionmodel/i,
    category: 'model',
  },
  { pattern: /lora|hypernetwork|embedding/i, category: 'model' },
  { pattern: /unet|^model/i, category: 'model' },

  // VAE nodes
  { pattern: /^vae|vaedecode|vaeencode|vaeloader/i, category: 'vae' },

  // Conditioning and text encoding
  {
    pattern: /clip|textencode|conditioning|style.*model|ipadapter/i,
    category: 'conditioning',
  },
  { pattern: /controlnet|t2iadapter/i, category: 'conditioning' },

  // Latent operations
  { pattern: /latent|emptylatent|upscalelatent/i, category: 'latent' },

  // Image operations
  {
    pattern: /^image|loadimage|saveimage|preview|upscale.*image/i,
    category: 'image',
  },
  { pattern: /crop|resize|pad|blur|sharpen/i, category: 'image' },

  // Control and masking
  { pattern: /mask|inpaint|segment/i, category: 'control' },

  // Utility nodes
  { pattern: /reroute|primitive|note|preview|show|display/i, category: 'utility' },
  { pattern: /convert|switch|compare|math|string/i, category: 'utility' },
];

/**
 * Categorizes a node type string into a NodeCategory.
 */
export function categorizeNodeType(type: string): NodeCategory {
  const normalized = type.trim();

  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(normalized)) {
      return category;
    }
  }

  return 'unknown';
}

// ============================================================================
// VALUE TYPE INFERENCE
// ============================================================================

/**
 * Infers the type of a widget value.
 */
function inferWidgetType(value: unknown): WidgetValue['type'] {
  if (value === null || value === undefined) return 'unknown';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'combo';
  return 'unknown';
}

/**
 * Known widget name patterns by position for common node types.
 * This helps assign meaningful names to widgets.
 */
const WIDGET_NAME_HINTS: Record<string, string[]> = {
  ksampler: ['seed', 'control_after_generate', 'steps', 'cfg', 'sampler_name', 'scheduler', 'denoise'],
  ksampleradvanced: ['add_noise', 'noise_seed', 'control_after_generate', 'steps', 'cfg', 'sampler_name', 'scheduler', 'start_at_step', 'end_at_step', 'return_with_leftover_noise'],
  checkpointloadersimple: ['ckpt_name'],
  loraloader: ['lora_name', 'strength_model', 'strength_clip'],
  cliptextencode: ['text'],
  emptylatentimage: ['width', 'height', 'batch_size'],
  vaeloader: ['vae_name'],
  vaedecode: [],
  vaeencode: [],
  saveimage: ['filename_prefix'],
  loadimage: ['image', 'upload'],
};

/**
 * Attempts to infer widget names based on node type and position.
 */
function inferWidgetName(
  nodeType: string,
  index: number,
  value: unknown
): string | undefined {
  const normalized = nodeType.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hints = WIDGET_NAME_HINTS[normalized];

  if (hints && index < hints.length) {
    return hints[index];
  }

  // Fallback heuristics based on value characteristics
  if (typeof value === 'number') {
    if (value > 1000000000) return 'seed'; // Large numbers are likely seeds
    if (value >= 1 && value <= 200 && Number.isInteger(value)) return 'steps';
    if (value > 0 && value <= 30) return 'cfg';
    if (value >= 0 && value <= 1) return 'denoise';
  }

  if (typeof value === 'string') {
    if (value.match(/\.(safetensors|ckpt|pt|pth|bin)$/i)) return 'model_name';
    if (value.match(/euler|dpm|ddim|uni_pc|lms|heun/i)) return 'sampler_name';
    if (value.match(/normal|karras|exponential|simple|sgm/i)) return 'scheduler';
  }

  return undefined;
}

// ============================================================================
// POSITION/SIZE NORMALIZATION
// ============================================================================

/**
 * Normalizes position from various formats to [x, y] tuple.
 */
function normalizePosition(
  pos: RawNode['pos']
): [number, number] {
  if (!pos) return [0, 0];

  if (Array.isArray(pos)) {
    return [Number(pos[0]) || 0, Number(pos[1]) || 0];
  }

  if (typeof pos === 'object' && '0' in pos && '1' in pos) {
    return [Number(pos[0]) || 0, Number(pos[1]) || 0];
  }

  return [0, 0];
}

/**
 * Normalizes size from various formats to [width, height] tuple.
 */
function normalizeSize(
  size: RawNode['size']
): [number, number] {
  const defaultSize: [number, number] = [200, 100];

  if (!size) return defaultSize;

  if (Array.isArray(size)) {
    return [Number(size[0]) || 200, Number(size[1]) || 100];
  }

  if (typeof size === 'object') {
    if ('width' in size && 'height' in size) {
      return [Number(size.width) || 200, Number(size.height) || 100];
    }
    if ('0' in size && '1' in size) {
      return [Number(size[0]) || 200, Number(size[1]) || 100];
    }
  }

  return defaultSize;
}

// ============================================================================
// AST BUILDER
// ============================================================================

/**
 * Builds a normalized AST from raw ComfyUI workflow JSON.
 * This is the main entry point for workflow analysis.
 *
 * @param rawWorkflow - Raw workflow JSON from PNG metadata
 * @returns Normalized WorkflowAST ready for linting
 */
export function buildWorkflowAST(rawWorkflow: unknown): WorkflowAST {
  const workflow = (rawWorkflow || {}) as RawWorkflow;

  // Initialize collections
  const nodes = new Map<number, WorkflowNode>();
  const links = new Map<number, WorkflowLink>();
  const downstream = new Map<number, Set<number>>();
  const upstream = new Map<number, Set<number>>();
  const byType = new Map<string, Set<number>>();
  const byCategory = new Map<NodeCategory, Set<number>>();

  // Helper to ensure set exists
  const ensureSet = <K, V>(map: Map<K, Set<V>>, key: K): Set<V> => {
    if (!map.has(key)) map.set(key, new Set());
    return map.get(key)!;
  };

  // Parse links first to build connection lookup
  const linksByTarget = new Map<string, WorkflowLink>(); // "nodeId:slotIndex" -> link

  for (const rawLink of workflow.links || []) {
    if (!Array.isArray(rawLink) || rawLink.length < 5) continue;

    const [id, sourceNodeId, sourceSlot, targetNodeId, targetSlot, type] = rawLink;

    const link: WorkflowLink = {
      id: Number(id),
      sourceNodeId: Number(sourceNodeId),
      sourceSlot: Number(sourceSlot),
      targetNodeId: Number(targetNodeId),
      targetSlot: Number(targetSlot),
      type: String(type || 'unknown'),
    };

    links.set(link.id, link);

    // Index by target for input resolution
    linksByTarget.set(`${link.targetNodeId}:${link.targetSlot}`, link);

    // Build adjacency lists
    ensureSet(downstream, link.sourceNodeId).add(link.targetNodeId);
    ensureSet(upstream, link.targetNodeId).add(link.sourceNodeId);
  }

  // Parse nodes
  for (const rawNode of workflow.nodes || []) {
    if (typeof rawNode.id !== 'number') continue;

    const type = rawNode.type || 'Unknown';
    const category = categorizeNodeType(type);

    // Parse inputs with connection info
    const inputs: NodeConnection[] = (rawNode.inputs || []).map((input, slotIndex) => {
      const linkId = input.link ?? undefined;
      const link = linkId !== undefined ? links.get(linkId) : undefined;

      return {
        name: input.name,
        type: input.type || 'unknown',
        linkId,
        connectedNodeId: link?.sourceNodeId,
        connectedSlot: link?.sourceSlot,
      };
    });

    // Parse outputs
    const outputs: NodeConnection[] = (rawNode.outputs || []).map((output) => ({
      name: output.name,
      type: output.type || 'unknown',
      // Outputs can have multiple links, but we don't track them individually here
    }));

    // Parse widgets with type inference
    const widgets: WidgetValue[] = (rawNode.widgets_values || []).map((val, idx) => ({
      index: idx,
      name: inferWidgetName(type, idx, val),
      value: val as string | number | boolean | null,
      type: inferWidgetType(val),
    }));

    const node: WorkflowNode = {
      id: rawNode.id,
      type,
      title: rawNode.title,
      category,
      inputs,
      outputs,
      widgets,
      position: normalizePosition(rawNode.pos),
      size: normalizeSize(rawNode.size),
      _raw: rawNode,
    };

    nodes.set(node.id, node);

    // Index by type
    ensureSet(byType, type).add(node.id);

    // Index by category
    ensureSet(byCategory, category).add(node.id);

    // Ensure adjacency entries exist even for unconnected nodes
    ensureSet(downstream, node.id);
    ensureSet(upstream, node.id);
  }

  return {
    nodes,
    links,
    downstream,
    upstream,
    byType,
    byCategory,
    _raw: rawWorkflow,
  };
}

// ============================================================================
// LINT CONTEXT FACTORY
// ============================================================================

/**
 * Creates a LintContext from a WorkflowAST.
 * The context provides helper methods for common rule operations.
 *
 * @param ast - The workflow AST to create context for
 * @returns LintContext with populated helpers
 */
export function createLintContext(ast: WorkflowAST): LintContext {
  /**
   * Resolves upstream through Reroute nodes transparently.
   */
  const resolveUpstream = (
    nodeId: number,
    inputName: string,
    depth = 0
  ): WorkflowNode | null => {
    if (depth > 20) return null; // Prevent infinite loops

    const node = ast.nodes.get(nodeId);
    if (!node) return null;

    const input = node.inputs.find((i) => i.name === inputName);
    if (!input?.connectedNodeId) return null;

    const upstreamNode = ast.nodes.get(input.connectedNodeId);
    if (!upstreamNode) return null;

    // Pass through Reroute nodes transparently
    const upstreamType = upstreamNode.type.toLowerCase();
    if (upstreamType.includes('reroute')) {
      // Reroute nodes typically have one input
      if (upstreamNode.inputs.length > 0) {
        return resolveUpstream(
          upstreamNode.id,
          upstreamNode.inputs[0].name,
          depth + 1
        );
      }
    }

    return upstreamNode;
  };

  /**
   * Finds all nodes matching a type pattern.
   */
  const findNodesByType = (pattern: RegExp): WorkflowNode[] => {
    const results: WorkflowNode[] = [];
    for (const node of ast.nodes.values()) {
      if (pattern.test(node.type)) {
        results.push(node);
      }
    }
    return results;
  };

  /**
   * Checks if a data path exists between two nodes (BFS).
   */
  const pathExists = (
    fromId: number,
    toId: number,
    visited = new Set<number>()
  ): boolean => {
    if (fromId === toId) return true;
    if (visited.has(fromId)) return false;
    visited.add(fromId);

    const downstreamNodes = ast.downstream.get(fromId);
    if (!downstreamNodes) return false;

    for (const nextId of downstreamNodes) {
      if (pathExists(nextId, toId, visited)) return true;
    }
    return false;
  };

  /**
   * Gets all nodes in a category.
   */
  const getNodesByCategory = (category: NodeCategory): WorkflowNode[] => {
    const nodeIds = ast.byCategory.get(category);
    if (!nodeIds) return [];
    return Array.from(nodeIds)
      .map((id) => ast.nodes.get(id))
      .filter((n): n is WorkflowNode => n !== undefined);
  };

  /**
   * Traces from a sampler to find the checkpoint loader.
   */
  const traceModelSource = (samplerId: number): WorkflowNode | null => {
    let current = resolveUpstream(samplerId, 'model');
    let depth = 0;

    while (current && depth < 15) {
      const type = current.type.toLowerCase();

      // Found checkpoint loader
      if (type.includes('checkpoint') || type.includes('diffusionmodel')) {
        return current;
      }

      // Continue through LoRA/model modifier chains
      if (
        type.includes('lora') ||
        type.includes('hypernetwork') ||
        type.includes('model')
      ) {
        current = resolveUpstream(current.id, 'model');
        depth++;
      } else {
        break;
      }
    }

    return null;
  };

  // -------------------------------------------------------------------------
  // Extract Prompts
  // -------------------------------------------------------------------------
  const prompts: { positive: string[]; negative: string[] } = {
    positive: [],
    negative: [],
  };

  const conditioningNodes = getNodesByCategory('conditioning');
  for (const node of conditioningNodes) {
    const type = node.type.toLowerCase();
    if (!type.includes('textencode') && !type.includes('clip')) continue;

    // Find text widget
    const textWidget = node.widgets.find(
      (w) => typeof w.value === 'string' && (w.value as string).length > 3
    );

    if (textWidget && typeof textWidget.value === 'string') {
      const title = (node.title || '').toLowerCase();
      const promptText = textWidget.value;

      // Classify as positive or negative based on title/type
      if (title.includes('negative') || title.includes('neg')) {
        prompts.negative.push(promptText);
      } else {
        prompts.positive.push(promptText);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Extract Parameters
  // -------------------------------------------------------------------------
  const parameters: ExtractedParameters = {};

  const samplerNodes = getNodesByCategory('sampling');
  for (const node of samplerNodes) {
    // Try to extract from widgets
    for (const widget of node.widgets) {
      const { name, value } = widget;

      // Named widget matching
      if (name) {
        const n = name.toLowerCase();
        if (n === 'seed' && !parameters.seed) {
          parameters.seed = String(value);
        } else if (n === 'steps' && !parameters.steps && typeof value === 'number') {
          parameters.steps = value;
        } else if (n === 'cfg' && !parameters.cfg && typeof value === 'number') {
          parameters.cfg = value;
        } else if ((n === 'sampler_name' || n === 'sampler') && !parameters.sampler) {
          parameters.sampler = String(value);
        } else if (n === 'scheduler' && !parameters.scheduler) {
          parameters.scheduler = String(value);
        } else if (n === 'denoise' && !parameters.denoise && typeof value === 'number') {
          parameters.denoise = value;
        }
        continue;
      }

      // Heuristic extraction for unnamed widgets
      if (typeof value === 'number') {
        if (value > 1000000000 && !parameters.seed) {
          parameters.seed = String(value);
        } else if (
          value >= 1 &&
          value <= 200 &&
          Number.isInteger(value) &&
          !parameters.steps
        ) {
          parameters.steps = value;
        } else if (value > 0 && value <= 30 && !parameters.cfg) {
          parameters.cfg = value;
        } else if (value >= 0 && value <= 1 && !parameters.denoise) {
          parameters.denoise = value;
        }
      }

      if (typeof value === 'string') {
        const s = value.toLowerCase();
        if (
          ['euler', 'dpm', 'ddim', 'uni_pc', 'lms', 'heun', 'deis'].some((t) =>
            s.includes(t)
          ) &&
          !parameters.sampler
        ) {
          parameters.sampler = value;
        }
        if (
          ['normal', 'karras', 'exponential', 'simple', 'sgm', 'beta'].some((t) =>
            s.includes(t)
          ) &&
          !parameters.scheduler
        ) {
          parameters.scheduler = value;
        }
      }
    }
  }

  // Extract model name from checkpoint loaders
  const modelNodes = getNodesByCategory('model');
  for (const node of modelNodes) {
    const type = node.type.toLowerCase();
    if (!type.includes('checkpoint') && !type.includes('loader')) continue;

    for (const widget of node.widgets) {
      if (typeof widget.value === 'string') {
        const val = widget.value;
        if (val.match(/\.(safetensors|ckpt|pt|pth|bin)$/i)) {
          parameters.modelName = val;
          break;
        }
      }
    }
    if (parameters.modelName) break;
  }

  // Extract VAE name
  const vaeNodes = getNodesByCategory('vae');
  for (const node of vaeNodes) {
    const type = node.type.toLowerCase();
    if (!type.includes('loader')) continue;

    for (const widget of node.widgets) {
      if (typeof widget.value === 'string') {
        const val = widget.value;
        if (val.match(/\.(safetensors|pt|vae)$/i) || val.toLowerCase().includes('vae')) {
          parameters.vaeName = val;
          break;
        }
      }
    }
    if (parameters.vaeName) break;
  }

  return {
    ast,
    prompts,
    parameters,
    resolveUpstream,
    findNodesByType,
    pathExists,
    getNodesByCategory,
    traceModelSource,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Counts nodes by category in a workflow.
 */
export function countNodesByCategory(
  ast: WorkflowAST
): Record<NodeCategory, number> {
  const counts: Record<NodeCategory, number> = {
    sampling: 0,
    model: 0,
    vae: 0,
    conditioning: 0,
    latent: 0,
    image: 0,
    control: 0,
    utility: 0,
    unknown: 0,
  };

  for (const [category, nodeIds] of ast.byCategory) {
    counts[category] = nodeIds.size;
  }

  return counts;
}

/**
 * Gets a summary of the workflow structure.
 */
export function getWorkflowSummary(ast: WorkflowAST): {
  nodeCount: number;
  linkCount: number;
  categories: Record<NodeCategory, number>;
  hasSampler: boolean;
  hasCheckpoint: boolean;
  hasVAE: boolean;
} {
  const categories = countNodesByCategory(ast);

  return {
    nodeCount: ast.nodes.size,
    linkCount: ast.links.size,
    categories,
    hasSampler: categories.sampling > 0,
    hasCheckpoint: categories.model > 0,
    hasVAE: categories.vae > 0,
  };
}

/**
 * Validates that an AST is usable for linting.
 */
export function validateAST(ast: WorkflowAST): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (ast.nodes.size === 0) {
    errors.push('Workflow contains no nodes');
  }

  // Check for basic workflow structure
  const summary = getWorkflowSummary(ast);

  if (!summary.hasSampler) {
    errors.push('No sampler node detected - workflow may be incomplete');
  }

  if (!summary.hasCheckpoint) {
    errors.push('No checkpoint loader detected - workflow may be incomplete');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
