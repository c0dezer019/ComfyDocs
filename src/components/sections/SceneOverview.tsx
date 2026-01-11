'use client';

import React, { useState } from 'react';
import { Layers, Edit2, Plus, BookOpen, Loader2 } from 'lucide-react';
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
      iconColorClass="bg-indigo-500/10 text-indigo-400 ring-indigo-500/20"
      isLoading={isLoading}
      className="overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
        <Layers size={80} className="text-indigo-400" />
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <LoadingAttributes />
        ) : (
          <AttributeList 
            items={sceneOverview} 
            isOffline={isOffline} 
          />
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
        <div className="w-32 h-2 bg-slate-800 rounded-full"></div>
        <div className="flex-1 h-2 bg-slate-800 rounded-full"></div>
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
          <span className="min-w-[140px] text-xs font-black text-indigo-300/60 uppercase tracking-[0.2em] mt-1.5">
            {item.category}
          </span>
          <p className="text-slate-200 leading-relaxed text-base">{item.details}</p>
        </div>
      ))
    ) : (
      <div className="text-slate-500 font-medium py-4 flex items-center gap-3">
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
  <div className="pt-8 mt-4 border-t border-white/5">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
        <BookOpen size={14} className="text-indigo-400" /> Narrative Context
      </div>
      {!isEditing && (
        <button
          onClick={onStartEdit}
          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider"
        >
          <Edit2 size={12} /> Edit Story
        </button>
      )}
    </div>

    {isEditing ? (
      <div className="space-y-4">
        <textarea
          className="w-full bg-black/30 border border-white/10 rounded-2xl p-5 text-sm text-slate-200 min-h-[120px] focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all placeholder:text-slate-700"
          placeholder="Write the backstory or inspiration for this image..."
          value={tempBackstory}
          onChange={(e) => onTempChange(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2 text-xs font-bold text-slate-500 hover:text-slate-300 uppercase"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20"
          >
            SAVE CONTEXT
          </button>
        </div>
      </div>
    ) : (
      <div
        onClick={onStartEdit}
        className="group cursor-pointer rounded-2xl p-5 -mx-5 border border-transparent hover:bg-white/5 transition-all"
      >
        {backstory ? (
          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
            {backstory}
          </p>
        ) : (
          <span className="text-slate-600 italic text-sm font-medium flex items-center gap-3">
            <Plus size={16} className="text-indigo-500/30" />
            No narrative context added. Click to add a backstory or inspiration notes.
          </span>
        )}
      </div>
    )}
  </div>
);
