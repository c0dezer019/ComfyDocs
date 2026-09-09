/**
 * ComfyDocs Model & VAE Rules
 *
 * Lint rules for checkpoint loading, LoRA, VAE, and model compatibility.
 * These rules detect common issues with model configuration and compatibility.
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
// VAE COMPATIBILITY RULES
// ============================================================================

/**
 * Rule: Detects potential VAE/model mismatch (SDXL VAE with SD1.5 model or vice versa).
 */
export const vaeMismatchRule = defineRule({
  id: 'model/vae-mismatch',
  name: 'Potential VAE/Model Mismatch',
  severity: 'warning',
  category: 'vae',
  appliesTo: ['vaeloader', 'vae'],
  defaultEnabled: true,
  rationale:
    'Using a VAE designed for a different model architecture (e.g., SDXL VAE with SD1.5 model) causes color shifts, artifacts, and quality degradation.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    // Find VAE name from widgets
    const vaeWidget = node.widgets.find(
      (w) =>
        typeof w.value === 'string' &&
        (w.name === 'vae_name' ||
          (w.value as string).toLowerCase().includes('vae') ||
          (w.value as string).match(/\.(safetensors|pt)$/i))
    );

    if (!vaeWidget || typeof vaeWidget.value !== 'string') return null;

    const vaeName = vaeWidget.value.toLowerCase();
    const modelName = (context.parameters.modelName || '').toLowerCase();

    // Skip if we can't determine model type
    if (!modelName) return null;

    // Detect model architecture
    const isSDXLModel =
      modelName.includes('xl') ||
      modelName.includes('sdxl') ||
      modelName.includes('pony');
    const isSD3Model = modelName.includes('sd3') || modelName.includes('stable-diffusion-3');
    const isFluxModel = modelName.includes('flux');

    // Detect VAE architecture
    const isSDXLVae =
      vaeName.includes('xl') ||
      vaeName.includes('sdxl') ||
      vaeName.includes('pony');
    const isSD3Vae = vaeName.includes('sd3');
    const isFluxVae = vaeName.includes('flux');

    // Check for mismatches
    if (isSDXLModel && !isSDXLVae && !vaeName.includes('baked')) {
      return createDiagnostic(this, node,
        `VAE "${vaeWidget.value}" may not be compatible with SDXL model "${context.parameters.modelName}".`,
        {
          offendingParameter: {
            name: 'vae_name',
            value: vaeWidget.value,
          },
          suggestedFix: {
            action: 'change_parameter',
            description:
              'Use an SDXL-compatible VAE (e.g., sdxl_vae.safetensors) or the baked-in VAE.',
            confidence: 'medium',
          },
          educationalContext: {
            summary:
              'VAEs are architecture-specific. Using SD1.5 VAE with SDXL causes color shifts and degraded quality.',
            detailKey: 'vae-sdxl-mismatch',
          },
        }
      );
    }

    if (!isSDXLModel && !isSD3Model && !isFluxModel && (isSDXLVae || isSD3Vae || isFluxVae)) {
      return createDiagnostic(this, node,
        `VAE "${vaeWidget.value}" appears to be for a different model architecture than "${context.parameters.modelName || 'SD 1.5'}".`,
        {
          offendingParameter: {
            name: 'vae_name',
            value: vaeWidget.value,
          },
          suggestedFix: {
            action: 'change_parameter',
            description:
              'Use an SD 1.5-compatible VAE (e.g., vae-ft-mse-840000-ema-pruned.safetensors).',
            confidence: 'medium',
          },
          educationalContext: {
            summary:
              'VAEs encode images to latent space. Using the wrong VAE architecture causes severe color and quality issues.',
          },
        }
      );
    }

    return null;
  },
});

// ============================================================================
// WORKFLOW STRUCTURE RULES (GLOBAL)
// ============================================================================

/**
 * Rule: No checkpoint loader in workflow.
 */
