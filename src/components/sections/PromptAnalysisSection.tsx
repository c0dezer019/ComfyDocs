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
      iconColorClass="bg-purple-500/10 text-purple-400 ring-purple-500/20"
      isLoading={isLoading}
      showHeaderBorder
      headerRight={
        promptAnalysis && (
          <div className="flex items-center gap-4">
            <button
              onClick={onRefreshPromptAnalysis}
              className="p-2.5 text-slate-500 hover:text-white rounded-xl hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
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
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-30 flex flex-col items-center justify-center gap-4 rounded-3xl">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-200">
            Revising Prompt Theory...
          </p>
        </div>
      )}

      {isLoading ? (
        <LoadingPlaceholder
          text="Analyzing prompt structure..."
          spinnerColorClass="text-purple-500/50"
        />
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
      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
        Theoretical Critique
      </h3>
      <button
        onClick={onStartEdit}
        className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300"
      >
        Edit
      </button>
    </div>
    {isEditing ? (
      <div className="space-y-4">
        <textarea
          className="w-full bg-slate-900 border border-white/5 rounded-2xl p-5 text-sm text-slate-300 min-h-[180px] outline-none"
          value={editedCritique}
          onChange={(e) => onCritiqueChange(e.target.value)}
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="text-[10px] font-black text-slate-500 uppercase px-4"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-6 py-2 bg-white text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest"
          >
            Update Critique
          </button>
        </div>
      </div>
    ) : (
      <div className="p-6 bg-black/30 rounded-2xl border border-white/5 text-slate-300 text-sm leading-relaxed shadow-inner">
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
    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
      Technical Refinements
    </h3>
    <ul className="space-y-3">
      {filteredIssues.map((issue, issueIdx) => {
        const fixes = issue.suggestedFixes || (issue.suggestedFix ? [issue.suggestedFix] : []);
        if (fixes.length === 0) return null;
        return (
          <li
            key={issue.id || `issue-${issueIdx}`}
            className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl animate-in slide-in-from-right-4 duration-500"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-1.5 h-1.5 rounded-full ${issue.severity === 'Note' ? 'bg-slate-400' : 'bg-rose-400'}`}
              />
              <span
                className={`text-[10px] font-black uppercase tracking-widest ${issue.severity === 'Note' ? 'text-slate-400' : 'text-rose-300'}`}
              >
                {issue.type}
              </span>
            </div>
            <div className="space-y-2 pl-4">
              {fixes.map((fix, fIdx) => (
                <div key={fIdx} className="flex items-start gap-3">
                  <ArrowRight size={12} className="text-indigo-500 mt-1 shrink-0" />
                  <span className="text-sm text-slate-200 font-medium">{fix}</span>
                </div>
              ))}
            </div>
          </li>
        );
      })}

      {improvements.map((tip, idx) => (
        <li
          key={`gen-${idx}`}
          className="group/item flex items-start gap-4 p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/[0.08] transition-all"
        >
          <Sparkles size={14} className="text-indigo-400 mt-1 shrink-0" />
          <span className="text-sm text-slate-300 leading-relaxed flex-1">{tip}</span>
          <button
            onClick={() => onDeleteImprovement(idx)}
            className="opacity-0 group-hover/item:opacity-100 p-1.5 text-slate-600 hover:text-red-400 transition-all"
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
          className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-5 py-3 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/30"
          value={newImprovement}
          onChange={(e) => onNewImprovementChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAddImprovement()}
          aria-label="New improvement observation"
        />
        <button
          onClick={onAddImprovement}
          disabled={!newImprovement.trim()}
          className="p-3.5 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-500 disabled:opacity-50 transition-all"
          aria-label="Add improvement suggestion"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
);
