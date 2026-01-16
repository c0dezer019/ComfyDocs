/**
 * ComfyDocs Performance Rules
 *
 * Lint rules for detecting workflow efficiency issues.
 * These rules identify patterns that may cause slow generation,
 * excessive VRAM usage, or suboptimal resource utilization.
 */

import {
  LintRule,
  GlobalLintRule,
  LintDiagnostic,
  WorkflowNode,
  LintContext,
} from '@/lib/lintTypes';
import { createDiagnostic, defineRule } from '@/utils/lintEngine';

// ============================================================================
// BATCH SIZE RULES
// ============================================================================

/**
 * Rule: Large batch size may cause VRAM issues.
 */
export const largeBatchSizeRule = defineRule({
  id: 'performance/large-batch',
  name: 'Large Batch Size',
  severity: 'warning',
  category: 'performance',
  appliesTo: ['emptylatentimage', 'latent', 'ksampler', 'sampler'],
  defaultEnabled: true,
  rationale:
    'Large batch sizes multiply VRAM usage. Batches over 4 may cause out-of-memory errors on consumer GPUs.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    const batchWidget = node.widgets.find(
      (w) => w.name === 'batch_size' && typeof w.value === 'number'
    );

    if (!batchWidget || typeof batchWidget.value !== 'number') return null;

    const batchSize = batchWidget.value;
    const isSDXL = context.parameters.modelName?.toLowerCase().includes('xl');

    // Thresholds depend on model
    const warningThreshold = isSDXL ? 2 : 4;
    const errorThreshold = isSDXL ? 4 : 8;

    if (batchSize <= warningThreshold) return null;

    const severity = batchSize >= errorThreshold ? 'error' : 'warning';

    return createDiagnostic(
      this,
      node,
      `Batch size of ${batchSize} is high${isSDXL ? ' for SDXL' : ''}. This multiplies VRAM usage and may cause out-of-memory errors.`,
      {
        severity,
        offendingParameter: {
          name: 'batch_size',
          value: batchSize,
          validRange: { min: 1, max: warningThreshold },
        },
        suggestedFix: {
          action: 'change_parameter',
          description: `Reduce batch size to ${warningThreshold} or lower to prevent VRAM issues.`,
          confidence: 'high',
          newValue: 1,
        },
        educationalContext: {
          summary:
            'Batch size determines how many images generate simultaneously. Each image in the batch uses additional VRAM proportionally.',
        },
      }
    );
  },
});

// ============================================================================
// RESOLUTION EFFICIENCY RULES
// ============================================================================

/**
 * Rule: Non-standard resolution may cause inefficiency.
 */
export const nonStandardResolutionRule = defineRule({
  id: 'performance/non-standard-resolution',
  name: 'Non-Standard Resolution',
  severity: 'info',
  category: 'performance',
  appliesTo: ['emptylatentimage', 'latent'],
  defaultEnabled: true,
  rationale:
    'Resolutions not divisible by 64 or 8 may cause padding and reduce efficiency.',

  check(node: WorkflowNode, _context: LintContext): LintDiagnostic | null {
    const widthWidget = node.widgets.find((w) => w.name === 'width');
    const heightWidget = node.widgets.find((w) => w.name === 'height');

    if (!widthWidget || !heightWidget) return null;

    const width = widthWidget.value as number;
    const height = heightWidget.value as number;

    if (typeof width !== 'number' || typeof height !== 'number') return null;

    // Check divisibility by 64 (optimal) or 8 (minimum)
    const widthMod64 = width % 64;
    const heightMod64 = height % 64;
    const widthMod8 = width % 8;
    const heightMod8 = height % 8;

    if (widthMod8 !== 0 || heightMod8 !== 0) {
      return createDiagnostic(
        this,
        node,
        `Resolution ${width}x${height} is not divisible by 8. This will cause errors or padding.`,
        {
          severity: 'warning',
          offendingParameter: {
            name: 'dimensions',
            value: `${width}x${height}`,
          },
          suggestedFix: {
            action: 'change_parameter',
            description: `Use ${Math.round(width / 8) * 8}x${Math.round(height / 8) * 8} instead.`,
            confidence: 'high',
          },
          educationalContext: {
            summary:
              'Latent space operates in 8x8 pixel blocks. Resolutions not divisible by 8 require padding.',
          },
        }
      );
    }

    if (widthMod64 !== 0 || heightMod64 !== 0) {
      return createDiagnostic(
        this,
        node,
        `Resolution ${width}x${height} is not divisible by 64. This is valid but may be slightly less efficient.`,
        {
          offendingParameter: {
            name: 'dimensions',
            value: `${width}x${height}`,
          },
          suggestedFix: {
            action: 'change_parameter',
            description: `Consider ${Math.round(width / 64) * 64}x${Math.round(height / 64) * 64} for optimal efficiency.`,
            confidence: 'low',
          },
          educationalContext: {
            summary:
              'Resolutions divisible by 64 align better with model attention patterns.',
          },
        }
      );
    }

    return null;
  },
});

