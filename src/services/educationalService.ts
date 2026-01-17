'use client';

/**
 * ComfyDocs Educational Service
 *
 * AI-powered educational content generation for lint diagnostics.
 * Provides structured "why" explanations that help users understand
 * the reasoning behind linting rules and how to fix issues effectively.
 */

import { GoogleGenAI, Type } from '@google/genai';
import {
  EducationalContent,
  EducationalFix,
  LintDiagnostic,
  EducationRequest,
} from '@/lib/lintTypes';
import {
  getCachedEducation,
  cacheEducation,
  generateEducationKey,
  detectModelFamily,
  getCachedEducationBatch,
} from '@/utils/educationCache';

// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

/**
 * Gets the API key from session storage.
 * The key is decrypted and stored there by the App component.
 */
const getApiKey = (): string => {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('gemini_api_key_decrypted') || '';
};

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Gemini response schema for educational content generation.
 * Enforces structured output for consistent parsing.
 */
const educationResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: 'Brief 1-2 sentence explanation suitable for inline display',
    },
    explanation: {
      type: Type.OBJECT,
      properties: {
        issue: {
          type: Type.STRING,
          description: 'What the issue is in plain terms',
        },
        technicalContext: {
          type: Type.STRING,
          description: 'Technical explanation of why this matters (diffusion process, model architecture, etc.)',
        },
        visualImpact: {
          type: Type.STRING,
          description: 'What visual artifacts or quality issues the user might see if this is not addressed',
        },
        exceptions: {
          type: Type.STRING,
          description: 'Scenarios where this setting might be intentional (artistic choice, specific workflow, etc.)',
        },
      },
      required: ['issue', 'technicalContext', 'visualImpact'],
    },
    fixes: {
      type: Type.ARRAY,
      description: 'Prioritized list of fixes, ordered from most to least preferred',
      items: {
        type: Type.OBJECT,
        properties: {
          priority: {
            type: Type.NUMBER,
            description: 'Priority order (1 = try first)',
          },
          category: {
            type: Type.STRING,
            enum: ['prompt', 'ksampler', 'node', 'inpaint', 'external'],
            description: 'Fix category for filtering',
          },
          title: {
            type: Type.STRING,
            description: 'One-line summary of the fix',
          },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Step-by-step instructions to implement the fix in ComfyUI',
          },
          confidence: {
            type: Type.STRING,
            enum: ['high', 'medium', 'low'],
            description: 'How confident we are this will resolve the issue',
          },
          parameterChanges: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                nodeName: { type: Type.STRING },
                parameter: { type: Type.STRING },
                currentValue: { type: Type.STRING },
                suggestedValue: { type: Type.STRING },
              },
              required: ['nodeName', 'parameter', 'suggestedValue'],
            },
            description: 'Specific parameter changes if applicable',
          },
        },
        required: ['priority', 'category', 'title', 'steps', 'confidence'],
      },
    },
    resources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          url: { type: Type.STRING },
          type: {
            type: Type.STRING,
            enum: ['docs', 'video', 'community'],
          },
        },
        required: ['title', 'url', 'type'],
      },
      description: 'Related learning resources',
    },
  },
  required: ['summary', 'explanation', 'fixes'],
};

/**
 * Batch explanation schema for multiple diagnostics.
 */
const batchEducationResponseSchema = {
  type: Type.OBJECT,
  properties: {
    explanations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ruleId: { type: Type.STRING },
          summary: { type: Type.STRING },
          explanation: {
            type: Type.OBJECT,
            properties: {
              issue: { type: Type.STRING },
              technicalContext: { type: Type.STRING },
              visualImpact: { type: Type.STRING },
              exceptions: { type: Type.STRING },
            },
            required: ['issue', 'technicalContext', 'visualImpact'],
          },
          topFix: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              title: { type: Type.STRING },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['category', 'title', 'steps'],
          },
        },
        required: ['ruleId', 'summary', 'explanation', 'topFix'],
      },
    },
  },
  required: ['explanations'],
};