export const noCheckpointRule: GlobalLintRule = {
  id: 'model/no-checkpoint',
  name: 'Missing Checkpoint Loader',
  severity: 'error',
  category: 'model',
  isGlobal: true,
  defaultEnabled: true,
  rationale:
    'A workflow must load at least one checkpoint (model) to generate images.',

  check(context: LintContext): LintDiagnostic[] {
    const checkpointNodes = context.findNodesByType(
      /checkpoint|loadcheckpoint|diffusionmodel/i
    );

    if (checkpointNodes.length > 0) return [];

    return [
      {
        ruleId: this.id,
        ruleName: this.name,
        severity: 'error',
        category: 'model',
        nodeId: 0,
        nodeType: 'workflow',
        message:
          'No checkpoint loader found. Add a Load Checkpoint node to load a model.',
        suggestedFix: {
          action: 'add_node',
          description:
            'Add a CheckpointLoaderSimple node and connect its MODEL output to your sampler.',
          confidence: 'high',
          nodeType: 'CheckpointLoaderSimple',
        },
        educationalContext: {
          summary:
            'Checkpoints contain the trained neural network weights. Without one, no image can be generated.',
        },
      },
    ];
  },
};

/**
 * Rule: No sampler in workflow.
 */
export const noSamplerRule: GlobalLintRule = {
  id: 'workflow/no-sampler',
  name: 'Missing Sampler',
  severity: 'error',
  category: 'workflow',
  isGlobal: true,
  defaultEnabled: true,
  rationale:
    'A workflow must have a sampler (KSampler) to generate images from the model.',

  check(context: LintContext): LintDiagnostic[] {
    const samplerNodes = context.getNodesByCategory('sampling');

    if (samplerNodes.length > 0) return [];

    return [
      {
        ruleId: this.id,
        ruleName: this.name,
        severity: 'error',
        category: 'workflow',
        nodeId: 0,
        nodeType: 'workflow',
        message:
          'No sampler found. Add a KSampler node to generate images.',
        suggestedFix: {
          action: 'add_node',
          description:
            'Add a KSampler node and connect model, positive/negative conditioning, and latent image inputs.',
          confidence: 'high',
          nodeType: 'KSampler',
        },
        educationalContext: {
          summary:
            'The sampler iteratively denoises a latent image using the model to create the final image.',
        },
      },
    ];
  },
};

/**
 * Rule: Sampler not connected to model.
 */
export const samplerNotConnectedRule = defineRule({
  id: 'workflow/sampler-disconnected',
  name: 'Disconnected Sampler',
  severity: 'error',
  category: 'workflow',
  appliesTo: ['ksampler', 'sampler'],
  defaultEnabled: true,
  rationale:
    'A sampler must be connected to a model to function. Disconnected samplers will fail.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    // Check if model input is connected
    const modelInput = node.inputs.find(
      (i) => i.name.toLowerCase() === 'model'
    );

    if (!modelInput) return null; // Node might not have model input
    if (modelInput.connectedNodeId !== undefined) return null; // Connected

    return createDiagnostic(this, node,
      'Sampler is not connected to a model. Connect a checkpoint loader or model modifier.',
      {
        suggestedFix: {
          action: 'change_connection',
          description:
            'Connect the MODEL output from a CheckpointLoader to this sampler\'s model input.',
          confidence: 'high',
        },
        educationalContext: {
          summary:
            'The sampler needs model weights to know how to denoise. Without a model, generation fails.',
        },
      }
    );
  },
});

// ============================================================================
// LORA RULES
// ============================================================================

/**
 * Rule: LoRA strength is extremely high.
 */
export const loraStrengthHighRule = defineRule({
  id: 'model/lora-strength-high',
  name: 'High LoRA Strength',
  severity: 'warning',
  category: 'model',
  appliesTo: ['lora', 'loraloader'],
  defaultEnabled: true,
  rationale:
    'LoRA strengths above 1.5 often cause artifacts and over-stylization. Most LoRAs work best between 0.5-1.0.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    // Find strength widgets
    const strengthWidgets = node.widgets.filter(
      (w) =>
        typeof w.value === 'number' &&
        (w.name?.includes('strength') || (w.value >= -2 && w.value <= 3))
    );

    for (const widget of strengthWidgets) {
      const strength = widget.value as number;

      if (Math.abs(strength) > 1.5) {
        return createDiagnostic(this, node,
          `LoRA strength of ${strength.toFixed(2)} is very high and may cause artifacts or over-stylization.`,
          {
            offendingParameter: {
              name: widget.name || 'strength',
              value: strength,
              validRange: { min: -1.5, max: 1.5 },
            },
            suggestedFix: {
              action: 'change_parameter',
              description:
                'Reduce LoRA strength to 0.7-1.0 for more natural integration with the base model.',
              confidence: 'medium',
              newValue: 1.0,
            },
            educationalContext: {
              summary:
                'High LoRA strength amplifies the LoRA\'s effect but can overwhelm the base model.',
              detailKey: 'lora-strength',
            },
          }
        );
      }
    }

    return null;
  },
});

