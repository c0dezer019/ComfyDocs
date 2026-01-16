/**
 * ComfyDocs Sampling Rules
 *
 * Lint rules for KSampler and sampling-related nodes.
 * These rules check for common parameter misconfigurations that
 * affect image quality.
 */

import {
  LintRule,
  LintDiagnostic,
  WorkflowNode,
  LintContext,
} from '@/lib/lintTypes';
import { createDiagnostic, defineRule } from '@/utils/lintEngine';

// ============================================================================
// CFG SCALE RULES
// ============================================================================

/**
 * Rule: CFG scale too high causes oversaturation and burnt colors.
 */
export const cfgTooHighRule = defineRule({
  id: 'sampling/cfg-too-high',
  name: 'CFG Scale Too High',
  severity: 'warning',
  category: 'sampling',
  appliesTo: ['ksampler', 'sampler'],
  defaultEnabled: true,
  rationale:
    'CFG values above 12-15 often cause oversaturation, "burnt" colors, and artifacts. SDXL models are particularly sensitive to high CFG.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    // Find CFG widget - typically a number between 1 and 30
    const cfgWidget = node.widgets.find((w) => {
      if (w.name === 'cfg') return true;
      if (typeof w.value !== 'number') return false;
      // Heuristic: CFG is typically between 1 and 30
      return w.value > 1 && w.value <= 30 && !Number.isInteger(w.value) === false;
    });

    if (!cfgWidget || typeof cfgWidget.value !== 'number') return null;

    const cfg = cfgWidget.value;

    // Determine model type for threshold
    const isSDXL = context.parameters.modelName?.toLowerCase().includes('xl');
    const threshold = isSDXL ? 10 : 15;
    const criticalThreshold = isSDXL ? 15 : 25;

    if (cfg <= threshold) return null;

    const severity = cfg >= criticalThreshold ? 'error' : 'warning';

    return createDiagnostic(this, node,
      `CFG scale of ${cfg} is ${cfg >= criticalThreshold ? 'very ' : ''}high. ` +
      `For ${isSDXL ? 'SDXL' : 'SD 1.5'} models, values above ${threshold} often cause quality issues.`,
      {
        severity,
        offendingParameter: {
          name: 'cfg',
          value: cfg,
          expectedType: 'number',
          validRange: { min: 1, max: threshold },
        },
        suggestedFix: {
          action: 'change_parameter',
          description: `Lower CFG to ${threshold - 3}-${threshold} for more natural results with fewer artifacts.`,
          confidence: 'high',
          newValue: threshold - 2,
        },
        educationalContext: {
          summary:
            'High CFG forces the model to follow the prompt more strictly, but causes oversaturation and artifacts.',
          detailKey: `cfg-high-${isSDXL ? 'sdxl' : 'sd15'}`,
          docUrls: ['https://comfyanonymous.github.io/ComfyUI_examples/'],
        },
      }
    );
  },
});

/**
 * Rule: CFG scale too low may produce unfocused results.
 */
export const cfgTooLowRule = defineRule({
  id: 'sampling/cfg-too-low',
  name: 'CFG Scale Too Low',
  severity: 'info',
  category: 'sampling',
  appliesTo: ['ksampler', 'sampler'],
  defaultEnabled: true,
  rationale:
    'CFG values below 4-5 give the model more creative freedom but may produce images that diverge from the prompt.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    const cfgWidget = node.widgets.find((w) => {
      if (w.name === 'cfg') return true;
      if (typeof w.value !== 'number') return false;
      return w.value >= 1 && w.value <= 30;
    });

    if (!cfgWidget || typeof cfgWidget.value !== 'number') return null;

    const cfg = cfgWidget.value;
    const threshold = 4;

    if (cfg >= threshold) return null;

    return createDiagnostic(this, node,
      `CFG scale of ${cfg} is low. The image may not follow the prompt closely.`,
      {
        offendingParameter: {
          name: 'cfg',
          value: cfg,
          validRange: { min: 4, max: 15 },
        },
        suggestedFix: {
          action: 'change_parameter',
          description: 'Increase CFG to 6-8 for better prompt adherence while maintaining quality.',
          confidence: 'medium',
          newValue: 7,
        },
        educationalContext: {
          summary:
            'Low CFG allows more creative variation but may produce results that ignore prompt details.',
        },
      }
    );
  },
});

