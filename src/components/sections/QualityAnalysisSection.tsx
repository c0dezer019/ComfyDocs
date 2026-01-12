'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Filter,
  Gauge,
  Target,
  Loader2,
  Edit2,
  Trash2,
  StickyNote,
  ScanEye,
  Plus,
  X,
} from 'lucide-react';
import { QualityIssue, Annotation } from '@/lib/types';
import { SectionCard, LoadingPlaceholder, ScoreDisplay } from '../ui/SectionCard';
import {
  getSeverityColor,
  getConfidenceColor,
  getScoreColor,
  calculateScore,
} from '@/lib/styleUtils';
import { runConsensusQualityAnalysis } from '@/services/geminiService';

interface QualityAnalysisSectionProps {
  /** Quality analysis data */
  qualityAnalysis?: {
    overallScore: number;
    issues: QualityIssue[];
  };
  /** Current AI processing status */
  aiStatus: 'idle' | 'loading' | 'complete' | 'error';
  /** Callback to update quality analysis */
  onUpdateQualityAnalysis: (analysis: { overallScore: number; issues: QualityIssue[] }) => void;
  /** Callback to regenerate fix for an issue */
  onRegenerateIssueFix?: (issue: QualityIssue) => Promise<void>;
  /** Callback to focus on a region in the image */
  onFocusRegion?: (annotation: Annotation) => void;
}

/**
 * Quality Analysis section component.
 * Displays forensic report with artifact detection and issue management.
 */