/**
 * Rule: Multiple LoRAs may conflict.
 */
export const multipleLorasRule: GlobalLintRule = {
  id: 'model/multiple-loras',
  name: 'Multiple LoRAs Detected',
  severity: 'info',
  category: 'model',
  isGlobal: true,
  defaultEnabled: true,
  rationale:
    'Using multiple LoRAs together can cause style conflicts or unexpected results.',

  check(context: LintContext): LintDiagnostic[] {
    const loraNodes = context.findNodesByType(/lora|loraloader/i);

    if (loraNodes.length <= 2) return [];

    return [
      {
        ruleId: this.id,
        ruleName: this.name,
        severity: 'info',
        category: 'model',
        nodeId: loraNodes[0].id,
        nodeType: loraNodes[0].type,
        message: `${loraNodes.length} LoRAs detected. Multiple LoRAs may conflict or require reduced individual strengths.`,
        suggestedFix: {
          action: 'change_parameter',
          description:
            'Consider reducing individual LoRA strengths (e.g., 0.5-0.7 each) to prevent over-stylization.',
          confidence: 'low',
        },
        educationalContext: {
          summary:
            'Each LoRA modifies the model. Multiple LoRAs compound their effects and may conflict.',
        },
      },
    ];
  },
};

// ============================================================================
// CLIP SKIP RULES
// ============================================================================

/**
 * Rule: CLIP skip value may not match model expectations.
 */
export const clipSkipRule = defineRule({
  id: 'model/clip-skip',
  name: 'CLIP Skip Configuration',
  severity: 'info',
  category: 'model',
  appliesTo: ['clipsetlastlayer', 'clip'],
  defaultEnabled: true,
  rationale:
    'Different models are trained with different CLIP skip values. Using the wrong value may affect prompt interpretation.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    const skipWidget = node.widgets.find(
      (w) =>
        typeof w.value === 'number' &&
        (w.name === 'stop_at_clip_layer' || (w.value >= -12 && w.value <= -1))
    );

    if (!skipWidget || typeof skipWidget.value !== 'number') return null;

    const clipSkip = Math.abs(skipWidget.value);
    const modelName = (context.parameters.modelName || '').toLowerCase();

    // Check for known model/clip skip preferences
    const isAnimeModel =
      modelName.includes('anime') ||
      modelName.includes('nai') ||
      modelName.includes('anything');
    const isPonyModel = modelName.includes('pony');

    // Anime models typically prefer clip skip 2
    if (isAnimeModel && clipSkip !== 2) {
      return createDiagnostic(this, node,
        `CLIP skip of ${clipSkip} detected with anime-style model. Most anime models are trained with CLIP skip 2.`,
        {
          offendingParameter: {
            name: 'stop_at_clip_layer',
            value: skipWidget.value,
          },
          suggestedFix: {
            action: 'change_parameter',
            description: 'Try CLIP skip 2 (-2) for better results with anime models.',
            confidence: 'medium',
            newValue: -2,
          },
          educationalContext: {
            summary:
              'CLIP skip determines which CLIP layer to use for prompt encoding. Models are trained with specific skip values.',
          },
        }
      );
    }

    // Pony models typically prefer clip skip 2
    if (isPonyModel && clipSkip !== 2) {
      return createDiagnostic(this, node,
        `CLIP skip of ${clipSkip} detected with Pony-based model. Pony models typically use CLIP skip 2.`,
        {
          offendingParameter: {
            name: 'stop_at_clip_layer',
            value: skipWidget.value,
          },
          suggestedFix: {
            action: 'change_parameter',
            description: 'Set CLIP skip to 2 (-2) for Pony-based models.',
            confidence: 'high',
            newValue: -2,
          },
          educationalContext: {
            summary:
              'Pony-based SDXL models are trained with specific CLIP configurations.',
          },
        }
      );
    }

    return null;
  },
});

// ============================================================================
// RESOLUTION RULES
// ============================================================================