// ============================================================================
// STEPS RULES
// ============================================================================

/**
 * Rule: Step count too low produces noisy/incomplete images.
 */
export const stepsTooLowRule = defineRule({
  id: 'sampling/steps-too-low',
  name: 'Insufficient Sampling Steps',
  severity: 'warning',
  category: 'sampling',
  appliesTo: ['ksampler', 'sampler'],
  defaultEnabled: true,
  rationale:
    'Too few sampling steps result in noisy, unfinished images. Most samplers need at least 15-20 steps for coherent results.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    const stepsWidget = node.widgets.find((w) => {
      if (w.name === 'steps') return true;
      if (typeof w.value !== 'number') return false;
      return w.value >= 1 && w.value <= 500 && Number.isInteger(w.value);
    });

    if (!stepsWidget || typeof stepsWidget.value !== 'number') return null;

    const steps = stepsWidget.value;
    const sampler = (context.parameters.sampler || '').toLowerCase();

    // Minimum steps vary by sampler
    let minSteps = 20;
    if (sampler.includes('dpm') || sampler.includes('ddim')) {
      minSteps = 15;
    } else if (sampler.includes('lcm') || sampler.includes('turbo')) {
      minSteps = 4; // LCM/Turbo samplers work with fewer steps
    }

    if (steps >= minSteps) return null;

    const severity = steps < 10 ? 'warning' : 'info';

    return createDiagnostic(this, node,
      `Step count of ${steps} may be too low for ${sampler || 'this sampler'}. ` +
      `Consider using at least ${minSteps} steps for coherent results.`,
      {
        severity,
        offendingParameter: {
          name: 'steps',
          value: steps,
          validRange: { min: minSteps, max: 150 },
        },
        suggestedFix: {
          action: 'change_parameter',
          description: `Increase steps to ${minSteps}-${minSteps + 10} for better image quality.`,
          confidence: 'high',
          newValue: minSteps,
        },
        educationalContext: {
          summary:
            'Each step refines the image. Too few steps leave visible noise and incomplete details.',
          detailKey: 'steps-low',
        },
      }
    );
  },
});

/**
 * Rule: Excessive step count wastes computation without benefit.
 */
export const stepsTooHighRule = defineRule({
  id: 'sampling/steps-excessive',
  name: 'Excessive Sampling Steps',
  severity: 'info',
  category: 'sampling',
  appliesTo: ['ksampler', 'sampler'],
  defaultEnabled: true,
  rationale:
    'Beyond a certain point, additional steps provide diminishing returns. Most images converge by 30-50 steps.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    const stepsWidget = node.widgets.find((w) => {
      if (w.name === 'steps') return true;
      if (typeof w.value !== 'number') return false;
      return w.value >= 1 && w.value <= 500 && Number.isInteger(w.value);
    });

    if (!stepsWidget || typeof stepsWidget.value !== 'number') return null;

    const steps = stepsWidget.value;
    const sampler = (context.parameters.sampler || '').toLowerCase();

    // Maximum useful steps vary by sampler
    let maxUsefulSteps = 50;
    if (sampler.includes('euler') && !sampler.includes('ancestral')) {
      maxUsefulSteps = 40;
    } else if (sampler.includes('dpm')) {
      maxUsefulSteps = 35;
    }

    if (steps <= maxUsefulSteps) return null;

    return createDiagnostic(this, node,
      `Step count of ${steps} is higher than typically useful for ${sampler || 'this sampler'}. ` +
      `${maxUsefulSteps} steps is usually sufficient.`,
      {
        offendingParameter: {
          name: 'steps',
          value: steps,
          validRange: { min: 15, max: maxUsefulSteps },
        },
        suggestedFix: {
          action: 'change_parameter',
          description: `Consider reducing steps to ${maxUsefulSteps} to save computation time without quality loss.`,
          confidence: 'low',
          newValue: maxUsefulSteps,
        },
        educationalContext: {
          summary:
            'After convergence, additional steps add computation time without improving the image.',
        },
      }
    );
  },
});

