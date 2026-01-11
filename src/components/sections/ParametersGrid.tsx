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
      iconColorClass="bg-amber-500/10 text-amber-400 ring-amber-500/20"
      showHeaderBorder
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(parameters).map(
          ([key, value]) =>
            (value || value === 0) && (
              <ParameterCard key={key} label={key} value={value} />
            ),
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
  <div className="bg-black/30 p-5 rounded-2xl border border-white/5 shadow-inner group/param hover:border-amber-500/30 transition-all">
    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 group-hover/param:text-amber-500/60 transition-colors">
      {label}
    </div>
    <div className="text-sm font-mono text-slate-200 break-all bg-slate-950/50 p-2.5 rounded-xl ring-1 ring-white/5">
      {String(value)}
    </div>
  </div>
);
