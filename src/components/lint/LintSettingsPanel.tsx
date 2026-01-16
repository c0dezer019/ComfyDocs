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
  error: 'text-red-400 bg-red-500/10 border-red-500/30',
  warning: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
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
          <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400">
            <Bug size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Lint Rules Configuration</h3>
            <p className="text-xs text-slate-500">
              {ruleStats?.total || builtinRules.length} rules available
            </p>
          </div>
        </div>
        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <RefreshCw size={12} />
          Reset to Defaults
        </button>
      </div>

      {/* Global Settings */}
      <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-4">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
          Global Settings
        </h4>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-white">Include Info Diagnostics</span>
            <p className="text-xs text-slate-500">
              Show informational suggestions alongside warnings and errors
            </p>
          </div>
          <button
            onClick={toggleIncludeInfo}
            className={`p-1 rounded-lg transition-colors ${
              config.includeInfo ? 'text-indigo-400' : 'text-slate-600'
            }`}
            aria-pressed={config.includeInfo}
          >
            {config.includeInfo ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>
      </div>

      {/* Rules by Category */}
      <div className="space-y-2">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
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
              className="bg-white/5 rounded-xl border border-white/5 overflow-hidden"
            >
              {/* Category Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex items-center gap-3">
                  <button
                    className="text-slate-500"
                    aria-expanded={state.expanded}
                  >
                    {state.expanded ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>
                  <span className="text-slate-400">{categoryInfo.icon}</span>
                  <span className="text-sm font-bold text-white">{categoryInfo.label}</span>
                  <span className="text-xs text-slate-500">
                    ({enabledCount}/{rules.length} enabled)
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCategoryEnabled(category);
                  }}
                  className={`p-1 rounded-lg transition-colors ${
                    state.allEnabled ? 'text-indigo-400' : 'text-slate-600'
                  }`}
                  aria-label={`Toggle all ${categoryInfo.label} rules`}
                >
                  {state.allEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
              </div>

              {/* Rules List */}
              {state.expanded && (
                <div className="border-t border-white/5 divide-y divide-white/5">
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
                        className={`p-4 flex items-start gap-4 ${
                          enabled ? '' : 'opacity-50'
                        }`}
                      >
                        <button
                          onClick={() => toggleRule(rule.id, enabled)}
                          className={`mt-0.5 p-0.5 rounded transition-colors ${
                            enabled ? 'text-indigo-400' : 'text-slate-600'
                          }`}
                          aria-label={`${enabled ? 'Disable' : 'Enable'} ${rule.name}`}
                        >
                          {enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white">{rule.name}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                                SEVERITY_COLORS[rule.severity]
                              }`}
                            >
                              <SeverityIcon size={10} className="inline mr-1" />
                              {rule.severity}
                            </span>
                            {'isGlobal' in rule && rule.isGlobal && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-violet-500/10 text-violet-400 border border-violet-500/30">
                                Global
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{rule.rationale}</p>
                          <code className="text-[10px] text-slate-600 font-mono mt-1 block">
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
        <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-4">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Education Cache
          </h4>

          {cacheStats && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Cached Entries</span>
                <span className="text-white ml-2">{cacheStats.totalEntries}</span>
              </div>
              <div>
                <span className="text-slate-500">Rules with Cache</span>
                <span className="text-white ml-2">
                  {Object.keys(cacheStats.entriesByRule).length}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleClearCache}
            disabled={isClearingCache}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} />
            {isClearingCache ? 'Clearing...' : 'Clear Education Cache'}
          </button>
          <p className="text-xs text-slate-600">
            Educational content is cached for 7 days. Clear to refresh explanations.
          </p>
        </div>
      )}
    </div>
  );
};

export default LintSettingsPanel;