// ============================================================================
// DENOISE RULES
// ============================================================================

/**
 * Rule: Very high denoise in img2img effectively ignores the input.
 */
export const denoiseHighRule = defineRule({
  id: 'sampling/denoise-high',
  name: 'High Denoise Strength',
  severity: 'info',
  category: 'sampling',
  appliesTo: ['ksampler', 'sampler'],
  defaultEnabled: true,
  rationale:
    'Denoise controls how much of the input image is preserved. Values above 0.9 replace most of the input.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    const denoiseWidget = node.widgets.find((w) => {
      if (w.name === 'denoise') return true;
      if (typeof w.value !== 'number') return false;
      return w.value >= 0 && w.value <= 1;
    });

    if (!denoiseWidget || typeof denoiseWidget.value !== 'number') return null;

    const denoise = denoiseWidget.value;

    // Only flag if it's high but not exactly 1.0 (which is intentional txt2img)
    if (denoise < 0.9 || denoise === 1.0) return null;

    return createDiagnostic(this, node,
      `Denoise strength of ${denoise.toFixed(2)} is very high. Most of the input image will be replaced.`,
      {
        offendingParameter: {
          name: 'denoise',
          value: denoise,
          validRange: { min: 0, max: 1 },
        },
        suggestedFix: {
          action: 'change_parameter',
          description:
            'Use denoise 0.5-0.75 to preserve more of the original composition, or 1.0 for full txt2img.',
          confidence: 'low',
          newValue: 0.7,
        },
        educationalContext: {
          summary:
            'High denoise is useful for major changes but may not preserve desired details from the input.',
          detailKey: 'denoise-high',
        },
      }
    );
  },
});

/**
 * Rule: Very low denoise may not produce visible changes.
 */
export const denoiseLowRule = defineRule({
  id: 'sampling/denoise-low',
  name: 'Low Denoise Strength',
  severity: 'info',
  category: 'sampling',
  appliesTo: ['ksampler', 'sampler'],
  defaultEnabled: true,
  rationale:
    'Very low denoise values may not produce noticeable changes to the input image.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    const denoiseWidget = node.widgets.find((w) => {
      if (w.name === 'denoise') return true;
      if (typeof w.value !== 'number') return false;
      return w.value >= 0 && w.value <= 1;
    });

    if (!denoiseWidget || typeof denoiseWidget.value !== 'number') return null;

    const denoise = denoiseWidget.value;

    // Only flag if it's very low but not exactly 0 (which might be intentional bypass)
    if (denoise >= 0.2 || denoise === 0) return null;

    return createDiagnostic(this, node,
      `Denoise strength of ${denoise.toFixed(2)} is very low. Changes to the image will be minimal.`,
      {
        offendingParameter: {
          name: 'denoise',
          value: denoise,
        },
        suggestedFix: {
          action: 'change_parameter',
          description:
            'Increase denoise to at least 0.3-0.4 for noticeable changes.',
          confidence: 'medium',
          newValue: 0.4,
        },
        educationalContext: {
          summary:
            'Low denoise makes subtle refinements. If no visible change is desired, consider if this step is needed.',
        },
      }
    );
  },
});

// ============================================================================
// SAMPLER/SCHEDULER COMBINATION RULES
// ============================================================================

/**
 * Rule: Certain sampler/scheduler combinations are suboptimal.
 */
