'use client';

/**
 * ComfyDocs Linter Hook
 *
 * React hook for integrating the lint engine with components.
 * Provides debounced linting, result management, and educational content integration.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  LintResult,
  LintDiagnostic,
  LintConfig,
  LintedQualityIssue,
  WorkflowAST,
} from '@/lib/lintTypes';
import {
  runLinter,
  lintToQualityAnalysis,
  DEFAULT_LINT_CONFIG,
  mergeConfig,
  ruleRegistry,
} from '@/utils/lintEngine';
import { buildWorkflowAST, getWorkflowSummary } from '@/utils/astBuilder';
import { registerBuiltinRules, areRulesRegistered } from '@/rules';

// ============================================================================
// TYPES
// ============================================================================

export interface LinterState {
  /** Full lint result with all diagnostics */
  result: LintResult | null;
  /** Diagnostics converted to QualityIssue format for UI compatibility */
  issues: LintedQualityIssue[];
  /** Whether linting is currently in progress */
  isLinting: boolean;
  /** Error message if linting failed */
  error: string | null;
  /** Workflow AST (for graph visualization) */
  ast: WorkflowAST | null;
  /** Overall score derived from lint results */
  overallScore: number;
  /** Quick counts of diagnostics by severity */
  counts: {
    errors: number;
    warnings: number;
    info: number;
    total: number;
  };
}

