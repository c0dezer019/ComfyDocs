/**
 * ComfyDocs Lint Engine
 *
 * Core orchestration layer for the rule-based educational linting system.
 * Manages rule registration, execution, and result aggregation.
 */

import {
  LintRule,
  GlobalLintRule,
  LintResult,
  LintDiagnostic,
  LintConfig,
  LintContext,
  LintMetadata,
  DiagnosticCounts,
  RuleSeverity,
  RuleCategory,
  WorkflowAST,
  isGlobalRule,
  LintedQualityIssue,
} from '@/lib/lintTypes';
import { buildWorkflowAST, createLintContext, validateAST } from './astBuilder';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default lint configuration with sensible defaults for ComfyUI workflows.
 */
export const DEFAULT_LINT_CONFIG: LintConfig = {
  disabledRules: [],
  severityOverrides: {},
  thresholds: {
    maxCfg: 15,
    minSteps: 10,
    maxSteps: 150,
    warnOnHighDenoise: 0.9,
    maxNodes: 200,
  },
  includeInfo: true,
  customRules: [],
};

// ============================================================================
// RULE REGISTRY
// ============================================================================

/**
 * Singleton registry for lint rules.
 * Rules must be registered before they can be used by the engine.
 */
class RuleRegistry {
  private rules: Map<string, LintRule | GlobalLintRule> = new Map();
  private static instance: RuleRegistry;

  private constructor() {}

  /**
   * Gets the singleton instance of the registry.
   */
  static getInstance(): RuleRegistry {
    if (!RuleRegistry.instance) {
      RuleRegistry.instance = new RuleRegistry();
    }
    return RuleRegistry.instance;
  }

  /**
   * Registers a single rule.
   * @param rule - The rule to register
   * @throws If rule ID is empty
   */
  register(rule: LintRule | GlobalLintRule): void {
    if (!rule.id || rule.id.trim() === '') {
      throw new Error('Rule ID cannot be empty');
    }

    if (this.rules.has(rule.id)) {
      console.warn(`[LintEngine] Rule '${rule.id}' already registered, overwriting.`);
    }

    this.rules.set(rule.id, rule);
  }

