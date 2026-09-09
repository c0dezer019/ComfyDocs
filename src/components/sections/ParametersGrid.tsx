'use client';

import React from 'react';
import { Sliders } from 'lucide-react';
import { SectionCard } from '../ui/SectionCard';

interface ParametersGridProps {
  /** Parameters object with key-value pairs */
  parameters: Record<string, string | number | undefined>;
}

/**
 * Parameters Grid section component.
 * Displays technical parameters extracted from the workflow.
 */
export const ParametersGrid: React.FC<ParametersGridProps> = ({ parameters }) => {
  return (
    <SectionCard
      icon={Sliders}
      title="Technical Profile"
      subtitle="Hyperparameter extraction"
      iconColorClass="bg-accent-subtle text-accent ring-accent/30"
      showHeaderBorder
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(parameters).map(
          ([key, value]) =>
            (value || value === 0) && <ParameterCard key={key} label={key} value={value} />,
        )}
      </div>
    </SectionCard>
  );
};

interface ParameterCardProps {
  label: string;
  value: string | number | undefined;
}

const ParameterCard: React.FC<ParameterCardProps> = ({ label, value }) => (
  <div className="group/param rounded-card border border-border bg-surface-muted p-5 shadow-subtle transition-colors hover:border-accent/50">
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-secondary transition-colors group-hover/param:text-accent">
      {label}
    </div>
    <div className="break-all rounded-input border border-border bg-surface p-2.5 font-mono text-sm text-text">
      {String(value)}
    </div>
  </div>
);
