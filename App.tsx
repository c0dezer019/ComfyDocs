


import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileJson, FileText, Image as ImageIcon, Sparkles, Loader2, AlertCircle, ChevronLeft, RefreshCw, Database, ArrowLeft, Key, ExternalLink, Settings, ZoomIn, Lock, Info, ScrollText } from 'lucide-react';
import { extractComfyMetadata } from './utils/pngParser';
import { generateSceneDocumentation, askQuestion, refreshPromptAnalysis, generateIssueFix, generateIssuesFromNotes } from './services/geminiService';
import { analyzeWorkflowLocally } from './utils/workflowAnalyzer';
import { calculateFileHash, getCachedAnalysis, cacheAnalysis } from './utils/cacheService';
import { encrypt, decrypt } from './utils/encryption';
import { JsonViewer } from './components/JsonViewer';
import { DocumentationViewer } from './components/DocumentationViewer';
import { ReportViewer } from './components/ReportViewer';
import { Landing } from './components/Landing';
import { SettingsModal } from './components/SettingsModal';
import { UnlockModal } from './components/UnlockModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
// FIX: Import QAItem to correctly type the demo data.
import { ProcessingState, AnalysisResult, ComfyMetadata, SceneDocumentation, QualityIssue, SceneNote, Annotation, QAItem } from './types';

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
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentFileHash, setCurrentFileHash] = useState<string | null>(null);
  const [isLoadedFromCache, setIsLoadedFromCache] = useState(false);
  
  const [metadata, setMetadata] = useState<ComfyMetadata | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'docs' | 'report'>('docs');
  
  const [showLanding, setShowLanding] = useState<boolean>(() => {
    return localStorage.getItem('comfydocs_seen_landing') !== 'true';
  });
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
    // Collect all annotations from both Quality Issues and Q&A for the previewer
    let allAnns: Annotation[] = [];
    if (analysisResult?.data.qualityAnalysis?.issues) {
      const issueAnns = analysisResult.data.qualityAnalysis.issues
        .filter(q => q.box_2d)
        .map(q => ({ label: q.type, style: q.style || 'box', box_2d: q.box_2d! }));
      allAnns = [...allAnns, ...issueAnns];
    }
    if (analysisResult?.data.qa) {
        const qaAnns = analysisResult.data.qa.flatMap(q => q.annotations || []);
        allAnns = [...allAnns, ...qaAnns];
    }
    setAllAnnotations(allAnns);
  }, [analysisResult]);


  const handleOpenSettings = () => setIsSettingsOpen(true);
  const handleOpenImagePreview = (annotation?: Annotation) => {
      setFocusAnnotation(annotation || null);
      setIsImageModalOpen(true);
  };

  const handleGetStarted = () => {
    localStorage.setItem('comfydocs_seen_landing', 'true');
    setShowLanding(false);
  };

  const startDemo = () => {
    // 1. Define plausible "extracted" metadata from the demo PNG.
    const demoMetadata: ComfyMetadata = {
      workflow: {
        "nodes": [
          {"id": 4, "type": "CheckpointLoaderSimple", "pos": [40, 230], "widgets_values": ["realisticVision_v51.safetensors"]},
          {"id": 5, "type": "VAELoader", "pos": [40, 480], "widgets_values": ["vae-ft-mse-840000-ema-pruned.safetensors"]},
          {"id": 6, "type": "CLIPTextEncode", "pos": [430, 40], "title": "Positive Prompt", "widgets_values": ["A young red-headed woman sitting on a bed playing an acoustic guitar, wearing large headphones, realistic photography, soft cinematic lighting, detailed face, 8k, room clutter, bed sheets, window background, high resolution, raw photo."]},
          {"id": 7, "type": "CLIPTextEncode", "pos": [430, 230], "title": "Negative Prompt", "widgets_values": ["deformed hands, fused fingers, low quality, bad anatomy, text, watermark, blurry faces, mutated limbs, extra digits"]},
          {"id": 3, "type": "KSampler", "pos": [780, 230], "widgets_values": [880796292329044, "fixed", 25, 6.5, "dpmpp_2m", "karras", 1]},
          {"id": 8, "type": "VAEDecode", "pos": [1150, 230]},
          {"id": 9, "type": "SaveImage", "pos": [1400, 230]}
        ],
        "links": [
          [1, 4, 0, 3, 0, "MODEL"],
          [2, 4, 1, 6, 0, "CLIP"],
          [3, 4, 1, 7, 0, "CLIP"],
          [4, 6, 0, 3, 1, "CONDITIONING"],
          [5, 7, 0, 3, 2, "CONDITIONING"],
          [6, 5, 0, 8, 1, "VAE"],
          [7, 3, 0, 8, 0, "LATENT"],
          [8, 8, 0, 9, 0, "IMAGE"]
        ]
      },
      prompt: { /* ComfyUI saves a simpler 'prompt' object too, we can omit for demo simplicity */ }
    };
    
    // 2. Simulate local analysis on the "extracted" data, as the app would.
    const localDoc = analyzeWorkflowLocally(demoMetadata.workflow);

    // 3. Define the AI-generated enhancements that would come from an "online" analysis.
    // FIX: Explicitly type demo data to prevent TypeScript from inferring string literals as `string`.
    const demoIssues: QualityIssue[] = [
      { id: 'demo-1', type: 'Anatomical Failure', description: 'The left hand positioned on the guitar neck is severely mutated. Fingers are fused, varying in thickness, and lack defined joint structures.', severity: 'Critical', score: 2.1, confidence: 98, suggestedFixes: ['Utilize a ControlNet Depth or Canny map to strictly enforce hand geometry during the generation pass.'], box_2d: [0.78, 0.45, 0.96, 0.68] },
      { id: 'demo-2', type: 'Object Rendering Error', description: 'The guitar headstock (top right of instrument) is malformed. The tuning pegs appear as garbled dark artifacts that do not align with the strings.', severity: 'Major', score: 1.5, confidence: 94, suggestedFixes: ['Inpaint the headstock area with a higher denoising strength and a specific "guitar headstock" prompt.'], box_2d: [0.82, 0.72, 0.95, 0.82] },
      { id: 'demo-3', type: 'Material Integration', description: 'The headphone earcup on the far side merges unnaturally with the subjects hair texture, lacking a distinct physical boundary.', severity: 'Major', score: 1.2, confidence: 88, suggestedFixes: ['Adjust the CFG scale or use a regional prompt mask to separate plastic/metal textures from hair.'], box_2d: [0.15, 0.44, 0.35, 0.52] }
    ];

    const demoQA: QAItem[] = [
      { id: 'q1', question: 'Are there any issues with the facial features?', answer: 'The facial structure is generally sound, though the singing mouth lacks sharp inner definition. There is slight blurring where the lips meet the facial plane.', timestamp: Date.now(), annotations: [{ label: 'Visual Blur', style: 'box', box_2d: [0.25, 0.48, 0.38, 0.58] }] },
      { id: 'q2', question: 'What is wrong with the guitar neck?', answer: 'Aside from the mutated hand, the guitar neck displays irregular fret spacing and the strings are not perfectly parallel as they approach the nut.', timestamp: Date.now() + 1000, annotations: [{ label: 'Geometry Error', style: 'paint', box_2d: [0.85, 0.48, 0.94, 0.65] }] }
    ];

    const aiEnhancements = {
      sceneOverview: [
        { category: 'SUBJECT', details: 'A young red-headed woman sitting on a bed playing a dark acoustic guitar.' },
        { category: 'ACTION', details: 'Strumming chords while wearing large headphones, appearing focused and immersed in music.' },
        { category: 'LIGHTING', details: 'Diffused natural light from a window on the right, creating soft highlights on the face and guitar body.' },
        { category: 'COMPOSITION', details: 'Candid medium shot with a shallow depth of field; background elements are softly blurred.' },
        { category: 'ENVIRONMENT', details: 'A domestic bedroom setting with white linens, a simple black headboard, and plants on a window sill.' }
      ],
      sceneBackstory: "This session was intended to replicate the vibe of an 'Unplugged' bedroom recording. The prompt aimed for high-fidelity skin textures and the specific matte finish of a mahogany guitar, utilizing a realistic checkpoint with LoRAs for 'Indie Photography' aesthetics.",
      qualityAnalysis: {
        overallScore: 0.8,
        issues: demoIssues
      },
      promptAnalysis: {
        adherenceScore: 8.2,
        critique: "Excellent adherence to mood, lighting, and subject matter. The model successfully interpreted 'cinematic lighting' as soft window light. However, specific anatomical negatives failed to be suppressed by the sampler.",
        improvements: [
          "Increase weight of negative prompts for 'fused fingers'.",
          "Try a slightly lower CFG (5.5) to reduce artifacting in complex areas like guitar strings.",
          "Use Hi-Res Fix to resolve finger details at a higher starting resolution."
        ]
      },
      qa: demoQA
    };

    // 4. Merge local analysis with AI enhancements for the final demo state.
    const finalDemoData: SceneDocumentation = {
      ...localDoc,
      ...aiEnhancements,
      isOffline: true, // Mark as a demo/offline analysis
    };

    // 5. Set all relevant states to display the full demo.
    setMetadata(demoMetadata);
    setAnalysisResult({
      data: finalDemoData,
      workflowJson: JSON.stringify(demoMetadata.workflow),
      promptJson: "{}", // Can be empty as workflow is primary
      rawWorkflow: demoMetadata.workflow,
    });
    setPreviewUrl('https://images.unsplash.com/photo-1511735111819-9a3f7709049c?q=80&w=1600&auto=format&fit=crop');
    setAiStatus('complete');
    setProcessingState({ status: 'complete' });
    setShowLanding(false);
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
        const extracted = await extractComfyMetadata(file);
        setMetadata(extracted);
        
        if (!extracted.workflow && !extracted.prompt) {
             setProcessingState({ status: 'error', message: 'No ComfyUI metadata found.' });
             return;
        }

        const workflowStr = JSON.stringify(extracted.workflow || {});
        const promptStr = JSON.stringify(extracted.prompt || {});

        if (extracted.report) {
            setAnalysisResult({ data: extracted.report, workflowJson: workflowStr, promptJson: promptStr, rawWorkflow: extracted.workflow });
            setAiStatus('complete');
            setProcessingState({ status: 'complete' });
            cacheAnalysis(hash, extracted.report).catch(console.error);
            return;
        }

        const cachedData = await getCachedAnalysis(hash);
        if (cachedData) {
            setAnalysisResult({ data: cachedData, workflowJson: workflowStr, promptJson: promptStr, rawWorkflow: extracted.workflow });
            setAiStatus('complete');
            setIsLoadedFromCache(true);
            setProcessingState({ status: 'complete' });
        } else {
            const localDoc = analyzeWorkflowLocally(extracted.workflow || { nodes: [], links: [] });
            setAnalysisResult({ data: localDoc, workflowJson: workflowStr, promptJson: promptStr, rawWorkflow: extracted.workflow });
            setProcessingState({ status: 'complete' });
            if (localApiKey) await performAiAnalysis(file, workflowStr, promptStr, hash, localApiKey);
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
      try {
          const base64Data = await fileToBase64(file);
          const aiDoc = await generateSceneDocumentation(base64Data, workflowStr, promptStr);
          aiDoc.isOffline = false;
          setAnalysisResult(prev => {
              const newData = { ...aiDoc };
              if (prev?.data) {
                  if (prev.data.userSceneNotes) newData.userSceneNotes = prev.data.userSceneNotes;
                  if (prev.data.sceneBackstory) newData.sceneBackstory = prev.data.sceneBackstory;
                  if (prev.data.qa) newData.qa = prev.data.qa;
              } else { newData.qa = []; }
              cacheAnalysis(hash, newData).catch(console.error);
              return prev ? { ...prev, data: newData } : { 
                  data: newData, workflowJson: workflowStr, promptJson: promptStr, rawWorkflow: JSON.parse(workflowStr) 
              };
          });
          setAiStatus('complete');
      } catch (error: any) {
          setAiStatus('error');
          setErrorMessage(error.message || "Failed to generate AI insights.");
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
             performAiAnalysis(currentFile, JSON.stringify(metadata.workflow), JSON.stringify(metadata.prompt), currentFileHash, decrypted);
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
            performAiAnalysis(currentFile, JSON.stringify(metadata.workflow), JSON.stringify(metadata.prompt), currentFileHash, key);
        }
      } else {
        localStorage.removeItem('gemini_api_key_encrypted');
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

  const handleAskAi = async (question: string) => {
    if (!analysisResult) return;
    try {
        const base64Data = currentFile ? await fileToBase64(currentFile) : "";
        const result = await askQuestion(base64Data, analysisResult.data, question);
        const newData = { ...analysisResult.data };
        const newQA = { id: Date.now().toString(), question, answer: result.answer, timestamp: Date.now(), annotations: result.annotations };
        newData.qa = [...(newData.qa || []), newQA];
        handleUpdateData(newData);
    } catch (e: any) {
        if (e.message === 'API_KEY_NOT_FOUND') setIsUnlockModalOpen(true);
        throw e;
    }
  };

  const handleUpdateData = async (newData: SceneDocumentation) => {
      setAnalysisResult(prev => prev ? { ...prev, data: newData } : null);
      if (currentFileHash) await cacheAnalysis(currentFileHash, newData);
  };

  return (
    <div className="min-h-screen text-slate-200 flex flex-col font-sans selection:bg-indigo-500/30">
      <header className="glass sticky top-0 z-50 border-b border-white/5 no-print">
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
        <input type="file" ref={fileInputRef} className="hidden" accept="image/png" onChange={handleFileChange} />

        {showLanding ? (
            <Landing onGetStarted={handleGetStarted} onTryDemo={startDemo} />
        ) : !previewUrl ? (
            <div className="flex flex-col items-center max-w-2xl mx-auto pt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="w-full glass-card rounded-3xl p-16 flex flex-col items-center justify-center text-center hover:border-indigo-500/50 cursor-pointer group" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
                    <div className="w-24 h-24 bg-indigo-500/10 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 ring-1 ring-white/10">
                        <Upload className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white mb-4 tracking-tight">Drop your generation</h2>
                    <p className="text-slate-400 max-w-sm text-lg font-light leading-relaxed">Recover your ComfyUI workflow and start a forensic audit.</p>
                </div>
                <button onClick={startDemo} className="mt-6 text-sm text-slate-500 hover:text-indigo-400 transition-colors font-medium">Or explore the sample guitarist generation</button>
            </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-3 flex flex-col gap-6 lg:sticky lg:top-24 no-print">
              <div className="glass-card rounded-2xl p-4">
                <div className="aspect-square relative rounded-xl overflow-hidden bg-slate-950/50 flex items-center justify-center group/preview ring-1 ring-white/5">
                  <img src={previewUrl} alt="ComfyUI Generation" className="max-w-full max-h-full object-contain" />
                  <div className="absolute top-3 right-3 opacity-0 group-hover/preview:opacity-100 transition-opacity z-10">
                      <button onClick={() => handleOpenImagePreview()} className="p-2.5 bg-black/70 hover:bg-black text-white rounded-xl backdrop-blur-md border border-white/10" title="Zoom & Inspect">
                          <ZoomIn size={18} />
                      </button>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between px-1">
                  <button onClick={resetState} className="text-xs font-bold text-slate-500 hover:text-slate-300 flex items-center gap-1.5 transition-colors tracking-wider"><ArrowLeft size={14} /> NEW ANALYSIS</button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-9 flex flex-col">
              {processingState.status === 'complete' && analysisResult && metadata && (
                <>
                  <nav className="flex gap-1 mb-8 bg-white/5 p-1 rounded-2xl w-fit shrink-0 backdrop-blur-sm ring-1 ring-white/10 no-print">
                    <TabButton active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} icon={<FileText size={16}/>} label="Overview" />
                    <TabButton active={activeTab === 'report'} onClick={() => setActiveTab('report')} icon={<ScrollText size={16}/>} label="Report" />
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

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSave={handleSaveLocalKey} currentKey={localApiKey} />
      <UnlockModal isOpen={isUnlockModalOpen} onUnlock={handleUnlock} onCancel={() => setIsUnlockModalOpen(false)} />
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