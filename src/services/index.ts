/**
 * ComfyDocs Services
 *
 * Central export for all service modules.
 */

// Gemini AI Service - Core analysis functionality
export {
  generateSceneDocumentation,
  runConsensusQualityAnalysis,
  generateIssueFix,
  generateIssuesFromNotes,
  refreshPromptAnalysis,
  askQuestion,
} from './geminiService';

// Educational Service - AI-powered explanations
export {
  generateEducationalContent,
  generateBatchEducationSummaries,
  generateVisualEducation,
  getQuickTip,
  getQuickTips,
} from './educationalService';
