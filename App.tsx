
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileJson, FileText, Image as ImageIcon, Sparkles, Loader2, AlertCircle, ChevronLeft, RefreshCw, Database, ArrowLeft, Key, ExternalLink, Settings } from 'lucide-react';
import { extractComfyMetadata } from './utils/pngParser';
import { generateSceneDocumentation, askQuestion, refreshPromptAnalysis, generateIssueFix } from './services/geminiService';
import { analyzeWorkflowLocally } from './utils/workflowAnalyzer';
import { calculateFileHash, getCachedAnalysis, cacheAnalysis } from './utils/cacheService';
import { JsonViewer } from './components/JsonViewer';
import { DocumentationViewer } from './components/DocumentationViewer';
import { Landing } from './components/Landing';
import { SettingsModal } from './components/SettingsModal';
import { ProcessingState, AnalysisResult, ComfyMetadata, SceneDocumentation, QualityIssue } from './types';

const App: React.FC = () => {
  const [processingState, setProcessingState] = useState<ProcessingState>({ status: 'idle' });
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefiningPrompt, setIsRefiningPrompt] = useState(false);
  
  // Key Management State
  // Initialize state once. Priority: LocalStorage -> Empty (BYOK)
  const [localApiKey, setLocalApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });
  
  const [hasApiKey, setHasApiKey] = useState<boolean>(false); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
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

  // Validate API Key
  useEffect(() => {
    const isValid = !!(localApiKey && localApiKey.length > 20 && localApiKey.startsWith('AIza'));
    setHasApiKey(isValid);
  }, [localApiKey]);

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
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
            
            // Automatically start AI analysis if key is present
            if (hasApiKey) {
                await performAiAnalysis(file, workflowStr, promptStr, hash);
            }
        }
    } catch (error: any) {
        setProcessingState({ status: 'error', message: error.message || 'Error processing file.' });
    }
  };

  const performAiAnalysis = async (file: File, workflowStr: string, promptStr: string, hash: string) => {
      // Ensure key is ready before starting
      // Retrieve key directly from localStorage to avoid stale state closures
      const apiKey = localStorage.getItem('gemini_api_key');
      
      if (!apiKey || !apiKey.startsWith('AIza')) {
          setHasApiKey(false);
          setIsSettingsOpen(true);
          return;
      }

      setAiStatus('loading');
      setErrorMessage(null);
      try {
          const base64Data = await fileToBase64(file);
          const aiDoc = await generateSceneDocumentation(base64Data, workflowStr, promptStr);
          aiDoc.isOffline = false;
          aiDoc.qa = [];
          if (aiDoc.qualityAnalysis?.issues) {
              aiDoc.qualityAnalysis.issues.forEach(i => { if (!i.id) i.id = crypto.randomUUID(); });
          }
          setAnalysisResult(prev => prev ? { ...prev, data: aiDoc } : null);
          await cacheAnalysis(hash, aiDoc);
          setAiStatus('complete');
      } catch (error: any) {
          if (error.message === 'API_KEY_NOT_FOUND') {
              setHasApiKey(false);
              setAiStatus('error');
              setErrorMessage("Valid API key required.");
              setIsSettingsOpen(true);
          } else {
              setAiStatus('error');
              setErrorMessage(error.message || "Failed to generate AI insights.");
          }
      }
  };
  
  const handleSaveLocalKey = async (key: string) => {
      setLocalApiKey(key);
      if (key) {
        localStorage.setItem('gemini_api_key', key);
        // If we have a file loaded and are currently in an offline/partial state, trigger AI now
        if (currentFile && metadata && currentFileHash) {
            // Slight delay to ensure localStorage propagation and state updates
            setTimeout(() => {
                const workflowStr = JSON.stringify(metadata.workflow || {});
                const promptStr = JSON.stringify(metadata.prompt || {});
                performAiAnalysis(currentFile, workflowStr, promptStr, currentFileHash!);
            }, 0);
        }
      } else {
        localStorage.removeItem('gemini_api_key');
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
          await performAiAnalysis(currentFile, analysisResult.workflowJson, analysisResult.promptJson, currentFileHash);
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
          if (e.message === 'API_KEY_NOT_FOUND') {
             setHasApiKey(false);
             setIsSettingsOpen(true);
          }
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
          if (e.message === 'API_KEY_NOT_FOUND') {
              setHasApiKey(false);
              setIsSettingsOpen(true);
          }
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
        const newQA = { id: Date.now().toString(), question, answer: result.answer, timestamp: Date.now() };
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
        if (e.message === 'API_KEY_NOT_FOUND') {
            setHasApiKey(false);
            setIsSettingsOpen(true);
        }
        throw e;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={resetState}>
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">ComfyDocs</h1>
          </div>
          <div className="flex items-center gap-3">
               <button 
                  onClick={handleOpenSettings}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${hasApiKey ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'}`}
               >
                  {hasApiKey ? <Key size={12} className="text-emerald-400" /> : <Settings size={12} />}
                  {hasApiKey ? 'API Ready' : 'Setup API Key'}
               </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {!previewUrl && (showLanding ? <Landing onGetStarted={() => setShowLanding(false)} /> : (
            <div className="flex flex-col items-center max-w-2xl mx-auto relative animate-in fade-in zoom-in-95 duration-500">
                <button onClick={() => setShowLanding(true)} className="self-start mb-4 text-slate-500 hover:text-slate-300 text-sm flex items-center gap-1 transition-colors">
                    <ChevronLeft size={16} /> Back to Home
                </button>
                <div className="w-full border-2 border-dashed border-slate-700 rounded-2xl p-12 flex flex-col items-center justify-center text-center hover:border-indigo-500 hover:bg-slate-900/50 transition-all cursor-pointer group" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/png" onChange={handleFileChange} />
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Upload className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Upload ComfyUI Image</h2>
                    <p className="text-slate-400 max-w-md">Drag and drop your .png generation here for automated decoding and AI analysis.</p>
                </div>
                {processingState.status === 'error' && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 w-full animate-in slide-in-from-top-2">
                    <AlertCircle className="shrink-0" size={20} />
                    <p className="text-sm">{processingState.message}</p>
                  </div>
                )}
            </div>
        ))}

        {previewUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in duration-500">
            <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-24">
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-xl">
                <div className="aspect-square relative rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center group/preview">
                  <img src={previewUrl} alt="ComfyUI Generation" className="max-w-full max-h-full object-contain" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white text-slate-900 rounded-full text-sm font-bold shadow-xl transform translate-y-2 group-hover/preview:translate-y-0 transition-transform">Change Image</button>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <button onClick={resetState} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"><ArrowLeft size={12} /> New Upload</button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/png" onChange={handleFileChange} />
                </div>
              </div>

              {!hasApiKey && (
                  <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-5 flex flex-col gap-4">
                      <div className="flex items-start gap-3">
                        <Key className="w-5 h-5 text-indigo-400 mt-1 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-white mb-1">AI Features Disabled</p>
                            <p className="text-xs text-slate-400 leading-relaxed mb-3">
                                Provide a Gemini API Key to enable forensic analysis, quality scoring, and automated scene documentation.
                            </p>
                            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 hover:underline">
                                <ExternalLink size={10} /> Get API Key
                            </a>
                        </div>
                      </div>
                      <button 
                        onClick={handleOpenSettings}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                      >
                        Setup API Key
                      </button>
                  </div>
              )}

              {processingState.status === 'reading' && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                   <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                   <p className="text-sm text-slate-300">Extracting Metadata...</p>
                </div>
              )}

              {aiStatus === 'loading' && (
                  <div className="bg-indigo-900/20 border border-indigo-900/50 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                      <div>
                          <p className="text-sm font-medium text-indigo-200">Generating AI Insights</p>
                          <p className="text-xs text-indigo-300/70">Analyzing scene and quality...</p>
                      </div>
                  </div>
              )}

              {aiStatus === 'error' && (
                <div className="bg-red-900/10 border border-red-900/30 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle size={16} />
                    <span className="text-sm font-medium">AI Analysis Failed</span>
                  </div>
                  <p className="text-xs text-red-300/70">{errorMessage}</p>
                  <button onClick={handleForceRerun} className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 uppercase tracking-wider"><RefreshCw size={12} /> Retry AI Task</button>
                </div>
              )}

              {isLoadedFromCache && aiStatus === 'complete' && (
                  <div className="bg-emerald-900/10 border border-emerald-900/30 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2"><Database size={14} className="text-emerald-400"/><span className="text-xs text-emerald-300 font-medium">Loaded from Cache</span></div>
                      <button onClick={handleForceRerun} className="p-1.5 hover:bg-emerald-900/30 rounded text-emerald-300 transition-colors"><RefreshCw size={12} /></button>
                  </div>
              )}
            </div>

            <div className="lg:col-span-8 flex flex-col">
              {processingState.status === 'error' ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Analysis Failed</h3>
                    <p className="text-slate-400 max-w-md mb-8">{processingState.message}</p>
                    <button onClick={resetState} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all">Try Another Image</button>
                </div>
              ) : processingState.status === 'complete' && analysisResult && metadata ? (
                <>
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2 shrink-0">
                    <button onClick={() => setActiveTab('docs')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'docs' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}><FileText size={16} />Analysis</button>
                    <button onClick={() => setActiveTab('workflow')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'workflow' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}><FileJson size={16} />Workflow Graph</button>
                    <button onClick={() => setActiveTab('metadata')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'metadata' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}><ImageIcon size={16} />Raw JSON</button>
                  </div>
                  <div className="w-full">
                    {activeTab === 'docs' && <DocumentationViewer data={analysisResult.data} workflowData={analysisResult.rawWorkflow} isOffline={!hasApiKey || aiStatus !== 'complete'} aiStatus={aiStatus} isRefiningPrompt={isRefiningPrompt} onUpdateData={handleUpdateData} onRefreshPromptAnalysis={handleRefreshPromptAnalysis} onRegenerateIssueFix={handleRegenerateIssueFix} onAskAi={handleAskAi} />}
                    {activeTab === 'workflow' && <div className="space-y-4">
                        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">This graph is reconstructed from the embedded JSON workflow data.</div>
                        <JsonViewer data={metadata.workflow} filename="workflow.json" label="Workflow JSON" />
                      </div>}
                    {activeTab === 'metadata' && <JsonViewer data={metadata.prompt} filename="api_metadata.json" label="API Prompt Data" />}
                  </div>
                </>
              ) : (
                <div className="bg-slate-900/30 border border-slate-800 rounded-xl h-[500px] flex items-center justify-center text-slate-500 italic">
                  Waiting for processing to finish...
                </div>
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
    </div>
  );
};

export default App;