// ============================================================================
// EDUCATIONAL CONTENT GENERATION
// ============================================================================

/**
 * Generates educational content for a specific lint diagnostic.
 * Results are cached to prevent redundant API calls.
 *
 * @param request - The education request containing diagnostic and context
 * @returns Structured educational content
 */
export async function generateEducationalContent(
  request: EducationRequest
): Promise<EducationalContent> {
  const { diagnostic, workflowContext } = request;

  // Generate cache key
  const modelFamily = detectModelFamily(workflowContext.modelName);
  const contentKey = generateEducationKey(diagnostic.ruleId, diagnostic.nodeType, {
    samplerType: workflowContext.samplerType,
    modelFamily,
  });

  // Check cache first
  const cached = await getCachedEducation(contentKey);
  if (cached) {
    console.debug(`[EducationalService] Cache hit for: ${contentKey}`);
    return cached;
  }

  // Get API key
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API_KEY_NOT_FOUND');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Build the prompt
  const prompt = buildEducationPrompt(diagnostic, workflowContext, modelFamily);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        temperature: 0.3, // Lower temperature for more consistent educational content
        responseMimeType: 'application/json',
        responseSchema: educationResponseSchema,
      },
    });

    if (!response.text) {
      throw new Error('Empty response from AI');
    }

    const parsed = JSON.parse(response.text);

    // Construct the EducationalContent object
    const content: EducationalContent = {
      contentKey,
      ruleId: diagnostic.ruleId,
      nodeType: diagnostic.nodeType,
      summary: parsed.summary,
      explanation: {
        issue: parsed.explanation.issue,
        technicalContext: parsed.explanation.technicalContext,
        visualImpact: parsed.explanation.visualImpact,
        exceptions: parsed.explanation.exceptions,
      },
      fixes: (parsed.fixes || []).map((fix: EducationalFix, idx: number) => ({
        priority: fix.priority || idx + 1,
        category: fix.category,
        title: fix.title,
        steps: fix.steps || [],
        confidence: fix.confidence || 'medium',
        parameterChanges: fix.parameterChanges,
      })),
      resources: parsed.resources || [],
      generatedAt: Date.now(),
      modelUsed: 'gemini-2.0-flash',
    };

    // Cache the result
    await cacheEducation(content);

    console.debug(`[EducationalService] Generated and cached: ${contentKey}`);
    return content;
  } catch (error) {
    const err = error as { message?: string };

    if (err.message?.includes('Requested entity was not found')) {
      throw new Error('API_KEY_NOT_FOUND');
    }

    console.error('[EducationalService] Generation failed:', error);
    throw new Error(`Failed to generate educational content: ${err.message || 'Unknown error'}`);
  }
}

/**
 * Builds the prompt for educational content generation.
 */
