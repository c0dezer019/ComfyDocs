'use client';

/**
 * LintSettingsPanel Component
 *
 * Settings panel for configuring lint rules.
 * Allows users to enable/disable rules by category,
 * adjust severity thresholds, and view rule statistics.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Bug,
  Settings2,
  ChevronDown,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Trash2,
  Database,
} from 'lucide-react';
import { LintRule, GlobalLintRule, LintConfig } from '@/lib/lintTypes';
import { builtinRules, getRulesByCategory } from '@/rules';
import { useRuleStats } from '@/hooks/useLinter';
import { getEducationCacheStats, clearAllEducation } from '@/utils/educationCache';

// ============================================================================
// TYPES
// ============================================================================

interface LintSettingsPanelProps {
  /** Current lint configuration */
  config: LintConfig;
  /** Callback when configuration changes */
  onConfigChange: (config: LintConfig) => void;
  /** Whether to show cache management options */
  showCacheManagement?: boolean;
}

interface CategoryState {
  expanded: boolean;
  allEnabled: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  sampling: { label: 'Sampling', icon: <Settings2 size={14} /> },
  model: { label: 'Model & Checkpoint', icon: <Database size={14} /> },
  vae: { label: 'VAE', icon: <Database size={14} /> },
  workflow: { label: 'Workflow Structure', icon: <Bug size={14} /> },
  prompt: { label: 'Prompts', icon: <Info size={14} /> },
  performance: { label: 'Performance', icon: <RefreshCw size={14} /> },
};

