'use client';

/**
 * LintSummary Component
 *
 * Displays a quick summary of lint results with severity counts
 * and overall health indicator.
 */

import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Loader2,
  Clock,
  Cpu,
  Layers,
} from 'lucide-react';
import { LintMetadata } from '@/lib/lintTypes';

// ============================================================================
// TYPES
// ============================================================================

interface LintSummaryProps {
  /** Count of error-level diagnostics */
  errorCount: number;
  /** Count of warning-level diagnostics */
  warningCount: number;
  /** Count of info-level diagnostics */
  infoCount: number;
  /** Overall workflow health score (0-10) */
  overallScore?: number;
  /** Whether linting is currently in progress */
  isLinting?: boolean;
  /** Lint execution metadata */
  metadata?: LintMetadata | null;
  /** Callback when lint is triggered */
  onRunLint?: () => void;
  /** Visual style variant */
  variant?: 'compact' | 'expanded';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const LintSummary: React.FC<LintSummaryProps> = ({
  errorCount,
  warningCount,
  infoCount,
  overallScore,
  isLinting = false,
  metadata,
  onRunLint,
  variant = 'compact',
}) => {
  const totalCount = errorCount + warningCount + infoCount;
  const hasIssues = totalCount > 0;

  // Determine health status
  const healthStatus = errorCount > 0
    ? 'critical'
    : warningCount > 0
    ? 'warning'
    : 'healthy';

  const healthColors = {
    critical: 'from-red-500/20 to-rose-500/10 border-red-500/30',
    warning: 'from-orange-500/20 to-amber-500/10 border-orange-500/30',
    healthy: 'from-green-500/20 to-emerald-500/10 border-green-500/30',
  };

  const healthTextColors = {
    critical: 'text-red-400',
    warning: 'text-orange-400',
    healthy: 'text-green-400',
  };

  if (variant === 'compact') {
    return (
      <div
        className={`
          flex items-center gap-4 px-4 py-2.5 rounded-xl border
          bg-gradient-to-r ${healthColors[healthStatus]}
        `}
      >
        {/* Status Icon */}
        {isLinting ? (
          <Loader2 size={18} className="animate-spin text-indigo-400" />
        ) : healthStatus === 'healthy' ? (
          <CheckCircle2 size={18} className="text-green-400" />
        ) : healthStatus === 'critical' ? (
          <AlertCircle size={18} className="text-red-400" />
        ) : (
          <AlertTriangle size={18} className="text-orange-400" />
        )}

        {/* Counts */}
        <div className="flex items-center gap-3">
          <CountBadge
            icon={AlertCircle}
            count={errorCount}
            color="text-red-400"
            bgColor="bg-red-500/10"
            label="Errors"
          />
          <CountBadge
            icon={AlertTriangle}
            count={warningCount}
            color="text-orange-400"
            bgColor="bg-orange-500/10"
            label="Warnings"
          />
          <CountBadge
            icon={Info}
            count={infoCount}
            color="text-blue-400"
            bgColor="bg-blue-500/10"
            label="Info"
          />
        </div>

        {/* Score */}
        {overallScore !== undefined && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Score
            </span>
            <span
              className={`text-lg font-black ${getScoreColor(overallScore)}`}
            >
              {overallScore.toFixed(1)}
            </span>
          </div>
        )}

        {/* Run Button */}
        {onRunLint && (
          <button
            onClick={onRunLint}
            disabled={isLinting}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
          >
            {isLinting ? 'Analyzing...' : 'Re-analyze'}
          </button>
        )}
      </div>
    );
  }

  // Expanded variant
  return (
    <div
      className={`
        p-6 rounded-2xl border
        bg-gradient-to-br ${healthColors[healthStatus]}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {isLinting ? (
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-indigo-400" />
            </div>
          ) : (
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                healthStatus === 'healthy'
                  ? 'bg-green-500/20'
                  : healthStatus === 'critical'
                  ? 'bg-red-500/20'
                  : 'bg-orange-500/20'
              }`}
            >
              {healthStatus === 'healthy' ? (
                <CheckCircle2 size={20} className="text-green-400" />
              ) : healthStatus === 'critical' ? (
                <AlertCircle size={20} className="text-red-400" />
              ) : (
                <AlertTriangle size={20} className="text-orange-400" />
              )}
            </div>
          )}
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Workflow Analysis
            </h3>
            <p className={`text-xs ${healthTextColors[healthStatus]}`}>
              {isLinting
                ? 'Analyzing workflow...'
                : !hasIssues
                ? 'No issues detected'
                : `${totalCount} issue${totalCount !== 1 ? 's' : ''} found`}
            </p>
          </div>
        </div>

        {/* Score Circle */}
        {overallScore !== undefined && (
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-white/5"
              />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${(overallScore / 10) * 100}, 100`}
                className={getScoreColor(overallScore)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-black ${getScoreColor(overallScore)}`}>
                {overallScore.toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Severity Breakdown */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SeverityCard
          icon={AlertCircle}
          label="Errors"
          count={errorCount}
          color="text-red-400"
          bgColor="bg-red-500/10"
          borderColor="border-red-500/20"
        />
        <SeverityCard
          icon={AlertTriangle}
          label="Warnings"
          count={warningCount}
          color="text-orange-400"
          bgColor="bg-orange-500/10"
          borderColor="border-orange-500/20"
        />
        <SeverityCard
          icon={Info}
          label="Info"
          count={infoCount}
          color="text-blue-400"
          bgColor="bg-blue-500/10"
          borderColor="border-blue-500/20"
        />
      </div>

      {/* Metadata */}
      {metadata && (
        <div className="flex items-center gap-6 text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Layers size={12} />
            <span>{metadata.nodesAnalyzed} nodes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu size={12} />
            <span>{metadata.rulesRun} rules</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={12} />
            <span>{metadata.executionTimeMs}ms</span>
          </div>
        </div>
      )}

      {/* Run Button */}
      {onRunLint && (
        <button
          onClick={onRunLint}
          disabled={isLinting}
          className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
        >
          {isLinting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Analyzing...
            </span>
          ) : (
            'Run Analysis'
          )}
        </button>
      )}
    </div>
  );
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface CountBadgeProps {
  icon: React.FC<{ size?: number; className?: string }>;
  count: number;
  color: string;
  bgColor: string;
  label: string;
}

const CountBadge: React.FC<CountBadgeProps> = ({
  icon: Icon,
  count,
  color,
  bgColor,
  label,
}) => (
  <div
    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${bgColor}`}
    title={label}
  >
    <Icon size={12} className={color} />
    <span className={`text-xs font-bold ${color}`}>{count}</span>
  </div>
);

interface SeverityCardProps {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  count: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

const SeverityCard: React.FC<SeverityCardProps> = ({
  icon: Icon,
  label,
  count,
  color,
  bgColor,
  borderColor,
}) => (
  <div
    className={`p-4 rounded-xl border ${bgColor} ${borderColor} flex flex-col items-center`}
  >
    <Icon size={20} className={color} />
    <span className={`text-2xl font-black mt-2 ${color}`}>{count}</span>
    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
      {label}
    </span>
  </div>
);

// ============================================================================
// UTILITIES
// ============================================================================

function getScoreColor(score: number): string {
  if (score >= 9) return 'text-green-400';
  if (score >= 7) return 'text-emerald-400';
  if (score >= 5) return 'text-yellow-400';
  if (score >= 3) return 'text-orange-400';
  return 'text-red-400';
}

export default LintSummary;
