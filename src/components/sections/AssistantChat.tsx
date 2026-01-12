'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Bot, Loader2, Send, ScanEye } from 'lucide-react';
import { QAItem, Annotation } from '@/lib/types';
import { MarkdownViewer } from '../MarkdownViewer';
import { SectionCard } from '../ui/SectionCard';

interface AssistantChatProps {
  /** Q&A history */
  qa?: QAItem[];
  /** Current AI processing status */
  aiStatus: 'idle' | 'loading' | 'complete' | 'error';
  /** Callback to ask AI a question */
  onAskAi: (question: string) => Promise<void>;
  /** Callback to focus on a region in the image */
  onFocusRegion?: (annotation: Annotation) => void;
}

/**
 * Assistant Chat section component.
 * Provides a chat interface for querying the AI about the image.
 */
export const AssistantChat: React.FC<AssistantChatProps> = ({
  qa,
  aiStatus,
  onAskAi,
  onFocusRegion,
}) => {
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const qaContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (qa && qaContainerRef.current) {
      qaContainerRef.current.scrollTop = qaContainerRef.current.scrollHeight;
    }
  }, [qa]);

  const handleSubmitQuestion = async () => {
    if (!question.trim()) return;
    setIsAsking(true);
    try {
      await onAskAi(question);
      setQuestion('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <SectionCard
      icon={Bot}
      title="Analysis Assistant"
      subtitle="Direct query model context"
      iconColorClass="bg-sky-500/10 text-sky-400 ring-sky-500/20"
      className="overflow-hidden"
    >
      <div className="space-y-6">
        <div
          ref={qaContainerRef}
          className="space-y-6 max-h-[500px] overflow-y-auto custom-scrollbar px-2 py-4"
        >
          {(!qa || qa.length === 0) && <EmptyState aiStatus={aiStatus} />}

          {qa?.map((item) => (
            <ChatMessage key={item.id} item={item} onFocusRegion={onFocusRegion} />
          ))}

          {isAsking && <SynthesizingIndicator />}
        </div>

        <ChatInput
          question={question}
          aiStatus={aiStatus}
          isAsking={isAsking}
          onChange={setQuestion}
          onSubmit={handleSubmitQuestion}
        />
      </div>
    </SectionCard>
  );
};

interface EmptyStateProps {
  aiStatus: 'idle' | 'loading' | 'complete' | 'error';
}

const EmptyState: React.FC<EmptyStateProps> = ({ aiStatus }) => (
  <div className="text-center py-10 text-slate-600 space-y-4">
    {aiStatus === 'loading' ? (
      <div className="flex items-center justify-center gap-3">
        <Loader2 size={24} className="animate-spin text-sky-500" />
        <p className="text-sm font-medium tracking-wide">INITIALIZING ASSISTANT...</p>
      </div>
    ) : (
      <>
        <Bot size={48} className="mx-auto text-slate-800" />
        <p className="text-sm font-medium tracking-wide">READY FOR INTERROGATION</p>
      </>
    )}
  </div>
);

interface ChatMessageProps {
  item: QAItem;
  onFocusRegion?: (annotation: Annotation) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ item, onFocusRegion }) => (
  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div className="flex justify-end">
      <div className="bg-indigo-600 text-white rounded-3xl rounded-tr-none px-6 py-3.5 max-w-[80%] text-sm font-medium shadow-xl">
        {item.question}
      </div>
    </div>
    <div className="flex flex-col items-start gap-3">
      <div className="bg-white/5 text-slate-200 rounded-3xl rounded-tl-none px-6 py-5 max-w-[90%] text-sm shadow-inner border border-white/5 leading-relaxed">
        <MarkdownViewer content={item.answer} />
      </div>
      {item.annotations && item.annotations.length > 0 && onFocusRegion && (
        <div className="flex flex-wrap gap-3 mt-1 ml-4">
          {item.annotations.map((ann, idx) => (
            <button
              key={idx}
              onClick={() => onFocusRegion(ann)}
              className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/50 hover:bg-indigo-600 text-white border border-white/5 rounded-2xl transition-all shadow-lg group"
            >
              <ScanEye size={16} className="text-indigo-400 group-hover:text-white" />
              <span className="text-[10px] font-black uppercase tracking-widest">{ann.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

const SynthesizingIndicator: React.FC = () => (
  <div className="flex justify-start animate-pulse">
    <div className="bg-white/5 rounded-3xl rounded-tl-none px-8 py-4 flex items-center gap-3 text-slate-400 text-xs font-bold uppercase tracking-widest border border-white/5">
      <Loader2 size={16} className="animate-spin text-indigo-500" /> SYNTHESIZING...
    </div>
  </div>
);

interface ChatInputProps {
  question: string;
  aiStatus: 'idle' | 'loading' | 'complete' | 'error';
  isAsking: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  question,
  aiStatus,
  isAsking,
  onChange,
  onSubmit,
}) => (
  <div className="relative mt-8 group/input">
    <input
      type="text"
      className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-8 pr-16 text-sm text-white placeholder:text-slate-600 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all shadow-inner disabled:opacity-50"
      placeholder={
        aiStatus === 'loading'
          ? 'Waiting for analysis...'
          : 'Analyze specific elements of the generation...'
      }
      value={question}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && !isAsking && aiStatus === 'complete' && onSubmit()}
      disabled={isAsking || aiStatus !== 'complete'}
    />
    <button
      onClick={onSubmit}
      disabled={!question.trim() || isAsking || aiStatus !== 'complete'}
      className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xl transition-all hover:scale-105 disabled:opacity-30 disabled:hover:scale-100"
    >
      <Send size={20} />
    </button>
  </div>
);
