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
  const [_regeneratingFixForId, _setRegeneratingFixForId] = useState<string | null>(null);
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
      _setRegeneratingFixForId(updatedIssue.id);
      await onRegenerateIssueFix(updatedIssue);
      _setRegeneratingFixForId(null);
    }
  };

  const handleAddIssue = async () => {
    if (!newIssue || !newIssue.description || !qualityAnalysis) return;
    const severity = (newIssue.severity as QualityIssue['severity']) || 'Minor';
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
      _setRegeneratingFixForId(issueToAdd.id);
      await onRegenerateIssueFix(issueToAdd);
      _setRegeneratingFixForId(null);
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
      _setRegeneratingFixForId(issue.id);
      await onRegenerateIssueFix(updatedIssue);
      _setRegeneratingFixForId(null);
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
      iconColorClass="bg-accent-subtle text-accent ring-accent/30"
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
        <LoadingPlaceholder text="Scanning artifacts..." spinnerColorClass="text-accent" />
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
                className="flex w-full items-center justify-center gap-3 rounded-card border-2 border-dashed border-border py-4 text-sm font-semibold text-text-secondary transition-colors hover:border-accent hover:bg-accent/5 hover:text-status-info"
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
    <div className="flex items-center gap-3 rounded-input border border-border bg-surface-muted px-4 py-2">
      <Filter size={14} className="text-text-secondary" aria-hidden="true" />
      <label htmlFor="confidence-threshold-slider" className="text-[10px] font-semibold text-text">
        {confidenceThreshold}% CONF
      </label>
      <input
        id="confidence-threshold-slider"
        type="range"
        min="0"
        max="100"
        value={confidenceThreshold}
        onChange={(e) => onConfidenceChange(parseInt(e.target.value))}
        className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border-muted accent-accent"
        aria-label="Confidence threshold filter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={confidenceThreshold}
        aria-valuetext={`${confidenceThreshold} percent confidence minimum`}
      />
    </div>

    <div className="flex items-center gap-3 rounded-input border border-border bg-surface-muted px-4 py-2">
      <Gauge size={14} className="text-text-secondary" aria-hidden="true" />
      <label htmlFor="pass-count-select" className="sr-only">
        Number of analysis passes
      </label>
      <select
        id="pass-count-select"
        value={passCount}
        onChange={(e) => onPassCountChange(Number(e.target.value))}
        className="cursor-pointer border-none bg-transparent text-[10px] font-semibold uppercase tracking-widest text-text outline-none"
        aria-label="Number of consensus analysis passes"
      >
        <option value="1">1 Pass</option>
        <option value="3">3 Passes</option>
        <option value="5">5 Passes</option>
      </select>
    </div>

    <button
      onClick={onRunConsensus}
      disabled={isRunningConsensus}
      className="flex items-center gap-2 rounded-button bg-accent px-6 py-2.5 text-xs font-semibold text-text shadow-card transition-colors hover:bg-accent-hover disabled:opacity-50"
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
  <div className="group/issue relative min-w-0 rounded-card border border-border bg-surface p-4 shadow-subtle transition-colors hover:border-accent/30 sm:p-6">
    {isEditing && editingIssue ? (
      <IssueEditForm
        issue={editingIssue}
        onChange={setEditingIssue}
        onSave={() => onSaveEdit(editingIssue)}
        onCancel={onCancelEdit}
      />
    ) : (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
            <div
              className={`rounded-input border px-3 py-1 text-center text-[10px] font-semibold uppercase tracking-widest ${getSeverityColor(issue.severity)}`}
            >
              {issue.severity === 'Note' ? '—' : issue.severity}
            </div>
            {issue.confidence !== undefined && (
              <div
                className={`rounded-input border px-3 py-1 text-center font-mono text-[9px] ${getConfidenceColor(issue.confidence)}`}
              >
                {issue.confidence}%
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 sm:pr-20">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <span className="min-w-0 break-words text-lg font-semibold tracking-tight text-text">
                {issue.type}
              </span>
              {issue.box_2d && onFocusRegion && (
                <button
                  onClick={onFocus}
                  className="rounded-input bg-accent/10 p-1.5 text-accent transition-colors hover:bg-accent hover:text-text"
                  aria-label={`Focus on ${issue.type} region in image`}
                >
                  <ScanEye size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">{issue.description}</p>
          </div>

          <div className="flex self-start gap-1 opacity-100 transition-opacity sm:absolute sm:top-6 sm:right-6 sm:opacity-0 sm:group-hover/issue:opacity-100 sm:group-focus-within/issue:opacity-100">
            <button
              onClick={onToggleNote}
              className={`rounded-input p-2 transition-colors hover:bg-surface-muted ${issue.userNotes ? 'text-accent' : 'text-text-secondary'}`}
              aria-label={`${issue.userNotes ? 'View' : 'Add'} context note for ${issue.type}`}
            >
              <StickyNote size={16} aria-hidden="true" />
            </button>
            <button
              onClick={onStartEdit}
              className="rounded-input p-2 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text"
              aria-label={`Edit ${issue.type} issue`}
            >
              <Edit2 size={16} aria-hidden="true" />
            </button>
            <button
              onClick={onDelete}
              className="rounded-input p-2 text-text-secondary transition-colors hover:bg-surface-muted hover:text-status-error"
              aria-label={`Delete ${issue.type} issue`}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {isNoteExpanded && (
          <NoteSection
            issueId={issue.id}
            issueType={issue.type}
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
  <div className="min-w-0 space-y-4">
    <div className="flex flex-col gap-4 sm:flex-row">
      <select
        className="w-full shrink-0 rounded-input border border-border bg-surface-muted px-4 py-2 text-xs font-semibold uppercase text-text sm:w-auto"
        value={issue.severity}
        onChange={(e) =>
          onChange({ ...issue, severity: e.target.value as QualityIssue['severity'] })
        }
      >
        <option value="Note">Note</option>
        <option value="Minor">Minor</option>
        <option value="Major">Major</option>
        <option value="Critical">Critical</option>
      </select>
      <input
        type="text"
        className="min-w-0 flex-1 rounded-input border border-border bg-surface-muted px-4 py-2 text-sm font-semibold text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        value={issue.type}
        onChange={(e) => onChange({ ...issue, type: e.target.value })}
      />
    </div>
    <label htmlFor={`issue-description-${issue.id}`} className="sr-only">
      Issue description
    </label>
    <textarea
      id={`issue-description-${issue.id}`}
      className="min-h-[80px] w-full rounded-input border border-border bg-surface-muted px-4 py-4 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      value={issue.description}
      onChange={(e) => onChange({ ...issue, description: e.target.value })}
      aria-label="Issue description"
    />
    <div className="flex flex-wrap justify-end gap-3">
      <button
        onClick={onCancel}
        className="px-6 py-2 text-xs font-semibold uppercase tracking-wider text-text-secondary hover:text-text"
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        className="rounded-button bg-accent px-8 py-2 text-xs font-semibold uppercase tracking-wider text-text shadow-card hover:bg-accent-hover"
      >
        Save Changes
      </button>
    </div>
  </div>
);

interface NoteSectionProps {
  issueId?: string;
  issueType?: string;
  userNotes?: string;
  isEditing: boolean;
  tempContent: string;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (value: string) => void;
}

const NoteSection: React.FC<NoteSectionProps> = ({
  issueId,
  issueType,
  userNotes,
  isEditing,
  tempContent,
  onStartEdit,
  onCancel,
  onSave,
  onChange,
}) => (
  <div className="ml-0 min-w-0 rounded-r-card border-l-4 border-accent bg-surface-muted p-4 text-sm sm:ml-10 sm:p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-text">
        <StickyNote size={12} aria-hidden="true" /> Researcher Context
      </div>
      {!isEditing && (
        <button
          onClick={onStartEdit}
          className="text-[10px] font-semibold uppercase text-text-secondary hover:text-status-info"
        >
          Edit
        </button>
      )}
    </div>
    {isEditing ? (
      <div className="space-y-4">
        <label htmlFor={`user-note-${issueId}`} className="sr-only">
          Context note for {issueType}
        </label>
        <textarea
          id={`user-note-${issueId}`}
          className="min-h-[100px] w-full rounded-input border border-border bg-surface p-4 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          value={tempContent}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Context note for ${issueType}`}
        />
        <div className="flex flex-wrap justify-end gap-3">
          <button
            onClick={onCancel}
            className="text-[10px] font-semibold uppercase text-text-secondary hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="rounded-button bg-accent px-4 py-1.5 text-[10px] font-semibold uppercase text-text hover:bg-accent-hover"
          >
            Save Note
          </button>
        </div>
      </div>
    ) : (
      <p className="italic leading-relaxed text-text-secondary">
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
  <div className="min-w-0 space-y-4 rounded-card border border-dashed border-accent/40 bg-accent/5 p-4 sm:p-8">
    <h4 className="text-sm font-semibold uppercase tracking-widest text-text">New Manual Entry</h4>
    <div className="flex flex-col gap-4 sm:flex-row">
      <label htmlFor="new-issue-severity" className="sr-only">
        Severity level
      </label>
      <select
        id="new-issue-severity"
        className="w-full shrink-0 rounded-input border border-border bg-surface px-4 py-3 text-xs font-semibold text-text sm:w-auto"
        value={newIssue.severity || 'Minor'}
        onChange={(e) =>
          onChange({ ...newIssue, severity: e.target.value as QualityIssue['severity'] })
        }
      >
        <option value="Note">Note</option>
        <option value="Minor">Minor</option>
        <option value="Major">Major</option>
        <option value="Critical">Critical</option>
      </select>
      <label htmlFor="new-issue-type" className="sr-only">
        Artifact type
      </label>
      <input
        id="new-issue-type"
        type="text"
        placeholder="Artifact Type..."
        className="min-w-0 flex-1 rounded-input border border-border bg-surface px-5 py-3 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        value={newIssue.type || ''}
        onChange={(e) => onChange({ ...newIssue, type: e.target.value })}
      />
    </div>
    <label htmlFor="new-issue-description" className="sr-only">
      Observation details
    </label>
    <textarea
      id="new-issue-description"
      placeholder="Observation details..."
      className="min-h-[100px] w-full rounded-input border border-border bg-surface px-5 py-4 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      value={newIssue.description || ''}
      onChange={(e) => onChange({ ...newIssue, description: e.target.value })}
    />
    <div className="flex flex-wrap justify-end gap-4">
      <button
        onClick={onCancel}
        className="text-xs font-semibold uppercase text-text-secondary hover:text-text"
      >
        Discard
      </button>
      <button
        onClick={onAdd}
        className="rounded-button bg-accent px-8 py-3 text-xs font-semibold uppercase text-text shadow-card transition-colors hover:bg-accent-hover"
      >
        Add & Audit
      </button>
    </div>
  </div>
);
