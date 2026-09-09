'use client';

/**
 * WorkflowTopologyEnhanced Component
 *
 * Enhanced workflow topology section with integrated lint diagnostics.
 * Shows the node graph with visual diagnostic indicators and allows
 * clicking nodes to see associated issues.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Zap, Bug, X, ChevronRight, Check } from 'lucide-react';
import { SectionCard } from '../ui/SectionCard';
import { WorkflowGraphEnhanced, GraphWorkflow, NodeDiagnosticInfo } from '../WorkflowGraphEnhanced';
import { DiagnosticCard } from '../lint/DiagnosticCard';
import { LintSummary } from '../lint/LintSummary';
import { useLinter, useFocusedNode } from '@/hooks/useLinter';
import { WorkflowContext } from '@/hooks/useEducation';
import { LintedQualityIssue, LintDiagnostic } from '@/lib/lintTypes';

// ============================================================================
// TYPES
// ============================================================================

interface WorkflowTopologyEnhancedProps {
  /** Workflow data for the graph */
  workflowData?: GraphWorkflow | undefined;
  /** Raw workflow JSON for linting */
  rawWorkflow?: unknown | null;
  /** Whether to show the lint panel by default */
  showLintPanelDefault?: boolean;
  /** Workflow context for educational content */
  workflowContext?: WorkflowContext;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const WorkflowTopologyEnhanced: React.FC<WorkflowTopologyEnhancedProps> = ({
  workflowData,
  rawWorkflow,
  showLintPanelDefault = false,
  workflowContext = {},
}) => {
  // Linter hook
  const { issues, isLinting, counts, result, overallScore, runLint } = useLinter(rawWorkflow, {
    autoRun: true,
    debounceMs: 300,
    includeInfo: true,
  });

  // Focused node management
  const { focusedNodeId, focusNode, clearFocus } = useFocusedNode();

  // UI state
  const [showLintPanel, setShowLintPanel] = useState(showLintPanelDefault);
  const [selectedNodeIssues, setSelectedNodeIssues] = useState<LintedQualityIssue[]>([]);

  // Build node diagnostic map
  const nodeDiagnostics = useMemo(() => {
    const map = new Map<number, NodeDiagnosticInfo>();

    for (const issue of issues) {
      if (!issue.nodeId || issue.nodeId === 0) continue;

      const existing = map.get(issue.nodeId);
      if (existing) {
        existing.diagnostics.push({
          ruleId: issue.ruleId || 'unknown',
          ruleName: issue.type,
          severity:
            issue.severity === 'Critical'
              ? 'error'
              : issue.severity === 'Major' || issue.severity === 'Minor'
                ? 'warning'
                : 'info',
          category: 'workflow',
          nodeId: issue.nodeId,
          nodeType: issue.nodeType || 'unknown',
          message: issue.description,
        } as LintDiagnostic);

        if (issue.severity === 'Critical') existing.errorCount++;
        else if (issue.severity === 'Major' || issue.severity === 'Minor') existing.warningCount++;
        else existing.infoCount++;
      } else {
        map.set(issue.nodeId, {
          nodeId: issue.nodeId,
          errorCount: issue.severity === 'Critical' ? 1 : 0,
          warningCount: issue.severity === 'Major' || issue.severity === 'Minor' ? 1 : 0,
          infoCount: issue.severity === 'Note' ? 1 : 0,
          diagnostics: [
            {
              ruleId: issue.ruleId || 'unknown',
              ruleName: issue.type,
              severity:
                issue.severity === 'Critical'
                  ? 'error'
                  : issue.severity === 'Major' || issue.severity === 'Minor'
                    ? 'warning'
                    : 'info',
              category: 'workflow',
              nodeId: issue.nodeId,
              nodeType: issue.nodeType || 'unknown',
              message: issue.description,
            } as LintDiagnostic,
          ],
        });
      }
    }

    return map;
  }, [issues]);

  // Handle node click
  const handleNodeClick = useCallback(
    (nodeId: number) => {
      focusNode(nodeId);

      // Get issues for this node
      const nodeIssues = issues.filter((i) => i.nodeId === nodeId);
      setSelectedNodeIssues(nodeIssues);

      // Open lint panel if there are issues
      if (nodeIssues.length > 0) {
        setShowLintPanel(true);
      }
    },
    [issues, focusNode],
  );

  // Handle node double-click (zoom to node)
  const handleNodeDoubleClick = useCallback(
    (nodeId: number) => {
      focusNode(nodeId);
    },
    [focusNode],
  );

  // Close node details
  const handleCloseNodeDetails = () => {
    clearFocus();
    setSelectedNodeIssues([]);
  };

  // Get affected node count
  const affectedNodeCount = nodeDiagnostics.size;

  return (
    <SectionCard
      icon={Zap}
      title="Workflow Topology"
      subtitle="Interactive node graph with lint diagnostics"
      iconColorClass="bg-accent-subtle text-accent ring-accent/30"
      showHeaderBorder
      headerRight={
        <div className="flex items-center gap-3">
          {/* Lint Summary Badge */}
          {rawWorkflow !== null && rawWorkflow !== undefined && (
            <button
              onClick={() => setShowLintPanel(!showLintPanel)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold
                transition-all border
                ${
                  counts.errors > 0
                    ? 'border-status-error/30 bg-status-error/10 text-status-error'
                    : counts.warnings > 0
                      ? 'border-status-warning/30 bg-status-warning/10 text-status-warning'
                      : 'border-status-success/30 bg-status-success/10 text-status-success'
                }
              `}
            >
              <Bug size={14} />
              {isLinting ? (
                'Analyzing...'
              ) : (
                <>
                  {counts.errors > 0 && <span>{counts.errors}E</span>}
                  {counts.warnings > 0 && <span>{counts.warnings}W</span>}
                  {counts.errors === 0 && counts.warnings === 0 && <span>OK</span>}
                  <span className="text-text-secondary">({affectedNodeCount} nodes)</span>
                </>
              )}
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Graph Container */}
        <div className={`w-full flex-1 ${showLintPanel ? 'min-w-0' : ''}`}>
          <div className="overflow-hidden rounded-card border border-border shadow-card">
            {workflowData ? (
              <WorkflowGraphEnhanced
                workflow={workflowData}
                nodeDiagnostics={nodeDiagnostics}
                focusedNodeId={focusedNodeId}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                showDiagnosticBadges={true}
                dimUnaffectedNodes={selectedNodeIssues.length > 0}
              />
            ) : (
              <div className="flex h-[600px] items-center justify-center bg-surface-muted">
                <div className="text-center font-semibold uppercase tracking-widest text-text-secondary">
                  Topology data missing
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lint Panel */}
        {showLintPanel && (
          <div className="flex max-h-[600px] w-full shrink-0 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card lg:w-96">
            {/* Panel Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <Bug size={16} className="text-accent" />
                <span className="text-sm font-semibold text-text">
                  {selectedNodeIssues.length > 0
                    ? `Node #${focusedNodeId} Issues`
                    : 'All Diagnostics'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedNodeIssues.length > 0 && (
                  <button
                    onClick={handleCloseNodeDetails}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-status-info"
                  >
                    View All
                    <ChevronRight size={12} />
                  </button>
                )}
                <button
                  onClick={() => setShowLintPanel(false)}
                  className="rounded-icon p-1 text-text-secondary hover:bg-surface-muted hover:text-text"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="shrink-0 border-b border-border p-4">
              <LintSummary
                errorCount={counts.errors}
                warningCount={counts.warnings}
                infoCount={counts.info}
                overallScore={overallScore}
                isLinting={isLinting}
                metadata={result?.meta}
                onRunLint={runLint}
                variant="compact"
              />
            </div>

            {/* Issues List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(selectedNodeIssues.length > 0 ? selectedNodeIssues : issues).map((issue, idx) => (
                <DiagnosticCard
                  key={issue.id || `${issue.ruleId}-${issue.nodeId}-${idx}`}
                  issue={issue}
                  workflowContext={workflowContext}
                  onFocusNode={(nodeId) => {
                    focusNode(nodeId);
                    const nodeIssues = issues.filter((i) => i.nodeId === nodeId);
                    setSelectedNodeIssues(nodeIssues);
                  }}
                />
              ))}

              {issues.length === 0 && !isLinting && (
                <div className="py-8 text-center text-sm text-text-secondary">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-status-success/10">
                    <Check className="h-6 w-6 text-status-success" />
                  </div>
                  No issues detected
                </div>
              )}

              {selectedNodeIssues.length === 0 &&
                focusedNodeId !== null &&
                focusedNodeId !== undefined && (
                  <div className="py-8 text-center text-sm text-text-secondary">
                    No issues for node #{focusedNodeId}
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
};

export default WorkflowTopologyEnhanced;