function buildEducationPrompt(
  diagnostic: LintDiagnostic,
  workflowContext: EducationRequest['workflowContext'],
  modelFamily: string
): string {
  return `
Role: Expert ComfyUI and Stable Diffusion educator. Your goal is to help users understand
WHY certain settings matter, not just WHAT to change.

A workflow lint rule has flagged the following issue:

RULE INFORMATION:
- Rule ID: ${diagnostic.ruleId}
- Rule Name: ${diagnostic.ruleName}
- Severity: ${diagnostic.severity}
- Category: ${diagnostic.category}

NODE INFORMATION:
- Node ID: ${diagnostic.nodeId}
- Node Type: ${diagnostic.nodeType}

DIAGNOSTIC MESSAGE:
${diagnostic.message}

${diagnostic.offendingParameter ? `
OFFENDING PARAMETER:
- Name: ${diagnostic.offendingParameter.name}
- Current Value: ${JSON.stringify(diagnostic.offendingParameter.value)}
${diagnostic.offendingParameter.validRange ? `- Valid Range: ${diagnostic.offendingParameter.validRange.min} - ${diagnostic.offendingParameter.validRange.max}` : ''}
` : ''}

${diagnostic.suggestedFix ? `
INITIAL SUGGESTION:
${diagnostic.suggestedFix.description}
` : ''}

WORKFLOW CONTEXT:
- Sampler: ${workflowContext.samplerType || 'Unknown'}
- Model Family: ${modelFamily}
- Model Name: ${workflowContext.modelName || 'Unknown'}
- Steps: ${workflowContext.steps || 'Unknown'}
- CFG: ${workflowContext.cfg || 'Unknown'}

YOUR TASK:
Generate comprehensive educational content that:

1. EXPLAINS the issue in plain terms a beginner can understand
2. PROVIDES technical context about WHY this matters:
   - How does this affect the diffusion process?
   - What happens internally when this parameter is wrong?
   - How does this interact with other settings?
3. DESCRIBES the visual artifacts or quality issues the user might see
4. LISTS scenarios where the current setting might be intentional:
   - Specific art styles that benefit from it
   - Special workflows where this is expected
   - Edge cases where the rule doesn't apply
5. PROVIDES prioritized fixes following this order:
   a) [prompt] Prompt changes (most preferred - show exact text to add/remove)
   b) [ksampler] Sampler/scheduler/parameter changes (specific values)
   c) [node] Node/workflow changes in ComfyUI (node names and settings)
   d) [inpaint] Inpainting solutions (only if necessary)
   e) [external] External tools (last resort, clearly marked)
6. INCLUDES relevant learning resources (ComfyUI docs, videos, forums)

Remember: Your audience is learning. Be educational, not just prescriptive.
Explain the "why" before the "how".
`;
}

// ============================================================================
// BATCH GENERATION
// ============================================================================

/**
 * Generates educational summaries for multiple diagnostics in a single API call.
 * More efficient than individual calls for displaying multiple issues.
 *
 * @param diagnostics - Array of diagnostics to explain
 * @param workflowContext - Shared workflow context
 * @returns Map of ruleId to educational summary
 */