/**
 * Rule: Resolution doesn't match model training resolution.
 */
export const resolutionMismatchRule = defineRule({
  id: 'model/resolution-mismatch',
  name: 'Resolution/Model Mismatch',
  severity: 'warning',
  category: 'model',
  appliesTo: ['emptylatentimage', 'latent'],
  defaultEnabled: true,
  rationale:
    'Models work best at their native training resolution. Using very different resolutions causes quality issues.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    // Find width and height widgets
    const widthWidget = node.widgets.find((w) => w.name === 'width');
    const heightWidget = node.widgets.find((w) => w.name === 'height');

    if (!widthWidget || !heightWidget) return null;

    const width = widthWidget.value as number;
    const height = heightWidget.value as number;

    if (typeof width !== 'number' || typeof height !== 'number') return null;

    const modelName = (context.parameters.modelName || '').toLowerCase();
    const isSDXL =
      modelName.includes('xl') ||
      modelName.includes('sdxl') ||
      modelName.includes('pony');

    const totalPixels = width * height;

    if (isSDXL) {
      // SDXL native: 1024x1024 = 1,048,576 pixels
      const sdxlNative = 1024 * 1024;

      if (totalPixels < sdxlNative * 0.5) {
        return createDiagnostic(this, node,
          `Resolution ${width}x${height} is small for SDXL. SDXL works best at 1024x1024 or equivalent megapixel.`,
          {
            offendingParameter: {
              name: 'dimensions',
              value: `${width}x${height}`,
            },
            suggestedFix: {
              action: 'change_parameter',
              description:
                'Use 1024x1024, 896x1152, or similar ~1 megapixel resolution for SDXL.',
              confidence: 'high',
            },
            educationalContext: {
              summary:
                'SDXL was trained at 1024x1024. Smaller resolutions may produce lower quality results.',
            },
          }
        );
      }

      if (totalPixels > sdxlNative * 2.5) {
        return createDiagnostic(this, node,
          `Resolution ${width}x${height} is very high for SDXL. Consider generating at native resolution and upscaling.`,
          {
            severity: 'info',
            offendingParameter: {
              name: 'dimensions',
              value: `${width}x${height}`,
            },
            suggestedFix: {
              action: 'change_parameter',
              description:
                'Generate at 1024x1024 and use an upscaler for larger final sizes.',
              confidence: 'medium',
            },
            educationalContext: {
              summary:
                'Very high resolutions use more VRAM and may produce artifacts. Upscaling is often more effective.',
            },
          }
        );
      }
    } else {
      // SD 1.5 native: 512x512 = 262,144 pixels
      const sd15Native = 512 * 512;

      if (totalPixels < sd15Native * 0.5) {
        return createDiagnostic(this, node,
          `Resolution ${width}x${height} is very small for SD 1.5. Results may be low quality.`,
          {
            offendingParameter: {
              name: 'dimensions',
              value: `${width}x${height}`,
            },
            suggestedFix: {
              action: 'change_parameter',
              description:
                'Use at least 512x512 for SD 1.5 models.',
              confidence: 'high',
            },
            educationalContext: {
              summary:
                'SD 1.5 was trained at 512x512. Very small resolutions produce blurry results.',
            },
          }
        );
      }

      if (totalPixels > sd15Native * 4) {
        return createDiagnostic(this, node,
          `Resolution ${width}x${height} is large for SD 1.5 without highres fix. Consider using a 2-pass generation.`,
          {
            severity: 'info',
            offendingParameter: {
              name: 'dimensions',
              value: `${width}x${height}`,
            },
            suggestedFix: {
              action: 'change_parameter',
              description:
                'Generate at 512x512-768x768 and use latent upscale or an upscaler model.',
              confidence: 'medium',
            },
            educationalContext: {
              summary:
                'SD 1.5 can struggle with high resolutions. A 2-pass approach often produces better results.',
            },
          }
        );
      }
    }

    return null;
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * All model-related lint rules.
 */
export const modelRules: Array<LintRule | GlobalLintRule> = [
  vaeMismatchRule,
  noCheckpointRule,
  noSamplerRule,
  samplerNotConnectedRule,
  loraStrengthHighRule,
  multipleLorasRule,
  clipSkipRule,
  resolutionMismatchRule,
];