export const QualityAnalysisSection: React.FC<QualityAnalysisSectionProps> = ({
  qualityAnalysis,
  aiStatus,
  onUpdateQualityAnalysis,
  onRegenerateIssueFix,
  onFocusRegion,
}) => {
  const [editingIssueIndex, setEditingIssueIndex] = useState<number | null>(null);
  const [editingIssue, setEditingIssue] = useState<QualityIssue | null>(null);
  const [newIssue, setNewIssue] = useState<Partial<QualityIssue> | null>(null);
  const [regeneratingFixForId, setRegeneratingFixForId] = useState<string | null>(null);
  const [passCount, setPassCount] = useState<number>(3);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0);
  const [isRunningConsensus, setIsRunningConsensus] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNoteContent, setTempNoteContent] = useState('');

  const isLoading = aiStatus === 'loading' && !qualityAnalysis;

  const toggleNote = (id: string) => {
    const next = new Set(expandedNotes);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedNotes(next);
    if (expandedNotes.has(id) && editingNoteId === id) setEditingNoteId(null);
  };

  const handleRunConsensus = async () => {
    if (!qualityAnalysis) return;
    const imgElement = document.querySelector('img[alt="ComfyUI Generation"]') as HTMLImageElement;
    if (!imgElement) return;
    setIsRunningConsensus(true);
    try {
      const response = await fetch(imgElement.src);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const newIssues = await runConsensusQualityAnalysis(base64, passCount);
        const newScore = calculateScore(newIssues);
        onUpdateQualityAnalysis({ overallScore: newScore, issues: newIssues });
        setIsRunningConsensus(false);
      };
    } catch (e) {
      console.error(e);
      setIsRunningConsensus(false);
    }
  };

  const handleDeleteIssue = (index: number) => {
    if (!qualityAnalysis) return;
    const newIssues = qualityAnalysis.issues.filter((_, i) => i !== index);
    const newScore = calculateScore(newIssues);
    onUpdateQualityAnalysis({ ...qualityAnalysis, issues: newIssues, overallScore: newScore });
  };

  const handleStartEditing = (index: number, issue: QualityIssue) => {
    setEditingIssueIndex(index);
    setEditingIssue({ ...issue });
  };

  const handleCancelEditing = () => {
    setEditingIssueIndex(null);
    setEditingIssue(null);
  };

  const handleSaveIssue = async (index: number, updatedIssue: QualityIssue) => {
    if (!qualityAnalysis) return;
    const originalIssue = qualityAnalysis.issues[index];
    if (updatedIssue.severity === 'Note') updatedIssue.score = 0;

    const noteChanged = originalIssue.userNotes !== updatedIssue.userNotes;
    const descChanged = originalIssue.description !== updatedIssue.description;
    const newIssues = [...qualityAnalysis.issues];
    newIssues[index] = updatedIssue;
    const newScore = calculateScore(newIssues);
    onUpdateQualityAnalysis({ ...qualityAnalysis, issues: newIssues, overallScore: newScore });
    setEditingIssueIndex(null);
    setEditingIssue(null);

    if ((noteChanged || descChanged) && onRegenerateIssueFix) {
      setRegeneratingFixForId(updatedIssue.id);
      await onRegenerateIssueFix(updatedIssue);
      setRegeneratingFixForId(null);
    }
  };

  const handleAddIssue = async () => {
    if (!newIssue || !newIssue.description || !qualityAnalysis) return;
    const severity = (newIssue.severity as any) || 'Minor';
    const score = severity === 'Note' ? 0 : newIssue.score || 0.5;

    const issueToAdd: QualityIssue = {
      id: crypto.randomUUID(),
      type: newIssue.type || 'Manual Entry',
      description: newIssue.description,
      severity: severity,
      score: score,
      suggestedFixes: ['Generating fix...'],
      confidence: 100,
      passCount: 1,
      userNotes: newIssue.userNotes || '',
    };
    const newIssues = [...qualityAnalysis.issues, issueToAdd];
    const newScore = calculateScore(newIssues);
    onUpdateQualityAnalysis({ ...qualityAnalysis, issues: newIssues, overallScore: newScore });
    setNewIssue(null);
    if (issueToAdd.userNotes) setExpandedNotes((prev) => new Set(prev).add(issueToAdd.id));

    if (onRegenerateIssueFix) {
      setRegeneratingFixForId(issueToAdd.id);
      await onRegenerateIssueFix(issueToAdd);
      setRegeneratingFixForId(null);
    }
  };

  const handleStartNoteEdit = (issue: QualityIssue) => {
    setTempNoteContent(issue.userNotes || '');
    setEditingNoteId(issue.id);
  };

  const handleCancelNoteEdit = () => {
    setEditingNoteId(null);
    setTempNoteContent('');
  };

  const handleSaveNote = async (issue: QualityIssue) => {
    if (!qualityAnalysis) return;
    const updatedIssue = { ...issue, userNotes: tempNoteContent };
    const newIssues = qualityAnalysis.issues.map((i) => (i.id === issue.id ? updatedIssue : i));
    onUpdateQualityAnalysis({ ...qualityAnalysis, issues: newIssues });
    setEditingNoteId(null);
    if (issue.userNotes !== tempNoteContent && onRegenerateIssueFix) {
      setRegeneratingFixForId(issue.id);
      await onRegenerateIssueFix(updatedIssue);
      setRegeneratingFixForId(null);
    }
  };

  const handleFocusIssue = (issue: QualityIssue) => {
    if (onFocusRegion && issue.box_2d) {
      onFocusRegion({ label: issue.type, style: issue.style || 'box', box_2d: issue.box_2d });
    }
  };

  const filteredIssues =
    qualityAnalysis?.issues.filter((i) => (i.confidence || 100) >= confidenceThreshold) || [];

  return (
    <SectionCard
      icon={AlertTriangle}
      title="Forensic Report"
      subtitle="Pixel-level artifact detection"
      iconColorClass="bg-rose-500/10 text-rose-400 ring-rose-500/20"
      isLoading={isLoading}
      headerRight={
        qualityAnalysis && (
          <ControlsBar
            confidenceThreshold={confidenceThreshold}
            passCount={passCount}
            isRunningConsensus={isRunningConsensus}
            overallScore={qualityAnalysis.overallScore}
            onConfidenceChange={setConfidenceThreshold}
            onPassCountChange={setPassCount}
            onRunConsensus={handleRunConsensus}
          />
        )
      }
    >
      {isLoading ? (
        <LoadingPlaceholder text="Scanning artifacts..." spinnerColorClass="text-rose-500/50" />
      ) : (
        qualityAnalysis && (
          <div className="space-y-4">
            {filteredIssues.map((issue, idx) => (
              <IssueCard
                key={issue.id || idx}
                issue={issue}
                index={idx}
                isEditing={editingIssueIndex === idx}
                editingIssue={editingIssue}
                isNoteExpanded={expandedNotes.has(issue.id)}
                isEditingNote={editingNoteId === issue.id}
                tempNoteContent={tempNoteContent}
                onToggleNote={() => toggleNote(issue.id)}
                onStartEdit={() => handleStartEditing(idx, issue)}
                onCancelEdit={handleCancelEditing}
                onSaveEdit={(updated) => handleSaveIssue(idx, updated)}
                onDelete={() => handleDeleteIssue(idx)}
                onFocus={() => handleFocusIssue(issue)}
                onStartNoteEdit={() => handleStartNoteEdit(issue)}
                onCancelNoteEdit={handleCancelNoteEdit}
                onSaveNote={() => handleSaveNote(issue)}
                onTempNoteChange={setTempNoteContent}
                setEditingIssue={setEditingIssue}
                onFocusRegion={onFocusRegion}
              />
            ))}

            {newIssue ? (
              <NewIssueForm
                newIssue={newIssue}
                onChange={setNewIssue}
                onAdd={handleAddIssue}
                onCancel={() => setNewIssue(null)}
              />
            ) : (
              <button
                onClick={() =>
                  setNewIssue({ severity: 'Minor', score: 0.5, type: '', userNotes: '' })
                }
                className="w-full py-4 border-2 border-dashed border-white/5 rounded-2xl text-sm font-bold text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-3"
              >
                <Plus size={20} /> MANUALLY TAG ARTIFACT
              </button>
            )}
          </div>
        )
      )}
    </SectionCard>
  );
};

