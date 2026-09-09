'use client';

import React, { useState } from 'react';
import { Layers, Edit2, Plus, BookOpen } from 'lucide-react';
import { SectionCard } from '../ui/SectionCard';

interface SceneOverviewItem {
  category: string;
  details: string;
}

interface SceneOverviewProps {
  /** Scene overview items */
  sceneOverview: SceneOverviewItem[];
  /** Scene backstory text */
  sceneBackstory?: string;
  /** Whether in offline mode */
  isOffline: boolean;
  /** Current AI processing status */
  aiStatus: 'idle' | 'loading' | 'complete' | 'error';
  /** Callback to update backstory */
  onUpdateBackstory: (backstory: string) => void;
}

/**
 * Scene Overview section component.
 * Displays scene intelligence attributes and narrative context.
 */
export const SceneOverview: React.FC<SceneOverviewProps> = ({
  sceneOverview,
  sceneBackstory,
  isOffline,
  aiStatus,
  onUpdateBackstory,
}) => {
  const [isEditingBackstory, setIsEditingBackstory] = useState(false);
  const [tempBackstory, setTempBackstory] = useState('');

  const handleStartEditBackstory = () => {
    setTempBackstory(sceneBackstory || '');
    setIsEditingBackstory(true);
  };

  const handleCancelEditBackstory = () => {
    setIsEditingBackstory(false);
    setTempBackstory('');
  };

  const handleSaveBackstory = () => {
    onUpdateBackstory(tempBackstory);
    setIsEditingBackstory(false);
  };

  const isLoading = aiStatus === 'loading' && sceneOverview.length === 0;

  return (
    <SectionCard
      icon={Layers}
      title="Scene Intelligence"
      subtitle={isOffline ? 'Local Recovery Mode' : undefined}
      iconColorClass="bg-accent-subtle text-accent ring-accent/30"
      isLoading={isLoading}
      className="overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
        <Layers size={80} className="text-accent" />
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <LoadingAttributes />
        ) : (
          <AttributeList items={sceneOverview} isOffline={isOffline} />
        )}

        <NarrativeContext
          backstory={sceneBackstory}
          isEditing={isEditingBackstory}
          tempBackstory={tempBackstory}
          onStartEdit={handleStartEditBackstory}
          onCancel={handleCancelEditBackstory}
          onSave={handleSaveBackstory}
          onTempChange={setTempBackstory}
        />
      </div>
    </SectionCard>
  );
};

const LoadingAttributes: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex gap-6 items-center">
        <div className="h-2 w-32 rounded-full bg-surface-muted"></div>
        <div className="h-2 flex-1 rounded-full bg-surface-muted"></div>
      </div>
    ))}
  </div>
);

interface AttributeListProps {
  items: SceneOverviewItem[];
  isOffline: boolean;
}

const AttributeList: React.FC<AttributeListProps> = ({ items, isOffline }) => (
  <div className="grid gap-6">
    {items.length > 0 ? (
      items.map((item, idx) => (
        <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:gap-6 items-start">
          <span className="mt-1.5 min-w-[140px] text-xs font-semibold uppercase tracking-[0.2em] text-status-info">
            {item.category}
          </span>
          <p className="text-base leading-relaxed text-text-secondary">{item.details}</p>
        </div>
      ))
    ) : (
      <div className="flex items-center gap-3 py-4 font-medium text-text-secondary">
        {isOffline
          ? 'Forensic scene description is unavailable in offline mode.'
          : 'Waiting for scan...'}
      </div>
    )}
  </div>
);

interface NarrativeContextProps {
  backstory?: string;
  isEditing: boolean;
  tempBackstory: string;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onTempChange: (value: string) => void;
}

const NarrativeContext: React.FC<NarrativeContextProps> = ({
  backstory,
  isEditing,
  tempBackstory,
  onStartEdit,
  onCancel,
  onSave,
  onTempChange,
}) => (
  <div className="mt-4 border-t border-border pt-8">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-text-secondary">
        <BookOpen size={14} className="text-accent" /> Narrative Context
      </div>
      {!isEditing && (
        <button
          onClick={onStartEdit}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-status-info hover:text-text"
        >
          <Edit2 size={12} /> Edit Story
        </button>
      )}
    </div>

    {isEditing ? (
      <div className="space-y-4">
        <textarea
          className="min-h-[120px] w-full rounded-card border border-border bg-surface-muted p-5 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
          placeholder="Write the backstory or inspiration for this image..."
          value={tempBackstory}
          onChange={(e) => onTempChange(e.target.value)}
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2 text-xs font-semibold uppercase text-text-secondary hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="rounded-button bg-accent px-6 py-2 text-xs font-semibold text-text shadow-card hover:bg-accent-hover"
          >
            SAVE CONTEXT
          </button>
        </div>
      </div>
    ) : (
      <div
        onClick={onStartEdit}
        onKeyDown={(e) => e.key === 'Enter' && onStartEdit()}
        role="button"
        tabIndex={0}
        className="group -mx-5 cursor-pointer rounded-card border border-transparent p-5 transition-colors hover:border-border hover:bg-surface-muted"
      >
        {backstory ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-text-secondary">
            {backstory}
          </p>
        ) : (
          <span className="flex items-center gap-3 text-sm font-medium italic text-text-muted">
            <Plus size={16} className="text-accent/50" />
            No narrative context added. Click to add a backstory or inspiration notes.
          </span>
        )}
      </div>
    )}
  </div>
);
