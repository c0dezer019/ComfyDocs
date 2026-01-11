'use client';

import React from 'react';
import { ScrollText } from 'lucide-react';
import { SectionCard } from '../ui/SectionCard';

interface PromptItem {
  label: string;
  text: string;
}

interface PromptsSectionProps {
  /** Array of prompt items with labels and text */
  prompts?: PromptItem[];
  /** Optional negative prompt text */
  negativePrompt?: string;
}

/**
 * Prompts section component.
 * Displays extracted prompt metadata from the image.
 */
export const PromptsSection: React.FC<PromptsSectionProps> = ({
  prompts,
  negativePrompt,
}) => {
  return (
    <SectionCard
      icon={ScrollText}
      title="Prompts"
      subtitle="Original prompt content extracted from the image"
      iconColorClass="bg-purple-500/10 text-purple-400 ring-purple-500/20"
      showHeaderBorder
    >
      <div className="grid gap-4">
        {prompts && prompts.length > 0 ? (
          prompts.map((p, i) => (
            <PromptCard key={i} label={p.label} text={p.text} />
          ))
        ) : (
          <div className="text-slate-500 italic">No prompt metadata found in the image.</div>
        )}

        {negativePrompt && (
          <PromptCard label="Negative Prompt" text={negativePrompt} />
        )}
      </div>
    </SectionCard>
  );
};

interface PromptCardProps {
  label: string;
  text: string;
}

const PromptCard: React.FC<PromptCardProps> = ({ label, text }) => (
  <div className="p-4 bg-black/30 rounded-2xl border border-white/5 text-sm text-slate-300">
    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">
      {label}
    </div>
    <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
  </div>
);
