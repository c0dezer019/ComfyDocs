'use client';

/**
 * LintAnalysisSection Component
 *
 * Main integration component for displaying workflow lint analysis
 * in the DocumentationViewer. Combines LintSummary and DiagnosticList
 * with the existing SectionCard pattern.
 */

import React, { useEffect } from 'react';
import { Bug, RefreshCw, Settings2 } from 'lucide-react';
import { SectionCard, LoadingPlaceholder } from '../ui/SectionCard';
import { LintSummary } from './LintSummary';
import { DiagnosticList } from './DiagnosticList';
import { useLinter, useWorkflowSummary } from '@/hooks/useLinter';
import { WorkflowContext } from '@/hooks/useEducation';

// ============================================================================
// TYPES
// ============================================================================

interface LintAnalysisSectionProps {
  /** Raw workflow JSON from PNG metadata */
  rawWorkflow: unknown | null;
  /** Whether the analysis is running in offline mode */
  isOffline: boolean;
  /** Extracted parameters for educational context */
  parameters?: {
    sampler?: string;
    model?: string;
    steps?: number;
    cfg?: number;
  };
  /** Callback when a node should be focused in the graph */
  onFocusNode?: (nodeId: number) => void;
  /** Callback when an image region should be focused */
  onFocusRegion?: (box: [number, number, number, number]) => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const LintAnalysisSection: React.FC<LintAnalysisSectionProps> = ({
  rawWorkflow,
  isOffline,
  parameters,
  onFocusNode,
  onFocusRegion,
}) => {
  // Use the linter hook
  const { issues, isLinting, error, overallScore, counts, result, runLint } = useLinter(
    rawWorkflow,
    {
      autoRun: true,
      debounceMs: 300,
      includeInfo: true,
    },
  );

  // Get workflow summary for additional context
  const workflowSummary = useWorkflowSummary(rawWorkflow);

  // Build workflow context for educational content
  const workflowContext: WorkflowContext = {
    samplerType: parameters?.sampler,
    modelName: parameters?.model,
    steps: parameters?.steps,
    cfg: parameters?.cfg,
  };

  // Log lint results in development
  useEffect(() => {
    if (result && process.env.NODE_ENV === 'development') {
      console.debug('[LintAnalysisSection] Lint complete:', {
        issues: issues.length,
        score: overallScore,
        meta: result.meta,
      });
    }
  }, [result, issues.length, overallScore]);

  // Don't render if no workflow
  if (!rawWorkflow) {
    return null;
  }

  return (
    <SectionCard
      icon={Bug}
      title="Workflow Linting"
      subtitle="Rule-based parameter analysis"
      iconColorClass="bg-accent-subtle text-status-info ring-accent/30"
      isLoading={false}
      headerRight={
        <div className="flex items-center gap-3">
          {/* Workflow Stats */}
          {workflowSummary && (
            <div className="flex items-center gap-4 text-[10px] text-text-secondary">
              <span>{workflowSummary.nodeCount} nodes</span>
              <span>{workflowSummary.linkCount} connections</span>
            </div>
          )}

          {/* Re-run Button */}
          <button
            onClick={runLint}
            disabled={isLinting}
            className="flex items-center gap-2 rounded-button bg-accent px-4 py-2 text-xs font-semibold text-text shadow-subtle transition-colors hover:bg-accent-hover disabled:opacity-50"
            aria-label="Re-run workflow analysis"
          >
            <RefreshCw size={14} className={isLinting ? 'animate-spin' : ''} />
            {isLinting ? 'ANALYZING...' : 'RE-ANALYZE'}
          </button>
        </div>
      }
    >
      {/* Loading State */}
      {isLinting && issues.length === 0 && (
        <LoadingPlaceholder
          text="Analyzing workflow parameters..."
          spinnerColorClass="text-status-info"
        />
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-card border border-red-200 bg-red-50 p-6" role="alert">
          <p className="text-sm text-status-error">{error}</p>
          <button
            onClick={runLint}
            className="mt-4 rounded-button border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-status-error transition-colors hover:bg-red-100"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Content */}
      {!isLinting && !error && (
        <div className="space-y-6">
          {/* Summary */}
          <LintSummary
            errorCount={counts.errors}
            warningCount={counts.warnings}
            infoCount={counts.info}
            overallScore={overallScore}
            isLinting={isLinting}
            metadata={result?.meta}
            variant="compact"
          />

          {/* Diagnostic List */}
          <DiagnosticList
            issues={issues}
            workflowContext={workflowContext}
            onFocusNode={onFocusNode}
            onFocusRegion={onFocusRegion}
            showControls={issues.length > 3}
            showEmptyState={true}
            emptyMessage={
              isOffline
                ? 'Workflow analysis complete - no issues detected!'
                : 'Your workflow parameters look good! No linting issues found.'
            }
          />

          {/* Offline Mode Notice */}
          {isOffline && issues.length > 0 && (
            <div className="rounded-card border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs text-status-info">
                <strong>Offline Mode:</strong> Detailed educational content requires an API key.
                Click &quot;Learn More&quot; on any issue to see explanations once you&apos;ve
                configured your API key.
              </p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
};

// ============================================================================
// MINIMAL INLINE VARIANT
// ============================================================================

/**
 * Compact inline variant for showing lint status in headers/toolbars.
 */
export const LintStatusBadge: React.FC<{
  rawWorkflow: unknown | null;
  onClick?: () => void;
}> = ({ rawWorkflow, onClick }) => {
  const { counts, isLinting, overallScore } = useLinter(rawWorkflow, {
    autoRun: true,
    debounceMs: 500,
    includeInfo: false, // Only count errors and warnings
  });

  const totalIssues = counts.errors + counts.warnings;

  if (!rawWorkflow) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold
        transition-all border
        ${
          isLinting
            ? 'border-sky-200 bg-sky-50 text-status-info'
            : counts.errors > 0
              ? 'border-red-200 bg-red-50 text-status-error'
              : counts.warnings > 0
                ? 'border-amber-200 bg-amber-50 text-status-warning'
                : 'border-green-200 bg-green-50 text-status-success'
        }
      `}
      aria-label={
        isLinting
          ? 'Lint status: analyzing workflow'
          : totalIssues > 0
            ? `Lint status: ${counts.errors} errors and ${counts.warnings} warnings`
            : 'Lint status: no issues found'
      }
    >
      <Bug size={14} />
      {isLinting ? (
        <span>Analyzing...</span>
      ) : totalIssues > 0 ? (
        <span>
          {counts.errors > 0 && `${counts.errors}E`}
          {counts.errors > 0 && counts.warnings > 0 && ' / '}
          {counts.warnings > 0 && `${counts.warnings}W`}
        </span>
      ) : (
        <span>OK</span>
      )}
      {!isLinting && overallScore !== undefined && (
        <span className="opacity-60">({overallScore.toFixed(1)})</span>
      )}
    </button>
  );
};

export default LintAnalysisSection;
