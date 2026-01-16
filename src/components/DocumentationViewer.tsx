'use client';

import React, { useState, useCallback } from 'react';
import { SceneDocumentation, QualityIssue, SceneNote, Annotation } from '@/lib/types';
import {
  AssistantChat,
  SceneOverview,
  PromptsSection,
  ParametersGrid,
  QualityAnalysisSection,
  PromptAnalysisSection,
  WorkflowTopologyEnhanced,
} from './sections';
import { LintAnalysisSection } from './lint';
import { GraphWorkflow } from './WorkflowGraph';
import { WorkflowContext } from '@/hooks/useEducation';

interface DocumentationViewerProps {
  data: SceneDocumentation;
  workflowData?: GraphWorkflow | undefined;
  /** Raw workflow JSON for the linting engine */
  rawWorkflow?: unknown | null;
  isOffline: boolean;
  aiStatus: 'idle' | 'loading' | 'complete' | 'error';
  isRefiningPrompt?: boolean;
  onUpdateData: (newData: SceneDocumentation) => void;
  onRefreshPromptAnalysis?: (updatedDoc: SceneDocumentation) => void;
  onRegenerateIssueFix?: (issue: QualityIssue) => Promise<void>;
  onAskAi?: (question: string) => Promise<void>;
  onGenerateIssuesFromNotes?: (notes: SceneNote[]) => Promise<void>;
  onFocusRegion?: (annotation: Annotation) => void;
}

/**
 * Main documentation viewer component.
 * Orchestrates section components and handles data updates.
 *
 * This component has been refactored from a monolithic 1200+ line file
 * into a composition of focused, reusable section components.
 */
export const DocumentationViewer: React.FC<DocumentationViewerProps> = ({
  data,
  workflowData,
  rawWorkflow,
  isOffline,
  aiStatus,
  isRefiningPrompt = false,
  onUpdateData,
  onRefreshPromptAnalysis,
  onRegenerateIssueFix,
  onAskAi,
  onFocusRegion,
}) => {
  // Focused node state for graph integration
  const [focusedNodeId, setFocusedNodeId] = useState<number | null>(null);

  // Compute filtered issues for prompt analysis section
  const confidenceThreshold = 0; // Can be lifted to state if needed globally
  const filteredIssues =
    data.qualityAnalysis?.issues.filter((i) => (i.confidence || 100) >= confidenceThreshold) || [];

  // Build workflow context for educational content
  const workflowContext: WorkflowContext = {
    samplerType: data.parameters?.sampler,
    modelName: data.parameters?.model,
    steps: data.parameters?.steps,
    cfg: data.parameters?.cfg,
  };

  // Handle node focus from lint diagnostics
  const handleFocusNode = useCallback((nodeId: number) => {
    setFocusedNodeId(nodeId);
    // Auto-scroll to workflow topology section
    const topologySection = document.getElementById('workflow-topology-section');
    if (topologySection) {
      topologySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Handle focus region with annotation
  const handleFocusRegion = useCallback((box: [number, number, number, number]) => {
    if (onFocusRegion) {
      onFocusRegion({
        label: 'Highlighted Region',
        box_2d: box,
        style: 'box',
      });
    }
  }, [onFocusRegion]);

  // Handler for updating backstory
  const handleUpdateBackstory = (backstory: string) => {
    onUpdateData({ ...data, sceneBackstory: backstory });
  };

  // Handler for updating quality analysis
  const handleUpdateQualityAnalysis = (analysis: {
    overallScore: number;
    issues: QualityIssue[];
  }) => {
    onUpdateData({ ...data, qualityAnalysis: analysis });
  };

  // Handler for updating prompt analysis
  const handleUpdatePromptAnalysis = (analysis: typeof data.promptAnalysis) => {
    if (analysis) {
      onUpdateData({ ...data, promptAnalysis: analysis });
    }
  };

  // Handler for refreshing prompt analysis
  const handleRefreshPromptAnalysis = () => {
    onRefreshPromptAnalysis?.(data);
  };

  return (
    <div className="space-y-10 pb-20">
      {/* 1. Assistant Chat */}
      {!isOffline && onAskAi && (
        <AssistantChat
          qa={data.qa}
          aiStatus={aiStatus}
          onAskAi={onAskAi}
          onFocusRegion={onFocusRegion}
        />
      )}

      {/* 2. Scene Overview */}
      <SceneOverview
        sceneOverview={data.sceneOverview}
        sceneBackstory={data.sceneBackstory}
        isOffline={isOffline}
        aiStatus={aiStatus}
        onUpdateBackstory={handleUpdateBackstory}
      />

      {/* 3. Prompts */}
      <PromptsSection prompts={data.prompts} negativePrompt={data.negativePrompt} />

      {/* 4. Parameters Grid */}
      <ParametersGrid parameters={data.parameters} />

      {/* 5. Quality Analysis */}
      {!isOffline && (
        <QualityAnalysisSection
          qualityAnalysis={data.qualityAnalysis}
          aiStatus={aiStatus}
          onUpdateQualityAnalysis={handleUpdateQualityAnalysis}
          onRegenerateIssueFix={onRegenerateIssueFix}
          onFocusRegion={onFocusRegion}
        />
      )}

      {/* 6. Prompt Analysis */}
      {!isOffline && (
        <PromptAnalysisSection
          promptAnalysis={data.promptAnalysis}
          aiStatus={aiStatus}
          isRefiningPrompt={isRefiningPrompt}
          filteredIssues={filteredIssues}
          onUpdatePromptAnalysis={handleUpdatePromptAnalysis}
          onRefreshPromptAnalysis={handleRefreshPromptAnalysis}
        />
      )}

      {/* 7. Workflow Linting (Rule-based Analysis) */}
      {rawWorkflow ? (
        <LintAnalysisSection
          rawWorkflow={rawWorkflow}
          isOffline={isOffline}
        />
      ) : null}

      {/* 8. Workflow Topology with Integrated Lint Diagnostics - Temporarily disabled for debugging */}
      {/* <div id="workflow-topology-section">
        <WorkflowTopologyEnhanced
          workflowData={workflowData}
          rawWorkflow={rawWorkflow}
          workflowContext={workflowContext}
          showLintPanelDefault={false}
        />
      </div> */}
    </div>
  );
};
