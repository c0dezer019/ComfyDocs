/**
 * ComfyDocs Prompt Rules
 *
 * Lint rules for analyzing CLIP text encoding and prompt-related nodes.
 * These rules check for common prompt issues that affect generation quality.
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
// PROMPT PRESENCE RULES
// ============================================================================

/**
 * Rule: No positive prompt/conditioning in workflow.
 */
export const noPositivePromptRule: GlobalLintRule = {
  id: 'prompt/no-positive',
  name: 'Missing Positive Prompt',
  severity: 'error',
  category: 'prompt',
  isGlobal: true,
  defaultEnabled: true,
  rationale:
    'A workflow without a positive prompt cannot guide image generation effectively.',

  check(context: LintContext): LintDiagnostic[] {
    // Check if we found any positive prompts during AST building
    if (context.prompts.positive.length > 0) {
      return [];
    }

    // Also check for CLIP text encode nodes
    const clipNodes = context.findNodesByType(/cliptextencode|textencode/i);
    if (clipNodes.length > 0) {
      // There are text encode nodes, so prompts exist
      return [];
    }

    return [
      {
        ruleId: this.id,
        ruleName: this.name,
        severity: 'error',
        category: 'prompt',
        nodeId: 0,
        nodeType: 'workflow',
        message:
          'No positive prompt detected. Add a CLIP Text Encode node with your prompt.',
        suggestedFix: {
          action: 'add_node',
          description:
            'Add a CLIPTextEncode node connected to the sampler\'s positive conditioning input.',
          confidence: 'high',
          nodeType: 'CLIPTextEncode',
        },
        educationalContext: {
          summary:
            'The positive prompt guides what the model should generate. Without it, results are unpredictable.',
        },
      },
    ];
  },
};

/**
 * Rule: No negative prompt may reduce quality.
 */
export const noNegativePromptRule: GlobalLintRule = {
  id: 'prompt/no-negative',
  name: 'Missing Negative Prompt',
  severity: 'info',
  category: 'prompt',
  isGlobal: true,
  defaultEnabled: true,
  rationale:
    'A negative prompt helps exclude unwanted elements and improve quality.',

  check(context: LintContext): LintDiagnostic[] {
    // Check for negative prompts
    if (context.prompts.negative.length > 0) {
      return [];
    }

    // Check for conditioning nodes labeled as negative
    const conditioningNodes = context.getNodesByCategory('conditioning');
    const hasNegativeNode = conditioningNodes.some((n) => {
      const title = (n.title || '').toLowerCase();
      return title.includes('negative') || title.includes('neg');
    });

    if (hasNegativeNode) {
      return [];
    }

    // Find any sampler to attach the diagnostic to
    const samplers = context.getNodesByCategory('sampling');
    const nodeId = samplers[0]?.id || 0;

    return [
      {
        ruleId: this.id,
        ruleName: this.name,
        severity: 'info',
        category: 'prompt',
        nodeId,
        nodeType: samplers[0]?.type || 'workflow',
        message:
          'No negative prompt detected. Consider adding one to exclude unwanted elements.',
        suggestedFix: {
          action: 'add_node',
          description:
            'Add a CLIPTextEncode node for negative prompts (e.g., "blurry, low quality, watermark").',
          confidence: 'medium',
          nodeType: 'CLIPTextEncode',
        },
        educationalContext: {
          summary:
            'Negative prompts tell the model what to avoid, improving overall quality and reducing artifacts.',
        },
      },
    ];
  },
};

// ============================================================================
// PROMPT CONTENT RULES
// ============================================================================

/**
 * Rule: Prompt is very short and may lack detail.
 */
export const shortPromptRule = defineRule({
  id: 'prompt/too-short',
  name: 'Very Short Prompt',
  severity: 'info',
  category: 'prompt',
  appliesTo: ['cliptextencode', 'textencode'],
  defaultEnabled: true,
  rationale:
    'Very short prompts provide limited guidance and may produce generic results.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    // Find text widget
    const textWidget = node.widgets.find(
      (w) => typeof w.value === 'string' && w.name === 'text'
    );

    if (!textWidget || typeof textWidget.value !== 'string') return null;

    const text = textWidget.value.trim();

    // Skip if it's a negative prompt node (these can be short)
    const title = (node.title || '').toLowerCase();
    if (title.includes('negative') || title.includes('neg')) {
      return null;
    }

    // Check length (less than 20 chars or 3 words)
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    if (text.length < 20 || wordCount < 3) {
      return createDiagnostic(
        this,
        node,
        `Prompt is very short (${wordCount} words). More detail typically produces better results.`,
        {
          offendingParameter: {
            name: 'text',
            value: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          },
          suggestedFix: {
            action: 'modify_prompt',
            description:
              'Add more descriptive elements: subject details, style, lighting, composition, etc.',
            confidence: 'medium',
          },
          educationalContext: {
            summary:
              'Detailed prompts guide the model more precisely. Include subject, style, lighting, and composition.',
          },
        }
      );
    }

    return null;
  },
});

