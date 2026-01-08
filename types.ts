export interface ComfyMetadata {
  workflow: any | null;
  prompt: any | null;
}

export interface ProcessingState {
  status: 'idle' | 'reading' | 'analyzing' | 'complete' | 'error';
  message?: string;
}

export interface QualityIssue {
  id: string; // Unique identifier for tracking
  type: string; // e.g., 'Anatomy', 'Artifact', 'Lighting'
  description: string;
  severity: 'Critical' | 'Major' | 'Minor' | 'Note';
  score: number; // 1-10 impact rating
  confidence?: number; // 0-100 percentage of accuracy/recurrence
  passCount?: number; // Number of passes used to determine confidence
  suggestedFixes?: string[]; // Specific fixes linked to this issue
  suggestedFix?: string; // Legacy support
  userNotes?: string; // User-provided context that influences suggestions
}

export interface PromptAnalysis {
  adherenceScore: number; // 1-10
  critique: string;
  improvements: string[]; // General improvements not tied to specific issues
}

export interface QAItem {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
}

export interface SceneDocumentation {
  isOffline?: boolean; // Flag to indicate offline mode
  sceneOverview: {
    category: string;
    details: string;
  }[];
  workflowAnalysis: string[];
  parameters: {
    seed: string;
    steps: number;
    cfg: number;
    sampler: string;
    scheduler: string;
    denoise: number;
    model: string;
    vae: string;
  };
  prompts: {
    label: string;
    text: string;
  }[];
  negativePrompt: string;
  
  // New Fields
  qualityAnalysis?: {
    overallScore: number; // 1-10
    issues: QualityIssue[];
  };
  promptAnalysis?: PromptAnalysis;
  
  // Q&A History
  qa?: QAItem[];
}

export interface AnalysisResult {
  data: SceneDocumentation;
  workflowJson: string;
  promptJson: string;
  rawWorkflow: any; // Add raw workflow object for the graph
}