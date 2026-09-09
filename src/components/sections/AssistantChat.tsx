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
      iconColorClass="bg-accent-subtle text-accent ring-accent/30"
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
  <div className="space-y-4 py-10 text-center text-text-secondary">
    {aiStatus === 'loading' ? (
      <div className="flex items-center justify-center gap-3">
        <Loader2 size={24} className="animate-spin text-accent" />
        <p className="text-sm font-medium tracking-wide">INITIALIZING ASSISTANT...</p>
      </div>
    ) : (
      <>
        <Bot size={48} className="mx-auto text-text-muted" />
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
  <div className="space-y-4">
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-3xl rounded-tr-none bg-accent px-6 py-3.5 text-sm font-medium text-text shadow-card">
        {item.question}
      </div>
    </div>
    <div className="flex flex-col items-start gap-3">
      <div className="max-w-[90%] rounded-3xl rounded-tl-none border border-border bg-surface-muted px-6 py-5 text-sm leading-relaxed text-text shadow-subtle">
        <MarkdownViewer content={item.answer} />
      </div>
      {item.annotations && item.annotations.length > 0 && onFocusRegion && (
        <div className="flex flex-wrap gap-3 mt-1 ml-4">
          {item.annotations.map((ann, idx) => (
            <button
              key={idx}
              onClick={() => onFocusRegion(ann)}
              className="group flex items-center gap-3 rounded-button border border-border bg-surface px-4 py-2.5 text-text shadow-subtle transition-colors hover:border-accent hover:bg-accent"
              aria-label={`Focus on ${ann.label} region in image`}
            >
              <ScanEye size={16} className="text-accent group-hover:text-text" aria-hidden="true" />
              <span className="text-[10px] font-black uppercase tracking-widest">{ann.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

const SynthesizingIndicator: React.FC = () => (
  <div className="flex justify-start">
    <div className="flex items-center gap-3 rounded-3xl rounded-tl-none border border-border bg-surface-muted px-8 py-4 text-xs font-semibold uppercase tracking-widest text-text-secondary">
      <Loader2 size={16} className="animate-spin text-accent" /> SYNTHESIZING...
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
    <label htmlFor="assistant-question-input" className="sr-only">
      Ask the AI assistant a question about the image
    </label>
    <input
      id="assistant-question-input"
      type="text"
      className="w-full rounded-card border border-border bg-surface px-8 py-5 pr-16 text-sm text-text shadow-subtle outline-none transition-colors placeholder:text-text-muted focus:border-accent focus:ring-4 focus:ring-accent/10 disabled:opacity-50"
      placeholder={
        aiStatus === 'loading'
          ? 'Waiting for analysis...'
          : 'Analyze specific elements of the generation...'
      }
      value={question}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && !isAsking && aiStatus === 'complete' && onSubmit()}
      disabled={isAsking || aiStatus !== 'complete'}
      aria-label="Question for AI assistant"
    />
    <button
      onClick={onSubmit}
      disabled={!question.trim() || isAsking || aiStatus !== 'complete'}
      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-input bg-accent p-3 text-text shadow-card transition-colors hover:bg-accent-hover disabled:opacity-30"
      aria-label="Send question to AI assistant"
    >
      <Send size={20} aria-hidden="true" />
    </button>
  </div>
);