export interface LinterOptions {
  /** Custom lint configuration */
  config?: Partial<LintConfig>;
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number;
  /** Auto-run lint when workflow changes (default: true) */
  autoRun?: boolean;
  /** Whether to include info-level diagnostics (default: true) */
  includeInfo?: boolean;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Hook for running the linter on a ComfyUI workflow.
 *
 * @param rawWorkflow - Raw workflow JSON from PNG metadata
 * @param options - Linter configuration options
 * @returns Linter state and control functions
 *
 * @example
 * ```tsx
 * const { result, issues, isLinting, runLint, counts } = useLinter(
 *   workflowData,
 *   { debounceMs: 500, autoRun: true }
 * );
 *
 * if (isLinting) return <Spinner />;
 * return <DiagnosticList issues={issues} />;
 * ```
 */
export function useLinter(
  rawWorkflow: unknown | null,
  options: LinterOptions = {}
): LinterState & {
  /** Manually trigger linting */
  runLint: () => void;
  /** Clear lint results */
  clearResults: () => void;
  /** Get diagnostic by node ID */
  getDiagnosticsForNode: (nodeId: number) => LintDiagnostic[];
  /** Get all affected node IDs */
  getAffectedNodeIds: () => Set<number>;
  /** Filter diagnostics by severity */
  filterBySeverity: (severity: 'error' | 'warning' | 'info') => LintDiagnostic[];
  /** Filter diagnostics by category */
  filterByCategory: (category: string) => LintDiagnostic[];
} {
  const {
    config: userConfig,
    debounceMs = 300,
    autoRun = true,
    includeInfo = true,
  } = options;

  // State
  const [result, setResult] = useState<LintResult | null>(null);
  const [issues, setIssues] = useState<LintedQualityIssue[]>([]);
  const [isLinting, setIsLinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ast, setAst] = useState<WorkflowAST | null>(null);
  const [overallScore, setOverallScore] = useState(10);

  // Refs for debouncing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workflowRef = useRef(rawWorkflow);
  workflowRef.current = rawWorkflow;

  // Merge config with defaults
  const config = useMemo(() => {
    const merged = userConfig ? mergeConfig(userConfig) : DEFAULT_LINT_CONFIG;
    return { ...merged, includeInfo };
  }, [userConfig, includeInfo]);

  // Counts computed from result
  const counts = useMemo(() => {
    if (!result) {
      return { errors: 0, warnings: 0, info: 0, total: 0 };
    }
    return result.counts;
  }, [result]);

  // Ensure rules are registered
  useEffect(() => {
    if (!areRulesRegistered()) {
      registerBuiltinRules();
    }
  }, []);

  // Core linting function
  const executeLint = useCallback(() => {
    const workflow = workflowRef.current;

    if (!workflow) {
      setResult(null);
      setIssues([]);
      setAst(null);
      setOverallScore(10);
      setError(null);
      return;
    }

    setIsLinting(true);
    setError(null);

    try {
      // Build AST first (for graph visualization)
      const workflowAst = buildWorkflowAST(workflow);
      setAst(workflowAst);

      // Run linter
      const lintResult = lintToQualityAnalysis(workflow, config);

      setResult({
        diagnostics: lintResult.issues.map((i) => ({
          ruleId: i.ruleId || 'unknown',
          ruleName: i.type,
          severity: i.severity === 'Critical' ? 'error' :
                    i.severity === 'Major' ? 'warning' :
                    i.severity === 'Minor' ? 'warning' : 'info',
          category: 'workflow' as const,
          nodeId: i.nodeId || 0,
          nodeType: i.nodeType || 'unknown',
          message: i.description,
          educationalContext: {
            summary: i.educationalContext || '',
          },
        })),
        meta: lintResult.lintMeta,
        counts: {
          errors: lintResult.issues.filter((i) => i.severity === 'Critical').length,
          warnings: lintResult.issues.filter((i) =>
            i.severity === 'Major' || i.severity === 'Minor'
          ).length,
          info: lintResult.issues.filter((i) => i.severity === 'Note').length,
          total: lintResult.issues.length,
        },
        success: true,
      });

      setIssues(lintResult.issues);
      setOverallScore(lintResult.overallScore);

      console.debug('[useLinter] Lint complete:', {
        diagnostics: lintResult.issues.length,
        score: lintResult.overallScore,
        timeMs: lintResult.lintMeta.executionTimeMs,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Linting failed';
      console.error('[useLinter] Lint error:', err);
      setError(message);
      setResult(null);
      setIssues([]);
    } finally {
      setIsLinting(false);
    }
  }, [config]);

  // Debounced lint execution
  const runLint = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      executeLint();
    }, debounceMs);
  }, [executeLint, debounceMs]);

  // Clear results
  const clearResults = useCallback(() => {
    setResult(null);
    setIssues([]);
    setAst(null);
    setOverallScore(10);
    setError(null);
  }, []);

  // Auto-run when workflow changes
  useEffect(() => {
    if (autoRun && rawWorkflow) {
      runLint();
    } else if (!rawWorkflow) {
      clearResults();
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [rawWorkflow, autoRun, runLint, clearResults]);

  // Helper: Get diagnostics for a specific node
  const getDiagnosticsForNode = useCallback(
    (nodeId: number): LintDiagnostic[] => {
      if (!result) return [];
      return result.diagnostics.filter((d) => d.nodeId === nodeId);
    },
    [result]
  );

  // Helper: Get all affected node IDs
  const getAffectedNodeIds = useCallback((): Set<number> => {
    if (!result) return new Set();
    return new Set(result.diagnostics.map((d) => d.nodeId).filter((id) => id > 0));
  }, [result]);

  // Helper: Filter by severity
  const filterBySeverity = useCallback(
    (severity: 'error' | 'warning' | 'info'): LintDiagnostic[] => {
      if (!result) return [];
      return result.diagnostics.filter((d) => d.severity === severity);
    },
    [result]
  );

  // Helper: Filter by category
  const filterByCategory = useCallback(
    (category: string): LintDiagnostic[] => {
      if (!result) return [];
      return result.diagnostics.filter((d) => d.category === category);
    },
    [result]
  );

  return {
    result,
    issues,
    isLinting,
    error,
    ast,
    overallScore,
    counts,
    runLint,
    clearResults,
    getDiagnosticsForNode,
    getAffectedNodeIds,
    filterBySeverity,
    filterByCategory,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to get workflow summary statistics.
 * Useful for displaying workflow complexity info.
 */
export function useWorkflowSummary(rawWorkflow: unknown | null) {
  const [summary, setSummary] = useState<{
    nodeCount: number;
    linkCount: number;
    categories: Record<string, number>;
    hasSampler: boolean;
    hasCheckpoint: boolean;
    hasVAE: boolean;
  } | null>(null);

  useEffect(() => {
    if (!rawWorkflow) {
      setSummary(null);
      return;
    }

    try {
      const ast = buildWorkflowAST(rawWorkflow);
      setSummary(getWorkflowSummary(ast));
    } catch {
      setSummary(null);
    }
  }, [rawWorkflow]);

  return summary;
}

/**
 * Hook to track which node is currently focused in the UI.
 * Syncs with diagnostics for highlighting.
 */
export function useFocusedNode(initialNodeId: number | null = null) {
  const [focusedNodeId, setFocusedNodeId] = useState<number | null>(initialNodeId);

  const focusNode = useCallback((nodeId: number | null) => {
    setFocusedNodeId(nodeId);
  }, []);

  const clearFocus = useCallback(() => {
    setFocusedNodeId(null);
  }, []);

  return {
    focusedNodeId,
    focusNode,
    clearFocus,
    isFocused: (nodeId: number) => focusedNodeId === nodeId,
  };
}

/**
 * Hook to get rule registry statistics.
 * Useful for settings/admin panels.
 */
export function useRuleStats() {
  const [stats, setStats] = useState<{
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    enabled: number;
    disabled: number;
  } | null>(null);

  useEffect(() => {
    if (!areRulesRegistered()) {
      registerBuiltinRules();
    }
    setStats(ruleRegistry.getSummary());
  }, []);

  return stats;
}
