/**
 * ComfyDocs Education Cache Service
 *
 * IndexedDB-based caching layer for AI-generated educational content.
 * Separates educational explanations from analysis results to enable:
 * - Longer cache lifetimes for stable educational content
 * - Rule-based cache invalidation when rules change
 * - Efficient retrieval without re-calling AI for known issues
 */

import { EducationalContent } from '@/lib/lintTypes';

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

const DB_NAME = 'ComfyDocsDB';
const EDUCATION_STORE = 'education_cache';
const DB_VERSION = 2; // Bump from 1 to add education store

/**
 * Cache entry expiry time (7 days in milliseconds).
 * Educational content is relatively stable and can be cached longer.
 */
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Maximum number of cached entries before cleanup triggers.
 */
const MAX_CACHE_ENTRIES = 500;

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

/**
 * Opens the IndexedDB database, creating stores if needed.
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[EducationCache] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create education cache store if it doesn't exist
      if (!db.objectStoreNames.contains(EDUCATION_STORE)) {
        const store = db.createObjectStore(EDUCATION_STORE, {
          keyPath: 'contentKey',
        });

        // Index for querying by rule ID (for bulk invalidation)
        store.createIndex('ruleId', 'ruleId', { unique: false });

        // Index for querying by generation time (for expiry cleanup)
        store.createIndex('generatedAt', 'generatedAt', { unique: false });

        // Index for querying by node type (for analytics)
        store.createIndex('nodeType', 'nodeType', { unique: false });

        console.debug('[EducationCache] Created education_cache store');
      }

      // Ensure analysis_cache store exists (from original cacheService)
      if (!db.objectStoreNames.contains('analysis_cache')) {
        db.createObjectStore('analysis_cache', { keyPath: 'hash' });
      }
    };
  });
};

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

/**
 * Generates a unique cache key for educational content.
 * Key is based on rule ID, node type, and relevant workflow context.
 *
 * @param ruleId - The lint rule ID
 * @param nodeType - The ComfyUI node type
 * @param context - Optional context for more specific caching
 * @returns Unique cache key string
 */
export function generateEducationKey(
  ruleId: string,
  nodeType: string,
  context?: {
    samplerType?: string;
    modelFamily?: 'sd15' | 'sdxl' | 'sd3' | 'flux' | 'unknown';
  }
): string {
  const parts = [
    ruleId,
    nodeType.toLowerCase().replace(/[^a-z0-9]/g, '_'),
  ];

  if (context?.samplerType) {
    parts.push(context.samplerType.toLowerCase().replace(/[^a-z0-9]/g, '_'));
  }

  if (context?.modelFamily) {
    parts.push(context.modelFamily);
  }

  return parts.join('::');
}

/**
 * Determines the model family from a model name.
 */
export function detectModelFamily(
  modelName?: string
): 'sd15' | 'sdxl' | 'sd3' | 'flux' | 'unknown' {
  if (!modelName) return 'unknown';

  const name = modelName.toLowerCase();

  if (name.includes('flux')) return 'flux';
  if (name.includes('sd3') || name.includes('stable-diffusion-3')) return 'sd3';
  if (name.includes('xl') || name.includes('sdxl') || name.includes('pony')) return 'sdxl';
  if (name.includes('1.5') || name.includes('v1-5') || name.includes('sd15')) return 'sd15';

  return 'unknown';
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Retrieves cached educational content by key.
 * Returns null if not found or expired.
 *
 * @param contentKey - The cache key to look up
 * @returns Cached content or null
 */
export async function getCachedEducation(
  contentKey: string
): Promise<EducationalContent | null> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(EDUCATION_STORE, 'readonly');
      const store = tx.objectStore(EDUCATION_STORE);
      const request = store.get(contentKey);

      request.onsuccess = () => {
        const result = request.result as EducationalContent | undefined;

        if (!result) {
          resolve(null);
          return;
        }

        // Check expiry
        if (Date.now() - result.generatedAt > CACHE_EXPIRY_MS) {
          console.debug(`[EducationCache] Cache expired for: ${contentKey}`);
          resolve(null);
          return;
        }

        resolve(result);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[EducationCache] Read failed:', err);
    return null;
  }
}

/**
 * Stores educational content in the cache.
 *
 * @param content - The educational content to cache
 */
export async function cacheEducation(
  content: EducationalContent
): Promise<void> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(EDUCATION_STORE, 'readwrite');
      const store = tx.objectStore(EDUCATION_STORE);
      const request = store.put(content);

      request.onsuccess = () => {
        console.debug(`[EducationCache] Cached: ${content.contentKey}`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[EducationCache] Write failed:', err);
  }
}

/**
 * Retrieves multiple cached entries by their keys.
 * More efficient than individual lookups for batch operations.
 *
 * @param contentKeys - Array of cache keys to look up
 * @returns Map of contentKey -> EducationalContent (only found entries)
 */
export async function getCachedEducationBatch(
  contentKeys: string[]
): Promise<Map<string, EducationalContent>> {
  const results = new Map<string, EducationalContent>();

  if (contentKeys.length === 0) return results;

  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(EDUCATION_STORE, 'readonly');
      const store = tx.objectStore(EDUCATION_STORE);
      let completed = 0;

      for (const key of contentKeys) {
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result as EducationalContent | undefined;

          if (result && Date.now() - result.generatedAt <= CACHE_EXPIRY_MS) {
            results.set(key, result);
          }

          completed++;
          if (completed === contentKeys.length) {
            resolve(results);
          }
        };

        request.onerror = () => {
          completed++;
          if (completed === contentKeys.length) {
            resolve(results);
          }
        };
      }
    });
  } catch (err) {
    console.error('[EducationCache] Batch read failed:', err);
    return results;
  }
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Clears expired entries from the cache.
 *
 * @returns Number of entries deleted
 */
