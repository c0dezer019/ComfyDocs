
export interface ComfyMetadata {
  workflow: any | null;
  prompt: any | null;
  report?: SceneDocumentation | null;
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
  
  // Spatial Data
  box_2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  style?: 'box' | 'paint';
}

export interface PromptAnalysis {
  adherenceScore: number; // 1-10
  critique: string;
  improvements: string[]; // General improvements not tied to specific issues
}

export interface Annotation {
  label: string;
  style: 'box' | 'paint'; // 'box' for outline, 'paint' for translucent fill
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1
}

export interface QAItem {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
  annotations?: Annotation[];
}

export interface SceneNote {
  id: string;
  text: string;
  timestamp: number;
  images?: string[]; // Array of Base64 strings (no data URI prefix usually, or handled by renderer)
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
  userSceneNotes?: SceneNote[]; // Changed from string to array of notes
  sceneBackstory?: string; // New field for inspiration/backstory
  
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
