'use client';

import React, { useState } from 'react';
import { Wand2, RefreshCw, Loader2, Plus, X, ArrowRight, Sparkles } from 'lucide-react';
import { PromptAnalysis, QualityIssue } from '@/lib/types';
import { SectionCard, LoadingPlaceholder, ScoreDisplay } from '../ui/SectionCard';
import { getScoreColor } from '@/lib/styleUtils';

interface PromptAnalysisSectionProps {
  /** Prompt analysis data */
  promptAnalysis?: PromptAnalysis;
  /** Current AI processing status */
  aiStatus: 'idle' | 'loading' | 'complete' | 'error';
  /** Whether prompt is being refined */
  isRefiningPrompt?: boolean;
  /** Filtered quality issues (for suggested fixes) */
  filteredIssues?: QualityIssue[];
  /** Callback to update prompt analysis */
  onUpdatePromptAnalysis: (analysis: PromptAnalysis) => void;
  /** Callback to refresh prompt analysis */
  onRefreshPromptAnalysis?: () => void;
}

/**
 * Prompt Analysis section component.
 * Displays linguistic adherence scoring and prompt critique.
 */
export const PromptAnalysisSection: React.FC<PromptAnalysisSectionProps> = ({
  promptAnalysis,
  aiStatus,
  isRefiningPrompt = false,
  filteredIssues = [],
  onUpdatePromptAnalysis,
  onRefreshPromptAnalysis,
}) => {
  const [editingPromptAnalysis, setEditingPromptAnalysis] = useState(false);
  const [editedCritique, setEditedCritique] = useState('');
  const [newImprovement, setNewImprovement] = useState('');

  const isLoading = aiStatus === 'loading' && !promptAnalysis;

  const handleStartEditPrompt = () => {
    if (!promptAnalysis) return;
    setEditedCritique(promptAnalysis.critique);
    setEditingPromptAnalysis(true);
  };

  const handleSavePromptAnalysis = () => {
    if (!promptAnalysis) return;
    onUpdatePromptAnalysis({ ...promptAnalysis, critique: editedCritique });
    setEditingPromptAnalysis(false);
  };

  const handleDeleteImprovement = (index: number) => {
    if (!promptAnalysis) return;
    const newImprovements = promptAnalysis.improvements.filter((_, i) => i !== index);
    onUpdatePromptAnalysis({ ...promptAnalysis, improvements: newImprovements });
  };

  const handleAddImprovement = () => {
    if (!newImprovement.trim() || !promptAnalysis) return;
    const newImprovements = [...promptAnalysis.improvements, newImprovement.trim()];
    onUpdatePromptAnalysis({ ...promptAnalysis, improvements: newImprovements });
    setNewImprovement('');
  };

  return (
    <SectionCard
      icon={Wand2}
      title="Prompt Audit"
      subtitle="Linguistic adherence scoring"
      iconColorClass="bg-accent-subtle text-accent ring-accent/30"
      isLoading={isLoading}
      showHeaderBorder
      headerRight={
        promptAnalysis && (
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            <button
              onClick={onRefreshPromptAnalysis}
              className="rounded-input p-2.5 text-text-secondary opacity-100 transition-colors hover:bg-surface-muted hover:text-status-info sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-visible:opacity-100"
              aria-label="Refresh prompt analysis"
            >
              <RefreshCw size={20} />
            </button>
            <ScoreDisplay
              label="Adherence"
              score={promptAnalysis.adherenceScore}
              colorClass={getScoreColor(promptAnalysis.adherenceScore)}
            />
          </div>
        )
      }
    >
      {/* Refining overlay */}
      {isRefiningPrompt && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-card bg-surface/95">
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text">
            Revising Prompt Theory...
          </p>
        </div>
      )}

      {isLoading ? (
        <LoadingPlaceholder text="Analyzing prompt structure..." spinnerColorClass="text-accent" />
      ) : (
        promptAnalysis && (
          <div className="grid md:grid-cols-2 gap-10">
            <CritiqueSection
              critique={promptAnalysis.critique}
              isEditing={editingPromptAnalysis}
              editedCritique={editedCritique}
              onStartEdit={handleStartEditPrompt}
              onCancel={() => setEditingPromptAnalysis(false)}
              onSave={handleSavePromptAnalysis}
              onCritiqueChange={setEditedCritique}
            />

            <RefinementsSection
              filteredIssues={filteredIssues}
              improvements={promptAnalysis.improvements}
              newImprovement={newImprovement}
              onDeleteImprovement={handleDeleteImprovement}
              onAddImprovement={handleAddImprovement}
              onNewImprovementChange={setNewImprovement}
            />
          </div>
        )
      )}
    </SectionCard>
  );
};