/**
 * Rule: Very high resolution may be slow or fail.
 */
export const veryHighResolutionRule = defineRule({
  id: 'performance/very-high-resolution',
  name: 'Very High Resolution',
  severity: 'warning',
  category: 'performance',
  appliesTo: ['emptylatentimage', 'latent'],
  defaultEnabled: true,
  rationale:
    'Very high resolutions require exponentially more VRAM and computation time.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    const widthWidget = node.widgets.find((w) => w.name === 'width');
    const heightWidget = node.widgets.find((w) => w.name === 'height');

    if (!widthWidget || !heightWidget) return null;

    const width = widthWidget.value as number;
    const height = heightWidget.value as number;

    if (typeof width !== 'number' || typeof height !== 'number') return null;

    const totalPixels = width * height;
    const isSDXL = context.parameters.modelName?.toLowerCase().includes('xl');

    // Thresholds
    const warningThreshold = isSDXL ? 1.5 * 1024 * 1024 : 1024 * 1024; // 1.5MP for SDXL, 1MP for SD1.5
    const errorThreshold = isSDXL ? 4 * 1024 * 1024 : 2 * 1024 * 1024;

    if (totalPixels <= warningThreshold) return null;

    const mpx = (totalPixels / 1000000).toFixed(1);
    const severity = totalPixels >= errorThreshold ? 'error' : 'warning';
    const nativeRes = isSDXL ? '1024x1024' : '512x512';

    return createDiagnostic(
      this,
      node,
      `Resolution ${width}x${height} (${mpx} MP) is very high${isSDXL ? ' even for SDXL' : ''}. Consider generating at ${nativeRes} and upscaling.`,
      {
        severity,
        offendingParameter: {
          name: 'dimensions',
          value: `${width}x${height}`,
        },
        suggestedFix: {
          action: 'change_parameter',
          description: `Generate at native resolution (${nativeRes}) and use an upscaler for larger sizes.`,
          confidence: 'high',
        },
        educationalContext: {
          summary:
            'VRAM usage scales with resolution. Generating large then upscaling is more efficient and often produces better results.',
        },
      }
    );
  },
});

// ============================================================================
// WORKFLOW STRUCTURE RULES
// ============================================================================

/**
 * Rule: Multiple redundant model loads.
 */
