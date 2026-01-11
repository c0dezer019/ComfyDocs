'use client';

import React from 'react';
import { SceneDocumentation, QualityIssue, SceneNote, Annotation } from '@/lib/types';
import {
  AssistantChat,
  SceneOverview,
  PromptsSection,
  ParametersGrid,
  QualityAnalysisSection,
  PromptAnalysisSection,
  WorkflowTopology,
} from './sections';

interface DocumentationViewerProps {
  data: SceneDocumentation;
  workflowData?: any;
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
  isOffline,
  aiStatus,
  isRefiningPrompt = false,
  onUpdateData,
  onRefreshPromptAnalysis,
  onRegenerateIssueFix,
  onAskAi,
  onFocusRegion,
}) => {
  // Compute filtered issues for prompt analysis section
  const confidenceThreshold = 0; // Can be lifted to state if needed globally
  const filteredIssues =
    data.qualityAnalysis?.issues.filter((i) => (i.confidence || 100) >= confidenceThreshold) || [];

  // Handler for updating backstory
  const handleUpdateBackstory = (backstory: string) => {
    onUpdateData({ ...data, sceneBackstory: backstory });
  };

  // Handler for updating quality analysis
  const handleUpdateQualityAnalysis = (analysis: { overallScore: number; issues: QualityIssue[] }) => {
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
      <PromptsSection
        prompts={data.prompts}
        negativePrompt={data.negativePrompt}
      />

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

      {/* 7. Workflow Topology */}
      <WorkflowTopology workflowData={workflowData} />
    </div>
  );
};
