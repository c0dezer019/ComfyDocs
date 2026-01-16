'use client';

/**
 * DiagnosticList Component
 *
 * Displays a filterable, sortable list of lint diagnostics.
 * Supports grouping by category and severity-based filtering.
 */

import React, { useState, useMemo } from 'react';
import {
  Filter,
  SortAsc,
  Layers,
  AlertCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { LintedQualityIssue } from '@/lib/lintTypes';
import { DiagnosticCard } from './DiagnosticCard';
import { WorkflowContext } from '@/hooks/useEducation';

// ============================================================================
// TYPES
// ============================================================================

type SortBy = 'severity' | 'category' | 'nodeId';
type GroupBy = 'none' | 'severity' | 'category' | 'nodeType';

interface DiagnosticListProps {
  /** Array of diagnostic issues to display */
  issues: LintedQualityIssue[];
  /** Workflow context for educational content */
  workflowContext?: WorkflowContext;
  /** Callback when node focus is requested */
  onFocusNode?: (nodeId: number) => void;
  /** Callback when image region focus is requested */
  onFocusRegion?: (box: [number, number, number, number]) => void;
  /** Whether to show filtering controls */
  showControls?: boolean;
  /** Whether to show empty state */
  showEmptyState?: boolean;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Maximum items to show (0 = unlimited) */
  maxItems?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SEVERITY_ORDER: Record<string, number> = {
  Critical: 0,
  Major: 1,
  Minor: 2,
  Note: 3,
};

const SEVERITY_COLORS: Record<string, string> = {
  Critical: 'text-red-400',
  Major: 'text-orange-400',
  Minor: 'text-yellow-400',
  Note: 'text-blue-400',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const DiagnosticList: React.FC<DiagnosticListProps> = ({
  issues,
  workflowContext = {},
  onFocusNode,
  onFocusRegion,
  showControls = true,
  showEmptyState = true,
  emptyMessage = 'No issues detected - your workflow looks good!',
  maxItems = 0,
}) => {
  // Filter and sort state
  const [severityFilter, setSeverityFilter] = useState<string[]>([
    'Critical',
    'Major',
    'Minor',
    'Note',
  ]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('severity');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(issues.map((i) => i.nodeType || 'Unknown'));
    return Array.from(cats).sort();
  }, [issues]);

  // Filter issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (!severityFilter.includes(issue.severity)) return false;
      if (categoryFilter && issue.nodeType !== categoryFilter) return false;
      return true;
    });
  }, [issues, severityFilter, categoryFilter]);

  // Sort issues
  const sortedIssues = useMemo(() => {
    const sorted = [...filteredIssues];

    switch (sortBy) {
      case 'severity':
        sorted.sort(
          (a, b) =>
            (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
        );
        break;
      case 'category':
        sorted.sort((a, b) =>
          (a.nodeType || '').localeCompare(b.nodeType || '')
        );
        break;
      case 'nodeId':
        sorted.sort((a, b) => (a.nodeId || 0) - (b.nodeId || 0));
        break;
    }

    return maxItems > 0 ? sorted.slice(0, maxItems) : sorted;
  }, [filteredIssues, sortBy, maxItems]);

  // Group issues
  const groupedIssues = useMemo(() => {
    if (groupBy === 'none') {
      return { '': sortedIssues };
    }

    const groups: Record<string, LintedQualityIssue[]> = {};

    for (const issue of sortedIssues) {
      let key: string;
      switch (groupBy) {
        case 'severity':
          key = issue.severity;
          break;
        case 'category':
          key = issue.type;
          break;
        case 'nodeType':
          key = issue.nodeType || 'Unknown';
          break;
        default:
          key = '';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(issue);
    }

    return groups;
  }, [sortedIssues, groupBy]);

  // Toggle severity filter
  const toggleSeverity = (severity: string) => {
    setSeverityFilter((prev) =>
      prev.includes(severity)
        ? prev.filter((s) => s !== severity)
        : [...prev, severity]
    );
  };

  // Count by severity
  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Critical: 0,
      Major: 0,
      Minor: 0,
      Note: 0,
    };

    for (const issue of issues) {
      counts[issue.severity] = (counts[issue.severity] || 0) + 1;
    }

    return counts;
  }, [issues]);

  // Empty state
  if (issues.length === 0 && showEmptyState) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-slate-400 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      {showControls && issues.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
          {/* Severity Filters */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-500" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Filter:
            </span>
            <div className="flex gap-1">
              {(['Critical', 'Major', 'Minor', 'Note'] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => toggleSeverity(sev)}
                  className={`
                    flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold
                    transition-all border
                    ${
                      severityFilter.includes(sev)
                        ? sev === 'Critical'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : sev === 'Major'
                          ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                          : sev === 'Minor'
                          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                        : 'bg-white/5 text-slate-500 border-white/5 opacity-50'
                    }
                  `}
                  aria-pressed={severityFilter.includes(sev)}
                >
                  <SeverityIcon severity={sev} size={10} />
                  <span className="uppercase">{sev}</span>
                  <span className="opacity-60">({severityCounts[sev]})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          {categories.length > 1 && (
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-slate-500" />
              <select
                value={categoryFilter || ''}
                onChange={(e) =>
                  setCategoryFilter(e.target.value || null)
                }
                className="bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-slate-300 px-3 py-1.5 outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort */}
          <div className="flex items-center gap-2">
            <SortAsc size={14} className="text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-slate-300 px-3 py-1.5 outline-none"
            >
              <option value="severity">Sort by Severity</option>
              <option value="category">Sort by Category</option>
              <option value="nodeId">Sort by Node ID</option>
            </select>
          </div>

          {/* Group */}
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-slate-500" />
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-slate-300 px-3 py-1.5 outline-none"
            >
              <option value="none">No Grouping</option>
              <option value="severity">Group by Severity</option>
              <option value="category">Group by Category</option>
              <option value="nodeType">Group by Node Type</option>
            </select>
          </div>

          {/* Count */}
          <div className="ml-auto text-[10px] text-slate-500">
            Showing {sortedIssues.length} of {issues.length} issues
          </div>
        </div>
      )}

      {/* Issue List */}
      <div className="space-y-6">
        {Object.entries(groupedIssues).map(([group, groupIssues]) => (
          <div key={group || 'all'}>
            {/* Group Header */}
            {group && groupBy !== 'none' && (
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest">
                  {group}
                </h3>
                <span className="text-[10px] text-slate-500">
                  ({groupIssues.length})
                </span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
            )}

            {/* Issues */}
            <div className="space-y-3">
              {groupIssues.map((issue, idx) => (
                <DiagnosticCard
                  key={issue.id || `${issue.ruleId}-${issue.nodeId}-${idx}`}
                  issue={issue}
                  workflowContext={workflowContext}
                  onFocusNode={onFocusNode}
                  onFocusRegion={onFocusRegion}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Truncation Notice */}
      {maxItems > 0 && filteredIssues.length > maxItems && (
        <div className="text-center py-4 text-sm text-slate-500">
          Showing {maxItems} of {filteredIssues.length} issues.
          {/* Could add a "Show All" button here */}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const SeverityIcon: React.FC<{ severity: string; size?: number }> = ({
  severity,
  size = 14,
}) => {
  switch (severity) {
    case 'Critical':
      return <AlertCircle size={size} className="text-red-400" />;
    case 'Major':
      return <AlertTriangle size={size} className="text-orange-400" />;
    case 'Minor':
      return <AlertTriangle size={size} className="text-yellow-400" />;
    default:
      return <Info size={size} className="text-blue-400" />;
  }
};

export default DiagnosticList;