const SEVERITY_COLORS: Record<string, string> = {
  error: 'border-red-200 bg-red-50 text-status-error',
  warning: 'border-amber-200 bg-amber-50 text-status-warning',
  info: 'border-sky-200 bg-sky-50 text-status-info',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const LintSettingsPanel: React.FC<LintSettingsPanelProps> = ({
  config,
  onConfigChange,
  showCacheManagement = true,
}) => {
  const ruleStats = useRuleStats();
  const rulesByCategory = useMemo(() => getRulesByCategory(), []);

  // Category expansion state
  const [categoryStates, setCategoryStates] = useState<Record<string, CategoryState>>({});

  // Cache stats
  const [cacheStats, setCacheStats] = useState<{
    totalEntries: number;
    entriesByRule: Record<string, number>;
  } | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Initialize category states
  useEffect(() => {
    const states: Record<string, CategoryState> = {};
    for (const [category, rules] of rulesByCategory.entries()) {
      const allEnabled = rules.every((r) => {
        const override = config.ruleOverrides?.[r.id];
        return override?.enabled ?? r.defaultEnabled;
      });
      states[category] = { expanded: false, allEnabled };
    }
    setCategoryStates(states);
  }, [rulesByCategory, config.ruleOverrides]);

  // Load cache stats
  useEffect(() => {
    if (showCacheManagement) {
      getEducationCacheStats().then(setCacheStats);
    }
  }, [showCacheManagement]);

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setCategoryStates((prev) => ({
      ...prev,
      [category]: { ...prev[category], expanded: !prev[category]?.expanded },
    }));
  };

  // Toggle all rules in a category
  const toggleCategoryEnabled = (category: string) => {
    const rules = rulesByCategory.get(category) || [];
    const allCurrentlyEnabled = categoryStates[category]?.allEnabled ?? true;
    const newEnabled = !allCurrentlyEnabled;

    const newOverrides = { ...config.ruleOverrides };
    for (const rule of rules) {
      newOverrides[rule.id] = {
        ...newOverrides[rule.id],
        enabled: newEnabled,
      };
    }

    onConfigChange({
      ...config,
      ruleOverrides: newOverrides,
    });
  };

  // Toggle individual rule
  const toggleRule = (ruleId: string, currentEnabled: boolean) => {
    const newOverrides = { ...config.ruleOverrides };
    newOverrides[ruleId] = {
      ...newOverrides[ruleId],
      enabled: !currentEnabled,
    };

    onConfigChange({
      ...config,
      ruleOverrides: newOverrides,
    });
  };

  // Update include info setting
  const toggleIncludeInfo = () => {
    onConfigChange({
      ...config,
      includeInfo: !config.includeInfo,
    });
  };

  // Clear cache
  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await clearAllEducation();
      const newStats = await getEducationCacheStats();
      setCacheStats(newStats);
    } finally {
      setIsClearingCache(false);
    }
  };

  // Reset to defaults
  const handleResetDefaults = () => {
    onConfigChange({
      ...config,
      ruleOverrides: {},
      includeInfo: true,
    });
  };

  // Check if rule is enabled
  const isRuleEnabled = (rule: LintRule | GlobalLintRule): boolean => {
    const override = config.ruleOverrides?.[rule.id];
    return override?.enabled ?? rule.defaultEnabled;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-icon bg-accent-subtle p-2 text-status-info">
            <Bug size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text">Lint Rules Configuration</h3>
            <p className="text-xs text-text-secondary">
              {ruleStats?.total || builtinRules.length} rules available
            </p>
          </div>
        </div>
        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-2 rounded-button px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-muted hover:text-text"
        >
          <RefreshCw size={12} />
          Reset to Defaults
        </button>
      </div>

      {/* Global Settings */}
      <div className="space-y-4 rounded-card border border-border bg-surface p-4 shadow-subtle">
        <h4 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          Global Settings
        </h4>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-text">Include Info Diagnostics</span>
            <p className="text-xs text-text-secondary">
              Show informational suggestions alongside warnings and errors
            </p>
          </div>
          <button
            onClick={toggleIncludeInfo}
            className={`p-1 rounded-lg transition-colors ${
              config.includeInfo ? 'text-status-info' : 'text-text-muted'
            }`}
            aria-pressed={config.includeInfo}
          >
            {config.includeInfo ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>
      </div>

      {/* Rules by Category */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
          Rules by Category
        </h4>

        {Array.from(rulesByCategory.entries()).map(([category, rules]) => {
          const state = categoryStates[category] || { expanded: false, allEnabled: true };
          const categoryInfo = CATEGORY_LABELS[category] || {
            label: category,
            icon: <Bug size={14} />,
          };

          // Count enabled rules
          const enabledCount = rules.filter((r) => isRuleEnabled(r)).length;

          return (
            <div
              key={category}
              className="overflow-hidden rounded-card border border-border bg-surface shadow-subtle"
            >
              {/* Category Header */}
              <div
                className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-surface-muted"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-button text-text-secondary"
                    aria-expanded={state.expanded}
                  >
                    {state.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <span className="text-text-secondary">{categoryInfo.icon}</span>
                  <span className="text-sm font-semibold text-text">{categoryInfo.label}</span>
                  <span className="text-xs text-text-secondary">
                    ({enabledCount}/{rules.length} enabled)
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCategoryEnabled(category);
                  }}
                  className={`p-1 rounded-lg transition-colors ${
                    state.allEnabled ? 'text-status-info' : 'text-text-muted'
                  }`}
                  aria-label={`Toggle all ${categoryInfo.label} rules`}
                >
                  {state.allEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
              </div>

              {/* Rules List */}
              {state.expanded && (
                <div className="divide-y divide-border border-t border-border">
                  {rules.map((rule) => {
                    const enabled = isRuleEnabled(rule);
                    const SeverityIcon =
                      rule.severity === 'error'
                        ? AlertCircle
                        : rule.severity === 'warning'
                          ? AlertTriangle
                          : Info;

                    return (
                      <div
                        key={rule.id}
                        className={`p-4 flex items-start gap-4 ${enabled ? '' : 'opacity-50'}`}
                      >
                        <button
                          onClick={() => toggleRule(rule.id, enabled)}
                          className={`mt-0.5 p-0.5 rounded transition-colors ${
                            enabled ? 'text-status-info' : 'text-text-muted'
                          }`}
                          aria-label={`${enabled ? 'Disable' : 'Enable'} ${rule.name}`}
                        >
                          {enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-text">{rule.name}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                SEVERITY_COLORS[rule.severity]
                              }`}
                            >
                              <SeverityIcon size={10} className="inline mr-1" />
                              {rule.severity}
                            </span>
                            {'isGlobal' in rule && rule.isGlobal && (
                              <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-status-info">
                                Global
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-text-secondary">{rule.rationale}</p>
                          <code className="mt-1 block font-mono text-[10px] text-text-muted">
                            {rule.id}
                          </code>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cache Management */}
      {showCacheManagement && (
        <div className="space-y-4 rounded-card border border-border bg-surface p-4 shadow-subtle">
          <h4 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
            Education Cache
          </h4>

          {cacheStats && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-secondary">Cached Entries</span>
                <span className="ml-2 text-text">{cacheStats.totalEntries}</span>
              </div>
              <div>
                <span className="text-text-secondary">Rules with Cache</span>
                <span className="ml-2 text-text">
                  {Object.keys(cacheStats.entriesByRule).length}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleClearCache}
            disabled={isClearingCache}
            className="flex items-center gap-2 rounded-button border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-status-error transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 size={14} />
            {isClearingCache ? 'Clearing...' : 'Clear Education Cache'}
          </button>
          <p className="text-xs text-text-muted">
            Educational content is cached for 7 days. Clear to refresh explanations.
          </p>
        </div>
      )}
    </div>
  );
};

export default LintSettingsPanel;