export const redundantModelLoadsRule: GlobalLintRule = {
  id: 'performance/redundant-model-loads',
  name: 'Multiple Model Loads',
  severity: 'info',
  category: 'performance',
  isGlobal: true,
  defaultEnabled: true,
  rationale:
    'Loading the same checkpoint multiple times wastes VRAM. Use a single loader and branch the output.',

  check(context: LintContext): LintDiagnostic[] {
    const checkpointNodes = context.findNodesByType(/checkpointloader/i);

    if (checkpointNodes.length <= 1) return [];

    // Check if they load the same model
    const modelNames = new Map<string, WorkflowNode[]>();

    for (const node of checkpointNodes) {
      const ckptWidget = node.widgets.find(
        (w) => w.name === 'ckpt_name' && typeof w.value === 'string'
      );

      if (ckptWidget && typeof ckptWidget.value === 'string') {
        const name = ckptWidget.value.toLowerCase();
        if (!modelNames.has(name)) {
          modelNames.set(name, []);
        }
        modelNames.get(name)!.push(node);
      }
    }

    const diagnostics: LintDiagnostic[] = [];

    for (const [modelName, nodes] of modelNames.entries()) {
      if (nodes.length > 1) {
        diagnostics.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: 'warning',
          category: 'performance',
          nodeId: nodes[0].id,
          nodeType: nodes[0].type,
          message: `Checkpoint "${modelName}" is loaded ${nodes.length} times. Consider using a single loader.`,
          suggestedFix: {
            action: 'refactor',
            description:
              'Remove duplicate checkpoint loaders and branch the outputs from a single loader.',
            confidence: 'medium',
          },
          educationalContext: {
            summary:
              'Each checkpoint loader holds model weights in VRAM. Multiple loads of the same model waste memory.',
          },
        });
      }
    }

    // Also warn if there are many different checkpoint loads
    if (modelNames.size > 2) {
      diagnostics.push({
        ruleId: this.id,
        ruleName: this.name,
        severity: 'info',
        category: 'performance',
        nodeId: checkpointNodes[0].id,
        nodeType: checkpointNodes[0].type,
        message: `Workflow loads ${modelNames.size} different checkpoints. This may exceed available VRAM.`,
        suggestedFix: {
          action: 'refactor',
          description:
            'Consider sequential execution or reducing the number of simultaneous models.',
          confidence: 'low',
        },
        educationalContext: {
          summary:
            'Multiple checkpoints in memory multiply VRAM requirements. Some workflows may need model unloading.',
        },
      });
    }

    return diagnostics;
  },
};

/**
 * Rule: Unused nodes in workflow.
 */
export const unusedNodesRule: GlobalLintRule = {
  id: 'performance/unused-nodes',
  name: 'Unused Nodes Detected',
  severity: 'info',
  category: 'performance',
  isGlobal: true,
  defaultEnabled: true,
  rationale:
    'Nodes not connected to the output chain waste computation and memory.',

  check(context: LintContext): LintDiagnostic[] {
    // Find nodes that have no downstream connections AND don't contribute to output
    const diagnostics: LintDiagnostic[] = [];

    // Nodes with no outputs going anywhere
    for (const [nodeId, node] of context.ast.nodes.entries()) {
      const downstream = context.ast.downstream.get(nodeId);
      const upstream = context.ast.upstream.get(nodeId);

      // Skip if this node has downstream connections
      if (downstream && downstream.size > 0) continue;

      // Skip known output nodes
      const type = node.type.toLowerCase();
      if (
        type.includes('saveimage') ||
        type.includes('preview') ||
        type.includes('output') ||
        type.includes('display')
      ) {
        continue;
      }

      // Skip if this is a note or comment node
      if (type.includes('note') || type.includes('comment') || type.includes('reroute')) {
        continue;
      }

      // If it has upstream but no downstream, it's unused
      if (upstream && upstream.size > 0) {
        diagnostics.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: 'info',
          category: 'performance',
          nodeId,
          nodeType: node.type,
          message: `Node "${node.title || node.type}" (#${nodeId}) has no downstream connections and may be unused.`,
          suggestedFix: {
            action: 'remove_node',
            description:
              'Remove this node if it\'s not needed, or connect its output to continue the chain.',
            confidence: 'low',
          },
          educationalContext: {
            summary:
              'Nodes not connected to outputs are still computed but their results are discarded.',
          },
        });
      }
    }

    return diagnostics;
  },
};

// ============================================================================
// UPSCALING RULES
// ============================================================================

/**
 * Rule: Multiple upscale passes may be slow.
 */
