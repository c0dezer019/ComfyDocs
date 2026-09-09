/**
 * ComfyDocs Lint System Bootstrap
 *
 * Initialization module for the educational linting system.
 * Call initializeLintSystem() during application startup.
 */

import { registerBuiltinRules, areRulesRegistered } from '@/rules';
import { performCacheMaintenance } from '@/utils/educationCache';
import { ruleRegistry, DEFAULT_LINT_CONFIG } from '@/utils/lintEngine';

// ============================================================================
// INITIALIZATION STATE
// ============================================================================

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

// ============================================================================
// MAIN INITIALIZATION
// ============================================================================

/**
 * Initializes the linting system.
 * Safe to call multiple times - subsequent calls are no-ops.
 *
 * @param options - Initialization options
 * @returns Promise that resolves when initialization is complete
 *
 * @example
 * ```tsx
 * // In App.tsx useEffect
 * useEffect(() => {
 *   initializeLintSystem().then(() => {
 *     console.log('Lint system ready');
 *   });
 * }, []);
 * ```
 */
export async function initializeLintSystem(options: {
  /** Whether to run cache maintenance on startup */
  runCacheMaintenance?: boolean;
  /** Whether to log initialization details */
  verbose?: boolean;
} = {}): Promise<void> {
  const { runCacheMaintenance = true, verbose = false } = options;

  // Return existing promise if already initializing
  if (initializationPromise) {
    return initializationPromise;
  }

  // Skip if already initialized
  if (isInitialized) {
    if (verbose) {
      console.debug('[LintBootstrap] Already initialized, skipping.');
    }
    return Promise.resolve();
  }

  initializationPromise = (async () => {
    const startTime = performance.now();

    if (verbose) {
      console.group('[LintBootstrap] Initializing lint system...');
    }

    try {
      // Step 1: Register built-in rules
      if (!areRulesRegistered()) {
        registerBuiltinRules();

        if (verbose) {
          const summary = ruleRegistry.getSummary();
          console.debug('[LintBootstrap] Rules registered:', {
            total: summary.total,
            byCategory: summary.byCategory,
            bySeverity: summary.bySeverity,
          });
        }
      } else if (verbose) {
        console.debug('[LintBootstrap] Rules already registered, skipping.');
      }

      // Step 2: Run cache maintenance (non-blocking)
      if (runCacheMaintenance) {
        // Don't await - let it run in background
        performCacheMaintenance()
          .then((result) => {
            if (verbose && (result.expiredDeleted > 0 || result.overflowDeleted > 0)) {
              console.debug('[LintBootstrap] Cache maintenance complete:', result);
            }
          })
          .catch((err) => {
            console.warn('[LintBootstrap] Cache maintenance failed:', err);
          });
      }

      isInitialized = true;

      const endTime = performance.now();

      if (verbose) {
        console.debug(`[LintBootstrap] Initialization complete in ${Math.round(endTime - startTime)}ms`);
        console.groupEnd();
      }
    } catch (err) {
      console.error('[LintBootstrap] Initialization failed:', err);
      if (verbose) {
        console.groupEnd();
      }
      throw err;
    }
  })();

  return initializationPromise;
}

// ============================================================================
// STATUS UTILITIES
// ============================================================================

/**
 * Checks if the lint system has been initialized.
 */
export function isLintSystemInitialized(): boolean {
  return isInitialized;
}

/**
 * Gets the current lint system status.
 */
export function getLintSystemStatus(): {
  initialized: boolean;
  rulesRegistered: boolean;
  ruleCount: number;
  defaultConfig: typeof DEFAULT_LINT_CONFIG;
} {
  return {
    initialized: isInitialized,
    rulesRegistered: areRulesRegistered(),
    ruleCount: ruleRegistry.size,
    defaultConfig: DEFAULT_LINT_CONFIG,
  };
}

/**
 * Resets the lint system.
 * Mainly useful for testing.
 */
export function resetLintSystem(): void {
  isInitialized = false;
  initializationPromise = null;
  // Note: This doesn't clear the rule registry
  // Call ruleRegistry.clear() separately if needed
}

// ============================================================================
// REACT HOOK
// ============================================================================

/**
 * React hook for ensuring lint system is initialized.
 * Returns initialization status and error if any.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isReady, error } = useLintSystemInit();
 *
 *   if (!isReady) return <Loading />;
 *   if (error) return <Error message={error} />;
 *
 *   return <MainApp />;
 * }
 * ```
 */
export function useLintSystemInit(options?: Parameters<typeof initializeLintSystem>[0]): {
  isReady: boolean;
  error: string | null;
} {
  // This is a simple synchronous check since initialization is fast
  // For async initialization, use useEffect in your component

  if (!isInitialized && !initializationPromise) {
    // Trigger initialization
    initializeLintSystem(options).catch(() => {
      // Error handled in initialization
    });
  }

  return {
    isReady: isInitialized,
    error: null,
  };
}

// ============================================================================
// AUTO-INITIALIZATION FOR MODULE IMPORT
// ============================================================================

/**
 * Enable auto-initialization when this module is imported.
 * Uncomment the line below if you want rules registered on import.
 */
// initializeLintSystem({ verbose: process.env.NODE_ENV === 'development' });

export default initializeLintSystem;