/**
 * Rule: Prompt contains potentially problematic patterns.
 */
export const promptPatternRule = defineRule({
  id: 'prompt/problematic-pattern',
  name: 'Potentially Problematic Prompt Pattern',
  severity: 'info',
  category: 'prompt',
  appliesTo: ['cliptextencode', 'textencode'],
  defaultEnabled: true,
  rationale:
    'Some prompt patterns can cause issues or are less effective than alternatives.',

  check(node: WorkflowNode, _context: LintContext): LintDiagnostic | null {
    const textWidget = node.widgets.find(
      (w) => typeof w.value === 'string' && w.name === 'text'
    );

    if (!textWidget || typeof textWidget.value !== 'string') return null;

    const text = textWidget.value.toLowerCase();

    // Check for common issues
    const patterns: Array<{
      pattern: RegExp;
      message: string;
      suggestion: string;
    }> = [
      {
        pattern: /\bdon'?t\b|\bnot\b|\bno\b|\bwithout\b|\bavoid\b/i,
        message: 'Positive prompt contains negative words. These work better in the negative prompt.',
        suggestion: 'Move exclusion terms to the negative prompt for better results.',
      },
      {
        pattern: /\[\s*\]/,
        message: 'Prompt contains empty brackets which have no effect.',
        suggestion: 'Remove empty brackets or add content to them.',
      },
      {
        pattern: /\(\s*\)/,
        message: 'Prompt contains empty parentheses which have no effect.',
        suggestion: 'Remove empty parentheses or add content to them.',
      },
      {
        pattern: /:{2,}/,
        message: 'Multiple colons detected. For emphasis, use (text:weight) syntax.',
        suggestion: 'Use proper weight syntax: (word:1.2) for emphasis.',
      },
      {
        pattern: /\b(best quality|masterpiece|ultra detailed)\b.*\b(best quality|masterpiece|ultra detailed)\b/i,
        message: 'Repeated quality boosters may not improve results further.',
        suggestion: 'Use quality terms once. Excessive repetition can cause issues.',
      },
    ];

    // Skip negative prompts for the first pattern
    const title = (node.title || '').toLowerCase();
    const isNegative = title.includes('negative') || title.includes('neg');

    for (const { pattern, message, suggestion } of patterns) {
      // Skip negative word check for negative prompts
      if (pattern.source.includes("don'?t") && isNegative) {
        continue;
      }

      if (pattern.test(text)) {
        return createDiagnostic(this, node, message, {
          offendingParameter: {
            name: 'text',
            value: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          },
          suggestedFix: {
            action: 'modify_prompt',
            description: suggestion,
            confidence: 'medium',
          },
          educationalContext: {
            summary:
              'Prompt structure affects generation quality. Some patterns work better than others.',
          },
        });
      }
    }

    return null;
  },
});

/**
 * Rule: Very long prompt may exceed token limits.
 */
export const longPromptRule = defineRule({
  id: 'prompt/too-long',
  name: 'Very Long Prompt',
  severity: 'info',
  category: 'prompt',
  appliesTo: ['cliptextencode', 'textencode'],
  defaultEnabled: true,
  rationale:
    'CLIP has a 77-token limit by default. Very long prompts may be truncated.',

  check(node: WorkflowNode, _context: LintContext): LintDiagnostic | null {
    const textWidget = node.widgets.find(
      (w) => typeof w.value === 'string' && w.name === 'text'
    );

    if (!textWidget || typeof textWidget.value !== 'string') return null;

    const text = textWidget.value;

    // Rough token estimate: words + punctuation
    // CLIP uses BPE tokenization, but word count is a reasonable approximation
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Standard CLIP limit is 77 tokens
    if (wordCount > 75) {
      return createDiagnostic(
        this,
        node,
        `Prompt has ~${wordCount} words and may exceed CLIP's 77-token limit. Later content may be ignored.`,
        {
          offendingParameter: {
            name: 'text',
            value: `${wordCount} words`,
          },
          suggestedFix: {
            action: 'modify_prompt',
            description:
              'Consider shortening the prompt or using a CLIP text encode node that supports longer prompts.',
            confidence: 'medium',
          },
          educationalContext: {
            summary:
              'CLIP encodes text in chunks of 77 tokens. Content beyond this limit may be truncated or handled differently depending on the node.',
          },
        }
      );
    }

    return null;
  },
});

