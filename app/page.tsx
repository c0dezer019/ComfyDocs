'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  Loader2,
  ArrowLeft,
  Key,
  Settings,
  ZoomIn,
  ScrollText,
} from 'lucide-react';
import { extractComfyMetadata } from '@/utils/pngParser';
import {
  generateSceneDocumentation,
  askQuestion,
  refreshPromptAnalysis,
  generateIssueFix,
  generateIssuesFromNotes,
} from '@/services/geminiService';
import { analyzeWorkflowLocally } from '@/utils/workflowAnalyzer';
import { calculateFileHash, getCachedAnalysis, cacheAnalysis } from '@/utils/cacheService';
import { encrypt, decrypt } from '@/utils/encryption';
import { DocumentationViewer } from '@/components/DocumentationViewer';
import { ReportViewer } from '@/components/ReportViewer';
import { Landing } from '@/components/Landing';
import { SettingsModal } from '@/components/SettingsModal';
import { UnlockModal } from '@/components/UnlockModal';
import { ImagePreviewModal } from '@/components/ImagePreviewModal';
import {
  ProcessingState,
  AnalysisResult,
  ComfyMetadata,
  SceneDocumentation,
  Annotation,
  QualityIssue,
  SceneNote,
} from '@/lib/types';

export default function HomePage() {
  const [processingState, setProcessingState] = useState<ProcessingState>({ status: 'idle' });
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [localApiKey, setLocalApiKey] = useState<string>('');
  const [hasEncryptedKey, setHasEncryptedKey] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [focusAnnotation, setFocusAnnotation] = useState<Annotation | null>(null);
  const [allAnnotations, setAllAnnotations] = useState<Annotation[]>([]);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentFileHash, setCurrentFileHash] = useState<string | null>(null);
  const [isLoadedFromCache, setIsLoadedFromCache] = useState(false);

  const [metadata, setMetadata] = useState<ComfyMetadata | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'docs' | 'report'>('docs');

  const [showLanding, setShowLanding] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to safely extract messages from unknown errors
  const getErrorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

  // Demo URL for Next.js public folder
  const demoUrl = '/demo.png';

  // Check for landing page state on mount (client-side only)
  useEffect(() => {
    const seenLanding = localStorage.getItem('comfydocs_seen_landing') === 'true';
    setShowLanding(!seenLanding);
  }, []);

  useEffect(() => {
    const encrypted = localStorage.getItem('gemini_api_key_encrypted');
    if (encrypted) {
      setHasEncryptedKey(true);
      const sessionKey = sessionStorage.getItem('gemini_api_key_decrypted');
      if (sessionKey) {
        setLocalApiKey(sessionKey);
      } else {
        setIsUnlockModalOpen(true);
      }
    }
  }, []);

  // Extended annotation type that includes issue linkage
  interface AnnotationWithMeta extends Annotation {
    labelRotation?: number;
    issueId?: string;
  }

  useEffect(() => {
    let allAnns: AnnotationWithMeta[] = [];
    if (analysisResult?.data.qualityAnalysis?.issues) {
      const issueAnns = analysisResult.data.qualityAnalysis.issues
        .filter((q): q is typeof q & { box_2d: [number, number, number, number] } => !!q.box_2d)
        .map((q) => ({
          label: q.type,
          style: (q.style || 'box') as 'box' | 'paint',
          box_2d: q.box_2d,
          issueId: q.id,
          labelRotation: q.labelRotation || 0,
        }));
      allAnns = [...allAnns, ...issueAnns];
    }
    if (analysisResult?.data.qa) {
      const qaAnns = analysisResult.data.qa.flatMap((q) => q.annotations || []);
      allAnns = [...allAnns, ...qaAnns];
    }
    setAllAnnotations(allAnns);
  }, [analysisResult]);

  const handleOpenSettings = () => setIsSettingsOpen(true);
  const handleOpenImagePreview = (annotation?: Annotation) => {
    setFocusAnnotation(annotation || null);
    setIsImageModalOpen(true);
  };

  // Annotation editing handlers
  const handleAnnotationUpdate = (index: number, updatedAnnotation: AnnotationWithMeta) => {
    if (!analysisResult?.data.qualityAnalysis) return;

    const ann = allAnnotations[index] as AnnotationWithMeta;
    if (!ann.issueId) return; // Can only update issue-linked annotations

    // Find and update the corresponding issue
    const issueIndex = analysisResult.data.qualityAnalysis.issues.findIndex(
      (issue) => issue.id === ann.issueId,
    );

    if (issueIndex !== -1) {
      const updatedIssues = [...analysisResult.data.qualityAnalysis.issues];
      updatedIssues[issueIndex] = {
        ...updatedIssues[issueIndex],
        type: updatedAnnotation.label,
        box_2d: updatedAnnotation.box_2d,
        labelRotation: updatedAnnotation.labelRotation,
      };

      setAnalysisResult({
        ...analysisResult,
        data: {
          ...analysisResult.data,
          qualityAnalysis: {
            ...analysisResult.data.qualityAnalysis,
            issues: updatedIssues,
          },
        },
      });
    }
  };

  const handleAnnotationDelete = (index: number) => {
    if (!analysisResult?.data.qualityAnalysis) return;

    const ann = allAnnotations[index] as AnnotationWithMeta;
    if (!ann.issueId) return; // Can only delete issue-linked annotations

    // Remove the corresponding issue
    const updatedIssues = analysisResult.data.qualityAnalysis.issues.filter(
      (issue) => issue.id !== ann.issueId,
    );

    // Recalculate score
    const calculateScore = (issues: QualityIssue[]) => {
      if (issues.length === 0) return 10;
      const severityWeights: Record<string, number> = {
        Critical: 3,
        Major: 2,
        Minor: 1,
        Note: 0.5,
      };
      const totalWeight = issues.reduce((sum, i) => sum + (severityWeights[i.severity] || 1), 0);
      return Math.max(1, Math.round(10 - totalWeight * 0.5));
    };

    setAnalysisResult({
      ...analysisResult,
      data: {
        ...analysisResult.data,
        qualityAnalysis: {
          overallScore: calculateScore(updatedIssues),
          issues: updatedIssues,
        },
      },
    });
  };

  const handleAnnotationCreate = (newAnnotation: AnnotationWithMeta) => {
    if (!analysisResult) return;

    // Generate a unique ID for the new issue
    const newIssueId = `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newIssue: QualityIssue = {
      id: newIssueId,
      type: newAnnotation.label,
      description: 'New issue created from annotation',
      severity: 'Minor',
      score: 5,
      confidence: 100,
      box_2d: newAnnotation.box_2d,
      style: newAnnotation.style,
      labelRotation: newAnnotation.labelRotation || 0,
      suggestedFixes: [],
    };

    const currentIssues = analysisResult.data.qualityAnalysis?.issues || [];
    const updatedIssues = [...currentIssues, newIssue];

    // Recalculate score
    const calculateScore = (issues: QualityIssue[]) => {
      if (issues.length === 0) return 10;
      const severityWeights: Record<string, number> = {
        Critical: 3,
        Major: 2,
        Minor: 1,
        Note: 0.5,
      };
      const totalWeight = issues.reduce((sum, i) => sum + (severityWeights[i.severity] || 1), 0);
      return Math.max(1, Math.round(10 - totalWeight * 0.5));
    };

    setAnalysisResult({
      ...analysisResult,
      data: {
        ...analysisResult.data,
        qualityAnalysis: {
          overallScore: calculateScore(updatedIssues),
          issues: updatedIssues,
        },
      },
    });
  };

  const handleGetStarted = () => {
    localStorage.setItem('comfydocs_seen_landing', 'true');
    setShowLanding(false);
  };

  const startDemo = async () => {
    try {
      localStorage.setItem('comfydocs_seen_landing', 'true');
      setShowLanding(false);
      setProcessingState({ status: 'reading', message: 'Loading interactive demo...' });

      const response = await fetch(demoUrl);
      if (!response.ok) throw new Error(`Demo image not found (HTTP ${response.status})`);

      const blob = await response.blob();
      const demoFile = new File([blob], 'demo.png', { type: 'image/png' });

      await handleNewFile(demoFile);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      setProcessingState({ status: 'error', message: msg || 'Could not load demo.' });
    }
  };

  const resetState = () => {
    setShowLanding(false);
    setPreviewUrl(null);
    setCurrentFile(null);
    setAnalysisResult(null);
    setMetadata(null);
    setProcessingState({ status: 'idle' });
    setAiStatus('idle');
    setErrorMessage(null);
    setAllAnnotations([]);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleNewFile(file);
    event.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await handleNewFile(file);
  };

  const handleNewFile = async (file: File) => {
    if (!file.type.startsWith('image/png')) {
      setProcessingState({ status: 'error', message: 'Please upload a PNG file from ComfyUI.' });
      return;
    }

    setShowLanding(false);
    setProcessingState({ status: 'reading' });
    setAiStatus('idle');
    setErrorMessage(null);
    setAnalysisResult(null);
    setMetadata(null);
    setIsLoadedFromCache(false);
    setAllAnnotations([]);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setCurrentFile(file);

    try {
      const hash = await calculateFileHash(file);
      setCurrentFileHash(hash);
      const extracted = await extractComfyMetadata(file);
      setMetadata(extracted);

      if (!extracted.workflow && !extracted.prompt) {
        setProcessingState({ status: 'error', message: 'No ComfyUI metadata found.' });
        return;
      }

      const workflowStr = JSON.stringify(extracted.workflow || {});
      const promptStr = JSON.stringify(extracted.prompt || {});

      if (extracted.report) {
        setAnalysisResult({
          data: extracted.report,
          workflowJson: workflowStr,
          promptJson: promptStr,
          rawWorkflow: extracted.workflow,
        });
        setAiStatus('complete');
        setProcessingState({ status: 'complete' });
        cacheAnalysis(hash, extracted.report).catch(console.error);
        return;
      }

      const localDoc = analyzeWorkflowLocally(extracted.workflow || { nodes: [], links: [] });
      const currentAnalysis: AnalysisResult = {
        data: localDoc,
        workflowJson: workflowStr,
        promptJson: promptStr,
        rawWorkflow: extracted.workflow,
      };
      setAnalysisResult(currentAnalysis);
      setProcessingState({ status: 'complete' });

      const cachedData = await getCachedAnalysis(hash);
      if (cachedData) {
        setAnalysisResult({
          data: cachedData,
          workflowJson: workflowStr,
          promptJson: promptStr,
          rawWorkflow: extracted.workflow,
        });
        setAiStatus('complete');
        setIsLoadedFromCache(true);
      } else if (localApiKey) {
        await performAiAnalysis(file, workflowStr, promptStr, hash, localApiKey);
      }
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      setProcessingState({ status: 'error', message: msg || 'Error processing file.' });
    }
  };

  const performAiAnalysis = async (
    file: File,
    workflowStr: string,
    promptStr: string,
    hash: string,
    apiKey?: string,
  ) => {
    const effectiveKey = apiKey || localApiKey;
    if (!effectiveKey || !effectiveKey.startsWith('AIza')) {
      if (hasEncryptedKey) setIsUnlockModalOpen(true);
      else setIsSettingsOpen(true);
      return;
    }
    setAiStatus('loading');
    try {
      const base64Data = await fileToBase64(file);
      const aiDoc = await generateSceneDocumentation(base64Data, workflowStr, promptStr);
      aiDoc.isOffline = false;
      setAnalysisResult((prev) => {
        const newData = { ...aiDoc };
        if (prev?.data) {
          if (prev.data.userSceneNotes) newData.userSceneNotes = prev.data.userSceneNotes;
          if (prev.data.sceneBackstory) newData.sceneBackstory = prev.data.sceneBackstory;
          if (prev.data.qa) newData.qa = prev.data.qa;
        } else {
          newData.qa = [];
        }
        cacheAnalysis(hash, newData).catch(console.error);
        return prev
          ? { ...prev, data: newData }
          : {
              data: newData,
              workflowJson: workflowStr,
              promptJson: promptStr,
              rawWorkflow: JSON.parse(workflowStr),
            };
      });
      setAiStatus('complete');
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      setAiStatus('error');
      setErrorMessage(msg || 'Failed to generate AI insights.');
    }
  };

  const handleUnlock = (password: string) => {
    const encrypted = localStorage.getItem('gemini_api_key_encrypted');
    if (!encrypted) return false;
    const decrypted = decrypt(encrypted, password);
    if (decrypted && decrypted.startsWith('AIza')) {
      sessionStorage.setItem('gemini_api_key_decrypted', decrypted);
      setLocalApiKey(decrypted);
      setIsUnlockModalOpen(false);
      if (currentFile && metadata && currentFileHash) {
        performAiAnalysis(
          currentFile,
          JSON.stringify(metadata.workflow),
          JSON.stringify(metadata.prompt),
          currentFileHash,
          decrypted,
        );
      }
      return true;
    }
    return false;
  };

  const handleSaveLocalKey = async (key: string, password?: string) => {
    if (key && password) {
      const encrypted = encrypt(key, password);
      localStorage.setItem('gemini_api_key_encrypted', encrypted);
      sessionStorage.setItem('gemini_api_key_decrypted', key);
      setLocalApiKey(key);
      setHasEncryptedKey(true);
      setIsSettingsOpen(false);
      if (currentFile && metadata && currentFileHash) {
        performAiAnalysis(
          currentFile,
          JSON.stringify(metadata.workflow),
          JSON.stringify(metadata.prompt),
          currentFileHash,
          key,
        );
      }
    } else {
      localStorage.removeItem('gemini_api_key_encrypted');
      sessionStorage.removeItem('gemini_api_key_decrypted');
      setLocalApiKey('');
      setHasEncryptedKey(false);
      setIsSettingsOpen(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === 'string' ? r.result.split(',')[1] : '');
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  };

  const handleAskAi = async (question: string) => {
    if (!analysisResult) return;
    try {
      const base64Data = currentFile ? await fileToBase64(currentFile) : '';
      const result = await askQuestion(base64Data, analysisResult.data, question);
      const newData = { ...analysisResult.data };
      const newQA = {
        id: Date.now().toString(),
        question,
        answer: result.answer,
        timestamp: Date.now(),
        annotations: result.annotations,
      };
      newData.qa = [...(newData.qa || []), newQA];
      handleUpdateData(newData);
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      if (msg === 'API_KEY_NOT_FOUND') setIsUnlockModalOpen(true);
      throw e;
    }
  };

  // Regenerate a concise fix for an issue and update the report
  const handleRegenerateIssueFix = async (issue: QualityIssue) => {
    if (!analysisResult) return;
    try {
      setAiStatus('loading');
      const base64Data = currentFile ? await fileToBase64(currentFile) : '';
      const fix = await generateIssueFix(base64Data, issue);
      const newIssues = (analysisResult.data.qualityAnalysis?.issues || []).map((i) => {
        return i.id === issue.id ? { ...i, suggestedFixes: [fix] } : i;
      });
      handleUpdateData({
        ...analysisResult.data,
        qualityAnalysis: {
          overallScore: analysisResult.data.qualityAnalysis?.overallScore ?? 0,
          issues: newIssues,
        },
      });
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      if (msg === 'API_KEY_NOT_FOUND') setIsUnlockModalOpen(true);
      console.error(msg);
    } finally {
      setAiStatus('complete');
    }
  };

  // Convert user scene notes into formal issues using the model
  const handleGenerateIssuesFromNotes = async (notes: SceneNote[]) => {
    if (!analysisResult || !currentFile) return;
    try {
      setAiStatus('loading');
      const notesText = notes.map((n) => n.text).join('\n');
      const refImages = notes.flatMap((n) => n.images || []);
      const base64 = await fileToBase64(currentFile);
      const newIssues = await generateIssuesFromNotes(base64, notesText, refImages);
      const mergedIssues = [...(analysisResult.data.qualityAnalysis?.issues || []), ...newIssues];
      const penalties = mergedIssues.reduce((acc, i) => acc + (i.score || 0), 0);
      const newScore = Math.round(Math.max(0, Math.min(10, 10 - penalties)) * 10) / 10;
      handleUpdateData({
        ...analysisResult.data,
        qualityAnalysis: { overallScore: newScore, issues: mergedIssues },
      });
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      if (msg === 'API_KEY_NOT_FOUND') setIsUnlockModalOpen(true);
      console.error(msg);
    } finally {
      setAiStatus('complete');
    }
  };

  // Refresh prompt analysis given current issues
  const handleRefreshPromptAnalysis = async (updatedDoc?: SceneDocumentation) => {
    if (!analysisResult) return;
    try {
      setAiStatus('loading');
      const base64 = currentFile ? await fileToBase64(currentFile) : '';
      const currentDoc = updatedDoc || analysisResult.data;
      const refreshed = await refreshPromptAnalysis(base64, currentDoc);
      handleUpdateData({ ...analysisResult.data, promptAnalysis: refreshed });
      setAiStatus('complete');
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      if (msg === 'API_KEY_NOT_FOUND') setIsUnlockModalOpen(true);
      console.error(msg);
      setAiStatus('error');
    }
  };

  const handleUpdateData = async (newData: SceneDocumentation) => {
    setAnalysisResult((prev) => (prev ? { ...prev, data: newData } : null));
    if (currentFileHash) await cacheAnalysis(currentFileHash, newData);
  };

  return (
    <div className="min-h-screen text-slate-200 flex flex-col font-sans selection:bg-indigo-500/30">
      <header className="glass sticky top-0 z-50 border-b border-white/5 no-print">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <button
            type="button"
            aria-label="New analysis"
            onClick={resetState}
            className="flex items-center gap-3 rounded group focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">ComfyDocs</h1>
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={
                hasEncryptedKey && !localApiKey
                  ? () => setIsUnlockModalOpen(true)
                  : handleOpenSettings
              }
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border transition-all duration-300 ${localApiKey ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:border-white/20'}`}
            >
              {localApiKey ? (
                <Key size={12} className="text-emerald-400" />
              ) : (
                <Settings size={12} />
              )}
              {localApiKey ? 'API ACTIVE' : hasEncryptedKey ? 'UNLOCK KEY' : 'SETUP API'}
            </button>
            {isLoadedFromCache && (
              <span className="ml-2 text-xs font-black px-2 py-0.5 rounded-full bg-indigo-600/20 text-indigo-200">
                CACHED
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-6 py-8">
        {errorMessage && (
          <div className="max-w-[1600px] mx-auto px-6 mb-4">
            <div className="bg-rose-600/10 border border-rose-500/20 text-rose-300 text-sm rounded px-4 py-2">
              {errorMessage}
            </div>
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/png"
          onChange={handleFileChange}
        />

        {showLanding ? (
          <Landing onGetStarted={handleGetStarted} onTryDemo={startDemo} demoUrl={demoUrl} />
        ) : !previewUrl ? (
          <div className="flex flex-col items-center max-w-2xl mx-auto pt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="w-full glass-card rounded-3xl p-12 flex flex-col items-center justify-center text-center hover:border-indigo-500/50 cursor-pointer group relative"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {processingState.status !== 'idle' && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center gap-4 z-10">
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-200">
                    {processingState.message || 'Processing...'}
                  </p>
                </div>
              )}
              <div className="w-24 h-24 bg-indigo-500/10 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 ring-1 ring-white/10">
                <Upload className="w-10 h-10 text-indigo-400" />
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-4 tracking-tight">
                Drop your generation
              </h2>
              <p className="text-slate-400 max-w-sm text-lg font-light leading-relaxed">
                Recover your ComfyUI workflow and start a forensic audit.
              </p>
            </div>
            <button
              onClick={startDemo}
              className="mt-6 text-sm text-slate-500 hover:text-indigo-400 transition-colors font-medium"
            >
              Or explore the sample guitarist generation
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-3 flex flex-col gap-6 lg:sticky lg:top-24 no-print">
              <div className="glass-card rounded-2xl p-4">
                <div className="aspect-square relative rounded-xl overflow-hidden bg-slate-950/50 flex items-center justify-center group/preview ring-1 ring-white/5">
                  <img
                    src={previewUrl}
                    alt="ComfyUI Generation"
                    className="max-w-full max-h-full object-contain"
                  />
                  <div className="absolute top-3 right-3 opacity-0 group-hover/preview:opacity-100 transition-opacity z-10">
                    <button
                      onClick={() => handleOpenImagePreview()}
                      className="p-2.5 bg-black/70 hover:bg-black text-white rounded-xl backdrop-blur-md border border-white/10"
                      title="Zoom & Inspect"
                    >
                      <ZoomIn size={18} />
                    </button>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between px-1">
                  <button
                    onClick={resetState}
                    className="text-xs font-bold text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition-colors tracking-wider"
                  >
                    <ArrowLeft size={14} /> NEW ANALYSIS
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-9 flex flex-col">
              {processingState.status === 'complete' && analysisResult && metadata && (
                <>
                  <nav className="flex gap-1 mb-8 bg-white/5 p-1 rounded-2xl w-fit shrink-0 backdrop-blur-sm ring-1 ring-white/10 no-print">
                    <TabButton
                      active={activeTab === 'docs'}
                      onClick={() => setActiveTab('docs')}
                      icon={<FileText size={16} />}
                      label="Overview"
                    />
                    <TabButton
                      active={activeTab === 'report'}
                      onClick={() => setActiveTab('report')}
                      icon={<ScrollText size={16} />}
                      label="Report"
                    />
                  </nav>

                  <div className="w-full animate-in fade-in slide-in-from-top-4 duration-700">
                    {activeTab === 'docs' && (
                      <DocumentationViewer
                        data={analysisResult.data}
                        workflowData={analysisResult.rawWorkflow}
                        isOffline={analysisResult.data.isOffline || !localApiKey}
                        aiStatus={aiStatus}
                        onUpdateData={handleUpdateData}
                        onAskAi={handleAskAi}
                        onFocusRegion={handleOpenImagePreview}
                        onRefreshPromptAnalysis={handleRefreshPromptAnalysis}
                        onRegenerateIssueFix={handleRegenerateIssueFix}
                        onGenerateIssuesFromNotes={handleGenerateIssuesFromNotes}
                      />
                    )}
                    {activeTab === 'report' && (
                      <ReportViewer
                        data={analysisResult.data}
                        imageSrc={previewUrl}
                        originalFile={currentFile}
                        fileHash={currentFileHash}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveLocalKey}
        currentKey={localApiKey}
      />
      <UnlockModal
        isOpen={isUnlockModalOpen}
        onUnlock={handleUnlock}
        onCancel={() => setIsUnlockModalOpen(false)}
      />
      <ImagePreviewModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        imageSrc={previewUrl}
        annotations={allAnnotations}
        initialFocus={focusAnnotation}
        onAnnotationUpdate={handleAnnotationUpdate}
        onAnnotationDelete={handleAnnotationDelete}
        onAnnotationCreate={handleAnnotationCreate}
      />
    </div>
  );
}

const TabButton = ({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
  >
    {icon}
    {label}
  </button>
);