// Sub-components

interface ControlsBarProps {
  confidenceThreshold: number;
  passCount: number;
  isRunningConsensus: boolean;
  overallScore: number;
  onConfidenceChange: (value: number) => void;
  onPassCountChange: (value: number) => void;
  onRunConsensus: () => void;
}

const ControlsBar: React.FC<ControlsBarProps> = ({
  confidenceThreshold,
  passCount,
  isRunningConsensus,
  overallScore,
  onConfidenceChange,
  onPassCountChange,
  onRunConsensus,
}) => (
  <div className="flex flex-wrap items-center gap-4">
    <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
      <Filter size={14} className="text-slate-500" />
      <span className="text-[10px] font-black text-slate-400">{confidenceThreshold}% CONF</span>
      <input
        type="range"
        min="0"
        max="100"
        value={confidenceThreshold}
        onChange={(e) => onConfidenceChange(parseInt(e.target.value))}
        className="w-20 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
      />
    </div>

    <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
      <Gauge size={14} className="text-slate-500" />
      <select
        value={passCount}
        onChange={(e) => onPassCountChange(Number(e.target.value))}
        className="bg-transparent text-[10px] font-black text-slate-300 uppercase tracking-widest outline-none border-none cursor-pointer"
      >
        <option value="1">1 Pass</option>
        <option value="3">3 Passes</option>
        <option value="5">5 Passes</option>
      </select>
    </div>

    <button
      onClick={onRunConsensus}
      disabled={isRunningConsensus}
      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
    >
      {isRunningConsensus ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
      {isRunningConsensus ? 'AUDITING...' : 'RUN AUDIT'}
    </button>

    <ScoreDisplay label="Score" score={overallScore} colorClass={getScoreColor(overallScore)} />
  </div>
);

interface IssueCardProps {
  issue: QualityIssue;
  index: number;
  isEditing: boolean;
  editingIssue: QualityIssue | null;
  isNoteExpanded: boolean;
  isEditingNote: boolean;
  tempNoteContent: string;
  onToggleNote: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (issue: QualityIssue) => void;
  onDelete: () => void;
  onFocus: () => void;
  onStartNoteEdit: () => void;
  onCancelNoteEdit: () => void;
  onSaveNote: () => void;
  onTempNoteChange: (value: string) => void;
  setEditingIssue: (issue: QualityIssue | null) => void;
  onFocusRegion?: (annotation: Annotation) => void;
}

const IssueCard: React.FC<IssueCardProps> = ({
  issue,
  isEditing,
  editingIssue,
  isNoteExpanded,
  isEditingNote,
  tempNoteContent,
  onToggleNote,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onFocus,
  onStartNoteEdit,
  onCancelNoteEdit,
  onSaveNote,
  onTempNoteChange,
  setEditingIssue,
  onFocusRegion,
}) => (
  <div className="bg-white/5 rounded-2xl border border-white/5 p-6 group/issue relative transition-all hover:bg-white/[0.08] hover:border-white/10">
    {isEditing && editingIssue ? (
      <IssueEditForm
        issue={editingIssue}
        onChange={setEditingIssue}
        onSave={() => onSaveEdit(editingIssue)}
        onCancel={onCancelEdit}
      />
    ) : (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-6">
          <div className="flex flex-col gap-2 shrink-0">
            <div
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border text-center ${getSeverityColor(issue.severity)}`}
            >
              {issue.severity === 'Note' ? '—' : issue.severity}
            </div>
            {issue.confidence !== undefined && (
              <div
                className={`px-3 py-1 rounded-lg text-[9px] font-mono border text-center ${getConfidenceColor(issue.confidence)}`}
              >
                {issue.confidence}%
              </div>
            )}
          </div>
          <div className="flex-1 pr-20">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-bold text-white tracking-tight">{issue.type}</span>
              {issue.box_2d && onFocusRegion && (
                <button
                  onClick={onFocus}
                  className="p-1.5 text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 rounded-lg transition-all"
                  title="Focus Region"
                >
                  <ScanEye size={14} />
                </button>
              )}
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">{issue.description}</p>
          </div>

          <div className="absolute top-6 right-6 flex gap-1 opacity-0 group-hover/issue:opacity-100 transition-opacity">
            <button
              onClick={onToggleNote}
              className={`p-2 rounded-xl hover:bg-white/10 ${issue.userNotes ? 'text-indigo-400' : 'text-slate-500'}`}
              title="Context Note"
            >
              <StickyNote size={16} />
            </button>
            <button
              onClick={onStartEdit}
              className="p-2 text-slate-500 hover:text-white rounded-xl hover:bg-white/10"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-slate-500 hover:text-red-400 rounded-xl hover:bg-white/10"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {isNoteExpanded && (
          <NoteSection
            userNotes={issue.userNotes}
            isEditing={isEditingNote}
            tempContent={tempNoteContent}
            onStartEdit={onStartNoteEdit}
            onCancel={onCancelNoteEdit}
            onSave={onSaveNote}
            onChange={onTempNoteChange}
          />
        )}
      </div>
    )}
  </div>
);

interface IssueEditFormProps {
  issue: QualityIssue;
  onChange: (issue: QualityIssue) => void;
  onSave: () => void;
  onCancel: () => void;
}

const IssueEditForm: React.FC<IssueEditFormProps> = ({ issue, onChange, onSave, onCancel }) => (
  <div className="space-y-4">
    <div className="flex gap-4">
      <select
        className="bg-slate-900 border border-white/10 rounded-xl text-xs font-bold uppercase text-slate-300 px-4 py-2"
        value={issue.severity}
        onChange={(e) => onChange({ ...issue, severity: e.target.value as any })}
      >
        <option value="Note">Note</option>
        <option value="Minor">Minor</option>
        <option value="Major">Major</option>
        <option value="Critical">Critical</option>
      </select>
      <input
        type="text"
        className="flex-1 bg-slate-900 border border-white/10 rounded-xl text-sm font-bold text-white px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500/30"
        value={issue.type}
        onChange={(e) => onChange({ ...issue, type: e.target.value })}
      />
    </div>
    <textarea
      className="w-full bg-slate-900 border border-white/10 rounded-xl text-sm text-slate-300 px-4 py-4 min-h-[80px] outline-none"
      value={issue.description}
      onChange={(e) => onChange({ ...issue, description: e.target.value })}
    />
    <div className="flex justify-end gap-3">
      <button
        onClick={onCancel}
        className="px-6 py-2 text-xs font-bold text-slate-500 hover:text-white uppercase tracking-wider"
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg uppercase tracking-wider"
      >
        Save Changes
      </button>
    </div>
  </div>
);

interface NoteSectionProps {
  userNotes?: string;
  isEditing: boolean;
  tempContent: string;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (value: string) => void;
}

const NoteSection: React.FC<NoteSectionProps> = ({
  userNotes,
  isEditing,
  tempContent,
  onStartEdit,
  onCancel,
  onSave,
  onChange,
}) => (
  <div className="ml-10 p-5 bg-black/40 border-l-4 border-indigo-500/50 rounded-r-2xl text-sm animate-in slide-in-from-top-2">
    <div className="flex items-center justify-between mb-3">
      <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
        <StickyNote size={12} /> Researcher Context
      </div>
      {!isEditing && (
        <button
          onClick={onStartEdit}
          className="text-[10px] font-bold text-slate-500 hover:text-indigo-300 uppercase"
        >
          Edit
        </button>
      )}
    </div>
    {isEditing ? (
      <div className="space-y-4">
        <textarea
          className="w-full bg-slate-900 border border-white/5 rounded-xl text-sm text-slate-200 p-4 min-h-[100px] outline-none"
          value={tempContent}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="text-[10px] font-black text-slate-500 uppercase">
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase"
          >
            Save Note
          </button>
        </div>
      </div>
    ) : (
      <p className="italic text-slate-400 leading-relaxed">
        {userNotes || 'No context added yet.'}
      </p>
    )}
  </div>
);

interface NewIssueFormProps {
  newIssue: Partial<QualityIssue>;
  onChange: (issue: Partial<QualityIssue>) => void;
  onAdd: () => void;
  onCancel: () => void;
}

const NewIssueForm: React.FC<NewIssueFormProps> = ({ newIssue, onChange, onAdd, onCancel }) => (
  <div className="bg-indigo-500/5 rounded-3xl border border-dashed border-indigo-500/30 p-8 space-y-4 animate-in zoom-in-95">
    <h4 className="text-sm font-black text-indigo-300 uppercase tracking-widest">
      New Manual Entry
    </h4>
    <div className="flex gap-4">
      <select
        className="bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-slate-300 px-4"
        value={newIssue.severity || 'Minor'}
        onChange={(e) => onChange({ ...newIssue, severity: e.target.value as any })}
      >
        <option value="Note">Note</option>
        <option value="Minor">Minor</option>
        <option value="Major">Major</option>
        <option value="Critical">Critical</option>
      </select>
      <input
        type="text"
        placeholder="Artifact Type..."
        className="flex-1 bg-slate-950 border border-white/10 rounded-xl text-sm text-white px-5 py-3 outline-none"
        value={newIssue.type || ''}
        onChange={(e) => onChange({ ...newIssue, type: e.target.value })}
      />
    </div>
    <textarea
      placeholder="Observation details..."
      className="w-full bg-slate-950 border border-white/10 rounded-xl text-sm text-slate-300 px-5 py-4 min-h-[100px] outline-none"
      value={newIssue.description || ''}
      onChange={(e) => onChange({ ...newIssue, description: e.target.value })}
    />
    <div className="flex justify-end gap-4">
      <button onClick={onCancel} className="text-xs font-bold text-slate-500 uppercase">
        Discard
      </button>
      <button
        onClick={onAdd}
        className="px-8 py-3 bg-white text-slate-900 rounded-full text-xs font-black uppercase shadow-xl hover:scale-105 transition-transform"
      >
        Add & Audit
      </button>
    </div>
  </div>
);