// ============================================================================
// PROMPT WEIGHT RULES
// ============================================================================

/**
 * Rule: Excessive prompt weight may cause artifacts.
 */
export const excessiveWeightRule = defineRule({
  id: 'prompt/excessive-weight',
  name: 'Excessive Prompt Weight',
  severity: 'warning',
  category: 'prompt',
  appliesTo: ['cliptextencode', 'textencode'],
  defaultEnabled: true,
  rationale:
    'Prompt weights above 1.5 often cause artifacts and oversaturation.',

  check(node: WorkflowNode, _context: LintContext): LintDiagnostic | null {
    const textWidget = node.widgets.find(
      (w) => typeof w.value === 'string' && w.name === 'text'
    );

    if (!textWidget || typeof textWidget.value !== 'string') return null;

    const text = textWidget.value;

    // Find weight patterns like (word:1.8) or ((word))
    const weightPattern = /\(([^)]+):(\d+\.?\d*)\)/g;
    let match: RegExpExecArray | null;
    let highestWeight = 0;
    let highestTerm = '';

    while ((match = weightPattern.exec(text)) !== null) {
      const weight = parseFloat(match[2]);
      if (weight > highestWeight) {
        highestWeight = weight;
        highestTerm = match[1];
      }
    }

    // Also check nested parentheses (each adds ~1.1x)
    const nestedPattern = /\({3,}([^)]+)\){3,}/;
    const nestedMatch = nestedPattern.exec(text);
    if (nestedMatch) {
      // 3+ nested parens is roughly equivalent to 1.3+ weight
      highestWeight = Math.max(highestWeight, 1.5);
      highestTerm = highestTerm || nestedMatch[1];
    }

    if (highestWeight > 1.5) {
      return createDiagnostic(
        this,
        node,
        `Prompt contains high weight (${highestWeight.toFixed(1)}) on "${highestTerm.substring(0, 30)}". This may cause artifacts.`,
        {
          offendingParameter: {
            name: 'text',
            value: `${highestTerm.substring(0, 30)}:${highestWeight}`,
            validRange: { min: 0.5, max: 1.5 },
          },
          suggestedFix: {
            action: 'modify_prompt',
            description:
              'Reduce weight to 1.0-1.3 for emphasis without artifacts.',
            confidence: 'medium',
          },
          educationalContext: {
            summary:
              'High weights amplify specific terms but can cause oversaturation and artifacts. Use weights between 0.8-1.3 for best results.',
          },
        }
      );
    }

    return null;
  },
});

// ============================================================================
// CONDITIONING CONNECTION RULES
// ============================================================================

/**
 * Rule: Conditioning not connected to sampler.
 */
export const conditioningNotConnectedRule = defineRule({
  id: 'prompt/conditioning-disconnected',
  name: 'Disconnected Conditioning',
  severity: 'warning',
  category: 'prompt',
  appliesTo: ['cliptextencode', 'textencode', 'conditioning'],
  defaultEnabled: true,
  rationale:
    'Conditioning that isn\'t connected to a sampler has no effect on generation.',

  check(node: WorkflowNode, context: LintContext): LintDiagnostic | null {
    // Check if this node's output connects to anything
    const downstreamNodes = context.ast.downstream.get(node.id);

    if (!downstreamNodes || downstreamNodes.size === 0) {
      // Check if this is a text encode node with actual content
      const textWidget = node.widgets.find(
        (w) => typeof w.value === 'string' && (w.value as string).length > 0
      );

      if (textWidget) {
        return createDiagnostic(
          this,
          node,
          'This prompt/conditioning node is not connected to any downstream nodes.',
          {
            suggestedFix: {
              action: 'change_connection',
              description:
                'Connect the CONDITIONING output to a sampler\'s positive or negative input.',
              confidence: 'high',
            },
            educationalContext: {
              summary:
                'Conditioning must flow to a sampler to affect generation. Unconnected prompts are ignored.',
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
 * All prompt-related lint rules.
 */
export const promptRules: Array<LintRule | GlobalLintRule> = [
  noPositivePromptRule,
  noNegativePromptRule,
  shortPromptRule,
  promptPatternRule,
  longPromptRule,
  excessiveWeightRule,
  conditioningNotConnectedRule,
];
