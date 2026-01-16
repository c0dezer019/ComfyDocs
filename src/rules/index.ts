/**
 * ComfyDocs Lint Rules Index
 *
 * Central module for rule registration and management.
 * All built-in rules are registered here.
 */

import { LintRule, GlobalLintRule } from '@/lib/lintTypes';
import { ruleRegistry } from '@/utils/lintEngine';
import { samplingRules } from './samplingRules';
import { modelRules } from './modelRules';
import { promptRules } from './promptRules';
import { performanceRules } from './performanceRules';

// ============================================================================
// RULE REGISTRATION
// ============================================================================

/**
 * All built-in rules combined.
 */
export const builtinRules: Array<LintRule | GlobalLintRule> = [
  ...samplingRules,
  ...modelRules,
  ...promptRules,
  ...performanceRules,
];

/**
 * Flag to track if rules have been registered.
 */
let rulesRegistered = false;

/**
 * Registers all built-in rules with the rule registry.
 * This should be called once during application initialization.
 *
 * Safe to call multiple times - subsequent calls are no-ops.
 */
export function registerBuiltinRules(): void {
  if (rulesRegistered) {
    console.debug('[LintRules] Rules already registered, skipping.');
    return;
  }

  console.debug(`[LintRules] Registering ${builtinRules.length} built-in rules...`);

  ruleRegistry.registerMany(builtinRules);
  rulesRegistered = true;

  console.debug('[LintRules] Registration complete.', ruleRegistry.getSummary());
}

/**
 * Resets rule registration state.
 * Mainly useful for testing.
 */
export function resetRuleRegistration(): void {
  ruleRegistry.clear();
  rulesRegistered = false;
}

/**
 * Checks if rules have been registered.
 */
export function areRulesRegistered(): boolean {
  return rulesRegistered;
}

// ============================================================================
// RULE ACCESSORS
// ============================================================================

/**
 * Gets all sampling-related rules.
 */
export function getSamplingRules(): LintRule[] {
  return [...samplingRules];
}

/**
 * Gets all model-related rules.
 */
export function getModelRules(): Array<LintRule | GlobalLintRule> {
  return [...modelRules];
}

/**
 * Gets all prompt-related rules.
 */
export function getPromptRules(): Array<LintRule | GlobalLintRule> {
  return [...promptRules];
}

/**
 * Gets all performance-related rules.
 */
export function getPerformanceRules(): Array<LintRule | GlobalLintRule> {
  return [...performanceRules];
}

/**
 * Gets a rule by ID from the built-in set.
 */
export function getBuiltinRule(id: string): LintRule | GlobalLintRule | undefined {
  return builtinRules.find((r) => r.id === id);
}

/**
 * Gets all rule IDs.
 */
export function getAllRuleIds(): string[] {
  return builtinRules.map((r) => r.id);
}

/**
 * Gets rules grouped by category.
 */
export function getRulesByCategory(): Map<string, Array<LintRule | GlobalLintRule>> {
  const grouped = new Map<string, Array<LintRule | GlobalLintRule>>();

  for (const rule of builtinRules) {
    const existing = grouped.get(rule.category) || [];
    existing.push(rule);
    grouped.set(rule.category, existing);
  }

  return grouped;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { samplingRules } from './samplingRules';
export { modelRules } from './modelRules';
export { promptRules } from './promptRules';
export { performanceRules } from './performanceRules';

// Re-export specific rules for direct import
export {
  cfgTooHighRule,
  cfgTooLowRule,
  stepsTooLowRule,
  stepsTooHighRule,
  denoiseHighRule,
  denoiseLowRule,
  samplerSchedulerMismatchRule,
  seedControlMismatchRule,
} from './samplingRules';

export {
  vaeMismatchRule,
  noCheckpointRule,
  noSamplerRule,
  samplerNotConnectedRule,
  loraStrengthHighRule,
  multipleLorasRule,
  clipSkipRule,
  resolutionMismatchRule,
} from './modelRules';

export {
  noPositivePromptRule,
  noNegativePromptRule,
  shortPromptRule,
  promptPatternRule,
  longPromptRule,
  excessiveWeightRule,
  conditioningNotConnectedRule,
} from './promptRules';

export {
  largeBatchSizeRule,
  nonStandardResolutionRule,
  veryHighResolutionRule,
  redundantModelLoadsRule,
  unusedNodesRule,
  multipleUpscalesRule,
  inefficientSamplerRule,
} from './performanceRules';
