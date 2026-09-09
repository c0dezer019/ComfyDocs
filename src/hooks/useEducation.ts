'use client';

/**
 * ComfyDocs Education Hooks
 *
 * React hooks for loading and managing educational content.
 * Provides seamless integration between the educational service
 * and React components with proper loading states and caching.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  EducationalContent,
  LintDiagnostic,
  EducationRequest,
} from '@/lib/lintTypes';
import {
  generateEducationalContent,
  generateBatchEducationSummaries,
  generateVisualEducation,
  getQuickTip,
  getQuickTips,
} from '@/services/educationalService';
import {
  getCachedEducation,
  generateEducationKey,
  detectModelFamily,
  performCacheMaintenance,
} from '@/utils/educationCache';

// ============================================================================
// TYPES
// ============================================================================

export interface EducationState {
  /** The loaded educational content */
  content: EducationalContent | null;
  /** Whether content is currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Whether content was loaded from cache */
  fromCache: boolean;
}

export interface BatchEducationState {
  /** Map of ruleId to summary info */
  summaries: Map<string, { summary: string; topFix: string }>;
  /** Whether batch loading is in progress */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Count of summaries loaded from cache */
  cacheHits: number;
}

export interface WorkflowContext {
  samplerType?: string;
  modelName?: string;
  steps?: number;
  cfg?: number;
}

// ============================================================================
// SINGLE DIAGNOSTIC HOOK
// ============================================================================

/**
 * Hook for loading educational content for a single diagnostic.
 *
 * @param diagnostic - The diagnostic to get education for (or null to skip)
 * @param workflowContext - Workflow context for tailored explanations
 * @param options - Configuration options
 * @returns Education state and control functions
 *
 * @example
 * ```tsx
 * const { content, isLoading, error, load } = useEducation(diagnostic, {
 *   samplerType: 'euler',
 *   modelName: 'sd_xl_base.safetensors',
 * });
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error} />;
 * if (content) return <EducationPanel content={content} />;
 * ```
 */