  /**
   * Registers multiple rules at once.
   * @param rules - Array of rules to register
   */
  registerMany(rules: Array<LintRule | GlobalLintRule>): void {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  /**
   * Gets a rule by ID.
   * @param id - Rule ID to look up
   * @returns The rule, or undefined if not found
   */
  get(id: string): LintRule | GlobalLintRule | undefined {
    return this.rules.get(id);
  }

  /**
   * Gets all registered rules.
   */
  getAll(): Array<LintRule | GlobalLintRule> {
    return Array.from(this.rules.values());
  }

  /**
   * Gets rules filtered by category.
   * @param category - Category to filter by
   */
  getByCategory(category: RuleCategory): Array<LintRule | GlobalLintRule> {
    return this.getAll().filter((r) => r.category === category);
  }

  /**
   * Gets all enabled rules based on configuration.
   * @param config - Lint configuration
   */
  getEnabled(config: LintConfig): Array<LintRule | GlobalLintRule> {
    const allRules = [...this.getAll(), ...(config.customRules || [])];

    return allRules.filter(
      (r) => r.defaultEnabled && !config.disabledRules.includes(r.id)
    );
  }

  /**
   * Gets rule count.
   */
  get size(): number {
    return this.rules.size;
  }

  /**
   * Checks if a rule is registered.
   * @param id - Rule ID to check
   */
  has(id: string): boolean {
    return this.rules.has(id);
  }

  /**
   * Removes a rule by ID.
   * @param id - Rule ID to remove
   * @returns True if the rule was removed
   */
  unregister(id: string): boolean {
    return this.rules.delete(id);
  }

  /**
   * Clears all registered rules.
   * Mainly useful for testing.
   */
  clear(): void {
    this.rules.clear();
  }

  /**
   * Gets summary statistics about registered rules.
   */
  getSummary(): {
    total: number;
    byCategory: Record<RuleCategory, number>;
    bySeverity: Record<RuleSeverity, number>;
    enabled: number;
    disabled: number;
  } {
    const rules = this.getAll();

    const byCategory: Record<RuleCategory, number> = {
      workflow: 0,
      sampling: 0,
      model: 0,
      vae: 0,
      performance: 0,
      prompt: 0,
      compatibility: 0,
    };

    const bySeverity: Record<RuleSeverity, number> = {
      error: 0,
      warning: 0,
      info: 0,
    };

    let enabled = 0;
    let disabled = 0;

    for (const rule of rules) {
      byCategory[rule.category]++;
      bySeverity[rule.severity]++;

      if (rule.defaultEnabled) {
        enabled++;
      } else {
        disabled++;
      }
    }

    return {
      total: rules.length,
      byCategory,
      bySeverity,
      enabled,
      disabled,
    };
  }
}

/**
 * Global rule registry instance.
 */
export const ruleRegistry = RuleRegistry.getInstance();

// ============================================================================
// LINT ENGINE
// ============================================================================

/**
 * Runs the linter on a raw workflow.
 *
 * @param rawWorkflow - Raw ComfyUI workflow JSON
 * @param config - Optional lint configuration
 * @returns Complete lint result with all diagnostics
 */
export function runLinter(
  rawWorkflow: unknown,
  config: LintConfig = DEFAULT_LINT_CONFIG
): LintResult {
  const startTime = performance.now();
  const diagnostics: LintDiagnostic[] = [];
  const timestamp = Date.now();

  // Handle null/undefined workflow
  if (!rawWorkflow) {
    return createErrorResult('Workflow is null or undefined', timestamp);
  }

  try {
    // Build AST
    const ast = buildWorkflowAST(rawWorkflow);

    // Validate AST
    const validation = validateAST(ast);
    if (!validation.valid) {
      // Add validation errors as diagnostics but continue
      for (const error of validation.errors) {
        diagnostics.push({
          ruleId: 'engine/validation',
          ruleName: 'Workflow Validation',
          severity: 'warning',
          category: 'workflow',
          nodeId: 0,
          nodeType: 'workflow',
          message: error,
          educationalContext: {
            summary: 'The workflow structure appears incomplete.',
          },
          timestamp,
        });
      }
    }

    // Create lint context
    const context = createLintContext(ast);

    // Get enabled rules
    const enabledRules = ruleRegistry.getEnabled(config);

    let rulesRun = 0;
    let rulesSkipped = 0;

    // Separate global and per-node rules
    const globalRules: GlobalLintRule[] = [];
    const nodeRules: LintRule[] = [];

    for (const rule of enabledRules) {
      if (isGlobalRule(rule)) {
        globalRules.push(rule);
      } else {
        nodeRules.push(rule as LintRule);
      }
    }

    // Run global rules first
    for (const rule of globalRules) {
      rulesRun++;
      try {
        const ruleDiagnostics = rule.check(context);
        for (const diag of ruleDiagnostics) {
          // Apply severity override
          if (config.severityOverrides[rule.id]) {
            diag.severity = config.severityOverrides[rule.id];
          }
          diag.timestamp = timestamp;
          diagnostics.push(diag);
        }
      } catch (err) {
        console.error(`[LintEngine] Global rule '${rule.id}' threw error:`, err);
      }
    }

    // Run per-node rules
    for (const rule of nodeRules) {
      // Determine which nodes this rule applies to
      let applicableNodes: IterableIterator<import('@/lib/lintTypes').WorkflowNode>;

      if (rule.appliesTo.length === 0) {
        // Rule applies to all nodes
        applicableNodes = ast.nodes.values();
      } else {
        // Filter nodes by type pattern
        const matchingNodes: import('@/lib/lintTypes').WorkflowNode[] = [];
        for (const node of ast.nodes.values()) {
          const nodeTypeLower = node.type.toLowerCase();
          const matches = rule.appliesTo.some((pattern) =>
            nodeTypeLower.includes(pattern.toLowerCase())
          );
          if (matches) {
            matchingNodes.push(node);
          }
        }

        if (matchingNodes.length === 0) {
          rulesSkipped++;
          continue;
        }

        applicableNodes = matchingNodes[Symbol.iterator]();
      }

      rulesRun++;

      for (const node of applicableNodes) {
        try {
          const diagnostic = rule.check(node, context);
          if (diagnostic) {
            // Apply severity override
            if (config.severityOverrides[rule.id]) {
              diagnostic.severity = config.severityOverrides[rule.id];
            }
            diagnostic.timestamp = timestamp;
            diagnostics.push(diagnostic);
          }
        } catch (err) {
          console.error(
            `[LintEngine] Rule '${rule.id}' threw error on node ${node.id}:`,
            err
          );
        }
      }
    }

    // Filter out info diagnostics if configured
    const finalDiagnostics = config.includeInfo
      ? diagnostics
      : diagnostics.filter((d) => d.severity !== 'info');

    const endTime = performance.now();

    return {
      diagnostics: finalDiagnostics,
      meta: {
        rulesRun,
        rulesSkipped,
        nodesAnalyzed: ast.nodes.size,
        executionTimeMs: Math.round(endTime - startTime),
        timestamp,
      },
      counts: countDiagnostics(finalDiagnostics),
      success: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[LintEngine] Fatal error during linting:', err);
    return createErrorResult(message, timestamp);
  }
}

/**
 * Creates an error result for when linting fails.
 */
function createErrorResult(message: string, timestamp: number): LintResult {
  return {
    diagnostics: [],
    meta: {
      rulesRun: 0,
      rulesSkipped: 0,
      nodesAnalyzed: 0,
      executionTimeMs: 0,
      timestamp,
    },
    counts: { errors: 0, warnings: 0, info: 0, total: 0 },
    success: false,
    error: message,
  };
}

/**
 * Counts diagnostics by severity.
 */
function countDiagnostics(diagnostics: LintDiagnostic[]): DiagnosticCounts {
  const counts = { errors: 0, warnings: 0, info: 0, total: 0 };

  for (const diag of diagnostics) {
    counts.total++;
    switch (diag.severity) {
      case 'error':
        counts.errors++;
        break;
      case 'warning':
        counts.warnings++;
        break;
      case 'info':
        counts.info++;
        break;
    }
  }

  return counts;
}

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Maps lint severity to QualityIssue severity for backward compatibility.
 */
function mapSeverityToLegacy(
  severity: RuleSeverity
): 'Critical' | 'Major' | 'Minor' | 'Note' {
  switch (severity) {
    case 'error':
      return 'Critical';
    case 'warning':
      return 'Major';
    case 'info':
      return 'Note';
  }
}

/**
 * Maps lint severity to a numeric score penalty.
 */
function severityToScore(severity: RuleSeverity): number {
  switch (severity) {
    case 'error':
      return 2.0;
    case 'warning':
      return 1.0;
    case 'info':
      return 0;
  }
}

/**
 * Converts lint diagnostics to the legacy QualityIssue format.
 * This enables backward compatibility with existing UI components.
 *
 * @param diagnostics - Array of lint diagnostics
 * @returns Array of LintedQualityIssue objects
 */
export function diagnosticsToQualityIssues(
  diagnostics: LintDiagnostic[]
): LintedQualityIssue[] {
  return diagnostics.map((d) => ({
    // Standard QualityIssue fields
    id: `${d.ruleId}-${d.nodeId}-${d.timestamp || Date.now()}`,
    type: formatCategoryAsType(d.category),
    description: d.message,
    severity: mapSeverityToLegacy(d.severity),
    score: severityToScore(d.severity),
    confidence: 100,
    passCount: 1,
    suggestedFixes: d.suggestedFix ? [d.suggestedFix.description] : [],
    box_2d: d.imageRegion?.box_2d,
    style: d.imageRegion?.style,

    // Linting-specific extensions
    nodeId: d.nodeId,
    nodeType: d.nodeType,
    ruleId: d.ruleId,
    educationalContext: d.educationalContext.summary,
    educationLoaded: false,
  }));
}

/**
 * Formats a category into a display-friendly type string.
 */
function formatCategoryAsType(category: RuleCategory): string {
  const formatted = category.charAt(0).toUpperCase() + category.slice(1);
  return formatted;
}

/**
 * Runs linter and returns results in the legacy QualityAnalysis format.
 * This is the main integration point for existing UI components.
 *
 * @param rawWorkflow - Raw ComfyUI workflow JSON
 * @param config - Optional lint configuration
 * @returns Object matching the existing qualityAnalysis shape
 */
export function lintToQualityAnalysis(
  rawWorkflow: unknown,
  config?: LintConfig
): {
  overallScore: number;
  issues: LintedQualityIssue[];
  lintMeta: LintMetadata;
} {
  const result = runLinter(rawWorkflow, config);

  const issues = diagnosticsToQualityIssues(result.diagnostics);

  // Calculate overall score: 10 - sum of penalties, clamped to [0, 10]
  const totalPenalty = issues.reduce((sum, i) => sum + (i.score || 0), 0);
  const overallScore = Math.max(0, Math.min(10, 10 - totalPenalty));

  return {
    overallScore: Math.round(overallScore * 10) / 10,
    issues,
    lintMeta: result.meta,
  };
}

// ============================================================================
// RULE BUILDER UTILITIES
// ============================================================================

/**
 * Creates a basic diagnostic with common fields pre-filled.
 * Helper for rule implementations.
 */
export function createDiagnostic(
  rule: LintRule | GlobalLintRule,
  node: { id: number; type: string },
  message: string,
  options: Partial<LintDiagnostic> = {}
): LintDiagnostic {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    category: rule.category,
    nodeId: node.id,
    nodeType: node.type,
    message,
    educationalContext: {
      summary: rule.rationale,
    },
    ...options,
  };
}

/**
 * Creates a rule definition with type checking.
 * Helper for defining rules with full type inference.
 */
export function defineRule<T extends LintRule | GlobalLintRule>(rule: T): T {
  return rule;
}

// ============================================================================
// CONFIGURATION HELPERS
// ============================================================================

/**
 * Merges user configuration with defaults.
 */
export function mergeConfig(
  userConfig: Partial<LintConfig>
): LintConfig {
  return {
    disabledRules: [
      ...DEFAULT_LINT_CONFIG.disabledRules,
      ...(userConfig.disabledRules || []),
    ],
    severityOverrides: {
      ...DEFAULT_LINT_CONFIG.severityOverrides,
      ...userConfig.severityOverrides,
    },
    thresholds: {
      ...DEFAULT_LINT_CONFIG.thresholds,
      ...userConfig.thresholds,
    },
    includeInfo: userConfig.includeInfo ?? DEFAULT_LINT_CONFIG.includeInfo,
    customRules: [
      ...(DEFAULT_LINT_CONFIG.customRules || []),
      ...(userConfig.customRules || []),
    ],
  };
}

/**
 * Creates a config that disables all rules except specified ones.
 */
export function createOnlyConfig(ruleIds: string[]): Partial<LintConfig> {
  const allRules = ruleRegistry.getAll();
  const disabledRules = allRules
    .filter((r) => !ruleIds.includes(r.id))
    .map((r) => r.id);

  return { disabledRules };
}

/**
 * Creates a config that disables specific rules.
 */
export function createExcludeConfig(ruleIds: string[]): Partial<LintConfig> {
  return { disabledRules: ruleIds };
}

// ============================================================================
// DEBUGGING UTILITIES
// ============================================================================

/**
 * Runs linting with verbose logging for debugging.
 */
export function runLinterDebug(
  rawWorkflow: unknown,
  config?: LintConfig
): LintResult {
  console.group('[LintEngine] Debug Run');
  console.log('Config:', config || DEFAULT_LINT_CONFIG);
  console.log('Registered rules:', ruleRegistry.getSummary());

  const result = runLinter(rawWorkflow, config);

  console.log('Result:', {
    success: result.success,
    diagnostics: result.diagnostics.length,
    meta: result.meta,
    counts: result.counts,
  });

  if (result.diagnostics.length > 0) {
    console.table(
      result.diagnostics.map((d) => ({
        rule: d.ruleId,
        severity: d.severity,
        node: `#${d.nodeId} (${d.nodeType})`,
        message: d.message.substring(0, 50) + (d.message.length > 50 ? '...' : ''),
      }))
    );
  }

  console.groupEnd();
  return result;
}
