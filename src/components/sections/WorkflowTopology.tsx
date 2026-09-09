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
      iconColorClass="bg-accent-subtle text-accent ring-accent/30"
      showHeaderBorder
    >
      <div className="overflow-hidden rounded-card border border-border shadow-card">
        {workflowData ? (
          <WorkflowGraph workflow={workflowData} />
        ) : (
          <div className="bg-surface-muted p-20 text-center text-text-secondary font-semibold uppercase tracking-widest">
            Topology data missing
          </div>
        )}
      </div>
    </SectionCard>
  );
};
