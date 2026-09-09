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
  const healthStatus = errorCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'healthy';

  const healthColors = {
    critical: 'border-red-200 bg-red-50',
    warning: 'border-amber-200 bg-amber-50',
    healthy: 'border-green-200 bg-green-50',
  };

  const healthTextColors = {
    critical: 'text-status-error',
    warning: 'text-status-warning',
    healthy: 'text-status-success',
  };

  if (variant === 'compact') {
    return (
      <div
        className={`
          flex flex-wrap items-center gap-3 rounded-card border px-4 py-2.5
          ${healthColors[healthStatus]}
        `}
        aria-live="polite"
      >
        {/* Status Icon */}
        {isLinting ? (
          <Loader2 size={18} className="animate-spin text-status-info" />
        ) : healthStatus === 'healthy' ? (
          <CheckCircle2 size={18} className="text-status-success" />
        ) : healthStatus === 'critical' ? (
          <AlertCircle size={18} className="text-status-error" />
        ) : (
          <AlertTriangle size={18} className="text-status-warning" />
        )}

        {/* Counts */}
        <div className="flex flex-wrap items-center gap-2">
          <CountBadge
            icon={AlertCircle}
            count={errorCount}
            color="text-status-error"
            bgColor="bg-white"
            label="Errors"
          />
          <CountBadge
            icon={AlertTriangle}
            count={warningCount}
            color="text-status-warning"
            bgColor="bg-white"
            label="Warnings"
          />
          <CountBadge
            icon={Info}
            count={infoCount}
            color="text-status-info"
            bgColor="bg-white"
            label="Info"
          />
        </div>

        {/* Score */}
        {overallScore !== undefined && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-[10px] font-bold uppercase text-text-secondary">Score</span>
            <span className={`text-lg font-black ${getScoreColor(overallScore)}`}>
              {overallScore.toFixed(1)}
            </span>
          </div>
        )}

        {/* Run Button */}
        {onRunLint && (
          <button
            onClick={onRunLint}
            disabled={isLinting}
            className="rounded-button bg-accent px-4 py-1.5 text-xs font-semibold text-text transition-colors hover:bg-accent-hover disabled:opacity-50"
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
        rounded-card border bg-surface p-6 shadow-subtle
      `}
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {isLinting ? (
            <div className="flex size-10 items-center justify-center rounded-icon bg-accent-subtle">
              <Loader2 size={20} className="animate-spin text-status-info" />
            </div>
          ) : (
            <div
              className={`flex size-10 items-center justify-center rounded-icon ${
                healthStatus === 'healthy'
                  ? 'bg-green-50'
                  : healthStatus === 'critical'
                    ? 'bg-red-50'
                    : 'bg-amber-50'
              }`}
            >
              {healthStatus === 'healthy' ? (
                <CheckCircle2 size={20} className="text-status-success" />
              ) : healthStatus === 'critical' ? (
                <AlertCircle size={20} className="text-status-error" />
              ) : (
                <AlertTriangle size={20} className="text-status-warning" />
              )}
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text">
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
                className="text-border-muted"
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
          color="text-status-error"
          bgColor="bg-red-50"
          borderColor="border-red-200"
        />
        <SeverityCard
          icon={AlertTriangle}
          label="Warnings"
          count={warningCount}
          color="text-status-warning"
          bgColor="bg-amber-50"
          borderColor="border-amber-200"
        />
        <SeverityCard
          icon={Info}
          label="Info"
          count={infoCount}
          color="text-status-info"
          bgColor="bg-sky-50"
          borderColor="border-sky-200"
        />
      </div>

      {/* Metadata */}
      {metadata && (
        <div className="flex items-center gap-6 text-[10px] text-text-secondary">
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
          className="mt-4 w-full rounded-button bg-accent py-3 text-sm font-semibold text-text transition-colors hover:bg-accent-hover disabled:opacity-50"
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

const CountBadge: React.FC<CountBadgeProps> = ({ icon: Icon, count, color, bgColor, label }) => (
  <div
    className={`flex items-center gap-1.5 rounded-button border border-border px-2.5 py-1 ${bgColor}`}
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
  <div className={`flex flex-col items-center rounded-card border p-4 ${bgColor} ${borderColor}`}>
    <Icon size={20} className={color} />
    <span className={`text-2xl font-black mt-2 ${color}`}>{count}</span>
    <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
      {label}
    </span>
  </div>
);

// ============================================================================
// UTILITIES
// ============================================================================

function getScoreColor(score: number): string {
  if (score >= 7) return 'text-status-success';
  if (score >= 5) return 'text-status-warning';
  return 'text-status-error';
}

export default LintSummary;