export function useEducation(
  diagnostic: LintDiagnostic | null,
  workflowContext: WorkflowContext,
  options: {
    /** Load automatically when diagnostic changes */
    autoLoad?: boolean;
    /** Check cache only, don't call API */
    cacheOnly?: boolean;
  } = {}
): EducationState & {
  /** Manually trigger loading */
  load: () => Promise<void>;
  /** Clear current content */
  clear: () => void;
  /** Quick tip for immediate display */
  quickTip: { summary: string; topFix: string } | undefined;
} {
  const { autoLoad = false, cacheOnly = false } = options;

  const [content, setContent] = useState<EducationalContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  // Track current diagnostic to prevent stale updates
  const diagnosticRef = useRef(diagnostic);
  diagnosticRef.current = diagnostic;

  // Get quick tip for immediate display
  const quickTip = useMemo(() => {
    if (!diagnostic) return undefined;
    return getQuickTip(diagnostic.ruleId);
  }, [diagnostic]);

  const load = useCallback(async () => {
    if (!diagnostic) return;

    setIsLoading(true);
    setError(null);

    try {
      // Check cache first
      const modelFamily = detectModelFamily(workflowContext.modelName);
      const contentKey = generateEducationKey(diagnostic.ruleId, diagnostic.nodeType, {
        samplerType: workflowContext.samplerType,
        modelFamily,
      });

      const cached = await getCachedEducation(contentKey);

      if (cached) {
        // Verify this is still the current diagnostic
        if (diagnosticRef.current?.ruleId === diagnostic.ruleId) {
          setContent(cached);
          setFromCache(true);
          setIsLoading(false);
        }
        return;
      }

      if (cacheOnly) {
        setIsLoading(false);
        return;
      }

      // Generate new content
      const request: EducationRequest = {
        diagnostic,
        workflowContext,
      };

      const newContent = await generateEducationalContent(request);

      // Verify this is still the current diagnostic
      if (diagnosticRef.current?.ruleId === diagnostic.ruleId) {
        setContent(newContent);
        setFromCache(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load education';

      // Only set error if still relevant
      if (diagnosticRef.current?.ruleId === diagnostic.ruleId) {
        setError(message);
      }
    } finally {
      // Only update loading state if still relevant
      if (diagnosticRef.current?.ruleId === diagnostic.ruleId) {
        setIsLoading(false);
      }
    }
  }, [diagnostic, workflowContext, cacheOnly]);

  const clear = useCallback(() => {
    setContent(null);
    setError(null);
    setFromCache(false);
  }, []);

  // Auto-load when diagnostic changes
  useEffect(() => {
    if (autoLoad && diagnostic) {
      load();
    } else if (!diagnostic) {
      clear();
    }
  }, [diagnostic, autoLoad, load, clear]);

  return {
    content,
    isLoading,
    error,
    fromCache,
    load,
    clear,
    quickTip,
  };
}

// ============================================================================
// BATCH SUMMARIES HOOK
// ============================================================================

/**
 * Hook for loading educational summaries for multiple diagnostics.
 * Optimized for displaying quick info in a list of issues.
 *
 * @param diagnostics - Array of diagnostics to get summaries for
 * @param workflowContext - Workflow context
 * @param options - Configuration options
 * @returns Batch education state
 *
 * @example
 * ```tsx
 * const { summaries, isLoading } = useBatchEducation(lintResult.diagnostics, {
 *   modelName: 'sdxl.safetensors',
 * });
 *
 * return diagnostics.map(d => (
 *   <IssueCard
 *     key={d.ruleId}
 *     diagnostic={d}
 *     summary={summaries.get(d.ruleId)?.summary}
 *   />
 * ));
 * ```
 */
export function useBatchEducation(
  diagnostics: LintDiagnostic[],
  workflowContext: WorkflowContext,
  options: {
    /** Load automatically when diagnostics change */
    autoLoad?: boolean;
    /** Use only quick tips (no API calls) */
    quickTipsOnly?: boolean;
  } = {}
): BatchEducationState & {
  /** Manually trigger loading */
  load: () => Promise<void>;
  /** Get summary for a specific rule */
  getSummary: (ruleId: string) => { summary: string; topFix: string } | undefined;
} {
  const { autoLoad = true, quickTipsOnly = false } = options;

  const [summaries, setSummaries] = useState<Map<string, { summary: string; topFix: string }>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheHits, setCacheHits] = useState(0);

  // Track diagnostics to prevent stale updates
  const diagnosticsRef = useRef(diagnostics);
  diagnosticsRef.current = diagnostics;

  const load = useCallback(async () => {
    if (diagnostics.length === 0) {
      setSummaries(new Map());
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Start with quick tips for immediate display
      const ruleIds = diagnostics.map((d) => d.ruleId);
      const quickTips = getQuickTips(ruleIds);
      setSummaries(new Map(quickTips));

      if (quickTipsOnly) {
        setIsLoading(false);
        return;
      }

      // Fetch full summaries from API/cache
      const fullSummaries = await generateBatchEducationSummaries(
        diagnostics,
        workflowContext
      );

      // Merge with quick tips (API results take precedence)
      const merged = new Map(quickTips);
      let hits = 0;

      for (const [ruleId, summary] of fullSummaries) {
        merged.set(ruleId, summary);
        hits++;
      }

      // Verify still relevant
      if (diagnosticsRef.current === diagnostics) {
        setSummaries(merged);
        setCacheHits(hits);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load summaries';

      if (diagnosticsRef.current === diagnostics) {
        setError(message);
      }
    } finally {
      if (diagnosticsRef.current === diagnostics) {
        setIsLoading(false);
      }
    }
  }, [diagnostics, workflowContext, quickTipsOnly]);

  const getSummary = useCallback(
    (ruleId: string) => summaries.get(ruleId),
    [summaries]
  );

  // Auto-load when diagnostics change
  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [diagnostics, autoLoad, load]);

  return {
    summaries,
    isLoading,
    error,
    cacheHits,
    load,
    getSummary,
  };
}

// ============================================================================
// VISUAL EDUCATION HOOK
// ============================================================================

/**
 * Hook for loading image-aware educational content.
 * Use when you need explanations that reference specific visual elements.
 *
 * @param diagnostic - The diagnostic to explain
 * @param imageBase64 - Base64 encoded image
 * @param workflowContext - Workflow context
 * @returns Education state with visual-aware content
 */
export function useVisualEducation(
  diagnostic: LintDiagnostic | null,
  imageBase64: string | null,
  workflowContext: WorkflowContext
): EducationState & {
  load: () => Promise<void>;
} {
  const [content, setContent] = useState<EducationalContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const diagnosticRef = useRef(diagnostic);
  diagnosticRef.current = diagnostic;

  const load = useCallback(async () => {
    if (!diagnostic || !imageBase64) return;

    setIsLoading(true);
    setError(null);

    try {
      const newContent = await generateVisualEducation(
        diagnostic,
        imageBase64,
        workflowContext
      );

      if (diagnosticRef.current?.ruleId === diagnostic.ruleId) {
        setContent(newContent);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load visual education';

      if (diagnosticRef.current?.ruleId === diagnostic.ruleId) {
        setError(message);
      }
    } finally {
      if (diagnosticRef.current?.ruleId === diagnostic.ruleId) {
        setIsLoading(false);
      }
    }
  }, [diagnostic, imageBase64, workflowContext]);

  return {
    content,
    isLoading,
    error,
    fromCache: false, // Visual content is never cached
    load,
  };
}

// ============================================================================
// CACHE MANAGEMENT HOOK
// ============================================================================

/**
 * Hook for managing the education cache.
 * Useful for settings panels or admin views.
 *
 * @returns Cache management functions and stats
 */
export function useEducationCache(): {
  /** Perform cache maintenance (cleanup expired entries) */
  runMaintenance: () => Promise<{ expiredDeleted: number; overflowDeleted: number }>;
  /** Whether maintenance is running */
  isRunning: boolean;
  /** Last maintenance result */
  lastResult: { expiredDeleted: number; overflowDeleted: number } | null;
} {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{
    expiredDeleted: number;
    overflowDeleted: number;
  } | null>(null);

  const runMaintenance = useCallback(async () => {
    setIsRunning(true);

    try {
      const result = await performCacheMaintenance();
      setLastResult(result);
      return result;
    } finally {
      setIsRunning(false);
    }
  }, []);

  // Run maintenance on mount
  useEffect(() => {
    runMaintenance();
  }, [runMaintenance]);

  return {
    runMaintenance,
    isRunning,
    lastResult,
  };
}

// ============================================================================
// PRELOAD UTILITY
// ============================================================================

/**
 * Preloads educational content for a set of diagnostics.
 * Call this early to warm the cache before the user needs it.
 *
 * @param diagnostics - Diagnostics to preload education for
 * @param workflowContext - Workflow context
 * @param concurrency - Number of parallel requests (default: 2)
 */
export async function preloadEducation(
  diagnostics: LintDiagnostic[],
  workflowContext: WorkflowContext,
  concurrency = 2
): Promise<void> {
  // Filter to only high-priority diagnostics (errors and warnings)
  const priority = diagnostics.filter(
    (d) => d.severity === 'error' || d.severity === 'warning'
  );

  if (priority.length === 0) return;

  // Process in batches
  const queue = [...priority];

  const processNext = async (): Promise<void> => {
    while (queue.length > 0) {
      const diagnostic = queue.shift()!;

      try {
        await generateEducationalContent({
          diagnostic,
          workflowContext,
        });
      } catch {
        // Silently fail - this is just preloading
      }
    }
  };

  // Run with concurrency limit
  const workers = Array(Math.min(concurrency, queue.length))
    .fill(null)
    .map(() => processNext());

  await Promise.all(workers);
}