export const samplerSchedulerMismatchRule = defineRule({
  id: 'sampling/sampler-scheduler-mismatch',
  name: 'Suboptimal Sampler/Scheduler Combination',
  severity: 'info',
  category: 'sampling',
  appliesTo: ['ksampler', 'sampler'],
  defaultEnabled: true,
  rationale:
    'Some sampler and scheduler combinations work better together. Mismatched pairs may produce suboptimal results.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    const samplerWidget = node.widgets.find(
      (w) => w.name === 'sampler_name' || w.name === 'sampler'
    );
    const schedulerWidget = node.widgets.find((w) => w.name === 'scheduler');

    if (!samplerWidget || !schedulerWidget) return null;

    const sampler = String(samplerWidget.value || '').toLowerCase();
    const scheduler = String(schedulerWidget.value || '').toLowerCase();

    // Known suboptimal combinations
    const issues: Array<{
      sampler: RegExp;
      scheduler: RegExp;
      message: string;
      recommendation: string;
    }> = [
      {
        sampler: /euler.*ancestral|euler_a/,
        scheduler: /karras/,
        message: 'Euler Ancestral with Karras scheduler often produces less coherent results.',
        recommendation: 'Try "normal" or "simple" scheduler with Euler Ancestral.',
      },
      {
        sampler: /dpm.*2m|dpmpp_2m/,
        scheduler: /simple/,
        message: 'DPM++ 2M typically works better with Karras scheduler.',
        recommendation: 'Use "karras" scheduler for better results with DPM++ 2M.',
      },
      {
        sampler: /ddim/,
        scheduler: /karras|exponential/,
        message: 'DDIM is designed for uniform scheduling.',
        recommendation: 'Use "normal" or "ddim_uniform" scheduler with DDIM.',
      },
    ];

    for (const issue of issues) {
      if (issue.sampler.test(sampler) && issue.scheduler.test(scheduler)) {
        return createDiagnostic(this, node,
          `${issue.message}`,
          {
            suggestedFix: {
              action: 'change_parameter',
              description: issue.recommendation,
              confidence: 'medium',
            },
            educationalContext: {
              summary:
                'Different samplers are optimized for specific noise schedules. Matching them correctly improves results.',
            },
          }
        );
      }
    }

    return null;
  },
});

// ============================================================================
// SEED RULES
// ============================================================================

/**
 * Rule: Fixed seed with randomize control mode.
 */
export const seedControlMismatchRule = defineRule({
  id: 'sampling/seed-control-mismatch',
  name: 'Seed Control Mode Mismatch',
  severity: 'info',
  category: 'sampling',
  appliesTo: ['ksampler', 'sampler'],
  defaultEnabled: true,
  rationale:
    'The seed control mode determines whether the seed is used as-is or modified each run.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    const seedWidget = node.widgets.find((w) => w.name === 'seed');
    const controlWidget = node.widgets.find(
      (w) =>
        w.name === 'control_after_generate' &&
        typeof w.value === 'string'
    );

    if (!seedWidget || !controlWidget) return null;

    const control = String(controlWidget.value).toLowerCase();
    const seed = seedWidget.value;

    // Check for common pattern: user wants random but control is "fixed"
    if (control === 'fixed' && seed === 0) {
      return createDiagnostic(this, node,
        'Seed is 0 with "fixed" control mode. Each run will produce the same black/undefined result.',
        {
          suggestedFix: {
            action: 'change_parameter',
            description:
              'Change control mode to "randomize" for varied results, or set a non-zero seed.',
            confidence: 'medium',
          },
          educationalContext: {
            summary:
              'Seed 0 is often treated specially. Use a specific seed or enable randomization.',
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
 * All sampling-related lint rules.
 */
export const samplingRules: LintRule[] = [
  cfgTooHighRule,
  cfgTooLowRule,
  stepsTooLowRule,
  stepsTooHighRule,
  denoiseHighRule,
  denoiseLowRule,
  samplerSchedulerMismatchRule,
  seedControlMismatchRule,
];
