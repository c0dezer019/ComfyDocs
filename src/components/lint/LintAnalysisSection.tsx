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
  const {
    issues,
    isLinting,
    error,
    overallScore,
    counts,
    result,
    runLint,
  } = useLinter(rawWorkflow, {
    autoRun: true,
    debounceMs: 300,
    includeInfo: true,
  });

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
      iconColorClass="bg-violet-500/10 text-violet-400 ring-violet-500/20"
      isLoading={false}
      headerRight={
        <div className="flex items-center gap-3">
          {/* Workflow Stats */}
          {workflowSummary && (
            <div className="flex items-center gap-4 text-[10px] text-slate-500">
              <span>{workflowSummary.nodeCount} nodes</span>
              <span>{workflowSummary.linkCount} connections</span>
            </div>
          )}

          {/* Re-run Button */}
          <button
            onClick={runLint}
            disabled={isLinting}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50"
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
          spinnerColorClass="text-violet-500/50"
        />
      )}

      {/* Error State */}
      {error && (
        <div className="p-6 bg-red-500/10 rounded-xl border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={runLint}
            className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-bold transition-colors"
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
            <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/20">
              <p className="text-xs text-indigo-300">
                <strong>Offline Mode:</strong> Detailed educational content requires
                an API key. Click &quot;Learn More&quot; on any issue to see explanations
                once you&apos;ve configured your API key.
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
            ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
            : counts.errors > 0
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : counts.warnings > 0
            ? 'bg-orange-500/10 border-orange-500/20 text-orange-400'
            : 'bg-green-500/10 border-green-500/20 text-green-400'
        }
      `}
      aria-label={`Lint status: ${totalIssues} issues`}
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