export async function generateBatchEducationSummaries(
  diagnostics: LintDiagnostic[],
  workflowContext: EducationRequest['workflowContext']
): Promise<Map<string, { summary: string; topFix: string }>> {
  const results = new Map<string, { summary: string; topFix: string }>();

  if (diagnostics.length === 0) return results;

  // Check cache for all diagnostics first
  const modelFamily = detectModelFamily(workflowContext.modelName);
  const cacheKeys = diagnostics.map((d) =>
    generateEducationKey(d.ruleId, d.nodeType, {
      samplerType: workflowContext.samplerType,
      modelFamily,
    })
  );

  const cached = await getCachedEducationBatch(cacheKeys);

  // Populate results from cache
  const uncached: LintDiagnostic[] = [];
  for (let i = 0; i < diagnostics.length; i++) {
    const cachedContent = cached.get(cacheKeys[i]);
    if (cachedContent) {
      results.set(diagnostics[i].ruleId, {
        summary: cachedContent.summary,
        topFix: cachedContent.fixes[0]?.title || 'See detailed analysis',
      });
    } else {
      uncached.push(diagnostics[i]);
    }
  }

  // If everything was cached, return early
  if (uncached.length === 0) {
    console.debug(`[EducationalService] All ${diagnostics.length} summaries from cache`);
    return results;
  }

  // Generate for uncached diagnostics
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[EducationalService] No API key, returning partial results');
    return results;
  }

  const ai = new GoogleGenAI({ apiKey });

  // Build batch prompt
  const diagnosticsSummary = uncached.map((d, i) => `
${i + 1}. Rule: ${d.ruleId}
   Node: ${d.nodeType}
   Message: ${d.message}
   ${d.offendingParameter ? `Parameter: ${d.offendingParameter.name} = ${JSON.stringify(d.offendingParameter.value)}` : ''}
`).join('\n');

  const batchPrompt = `
Role: ComfyUI educator providing quick explanations for multiple lint issues.

Context:
- Model: ${workflowContext.modelName || 'Unknown'} (${modelFamily})
- Sampler: ${workflowContext.samplerType || 'Unknown'}

Issues to explain:
${diagnosticsSummary}

For EACH issue, provide:
1. A brief 1-sentence summary explaining WHY this matters
2. The single best fix (category and title only)

Be concise - this is for quick reference. Full explanations are available separately.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [{ text: batchPrompt }],
      },
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: batchEducationResponseSchema,
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);

      for (const exp of (parsed.explanations || [])) {
        results.set(exp.ruleId, {
          summary: exp.summary,
          topFix: exp.topFix?.title || 'See detailed analysis',
        });
      }
    }
  } catch (error) {
    console.error('[EducationalService] Batch generation failed:', error);
    // Return what we have from cache
  }

  return results;
}

// ============================================================================
// CONTEXTUAL EXPLANATIONS
// ============================================================================

/**
 * Generates a contextual explanation for a diagnostic with image context.
 * Useful for explanations that need to reference specific visual elements.
 *
 * @param diagnostic - The diagnostic to explain
 * @param imageBase64 - Base64 encoded image for visual context
 * @param workflowContext - Workflow context
 * @returns Educational content with image-aware explanations
 */
export async function generateVisualEducation(
  diagnostic: LintDiagnostic,
  imageBase64: string,
  workflowContext: EducationRequest['workflowContext']
): Promise<EducationalContent> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API_KEY_NOT_FOUND');
  }

  const modelFamily = detectModelFamily(workflowContext.modelName);
  const contentKey = generateEducationKey(
    `visual-${diagnostic.ruleId}`,
    diagnostic.nodeType,
    { samplerType: workflowContext.samplerType, modelFamily }
  );

  // Visual explanations are not cached as they're image-specific
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Role: ComfyUI visual quality educator.

I have a generated image and a lint diagnostic. Your task is to explain
how the diagnostic relates to what the user can SEE in the image.

DIAGNOSTIC:
- Rule: ${diagnostic.ruleName}
- Message: ${diagnostic.message}
${diagnostic.offendingParameter ? `- Parameter: ${diagnostic.offendingParameter.name} = ${JSON.stringify(diagnostic.offendingParameter.value)}` : ''}

WORKFLOW CONTEXT:
- Model: ${workflowContext.modelName || 'Unknown'} (${modelFamily})
- CFG: ${workflowContext.cfg || 'Unknown'}
- Steps: ${workflowContext.steps || 'Unknown'}

Look at the image and:
1. Identify any visual artifacts that might be related to this diagnostic
2. Explain how the parameter affects what the user sees
3. Describe what the image would look like if the issue were fixed
4. Provide specific, actionable fixes prioritized for ComfyUI

Be specific about what you see in THIS image, not generic advice.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: imageBase64 } },
          { text: prompt },
        ],
      },
      config: {
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: educationResponseSchema,
      },
    });

    if (!response.text) {
      throw new Error('Empty response from AI');
    }

    const parsed = JSON.parse(response.text);

    return {
      contentKey,
      ruleId: diagnostic.ruleId,
      nodeType: diagnostic.nodeType,
      summary: parsed.summary,
      explanation: parsed.explanation,
      fixes: parsed.fixes || [],
      resources: parsed.resources || [],
      generatedAt: Date.now(),
      modelUsed: 'gemini-2.0-flash',
    };
  } catch (error) {
    const err = error as { message?: string };
    console.error('[EducationalService] Visual education failed:', error);
    throw new Error(`Failed to generate visual education: ${err.message || 'Unknown error'}`);
  }
}

// ============================================================================
// QUICK TIPS
// ============================================================================

/**
 * Pre-defined quick tips for common rules.
 * Used as fallback when API is unavailable or for instant display.
 */
const QUICK_TIPS: Record<string, { summary: string; topFix: string }> = {
  // ============================================================================
  // SAMPLING RULES
  // ============================================================================
  'sampling/cfg-too-high': {
    summary: 'High CFG forces strict prompt adherence but causes oversaturation and "burnt" colors.',
    topFix: 'Lower CFG to 7-12 for balanced prompt following without artifacts.',
  },
  'sampling/cfg-too-low': {
    summary: 'Low CFG gives creative freedom but may ignore prompt details.',
    topFix: 'Increase CFG to 6-8 for better prompt adherence.',
  },
  'sampling/steps-too-low': {
    summary: 'Insufficient steps leave noise and incomplete details in the image.',
    topFix: 'Increase steps to 20-30 for cleaner, more detailed results.',
  },
  'sampling/steps-excessive': {
    summary: 'Extra steps beyond convergence waste time without improving quality.',
    topFix: 'Reduce steps to 30-40 to save computation time.',
  },
  'sampling/denoise-high': {
    summary: 'High denoise replaces most of the input image, nearly creating a new image.',
    topFix: 'Use 0.5-0.75 denoise to preserve original composition.',
  },
  'sampling/denoise-low': {
    summary: 'Very low denoise makes minimal changes - the model barely affects the image.',
    topFix: 'Increase denoise to 0.3+ for noticeable changes, or remove the sampler if no changes are wanted.',
  },
  'sampling/sampler-scheduler-mismatch': {
    summary: 'Some sampler/scheduler combinations work poorly together, causing artifacts or slow convergence.',
    topFix: 'Use Euler with Normal, DPM++ 2M with Karras, or UniPC with Beta for optimal results.',
  },
  'sampling/seed-control-mismatch': {
    summary: 'Using fixed seed with randomization node defeats the purpose of deterministic generation.',
    topFix: 'Remove the randomization node or use -1 seed for intentional variation.',
  },

  // ============================================================================
  // MODEL RULES
  // ============================================================================
  'model/vae-mismatch': {
    summary: 'Mismatched VAE architecture causes color shifts and quality degradation.',
    topFix: 'Use a VAE that matches your model (SDXL VAE for SDXL models).',
  },
  'model/no-checkpoint': {
    summary: 'No model loaded - the workflow cannot generate any images.',
    topFix: 'Add a CheckpointLoaderSimple node and load a model.',
  },
  'model/resolution-mismatch': {
    summary: 'Resolution far from training size causes quality issues and repetition.',
    topFix: 'Use native resolution (512x512 for SD1.5, 1024x1024 for SDXL).',
  },
  'model/lora-strength-high': {
    summary: 'High LoRA strength can overpower the base model, causing artifacts.',
    topFix: 'Start with 0.7-0.8 strength and adjust based on results.',
  },
  'model/multiple-loras': {
    summary: 'Many LoRAs can conflict, slowing generation and degrading quality.',
    topFix: 'Limit to 2-3 LoRAs and lower individual strengths when combining.',
  },
  'model/clip-skip': {
    summary: 'CLIP Skip affects how prompts are interpreted - wrong values for your model cause issues.',
    topFix: 'Use CLIP Skip 1 for SD1.5, CLIP Skip 2 for anime models, 1 for SDXL.',
  },
  'workflow/no-sampler': {
    summary: 'No sampler node found - the workflow cannot denoise or generate images.',
    topFix: 'Add a KSampler or KSamplerAdvanced node to perform the generation.',
  },
  'workflow/sampler-disconnected': {
    summary: 'Sampler is not connected to output - generated images won\'t be saved or displayed.',
    topFix: 'Connect the sampler output to a VAE Decode and then to a Save/Preview node.',
  },

  // ============================================================================
  // PROMPT RULES
  // ============================================================================
  'prompt/no-positive': {
    summary: 'No positive prompt - the model has no guidance for what to generate.',
    topFix: 'Add a CLIP Text Encode node with a description of what you want to create.',
  },
  'prompt/no-negative': {
    summary: 'No negative prompt - unwanted elements may appear in the image.',
    topFix: 'Add negatives like "blurry, low quality, deformed" to guide the model.',
  },
  'prompt/too-short': {
    summary: 'Very short prompts give the model less guidance, leading to generic results.',
    topFix: 'Add descriptive details: subject, style, lighting, composition, quality tags.',
  },
  'prompt/too-long': {
    summary: 'CLIP truncates prompts beyond 77 tokens - later content may be ignored.',
    topFix: 'Prioritize important concepts at the start, or use CLIP text encoding with multiple segments.',
  },
  'prompt/problematic-pattern': {
    summary: 'Some prompt patterns (doubled words, conflicting styles) confuse the model.',
    topFix: 'Review and clean up the prompt, removing duplicates and contradictions.',
  },
  'prompt/excessive-weight': {
    summary: 'Extreme prompt weights (>1.5) cause artifacts and oversaturated results.',
    topFix: 'Keep weights between 0.8-1.4 for natural-looking emphasis.',
  },
  'prompt/conditioning-disconnected': {
    summary: 'Conditioning is created but not connected - the model won\'t receive prompt guidance.',
    topFix: 'Connect the conditioning output to the sampler\'s positive/negative inputs.',
  },

  // ============================================================================
  // PERFORMANCE RULES
  // ============================================================================
  'performance/large-batch': {
    summary: 'Large batch sizes use excessive VRAM and can cause out-of-memory errors.',
    topFix: 'Use batch size 1-4 for most workflows, increase only if VRAM allows.',
  },
  'performance/non-standard-resolution': {
    summary: 'Resolutions not divisible by 8/64 cause padding and waste computation.',
    topFix: 'Use resolutions divisible by 64 (e.g., 512, 768, 1024) for efficiency.',
  },
  'performance/very-high-resolution': {
    summary: 'Very high resolutions require massive VRAM and may exceed model training.',
    topFix: 'Generate at native resolution, then upscale with a dedicated upscaler.',
  },
  'performance/redundant-model-loads': {
    summary: 'Loading the same model multiple times wastes VRAM unnecessarily.',
    topFix: 'Load the model once and connect it to all nodes that need it.',
  },
  'performance/unused-nodes': {
    summary: 'Nodes not connected to output still consume resources during execution.',
    topFix: 'Remove or bypass unused nodes to speed up workflow execution.',
  },
  'performance/multiple-upscales': {
    summary: 'Chaining multiple upscalers compounds artifacts and increases processing time.',
    topFix: 'Use a single high-quality upscaler (like 4x_NMKD) for best results.',
  },
  'performance/inefficient-sampler': {
    summary: 'Some samplers require more steps to converge than modern alternatives.',
    topFix: 'Try DPM++ 2M Karras or UniPC for faster convergence with fewer steps.',
  },
};

/**
 * Gets a quick tip for a rule, either from cache or predefined tips.
 * This is synchronous and doesn't require API calls.
 *
 * @param ruleId - The rule ID to get a tip for
 * @returns Quick tip or undefined if not available
 */
export function getQuickTip(
  ruleId: string
): { summary: string; topFix: string } | undefined {
  return QUICK_TIPS[ruleId];
}

/**
 * Gets quick tips for multiple rules at once.
 *
 * @param ruleIds - Array of rule IDs
 * @returns Map of ruleId to quick tip
 */
export function getQuickTips(
  ruleIds: string[]
): Map<string, { summary: string; topFix: string }> {
  const results = new Map<string, { summary: string; topFix: string }>();

  for (const ruleId of ruleIds) {
    const tip = QUICK_TIPS[ruleId];
    if (tip) {
      results.set(ruleId, tip);
    }
  }

  return results;
}
