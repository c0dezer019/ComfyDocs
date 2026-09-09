'use client';

/**
 * DiagnosticCard Component
 *
 * Displays a single lint diagnostic with educational context,
 * suggested fixes, and interactive elements.
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  BookOpen,
  Loader2,
  ExternalLink,
  ScanEye,
  Wrench,
} from 'lucide-react';
import { LintedQualityIssue, EducationalContent } from '@/lib/lintTypes';
import { useEducation, WorkflowContext } from '@/hooks/useEducation';

// ============================================================================
// TYPES
// ============================================================================

interface DiagnosticCardProps {
  /** The diagnostic issue to display */
  issue: LintedQualityIssue;
  /** Workflow context for educational content */
  workflowContext?: WorkflowContext;
  /** Whether the card is expanded by default */
  defaultExpanded?: boolean;
  /** Callback when node focus is requested */
  onFocusNode?: (nodeId: number) => void;
  /** Callback when image region focus is requested */
  onFocusRegion?: (box: [number, number, number, number]) => void;
  /** Whether to auto-load educational content */
  autoLoadEducation?: boolean;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const SeverityIcon: React.FC<{ severity: string; className?: string }> = ({
  severity,
  className = '',
}) => {
  switch (severity) {
    case 'Critical':
      return <AlertCircle className={`text-status-error ${className}`} />;
    case 'Major':
      return <AlertTriangle className={`text-status-warning ${className}`} />;
    case 'Minor':
      return <AlertTriangle className={`text-status-warning ${className}`} />;
    default:
      return <Info className={`text-status-info ${className}`} />;
  }
};

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const colors = {
    Critical: 'border-red-200 bg-red-50 text-status-error',
    Major: 'border-amber-200 bg-amber-50 text-status-warning',
    Minor: 'border-amber-200 bg-amber-50 text-status-warning',
    Note: 'border-sky-200 bg-sky-50 text-status-info',
  };

  return (
    <span
      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
        colors[severity as keyof typeof colors] || colors.Note
      }`}
    >
      {severity}
    </span>
  );
};

const CategoryBadge: React.FC<{ category: string }> = ({ category }) => (
  <span className="rounded-md border border-border bg-surface-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-text-secondary">
    {category}
  </span>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const DiagnosticCard: React.FC<DiagnosticCardProps> = ({
  issue,
  workflowContext = {},
  defaultExpanded = false,
  onFocusNode,
  onFocusRegion,
  autoLoadEducation = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showEducation, setShowEducation] = useState(false);

  // Create a diagnostic object for the education hook
  const diagnostic = issue.ruleId
    ? {
        ruleId: issue.ruleId,
        ruleName: issue.type,
        severity:
          issue.severity === 'Critical'
            ? ('error' as const)
            : issue.severity === 'Major'
              ? ('warning' as const)
              : issue.severity === 'Minor'
                ? ('warning' as const)
                : ('info' as const),
        category: 'workflow' as const,
        nodeId: issue.nodeId || 0,
        nodeType: issue.nodeType || 'unknown',
        message: issue.description,
        educationalContext: {
          summary: issue.educationalContext || '',
        },
      }
    : null;

  // Use education hook
  const {
    content: education,
    isLoading: educationLoading,
    error: educationError,
    load: loadEducation,
    quickTip,
  } = useEducation(diagnostic, workflowContext, {
    autoLoad: autoLoadEducation && showEducation,
    cacheOnly: false,
  });

  const handleExpandToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleShowEducation = async () => {
    setShowEducation(true);
    if (!education && !educationLoading) {
      await loadEducation();
    }
  };

  const handleFocusNode = () => {
    if (issue.nodeId && onFocusNode) {
      onFocusNode(issue.nodeId);
    }
  };

  const handleFocusRegion = () => {
    if (issue.box_2d && onFocusRegion) {
      onFocusRegion(issue.box_2d);
    }
  };

  return (
    <div
      className={`
        overflow-hidden rounded-card border border-border bg-surface shadow-subtle
        transition-colors duration-150 hover:border-border-muted
        ${isExpanded ? 'ring-1 ring-accent/30' : ''}
      `}
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Severity Icon */}
          <div className="mt-0.5">
            <SeverityIcon severity={issue.severity} className="w-5 h-5" />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Title Row */}
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <SeverityBadge severity={issue.severity} />
              <span className="font-heading text-base font-semibold text-text">{issue.type}</span>
              {issue.nodeType && <CategoryBadge category={issue.nodeType} />}
            </div>

            {/* Description */}
            <p className="pr-4 text-sm leading-relaxed text-text-secondary">{issue.description}</p>

            {/* Quick Tip (if available) */}
            {quickTip && !showEducation && (
              <div className="mt-3 flex items-start gap-2 text-xs text-text-secondary">
                <Lightbulb size={12} className="mt-0.5 shrink-0 text-status-warning" />
                <span>{quickTip.summary}</span>
              </div>
            )}

            {/* Educational Context Preview */}
            {issue.educationalContext && !showEducation && (
              <div className="mt-3 text-xs italic text-status-info">{issue.educationalContext}</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Focus on Node */}
            {issue.nodeId && onFocusNode && (
              <button
                onClick={handleFocusNode}
                className="rounded-button p-2 text-text-muted transition-colors hover:bg-accent-subtle hover:text-status-info"
                title={`Focus on node #${issue.nodeId}`}
                aria-label={`Focus on node ${issue.nodeId}`}
              >
                <ScanEye size={16} />
              </button>
            )}

            {/* Focus on Region */}
            {issue.box_2d && onFocusRegion && (
              <button
                onClick={handleFocusRegion}
                className="rounded-button p-2 text-text-muted transition-colors hover:bg-amber-50 hover:text-status-warning"
                title="Show in image"
                aria-label="Show issue region in image"
              >
                <ScanEye size={16} />
              </button>
            )}

            {/* Expand Toggle */}
            <button
              onClick={handleExpandToggle}
              className="rounded-button p-2 text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="space-y-4 border-t border-border bg-surface-muted p-5">
          {/* Suggested Fixes */}
          {issue.suggestedFixes && issue.suggestedFixes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                <Wrench size={12} />
                Suggested Fixes
              </div>
              <ul className="space-y-2 pl-4">
                {issue.suggestedFixes.map((fix, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="mt-0.5 font-mono text-xs text-status-info">{idx + 1}.</span>
                    <span>{fix}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Learn More Button */}
          {issue.ruleId && !showEducation && (
            <button
              onClick={handleShowEducation}
              className="flex items-center gap-2 rounded-button border border-accent/30 bg-accent-subtle px-4 py-2 text-xs font-semibold text-text transition-colors hover:bg-accent hover:text-text"
            >
              <BookOpen size={14} />
              Learn More
            </button>
          )}

          {/* Educational Content */}
          {showEducation && (
            <EducationPanel
              education={education}
              isLoading={educationLoading}
              error={educationError}
            />
          )}

          {/* Node Info */}
          {issue.nodeId && (
            <div className="flex items-center gap-4 text-[10px] text-text-secondary">
              <span>
                <span className="font-bold">Node:</span> #{issue.nodeId}
              </span>
              {issue.nodeType && (
                <span>
                  <span className="font-bold">Type:</span> {issue.nodeType}
                </span>
              )}
              {issue.ruleId && (
                <span>
                  <span className="font-bold">Rule:</span> {issue.ruleId}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// EDUCATION PANEL
// ============================================================================

interface EducationPanelProps {
  education: EducationalContent | null;
  isLoading: boolean;
  error: string | null;
}

const EducationPanel: React.FC<EducationPanelProps> = ({ education, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-sky-200 bg-sky-50 p-4">
        <Loader2 size={16} className="animate-spin text-status-info" />
        <span className="text-sm text-status-info">Loading educational content...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-card border border-red-200 bg-red-50 p-4" role="alert">
        <p className="text-sm text-status-error">{error}</p>
      </div>
    );
  }

  if (!education) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-card border border-sky-200 bg-sky-50 p-4">
      {/* Summary */}
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-status-info">
          Understanding This Issue
        </h4>
        <p className="text-sm leading-relaxed text-text-secondary">{education.summary}</p>
      </div>

      {/* Explanation */}
      <div className="space-y-3">
        <div>
          <span className="text-[10px] font-bold uppercase text-text-secondary">The Issue</span>
          <p className="mt-1 text-sm text-text-secondary">{education.explanation.issue}</p>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase text-text-secondary">
            Technical Context
          </span>
          <p className="mt-1 text-sm text-text-secondary">
            {education.explanation.technicalContext}
          </p>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase text-text-secondary">Visual Impact</span>
          <p className="mt-1 text-sm text-text-secondary">{education.explanation.visualImpact}</p>
        </div>

        {education.explanation.exceptions && (
          <div>
            <span className="text-[10px] font-bold uppercase text-text-secondary">Exceptions</span>
            <p className="mt-1 text-sm italic text-text-secondary">
              {education.explanation.exceptions}
            </p>
          </div>
        )}
      </div>

      {/* Fixes */}
      {education.fixes.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-status-info">
            How to Fix
          </h4>
          <div className="space-y-3">
            {education.fixes.slice(0, 3).map((fix, idx) => (
              <div key={idx} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-accent-subtle text-xs font-bold text-status-info">
                    {fix.priority}
                  </span>
                  <span className="text-sm font-semibold text-text">{fix.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      fix.confidence === 'high'
                        ? 'bg-green-50 text-status-success'
                        : fix.confidence === 'medium'
                          ? 'bg-amber-50 text-status-warning'
                          : 'bg-surface-muted text-text-secondary'
                    }`}
                  >
                    {fix.confidence}
                  </span>
                </div>
                {fix.steps.length > 0 && (
                  <ol className="space-y-1 ml-7">
                    {fix.steps.map((step, stepIdx) => (
                      <li key={stepIdx} className="list-decimal text-xs text-text-secondary">
                        {step}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resources */}
      {education.resources && education.resources.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-text-secondary">
            Learn More
          </h4>
          <div className="flex flex-wrap gap-2">
            {education.resources.map((resource, idx) => (
              <a
                key={idx}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-button border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent hover:text-status-info"
              >
                <ExternalLink size={12} />
                {resource.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticCard;
