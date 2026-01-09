import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileJson, FileText, Image as ImageIcon, Sparkles, Loader2, AlertCircle, ChevronLeft, RefreshCw, Database, ArrowLeft, Key, ExternalLink, Settings, ZoomIn, Lock, Info } from 'lucide-react';
import { extractComfyMetadata } from './utils/pngParser';
import { generateSceneDocumentation, askQuestion, refreshPromptAnalysis, generateIssueFix, generateIssuesFromNotes } from './services/geminiService';
import { analyzeWorkflowLocally } from './utils/workflowAnalyzer';
import { calculateFileHash, getCachedAnalysis, cacheAnalysis } from './utils/cacheService';
import { encrypt, decrypt } from './utils/encryption';
import { JsonViewer } from './components/JsonViewer';
import { DocumentationViewer } from './components/DocumentationViewer';
import { Landing } from './components/Landing';
import { SettingsModal } from './components/SettingsModal';
import { UnlockModal } from './components/UnlockModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { ProcessingState, AnalysisResult, ComfyMetadata, SceneDocumentation, QualityIssue, SceneNote, Annotation } from './types';

const App: React.FC = () => {
  const [processingState, setProcessingState] = useState<ProcessingState>({ status: 'idle' });
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefiningPrompt, setIsRefiningPrompt] = useState(false);
  
  const [localApiKey, setLocalApiKey] = useState<string>('');
  const [hasEncryptedKey, setHasEncryptedKey] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [focusAnnotation, setFocusAnnotation] = useState<Annotation | null>(null);
  const [allAnnotations, setAllAnnotations] = useState<Annotation[]>([]);
  
  const refineRequestRef = useRef<number>(0);
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentFileHash, setCurrentFileHash] = useState<string | null>(null);
  const [isLoadedFromCache, setIsLoadedFromCache] = useState(false);
  
  const [metadata, setMetadata] = useState<ComfyMetadata | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'docs' | 'workflow' | 'metadata'>('docs');
  
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (analysisResult?.data.qa) {
        const anns = analysisResult.data.qa.flatMap(q => q.annotations || []);
        setAllAnnotations(anns);
    } else {
        setAllAnnotations([]);
    }
  }, [analysisResult?.data.qa]);

  const handleOpenSettings = () => setIsSettingsOpen(true);
  const handleOpenImagePreview = (annotation?: Annotation) => {
      setFocusAnnotation(annotation || null);
      setIsImageModalOpen(true);
  };

  const resetState = () => {
    setShowLanding(true);
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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await handleNewFile(file);
  }, []); 

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
    setIsRefiningPrompt(false);
    setAllAnnotations([]);
    
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setCurrentFile(file);

    try {
        const hash = await calculateFileHash(file);
        setCurrentFileHash(hash);
        
        const [cachedData, extracted] = await Promise.all([
            getCachedAnalysis(hash),
            extractComfyMetadata(file)
        ]);

        setMetadata(extracted);
        
        if (!extracted.workflow && !extracted.prompt) {
             setProcessingState({ 
                status: 'error', 
                message: 'No ComfyUI metadata found. Ensure this is an original generation from ComfyUI.' 
             });
             return;
        }

        const workflowStr = JSON.stringify(extracted.workflow || {});
        const promptStr = JSON.stringify(extracted.prompt || {});

        if (cachedData) {
            setAnalysisResult({ data: cachedData, workflowJson: workflowStr, promptJson: promptStr, rawWorkflow: extracted.workflow });
            setAiStatus('complete');
            setIsLoadedFromCache(true);
            setProcessingState({ status: 'complete' });
        } else {
            const localDoc = analyzeWorkflowLocally(extracted.workflow || { nodes: [], links: [] });
            setAnalysisResult({ data: localDoc, workflowJson: workflowStr, promptJson: promptStr, rawWorkflow: extracted.workflow });
            setProcessingState({ status: 'complete' });
            
            if (localApiKey) {
                await performAiAnalysis(file, workflowStr, promptStr, hash, localApiKey);
            }
        }
    } catch (error: any) {
        setProcessingState({ status: 'error', message: error.message || 'Error processing file.' });
    }
  };

  const performAiAnalysis = async (file: File, workflowStr: string, promptStr: string, hash: string, apiKey?: string) => {
      const effectiveKey = apiKey || localApiKey;
      
      if (!effectiveKey || !effectiveKey.startsWith('AIza')) {
          if (hasEncryptedKey) setIsUnlockModalOpen(true);
          else setIsSettingsOpen(true);
          return;
      }

      setAiStatus('loading');
      setErrorMessage(null);
      try {
          const base64Data = await fileToBase64(file);
          // Note: generateSceneDocumentation reads from sessionStorage, but we ensure it's set before calling this.
          const aiDoc = await generateSceneDocumentation(base64Data, workflowStr, promptStr);
          aiDoc.isOffline = false;
          
          setAnalysisResult(prev => {
              const newData = { ...aiDoc };
              if (prev?.data) {
                  if (prev.data.userSceneNotes) newData.userSceneNotes = prev.data.userSceneNotes;
                  if (prev.data.sceneBackstory) newData.sceneBackstory = prev.data.sceneBackstory;
                  if (prev.data.qa) newData.qa = prev.data.qa;
              } else {
                  newData.qa = [];
              }

              if (newData.qualityAnalysis?.issues) {
                  newData.qualityAnalysis.issues.forEach(i => { if (!i.id) i.id = crypto.randomUUID(); });
              }
              
              cacheAnalysis(hash, newData).catch(console.error);

              return prev ? { ...prev, data: newData } : { 
                  data: newData, 
                  workflowJson: workflowStr, 
                  promptJson: promptStr, 
                  rawWorkflow: JSON.parse(workflowStr) 
              };
          });
          setAiStatus('complete');
      } catch (error: any) {
          if (error.message === 'API_KEY_NOT_FOUND') {
              setLocalApiKey('');
              setAiStatus('error');
              setErrorMessage("Valid API key required.");
              setIsSettingsOpen(true);
          } else {
              setAiStatus('error');
              setErrorMessage(error.message || "Failed to generate AI insights.");
          }
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
             const workflowStr = JSON.stringify(metadata.workflow || {});
             const promptStr = JSON.stringify(metadata.prompt || {});
             performAiAnalysis(currentFile, workflowStr, promptStr, currentFileHash, decrypted);
          }
          return true;
      }
      return false;
  };

  const handleCancelUnlock = () => setIsUnlockModalOpen(false);

  const handleSaveLocalKey = async (key: string, password?: string) => {
      if (key && password) {
        const encrypted = encrypt(key, password);
        localStorage.setItem('gemini_api_key_encrypted', encrypted);
        sessionStorage.setItem('gemini_api_key_decrypted', key);
        setLocalApiKey(key);
        setHasEncryptedKey(true);
        setIsSettingsOpen(false);
        
        if (currentFile && metadata && currentFileHash) {
            const workflowStr = JSON.stringify(metadata.workflow || {});
            const promptStr = JSON.stringify(metadata.prompt || {});
            performAiAnalysis(currentFile, workflowStr, promptStr, currentFileHash, key);
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
          r.onloadend = () => resolve(typeof r.result === 'string' ? r.result.split(',')[1] : "");
          r.onerror = reject;
          r.readAsDataURL(file);
      });
  };

  const handleForceRerun = async () => {
      if (currentFile && metadata && analysisResult && currentFileHash) {
          await performAiAnalysis(currentFile, analysisResult.workflowJson, analysisResult.promptJson, currentFileHash, localApiKey);
      }
  };

  const handleRefreshPromptAnalysis = async (updatedDoc: SceneDocumentation) => {
      if (!currentFile) return;
      const requestId = ++refineRequestRef.current;
      setIsRefiningPrompt(true);
      try {
          const base64 = await fileToBase64(currentFile);
          const newAnalysis = await refreshPromptAnalysis(base64, updatedDoc);
          if (requestId === refineRequestRef.current) {
              setAnalysisResult(prev => {
                  if (!prev) return null;
                  const newData = { ...prev.data, promptAnalysis: newAnalysis };
                  if (currentFileHash) cacheAnalysis(currentFileHash, newData);
                  return { ...prev, data: newData };
              });
          }
      } catch (e: any) {
          if (e.message === 'API_KEY_NOT_FOUND') setIsUnlockModalOpen(true);
      } finally {
          if (requestId === refineRequestRef.current) setIsRefiningPrompt(false);
      }
  };

  const handleRegenerateIssueFix = async (issue: QualityIssue) => {
      if (!currentFile) return;
      try {
          const base64 = await fileToBase64(currentFile);
          const fix = await generateIssueFix(base64, issue);
          setAnalysisResult(prev => {
              if (!prev || !prev.data.qualityAnalysis) return prev;
              const newIssues = prev.data.qualityAnalysis.issues.map(i => i.id === issue.id ? { ...i, suggestedFix: fix } : i);
              const newData = { ...prev.data, qualityAnalysis: { ...prev.data.qualityAnalysis, issues: newIssues } };
              if (currentFileHash) cacheAnalysis(currentFileHash, newData);
              return { ...prev, data: newData };
          });
      } catch (e: any) {
          if (e.message === 'API_KEY_NOT_FOUND') setIsUnlockModalOpen(true);
      }
  };

  const handleGenerateIssuesFromNotes = async (notes: SceneNote[]) => {
      if (!currentFile || !analysisResult || notes.length === 0) return;
      try {
        const base64 = await fileToBase64(currentFile);
        const notesText = notes.map(n => `- ${n.text}`).join('\n');
        const referenceImages = notes.reduce<string[]>((acc, n) => {
            if (n.images) return [...acc, ...n.images];
            return acc;
        }, []);
        const newIssues = await generateIssuesFromNotes(base64, notesText, referenceImages);
        setAnalysisResult(prev => {
           if (!prev || !prev.data.qualityAnalysis) return prev;
           const existingIssues = prev.data.qualityAnalysis.issues;
           const combinedIssues = [...existingIssues, ...newIssues];
           const penalties = combinedIssues.reduce((acc, issue) => acc + issue.score, 0);
           const newScore = Math.max(0, Math.min(10, Math.round((10 - penalties) * 10) / 10));
           const newData = {
               ...prev.data,
               userSceneNotes: notes,
               qualityAnalysis: {
                   ...prev.data.qualityAnalysis,
                   issues: combinedIssues,
                   overallScore: newScore
               }
           };
           if (currentFileHash) cacheAnalysis(currentFileHash, newData);
           return { ...prev, data: newData };
        });
      } catch (e: any) {
          if (e.message === 'API_KEY_NOT_FOUND') setIsUnlockModalOpen(true);
          throw e;
      }
  };

  const handleUpdateData = async (newData: SceneDocumentation) => {
      setAnalysisResult(prev => prev ? { ...prev, data: newData } : null);
      if (currentFileHash) await cacheAnalysis(currentFileHash, newData);
  };

  const handleAskAi = async (question: string) => {
    if (!currentFile || !analysisResult) return;
    try {
        const base64Data = await fileToBase64(currentFile);
        const result = await askQuestion(base64Data, analysisResult.data, question);
        const newData = { ...analysisResult.data };
        const newQA = { 
            id: Date.now().toString(), 
            question, 
            answer: result.answer, 
            timestamp: Date.now(),
            annotations: result.annotations 
        };
        newData.qa = [...(newData.qa || []), newQA];
        if (result.updates) {
             if (result.updates.critique && newData.promptAnalysis) newData.promptAnalysis.critique = result.updates.critique;
             if (result.updates.newImprovements && newData.promptAnalysis) {
                 const existing = new Set(newData.promptAnalysis.improvements);
                 result.updates.newImprovements.forEach(imp => existing.add(imp));
                 newData.promptAnalysis.improvements = Array.from(existing);
             }
        }
        await handleUpdateData(newData);
    } catch (e: any) {
        if (e.message === 'API_KEY_NOT_FOUND') setIsUnlockModalOpen(true);
        throw e;
    }
  };

  return (
    <div className="min-h-screen text-slate-200 flex flex-col font-sans selection:bg-indigo-500/30">
      <header className="glass sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={resetState}>
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">ComfyDocs</h1>
          </div>
          <div className="flex items-center gap-4">
               <button 
                  onClick={hasEncryptedKey && !localApiKey ? () => setIsUnlockModalOpen(true) : handleOpenSettings}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border transition-all duration-300 ${localApiKey ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:border-white/20'}`}
               >
                  {localApiKey ? <Key size={12} className="text-emerald-400" /> : <Settings size={12} />}
                  {localApiKey ? 'API ACTIVE' : (hasEncryptedKey ? 'UNLOCK KEY' : 'SETUP API')}
               </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-6 py-8">
        {!previewUrl && (showLanding ? <Landing onGetStarted={() => setShowLanding(false)} /> : (
            <div className="flex flex-col items-center max-w-2xl mx-auto pt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <button onClick={() => setShowLanding(true)} className="self-start mb-6 text-slate-500 hover:text-slate-300 text-sm font-medium flex items-center gap-2 transition-colors">
                    <ChevronLeft size={16} /> Back to Dashboard
                </button>
                <div className="w-full glass-card rounded-3xl p-16 flex flex-col items-center justify-center text-center hover:border-indigo-500/50 cursor-pointer group" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/png" onChange={handleFileChange} />
                    <div className="w-24 h-24 bg-indigo-500/10 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 ring-1 ring-white/10">
                        <Upload className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white mb-4 tracking-tight">Drop your generation</h2>
                    <p className="text-slate-400 max-w-sm text-lg font-light leading-relaxed">Recover your ComfyUI workflow and start a forensic audit.</p>
                </div>
                {processingState.status === 'error' && (
                  <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 w-full animate-in slide-in-from-top-2">
                    <AlertCircle className="shrink-0" size={20} />
                    <p className="text-sm font-medium">{processingState.message}</p>
                  </div>
                )}
            </div>
        ))}

        {previewUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-3 flex flex-col gap-6 lg:sticky lg:top-24">
              <div className="glass-card rounded-2xl p-4">
                <div className="aspect-square relative rounded-xl overflow-hidden bg-slate-950/50 flex items-center justify-center group/preview ring-1 ring-white/5">
                  <img src={previewUrl} alt="ComfyUI Generation" className="max-w-full max-h-full object-contain" />
                  <div className="absolute top-3 right-3 opacity-0 group-hover/preview:opacity-100 transition-opacity z-10">
                      <button onClick={() => handleOpenImagePreview()} className="p-2.5 bg-black/70 hover:bg-black text-white rounded-xl backdrop-blur-md border border-white/10" title="Zoom & Inspect">
                          <ZoomIn size={18} />
                      </button>
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <button onClick={() => fileInputRef.current?.click()} className="pointer-events-auto px-5 py-2.5 bg-white text-slate-900 rounded-full text-xs font-bold shadow-2xl transform translate-y-2 group-hover/preview:translate-y-0 transition-transform">UPDATE IMAGE</button>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between px-1">
                  <button onClick={resetState} className="text-xs font-bold text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition-colors tracking-wider"><ArrowLeft size={14} /> NEW ANALYSIS</button>
                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Original PNG</div>
                </div>
              </div>

              {!localApiKey && (
                  <div className="glass rounded-2xl p-6 border-indigo-500/20">
                      <div className="flex items-start gap-4 mb-5">
                        <div className="p-2 bg-indigo-500/10 rounded-lg"><Lock className="w-5 h-5 text-indigo-400" /></div>
                        <div>
                            <p className="text-sm font-bold text-white mb-1">AI Locked</p>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                Forensic auditing and quality scoring require a Gemini API Key.
                            </p>
                        </div>
                      </div>
                      <button 
                        onClick={hasEncryptedKey ? () => setIsUnlockModalOpen(true) : handleOpenSettings}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
                      >
                         {hasEncryptedKey ? 'UNLOCK KEY' : 'SETUP API'}
                      </button>
                  </div>
              )}

              {aiStatus === 'loading' && (
                  <div className="glass rounded-2xl p-5 flex items-center gap-4 animate-pulse border-indigo-500/20">
                      <div className="p-2 bg-indigo-500/10 rounded-lg"><Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /></div>
                      <div>
                          <p className="text-xs font-bold text-indigo-200 tracking-wider">FORENSIC AUDIT</p>
                          <p className="text-[10px] text-indigo-300/60 uppercase font-black mt-0.5">Scanning pixels...</p>
                      </div>
                  </div>
              )}

              {isLoadedFromCache && aiStatus === 'complete' && (
                  <div className="glass rounded-xl p-3 flex items-center justify-between border-emerald-500/20">
                      <div className="flex items-center gap-2"><Database size={14} className="text-emerald-400"/><span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Cached Analysis</span></div>
                      <button onClick={handleForceRerun} className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-colors" title="Rerun Analysis"><RefreshCw size={12} /></button>
                  </div>
              )}
            </div>

            <div className="lg:col-span-9 flex flex-col">
              {processingState.status === 'error' ? (
                <div className="glass rounded-3xl p-20 text-center flex flex-col items-center justify-center min-h-[500px] border-red-500/10">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-8">
                        <AlertCircle className="w-10 h-10 text-red-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3">Analysis Failed</h3>
                    <p className="text-slate-400 max-w-md mb-10 text-lg leading-relaxed">{processingState.message}</p>
                    <button onClick={resetState} className="px-8 py-3 bg-white text-slate-900 rounded-full font-bold transition-all hover:scale-105">Try Another Image</button>
                </div>
              ) : processingState.status === 'complete' && analysisResult && metadata ? (
                <>
                  <nav className="flex gap-1 mb-8 bg-white/5 p-1 rounded-2xl w-fit shrink-0 backdrop-blur-sm ring-1 ring-white/10">
                    <TabButton active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} icon={<FileText size={16}/>} label="Overview" />
                    <TabButton active={activeTab === 'workflow'} onClick={() => setActiveTab('workflow')} icon={<FileJson size={16}/>} label="Workflow" />
                    <TabButton active={activeTab === 'metadata'} onClick={() => setActiveTab('metadata')} icon={<ImageIcon size={16}/>} label="Raw Data" />
                  </nav>
                  
                  <div className="w-full animate-in fade-in slide-in-from-top-4 duration-700">
                    {activeTab === 'docs' && (
                        <DocumentationViewer 
                            data={analysisResult.data} 
                            workflowData={analysisResult.rawWorkflow} 
                            isOffline={!localApiKey || aiStatus !== 'complete'} 
                            aiStatus={aiStatus} 
                            isRefiningPrompt={isRefiningPrompt} 
                            onUpdateData={handleUpdateData} 
                            onRefreshPromptAnalysis={handleRefreshPromptAnalysis} 
                            onRegenerateIssueFix={handleRegenerateIssueFix} 
                            onAskAi={handleAskAi}
                            onGenerateIssuesFromNotes={handleGenerateIssuesFromNotes} 
                            onFocusRegion={handleOpenImagePreview}
                        />
                    )}
                    {activeTab === 'workflow' && <div className="space-y-6">
                        <div className="glass p-4 rounded-xl text-xs text-slate-400 flex items-center gap-3 border-indigo-500/10"><Info size={14} className="text-indigo-400"/> Reconstructed from embedded metadata.</div>
                        <JsonViewer data={metadata.workflow} filename="workflow.json" label="Workflow Schema" />
                      </div>}
                    {activeTab === 'metadata' && <JsonViewer data={metadata.prompt} filename="api_metadata.json" label="ComfyUI API Format" />}
                  </div>
                </>
              ) : (
                <div className="glass rounded-3xl h-[600px] flex flex-col items-center justify-center text-slate-500 gap-4">
                  <Loader2 size={32} className="animate-spin text-indigo-500/50" />
                  <p className="font-medium tracking-wide">PROCESSING ANALYTICS</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSave={handleSaveLocalKey} currentKey={localApiKey} />
      <UnlockModal isOpen={isUnlockModalOpen} onUnlock={handleUnlock} onCancel={handleCancelUnlock} />
      <ImagePreviewModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} imageSrc={previewUrl} annotations={allAnnotations} initialFocus={focusAnnotation} />
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
    <button 
        onClick={onClick} 
        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
    >
        {icon}
        {label}
    </button>
);

export default App;