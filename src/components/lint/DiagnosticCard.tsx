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
      return <AlertCircle className={`text-red-400 ${className}`} />;
    case 'Major':
      return <AlertTriangle className={`text-orange-400 ${className}`} />;
    case 'Minor':
      return <AlertTriangle className={`text-yellow-400 ${className}`} />;
    default:
      return <Info className={`text-blue-400 ${className}`} />;
  }
};

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const colors = {
    Critical: 'bg-red-500/10 text-red-400 border-red-500/30',
    Major: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    Minor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    Note: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
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
  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-white/5 text-slate-500 border border-white/5">
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
  const diagnostic = issue.ruleId ? {
    ruleId: issue.ruleId,
    ruleName: issue.type,
    severity: issue.severity === 'Critical' ? 'error' as const :
              issue.severity === 'Major' ? 'warning' as const :
              issue.severity === 'Minor' ? 'warning' as const : 'info' as const,
    category: 'workflow' as const,
    nodeId: issue.nodeId || 0,
    nodeType: issue.nodeType || 'unknown',
    message: issue.description,
    educationalContext: {
      summary: issue.educationalContext || '',
    },
  } : null;

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
        bg-white/5 rounded-2xl border border-white/5 overflow-hidden
        transition-all duration-200 hover:bg-white/[0.07] hover:border-white/10
        ${isExpanded ? 'ring-1 ring-indigo-500/20' : ''}
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
              <span className="text-base font-bold text-white">{issue.type}</span>
              {issue.nodeType && <CategoryBadge category={issue.nodeType} />}
            </div>

            {/* Description */}
            <p className="text-sm text-slate-400 leading-relaxed pr-4">
              {issue.description}
            </p>

            {/* Quick Tip (if available) */}
            {quickTip && !showEducation && (
              <div className="mt-3 flex items-start gap-2 text-xs text-slate-500">
                <Lightbulb size={12} className="text-amber-500 mt-0.5 shrink-0" />
                <span>{quickTip.summary}</span>
              </div>
            )}

            {/* Educational Context Preview */}
            {issue.educationalContext && !showEducation && (
              <div className="mt-3 text-xs text-indigo-400/80 italic">
                {issue.educationalContext}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Focus on Node */}
            {issue.nodeId && onFocusNode && (
              <button
                onClick={handleFocusNode}
                className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
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
                className="p-2 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                title="Show in image"
                aria-label="Show issue region in image"
              >
                <ScanEye size={16} />
              </button>
            )}

            {/* Expand Toggle */}
            <button
              onClick={handleExpandToggle}
              className="p-2 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
        <div className="border-t border-white/5 bg-black/20 p-5 space-y-4 animate-in slide-in-from-top-2">
          {/* Suggested Fixes */}
          {issue.suggestedFixes && issue.suggestedFixes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <Wrench size={12} />
                Suggested Fixes
              </div>
              <ul className="space-y-2 pl-4">
                {issue.suggestedFixes.map((fix, idx) => (
                  <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-indigo-400 font-mono text-xs mt-0.5">{idx + 1}.</span>
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
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl text-xs font-bold transition-colors"
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
            <div className="flex items-center gap-4 text-[10px] text-slate-500">
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

const EducationPanel: React.FC<EducationPanelProps> = ({
  education,
  isLoading,
  error,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/20">
        <Loader2 size={16} className="animate-spin text-indigo-400" />
        <span className="text-sm text-indigo-300">Loading educational content...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/20">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!education) {
    return null;
  }

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 rounded-xl border border-indigo-500/20">
      {/* Summary */}
      <div>
        <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-2">
          Understanding This Issue
        </h4>
        <p className="text-sm text-slate-300 leading-relaxed">{education.summary}</p>
      </div>

      {/* Explanation */}
      <div className="space-y-3">
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase">The Issue</span>
          <p className="text-sm text-slate-400 mt-1">{education.explanation.issue}</p>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase">Technical Context</span>
          <p className="text-sm text-slate-400 mt-1">{education.explanation.technicalContext}</p>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase">Visual Impact</span>
          <p className="text-sm text-slate-400 mt-1">{education.explanation.visualImpact}</p>
        </div>

        {education.explanation.exceptions && (
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Exceptions</span>
            <p className="text-sm text-slate-400 mt-1 italic">
              {education.explanation.exceptions}
            </p>
          </div>
        )}
      </div>

      {/* Fixes */}
      {education.fixes.length > 0 && (
        <div>
          <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-3">
            How to Fix
          </h4>
          <div className="space-y-3">
            {education.fixes.slice(0, 3).map((fix, idx) => (
              <div
                key={idx}
                className="p-3 bg-black/30 rounded-lg border border-white/5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center">
                    {fix.priority}
                  </span>
                  <span className="text-sm font-bold text-white">{fix.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      fix.confidence === 'high'
                        ? 'bg-green-500/10 text-green-400'
                        : fix.confidence === 'medium'
                        ? 'bg-yellow-500/10 text-yellow-400'
                        : 'bg-slate-500/10 text-slate-400'
                    }`}
                  >
                    {fix.confidence}
                  </span>
                </div>
                {fix.steps.length > 0 && (
                  <ol className="space-y-1 ml-7">
                    {fix.steps.map((step, stepIdx) => (
                      <li key={stepIdx} className="text-xs text-slate-400 list-decimal">
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
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Learn More
          </h4>
          <div className="flex flex-wrap gap-2">
            {education.resources.map((resource, idx) => (
              <a
                key={idx}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
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