export async function cleanupExpiredEducation(): Promise<number> {
  try {
    const db = await openDB();
    const cutoff = Date.now() - CACHE_EXPIRY_MS;
    let deleted = 0;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(EDUCATION_STORE, 'readwrite');
      const store = tx.objectStore(EDUCATION_STORE);
      const index = store.index('generatedAt');
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deleted++;
          cursor.continue();
        }
      };

      tx.oncomplete = () => {
        if (deleted > 0) {
          console.debug(`[EducationCache] Cleaned up ${deleted} expired entries`);
        }
        resolve(deleted);
      };

      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('[EducationCache] Cleanup failed:', err);
    return 0;
  }
}

/**
 * Invalidates all cached content for a specific rule.
 * Useful when a rule's logic or educational content changes.
 *
 * @param ruleId - The rule ID to invalidate
 * @returns Number of entries deleted
 */
export async function invalidateRuleEducation(ruleId: string): Promise<number> {
  try {
    const db = await openDB();
    let deleted = 0;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(EDUCATION_STORE, 'readwrite');
      const store = tx.objectStore(EDUCATION_STORE);
      const index = store.index('ruleId');
      const range = IDBKeyRange.only(ruleId);
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deleted++;
          cursor.continue();
        }
      };

      tx.oncomplete = () => {
        console.debug(`[EducationCache] Invalidated ${deleted} entries for rule: ${ruleId}`);
        resolve(deleted);
      };

      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('[EducationCache] Rule invalidation failed:', err);
    return 0;
  }
}

/**
 * Clears all educational content from the cache.
 *
 * @returns Number of entries deleted
 */
export async function clearAllEducation(): Promise<number> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(EDUCATION_STORE, 'readwrite');
      const store = tx.objectStore(EDUCATION_STORE);
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        const count = countRequest.result;
        store.clear();

        tx.oncomplete = () => {
          console.debug(`[EducationCache] Cleared all ${count} entries`);
          resolve(count);
        };

        tx.onerror = () => reject(tx.error);
      };

      countRequest.onerror = () => reject(countRequest.error);
    });
  } catch (err) {
    console.error('[EducationCache] Clear failed:', err);
    return 0;
  }
}

/**
 * Gets cache statistics.
 *
 * @returns Cache statistics object
 */
export async function getEducationCacheStats(): Promise<{
  totalEntries: number;
  oldestEntry: number | null;
  newestEntry: number | null;
  entriesByRule: Record<string, number>;
}> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(EDUCATION_STORE, 'readonly');
      const store = tx.objectStore(EDUCATION_STORE);

      const stats = {
        totalEntries: 0,
        oldestEntry: null as number | null,
        newestEntry: null as number | null,
        entriesByRule: {} as Record<string, number>,
      };

      const cursorRequest = store.openCursor();

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;

        if (cursor) {
          const entry = cursor.value as EducationalContent;
          stats.totalEntries++;

          // Track oldest/newest
          if (stats.oldestEntry === null || entry.generatedAt < stats.oldestEntry) {
            stats.oldestEntry = entry.generatedAt;
          }
          if (stats.newestEntry === null || entry.generatedAt > stats.newestEntry) {
            stats.newestEntry = entry.generatedAt;
          }

          // Count by rule
          stats.entriesByRule[entry.ruleId] =
            (stats.entriesByRule[entry.ruleId] || 0) + 1;

          cursor.continue();
        } else {
          resolve(stats);
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  } catch (err) {
    console.error('[EducationCache] Stats failed:', err);
    return {
      totalEntries: 0,
      oldestEntry: null,
      newestEntry: null,
      entriesByRule: {},
    };
  }
}

/**
 * Performs cache maintenance: cleanup expired entries and enforce size limits.
 * Should be called periodically (e.g., on app startup).
 */
export async function performCacheMaintenance(): Promise<{
  expiredDeleted: number;
  overflowDeleted: number;
}> {
  // First, clean up expired entries
  const expiredDeleted = await cleanupExpiredEducation();

  // Then check if we're over the limit
  let overflowDeleted = 0;

  try {
    const stats = await getEducationCacheStats();

    if (stats.totalEntries > MAX_CACHE_ENTRIES) {
      const db = await openDB();
      const toDelete = stats.totalEntries - MAX_CACHE_ENTRIES + 50; // Delete 50 extra for headroom

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(EDUCATION_STORE, 'readwrite');
        const store = tx.objectStore(EDUCATION_STORE);
        const index = store.index('generatedAt');
        const request = index.openCursor();

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor && overflowDeleted < toDelete) {
            cursor.delete();
            overflowDeleted++;
            cursor.continue();
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      console.debug(`[EducationCache] Deleted ${overflowDeleted} entries for size limit`);
    }
  } catch (err) {
    console.error('[EducationCache] Overflow cleanup failed:', err);
  }

  return { expiredDeleted, overflowDeleted };
}