interface CritiqueSectionProps {
  critique: string;
  isEditing: boolean;
  editedCritique: string;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onCritiqueChange: (value: string) => void;
}

const CritiqueSection: React.FC<CritiqueSectionProps> = ({
  critique,
  isEditing,
  editedCritique,
  onStartEdit,
  onCancel,
  onSave,
  onCritiqueChange,
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-text-secondary">
        Theoretical Critique
      </h3>
      <button
        onClick={onStartEdit}
        className="text-[10px] font-semibold uppercase tracking-widest text-status-info hover:text-text"
      >
        Edit
      </button>
    </div>
    {isEditing ? (
      <div className="space-y-4">
        <textarea
          className="min-h-[180px] w-full rounded-card border border-border bg-surface-muted p-5 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          value={editedCritique}
          onChange={(e) => onCritiqueChange(e.target.value)}
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 text-[10px] font-semibold uppercase text-text-secondary hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="rounded-button bg-accent px-6 py-2 text-[10px] font-semibold uppercase tracking-widest text-text hover:bg-accent-hover"
          >
            Update Critique
          </button>
        </div>
      </div>
    ) : (
      <div className="rounded-card border border-border bg-surface-muted p-6 text-sm leading-relaxed text-text-secondary shadow-subtle">
        {critique}
      </div>
    )}
  </div>
);

interface RefinementsSectionProps {
  filteredIssues: QualityIssue[];
  improvements: string[];
  newImprovement: string;
  onDeleteImprovement: (index: number) => void;
  onAddImprovement: () => void;
  onNewImprovementChange: (value: string) => void;
}

const RefinementsSection: React.FC<RefinementsSectionProps> = ({
  filteredIssues,
  improvements,
  newImprovement,
  onDeleteImprovement,
  onAddImprovement,
  onNewImprovementChange,
}) => (
  <div className="space-y-4">
    <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-text-secondary">
      Technical Refinements
    </h3>
    <ul className="space-y-3">
      {filteredIssues.map((issue, issueIdx) => {
        const fixes = issue.suggestedFixes || (issue.suggestedFix ? [issue.suggestedFix] : []);
        if (fixes.length === 0) return null;
        return (
          <li
            key={issue.id || `issue-${issueIdx}`}
            className="rounded-card border border-accent/20 bg-accent/5 p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`h-1.5 w-1.5 rounded-full ${issue.severity === 'Note' ? 'bg-text-muted' : 'bg-status-error'}`}
              />
              <span
                className={`text-[10px] font-semibold uppercase tracking-widest ${issue.severity === 'Note' ? 'text-text-secondary' : 'text-status-error'}`}
              >
                {issue.type}
              </span>
            </div>
            <div className="space-y-2 pl-4">
              {fixes.map((fix, fIdx) => (
                <div key={fIdx} className="flex items-start gap-3">
                  <ArrowRight size={12} className="mt-1 shrink-0 text-accent" />
                  <span className="text-sm font-medium text-text-secondary">{fix}</span>
                </div>
              ))}
            </div>
          </li>
        );
      })}

      {improvements.map((tip, idx) => (
        <li
          key={`gen-${idx}`}
          className="group/item flex items-start gap-4 rounded-card border border-border bg-surface-muted p-5 transition-colors hover:border-accent/30"
        >
          <Sparkles size={14} className="mt-1 shrink-0 text-accent" />
          <span className="flex-1 text-sm leading-relaxed text-text-secondary">{tip}</span>
          <button
            onClick={() => onDeleteImprovement(idx)}
            className="p-1.5 text-text-muted opacity-100 transition-colors hover:text-status-error sm:opacity-0 sm:group-hover/item:opacity-100 sm:group-focus-within/item:opacity-100 sm:focus-visible:opacity-100"
            aria-label="Delete improvement"
          >
            <X size={14} />
          </button>
        </li>
      ))}

      <li key="add-improvement" className="flex items-center gap-3 pt-4">
        <label htmlFor="new-improvement-input" className="sr-only">
          Add new improvement suggestion
        </label>
        <input
          id="new-improvement-input"
          type="text"
          placeholder="Add observation..."
          className="flex-1 rounded-input border border-border bg-surface px-5 py-3 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          value={newImprovement}
          onChange={(e) => onNewImprovementChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAddImprovement()}
          aria-label="New improvement observation"
        />
        <button
          onClick={onAddImprovement}
          disabled={!newImprovement.trim()}
          className="rounded-input bg-accent p-3.5 text-text shadow-card transition-colors hover:bg-accent-hover disabled:opacity-50"
          aria-label="Add improvement suggestion"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
);