export const multipleUpscalesRule: GlobalLintRule = {
  id: 'performance/multiple-upscales',
  name: 'Multiple Upscale Passes',
  severity: 'info',
  category: 'performance',
  isGlobal: true,
  defaultEnabled: true,
  rationale:
    'Multiple upscaling passes increase computation time. Consider single-pass upscaling for efficiency.',

  check(context: LintContext): LintDiagnostic[] {
    const upscaleNodes = context.findNodesByType(/upscale|esrgan|realsr|swinir/i);

    if (upscaleNodes.length <= 1) return [];

    // Check if they're in sequence (chained)
    let chainLength = 0;
    const visited = new Set<number>();

    const countChain = (nodeId: number): number => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);

      const node = context.ast.nodes.get(nodeId);
      if (!node) return 0;

      const isUpscale = /upscale|esrgan|realsr|swinir/i.test(node.type);
      if (!isUpscale) return 0;

      let maxDownstream = 0;
      const downstream = context.ast.downstream.get(nodeId);
      if (downstream) {
        for (const downId of downstream) {
          maxDownstream = Math.max(maxDownstream, countChain(downId));
        }
      }

      return 1 + maxDownstream;
    };

    for (const node of upscaleNodes) {
      chainLength = Math.max(chainLength, countChain(node.id));
    }

    if (chainLength >= 2) {
      return [
        {
          ruleId: this.id,
          ruleName: this.name,
          severity: 'info',
          category: 'performance',
          nodeId: upscaleNodes[0].id,
          nodeType: upscaleNodes[0].type,
          message: `${chainLength} upscale operations detected in sequence. This multiplies processing time.`,
          suggestedFix: {
            action: 'refactor',
            description:
              'Consider a single higher-factor upscale instead of multiple passes.',
            confidence: 'low',
          },
          educationalContext: {
            summary:
              'Chained 2x upscales (2x -> 2x = 4x) are slower than a single 4x upscale. However, multi-pass can sometimes produce better quality.',
          },
        },
      ];
    }

    return [];
  },
};

// ============================================================================
// SAMPLER EFFICIENCY RULES
// ============================================================================

/**
 * Rule: Inefficient sampler for the number of steps.
 */
export const inefficientSamplerRule = defineRule({
  id: 'performance/inefficient-sampler',
  name: 'Potentially Inefficient Sampler',
  severity: 'info',
  category: 'performance',
  appliesTo: ['ksampler', 'sampler'],
  defaultEnabled: true,
  rationale:
    'Some samplers converge faster than others. Using a slow sampler with few steps or a fast sampler with many steps is inefficient.',

  check(node: WorkflowNode, _context: LintContext): LintDiagnostic | null {
    const samplerWidget = node.widgets.find(
      (w) => w.name === 'sampler_name' || w.name === 'sampler'
    );
    const stepsWidget = node.widgets.find((w) => w.name === 'steps');

    if (!samplerWidget || !stepsWidget) return null;

    const sampler = String(samplerWidget.value || '').toLowerCase();
    const steps = stepsWidget.value as number;

    if (typeof steps !== 'number') return null;

    // Fast samplers with many steps
    const fastSamplers = ['euler', 'euler_ancestral', 'heun', 'lms'];
    const isFastSampler = fastSamplers.some((s) => sampler.includes(s));

    if (isFastSampler && steps > 40) {
      return createDiagnostic(
        this,
        node,
        `Using fast sampler "${sampler}" with ${steps} steps. Consider DPM++ 2M for better quality at high step counts.`,
        {
          offendingParameter: {
            name: 'sampler_name',
            value: sampler,
          },
          suggestedFix: {
            action: 'change_parameter',
            description:
              'Use DPM++ 2M or DPM++ 2M SDE for better results at higher step counts.',
            confidence: 'low',
          },
          educationalContext: {
            summary:
              'Euler-family samplers converge quickly but don\'t improve much beyond 30 steps. DPM++ samplers can benefit from more steps.',
          },
        }
      );
    }

    // Slow samplers with few steps
    const slowSamplers = ['dpm_adaptive', 'dpmpp_sde', 'dpm2_a'];
    const isSlowSampler = slowSamplers.some((s) => sampler.includes(s));

    if (isSlowSampler && steps < 15) {
      return createDiagnostic(
        this,
        node,
        `Using quality sampler "${sampler}" with only ${steps} steps. Consider Euler or LCM sampler for speed.`,
        {
          offendingParameter: {
            name: 'steps',
            value: steps,
            validRange: { min: 20, max: 150 },
          },
          suggestedFix: {
            action: 'change_parameter',
            description:
              'Either increase steps to 20+ or use a faster sampler like Euler for quick previews.',
            confidence: 'low',
          },
          educationalContext: {
            summary:
              'Higher-quality samplers need more steps to shine. For quick iterations, faster samplers are more efficient.',
          },
        }
      );
    }

    return null;
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * All performance-related lint rules.
 */
export const performanceRules: Array<LintRule | GlobalLintRule> = [
  largeBatchSizeRule,
  nonStandardResolutionRule,
  veryHighResolutionRule,
  redundantModelLoadsRule,
  unusedNodesRule,
  multipleUpscalesRule,
  inefficientSamplerRule,
];
