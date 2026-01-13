'use client';

import React from 'react';
import { Zap } from 'lucide-react';
import { SectionCard } from '../ui/SectionCard';
import { WorkflowGraph, GraphWorkflow } from '../WorkflowGraph';

interface WorkflowTopologyProps {
  /** Workflow data for the graph */
  workflowData?: GraphWorkflow | undefined;
}

/**
 * Workflow Topology section component.
 * Displays interactive node graph reconstruction.
 */
export const WorkflowTopology: React.FC<WorkflowTopologyProps> = ({ workflowData }) => {
  return (
    <SectionCard
      icon={Zap}
      title="Workflow Topology"
      subtitle="Interactive node reconstruction"
      iconColorClass="bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
      showHeaderBorder
    >
      <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
        {workflowData ? (
          <WorkflowGraph workflow={workflowData} />
        ) : (
          <div className="p-20 text-center text-slate-500 font-bold uppercase tracking-widest bg-black/20">
            Topology data missing
          </div>
        )}
      </div>
    </SectionCard>
  );
};
