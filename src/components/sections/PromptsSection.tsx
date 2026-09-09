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
export const PromptsSection: React.FC<PromptsSectionProps> = ({ prompts, negativePrompt }) => {
  return (
    <SectionCard
      icon={ScrollText}
      title="Prompts"
      subtitle="Original prompt content extracted from the image"
      iconColorClass="bg-accent-subtle text-accent ring-accent/30"
      showHeaderBorder
    >
      <div className="grid gap-4">
        {prompts && prompts.length > 0 ? (
          prompts.map((p, i) => <PromptCard key={i} label={p.label} text={p.text} />)
        ) : (
          <div className="italic text-text-secondary">No prompt metadata found in the image.</div>
        )}

        {negativePrompt && <PromptCard label="Negative Prompt" text={negativePrompt} />}
      </div>
    </SectionCard>
  );
};

interface PromptCardProps {
  label: string;
  text: string;
}

const PromptCard: React.FC<PromptCardProps> = ({ label, text }) => (
  <div className="rounded-card border border-border bg-surface-muted p-4 text-sm text-text-secondary">
    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary">
      {label}
    </div>
    <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
  </div>
);
