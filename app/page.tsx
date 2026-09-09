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
import type { GraphWorkflow } from '@/components/WorkflowGraph';
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
import { initializeLintSystem } from '@/utils/lintBootstrap';
import { assetPath } from '@/lib/assetPath';
import { LegalFooter } from '@/components/LegalFooter';

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

  const [showLanding, setShowLanding] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to safely extract messages from unknown errors
  const getErrorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

  // Demo URL for Next.js public folder (base-path aware for static export)
  const demoUrl = assetPath('/demo.png');

  // Check for landing page state on mount (client-side only)
  useEffect(() => {
    const seenLanding = localStorage.getItem('comfydocs_seen_landing') === 'true';
    setShowLanding(!seenLanding);
  }, []);

  // Initialize the lint system (rule registration + cache maintenance)
  useEffect(() => {
    initializeLintSystem({
      runCacheMaintenance: true,
      verbose: process.env.NODE_ENV === 'development',
    }).catch((err) => {
      console.error('[HomePage] Lint system initialization failed:', err);
    });
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
    <div className="flex min-h-screen flex-col bg-page font-sans text-text selection:bg-accent-subtle">
      <header className="sticky top-0 z-50 border-b border-border bg-page no-print">
        <div className="mx-auto flex min-h-16 max-w-[var(--page-max-width)] flex-col items-start gap-3 px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0">
          <button
            type="button"
            aria-label="New analysis"
            onClick={resetState}
            className="group flex items-center gap-3 rounded focus:outline-none"
          >
            <div className="rounded-icon bg-accent p-2 text-text">
              <Sparkles className="size-5" />
            </div>
            <h1 className="font-heading text-xl font-semibold tracking-tight text-text">
              ComfyDocs
            </h1>
          </button>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <button
              onClick={
                hasEncryptedKey && !localApiKey
                  ? () => setIsUnlockModalOpen(true)
                  : handleOpenSettings
              }
              className={`flex items-center gap-2 rounded-button border px-4 py-2 text-sm font-medium transition-colors ${localApiKey ? 'border-status-success/30 bg-status-success/10 text-status-success' : 'border-border bg-surface text-text-secondary hover:border-accent hover:text-status-info'}`}
            >
              {localApiKey ? <Key size={14} /> : <Settings size={14} />}
              {localApiKey ? 'API ACTIVE' : hasEncryptedKey ? 'UNLOCK KEY' : 'SETUP API'}
            </button>
            {isLoadedFromCache && (
              <span className="rounded-button bg-accent-subtle px-2.5 py-1 text-xs font-medium text-text sm:ml-2">
                CACHED
              </span>
            )}
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto w-full max-w-[var(--page-max-width)] flex-1 px-4 py-8 sm:px-6"
      >
        {errorMessage && (
          <div className="mx-auto mb-4 max-w-[var(--page-max-width)]">
            <div className="rounded-input border border-status-error/30 bg-status-error/10 px-4 py-2 text-sm text-status-error">
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
          <div className="mx-auto flex max-w-3xl flex-col pt-12 sm:pt-20">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="group relative flex w-full cursor-pointer flex-col border border-dashed border-border bg-surface p-8 text-left shadow-card transition-colors hover:border-accent sm:p-12"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {processingState.status !== 'idle' && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-surface/95">
                  <Loader2 className="size-10 animate-spin text-accent" />
                  <p className="text-sm font-medium text-text">
                    {processingState.message || 'Processing...'}
                  </p>
                </div>
              )}
              <div className="mb-6 flex size-12 items-center justify-center rounded-icon bg-accent-subtle text-accent-hover">
                <Upload className="size-6" />
              </div>
              <h2 className="font-heading text-3xl font-semibold tracking-tight text-text">
                Drop your generation
              </h2>
              <p className="mt-3 max-w-md text-base leading-7 text-text-secondary">
                Recover your ComfyUI workflow and start a forensic audit.
              </p>
            </div>
            <button
              onClick={startDemo}
              className="mt-5 w-fit text-sm font-medium text-text-secondary underline decoration-border underline-offset-4 transition-colors hover:text-status-info hover:decoration-accent"
            >
              Or explore the sample guitarist generation
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-3 flex flex-col gap-6 lg:sticky lg:top-24 no-print">
              <div className="rounded-card border border-border bg-surface p-4 shadow-preview">
                <div className="aspect-square relative flex items-center justify-center overflow-hidden rounded-card bg-surface-muted group/preview ring-1 ring-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="ComfyUI Generation"
                    className="max-w-full max-h-full object-contain"
                  />
                  <div className="absolute top-3 right-3 z-10 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/preview:opacity-100 sm:group-focus-within/preview:opacity-100">
                    <button
                      onClick={() => handleOpenImagePreview()}
                      className="rounded-button border border-surface-inverted bg-surface-inverted p-2.5 text-text-inverse transition-colors hover:bg-text"
                      aria-label="Open full-size image viewer with annotations"
                    >
                      <ZoomIn size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between px-1">
                  <button
                    onClick={resetState}
                    className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-text-secondary transition-colors hover:text-text"
                  >
                    <ArrowLeft size={14} /> NEW ANALYSIS
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-9 flex flex-col">
              {processingState.status === 'complete' && analysisResult && metadata && (
                <>
                  <nav className="mb-8 flex w-fit shrink-0 gap-1 rounded-card border border-border bg-surface p-1 shadow-subtle no-print">
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

                  <div className="w-full">
                    {activeTab === 'docs' && (
                      <DocumentationViewer
                        data={analysisResult.data}
                        workflowData={analysisResult.rawWorkflow as GraphWorkflow}
                        rawWorkflow={analysisResult.rawWorkflow}
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

      <LegalFooter />

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
    className={`flex items-center gap-2 rounded-button px-5 py-2 text-xs font-semibold tracking-wider transition-colors ${active ? 'bg-surface-inverted text-text-inverse shadow-subtle' : 'text-text-secondary hover:bg-surface-muted hover:text-text'}`}
  >
    {icon}
    {label}
  </button>
);
