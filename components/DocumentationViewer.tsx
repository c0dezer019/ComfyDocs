
import React, { useState, useRef, useEffect } from 'react';
import { SceneDocumentation, QualityIssue, SceneNote, Annotation } from '../types';
import { Layers, Zap, Sliders, MessageSquare, Quote, Info, Loader2, AlertTriangle, Wand2, CheckCircle2, X, Plus, Edit2, Trash2, Save, XCircle, Bot, Send, RefreshCw, ArrowRight, Target, Gauge, StickyNote, Check, Filter, NotebookPen, Sparkles, Image as ImageIcon, BookOpen, ScanEye, Eye } from 'lucide-react';
import { WorkflowGraph } from './WorkflowGraph';
import { MarkdownViewer } from './MarkdownViewer';
import { runConsensusQualityAnalysis } from '../services/geminiService';

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
    onGenerateIssuesFromNotes,
    onFocusRegion
}) => {
  
  const [editingIssueIndex, setEditingIssueIndex] = useState<number | null>(null);
  const [editingIssue, setEditingIssue] = useState<QualityIssue | null>(null);
  const [newIssue, setNewIssue] = useState<Partial<QualityIssue> | null>(null);
  const [regeneratingFixForId, setRegeneratingFixForId] = useState<string | null>(null);
  
  const [passCount, setPassCount] = useState<number>(3);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0);
  const [isRunningConsensus, setIsRunningConsensus] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNoteContent, setTempNoteContent] = useState("");

  const [isGeneratingIssues, setIsGeneratingIssues] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteImages, setNewNoteImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingPromptAnalysis, setEditingPromptAnalysis] = useState(false);
  const [editedCritique, setEditedCritique] = useState('');
  const [newImprovement, setNewImprovement] = useState('');

  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const qaContainerRef = useRef<HTMLDivElement>(null);

  const [isEditingBackstory, setIsEditingBackstory] = useState(false);
  const [tempBackstory, setTempBackstory] = useState("");

  const handleStartEditBackstory = () => {
      setTempBackstory(data.sceneBackstory || "");
      setIsEditingBackstory(true);
  };

  const handleCancelEditBackstory = () => {
      setIsEditingBackstory(false);
      setTempBackstory("");
  };

  const handleSaveBackstory = () => {
      onUpdateData({ ...data, sceneBackstory: tempBackstory });
      setIsEditingBackstory(false);
  };

  const getSeverityColor = (severity: string) => {
      switch(severity.toLowerCase()) {
          case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
          case 'major': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
          case 'minor': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
          case 'note': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
          default: return 'bg-slate-800 text-slate-400';
      }
  };

  const getScoreColor = (score: number) => {
      if (score >= 8) return 'text-emerald-400';
      if (score >= 5) return 'text-yellow-400';
      return 'text-red-400';
  };

  const getConfidenceColor = (conf: number | undefined) => {
      if (!conf) return 'text-slate-400 bg-slate-800';
      if (conf >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      if (conf >= 50) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      return 'text-red-400 bg-red-500/10 border-red-500/20';
  };

  const toggleNote = (id: string) => {
      const next = new Set(expandedNotes);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setExpandedNotes(next);
      if (expandedNotes.has(id) && editingNoteId === id) setEditingNoteId(null);
  };

  const handleStartNoteEdit = (issue: QualityIssue) => {
      setTempNoteContent(issue.userNotes || "");
      setEditingNoteId(issue.id);
  };

  const handleCancelNoteEdit = () => {
      setEditingNoteId(null);
      setTempNoteContent("");
  };

  const handleSaveNote = async (issue: QualityIssue) => {
      if (!data.qualityAnalysis) return;
      const updatedIssue = { ...issue, userNotes: tempNoteContent };
      const newIssues = data.qualityAnalysis.issues.map(i => i.id === issue.id ? updatedIssue : i);
      onUpdateData({ ...data, qualityAnalysis: { ...data.qualityAnalysis, issues: newIssues } });
      setEditingNoteId(null);
      if (issue.userNotes !== tempNoteContent && onRegenerateIssueFix) {
          setRegeneratingFixForId(issue.id);
          await onRegenerateIssueFix(updatedIssue);
          setRegeneratingFixForId(null);
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          Array.from(e.target.files as FileList).forEach((file: File) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                  const base64 = (reader.result as string).split(',')[1];
                  setNewNoteImages(prev => [...prev, base64]);
              };
              reader.readAsDataURL(file as Blob);
          });
      }
      e.target.value = '';
  };

  const handleRemoveNewNoteImage = (index: number) => {
      setNewNoteImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddNote = () => {
      if (!newNoteText.trim()) return;
      const newNote: SceneNote = {
          id: crypto.randomUUID(),
          text: newNoteText,
          timestamp: Date.now(),
          images: newNoteImages.length > 0 ? newNoteImages : undefined
      };
      const updatedNotes = [...(data.userSceneNotes || []), newNote];
      onUpdateData({ ...data, userSceneNotes: updatedNotes });
      setNewNoteText("");
      setNewNoteImages([]);
  };

  const handleDeleteNote = (noteId: string) => {
      const updatedNotes = (data.userSceneNotes || []).filter(n => n.id !== noteId);
      onUpdateData({ ...data, userSceneNotes: updatedNotes });
  };

  const handleGenerateIssues = async () => {
      if (!data.userSceneNotes || data.userSceneNotes.length === 0 || !onGenerateIssuesFromNotes) return;
      setIsGeneratingIssues(true);
      try { await onGenerateIssuesFromNotes(data.userSceneNotes); } catch (e) { console.error(e); } finally { setIsGeneratingIssues(false); }
  };

  useEffect(() => {
    if (data.qa && qaContainerRef.current) qaContainerRef.current.scrollTop = qaContainerRef.current.scrollHeight;
  }, [data.qa]);

  const calculateScore = (issues: QualityIssue[]) => {
      const penalties = issues.reduce((acc, issue) => acc + issue.score, 0);
      return Math.round(Math.max(0, Math.min(10, 10 - penalties)) * 10) / 10;
  };

  const handleRunConsensus = async () => {
      if (!data.qualityAnalysis) return;
      const imgElement = document.querySelector('img[alt="ComfyUI Generation"]') as HTMLImageElement;
      if (!imgElement) return;
      setIsRunningConsensus(true);
      try {
          const response = await fetch(imgElement.src);
          const blob: Blob = await response.blob();
          const reader = new FileReader();
          reader.readAsDataURL(blob as any);
          reader.onloadend = async () => {
             const base64 = (reader.result as string).split(',')[1];
             const newIssues = await runConsensusQualityAnalysis(base64, passCount);
             const newScore = calculateScore(newIssues);
             onUpdateData({ ...data, qualityAnalysis: { overallScore: newScore, issues: newIssues } });
             setIsRunningConsensus(false);
          };
      } catch (e) { console.error(e); setIsRunningConsensus(false); }
  };

  const handleDeleteIssue = (index: number) => {
      if (!data.qualityAnalysis) return;
      const newIssues = data.qualityAnalysis.issues.filter((_, i) => i !== index);
      const newScore = calculateScore(newIssues);
      onUpdateData({ ...data, qualityAnalysis: { ...data.qualityAnalysis, issues: newIssues, overallScore: newScore } });
  };

  const handleStartEditing = (index: number, issue: QualityIssue) => {
      setEditingIssueIndex(index);
      setEditingIssue({ ...issue });
  };

  const handleCancelEditing = () => {
      setEditingIssueIndex(null);
      setEditingIssue(null);
  };

  const handleSaveIssue = async (index: number, updatedIssue: QualityIssue) => {
      if (!data.qualityAnalysis) return;
      const originalIssue = data.qualityAnalysis.issues[index];
      
      // Ensure score is 0 if severity is Note
      if (updatedIssue.severity === 'Note') updatedIssue.score = 0;
      
      const noteChanged = originalIssue.userNotes !== updatedIssue.userNotes;
      const descChanged = originalIssue.description !== updatedIssue.description;
      const newIssues = [...data.qualityAnalysis.issues];
      newIssues[index] = updatedIssue;
      const newScore = calculateScore(newIssues);
      onUpdateData({ ...data, qualityAnalysis: { ...data.qualityAnalysis, issues: newIssues, overallScore: newScore } });
      setEditingIssueIndex(null);
      setEditingIssue(null);
      if ((noteChanged || descChanged) && onRegenerateIssueFix) {
          setRegeneratingFixForId(updatedIssue.id);
          await onRegenerateIssueFix(updatedIssue);
          setRegeneratingFixForId(null);
      }
  };

  const handleAddIssue = async () => {
      if (!newIssue || !newIssue.description || !data.qualityAnalysis) return;
      
      const severity = (newIssue.severity as any) || 'Minor';
      // Default score based on severity, strictly 0 for Note
      const score = severity === 'Note' ? 0 : (newIssue.score || 0.5);

      const issueToAdd: QualityIssue = {
          id: crypto.randomUUID(),
          type: newIssue.type || 'Manual Entry',
          description: newIssue.description,
          severity: severity,
          score: score,
          suggestedFixes: ["Generating fix..."],
          confidence: 100,
          passCount: 1,
          userNotes: newIssue.userNotes || ""
      };
      const newIssues = [...data.qualityAnalysis.issues, issueToAdd];
      const newScore = calculateScore(newIssues);
      onUpdateData({ ...data, qualityAnalysis: { ...data.qualityAnalysis, issues: newIssues, overallScore: newScore } });
      setNewIssue(null);
      if (issueToAdd.userNotes) setExpandedNotes(prev => new Set(prev).add(issueToAdd.id));
      if (onRegenerateIssueFix) {
          setRegeneratingFixForId(issueToAdd.id);
          await onRegenerateIssueFix(issueToAdd);
          setRegeneratingFixForId(null);
      }
  };

  const handleStartEditPrompt = () => {
      if (!data.promptAnalysis) return;
      setEditedCritique(data.promptAnalysis.critique);
      setEditingPromptAnalysis(true);
  };

  const handleDeleteImprovement = (index: number) => {
      if (!data.promptAnalysis) return;
      const newImprovements = data.promptAnalysis.improvements.filter((_, i) => i !== index);
      onUpdateData({ ...data, promptAnalysis: { ...data.promptAnalysis, improvements: newImprovements } });
  };

  const handleAddImprovement = () => {
      if (!newImprovement.trim() || !data.promptAnalysis) return;
      const newImprovements = [...data.promptAnalysis.improvements, newImprovement.trim()];
      onUpdateData({ ...data, promptAnalysis: { ...data.promptAnalysis, improvements: newImprovements } });
      setNewImprovement('');
  };

  const handleSavePromptAnalysis = () => {
      if (!data.promptAnalysis) return;
      onUpdateData({ ...data, promptAnalysis: { ...data.promptAnalysis, critique: editedCritique } });
      setEditingPromptAnalysis(false);
  };

  const handleSubmitQuestion = async () => {
      if (!question.trim() || !onAskAi) return;
      setIsAsking(true);
      try { await onAskAi(question); setQuestion(''); } catch (error) { console.error(error); } finally { setIsAsking(false); }
  };

  const handleFocusIssue = (issue: QualityIssue) => {
      if (onFocusRegion && issue.box_2d) onFocusRegion({ label: issue.type, style: issue.style || 'box', box_2d: issue.box_2d });
  };

  const filteredIssues = data.qualityAnalysis?.issues.filter(i => (i.confidence || 100) >= confidenceThreshold) || [];

  return (
    <div className="space-y-10 pb-20">

      {/* 1. Assistant Chat - Moved to Top */}
      {!isOffline && onAskAi && (
        <section className="glass-card rounded-3xl p-8 relative overflow-hidden">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-sky-500/10 rounded-2xl text-sky-400 ring-1 ring-sky-500/20">
                    <Bot size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-extrabold text-white tracking-tight">Analysis Assistant</h2>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Direct query model context</div>
                </div>
            </div>

            <div className="space-y-6">
                <div ref={qaContainerRef} className="space-y-6 max-h-[500px] overflow-y-auto custom-scrollbar px-2 py-4">
                    {(!data.qa || data.qa.length === 0) && (
                        <div className="text-center py-10 text-slate-600 space-y-4">
                            {aiStatus === 'loading' ? (
                                <div className="flex items-center justify-center gap-3">
                                    <Loader2 size={24} className="animate-spin text-sky-500" />
                                    <p className="text-sm font-medium tracking-wide">INITIALIZING ASSISTANT...</p>
                                </div>
                            ) : (
                                <>
                                    <Bot size={48} className="mx-auto text-slate-800" />
                                    <p className="text-sm font-medium tracking-wide">READY FOR INTERROGATION</p>
                                </>
                            )}
                        </div>
                    )}
                    
                    {data.qa?.map((item) => (
                        <div key={item.id} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                             <div className="flex justify-end">
                                 <div className="bg-indigo-600 text-white rounded-3xl rounded-tr-none px-6 py-3.5 max-w-[80%] text-sm font-medium shadow-xl">
                                     {item.question}
                                 </div>
                             </div>
                             <div className="flex flex-col items-start gap-3">
                                 <div className="bg-white/5 text-slate-200 rounded-3xl rounded-tl-none px-6 py-5 max-w-[90%] text-sm shadow-inner border border-white/5 leading-relaxed">
                                     <MarkdownViewer content={item.answer} />
                                 </div>
                                 {item.annotations && item.annotations.length > 0 && onFocusRegion && (
                                     <div className="flex flex-wrap gap-3 mt-1 ml-4">
                                         {item.annotations.map((ann, idx) => (
                                             <button key={idx} onClick={() => onFocusRegion(ann)} className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/50 hover:bg-indigo-600 text-white border border-white/5 rounded-2xl transition-all shadow-lg group">
                                                 <ScanEye size={16} className="text-indigo-400 group-hover:text-white" />
                                                 <span className="text-[10px] font-black uppercase tracking-widest">{ann.label}</span>
                                             </button>
                                         ))}
                                     </div>
                                 )}
                             </div>
                        </div>
                    ))}
                     {isAsking && (
                        <div className="flex justify-start animate-pulse">
                             <div className="bg-white/5 rounded-3xl rounded-tl-none px-8 py-4 flex items-center gap-3 text-slate-400 text-xs font-bold uppercase tracking-widest border border-white/5">
                                <Loader2 size={16} className="animate-spin text-indigo-500" /> SYNTHESIZING...
                             </div>
                        </div>
                    )}
                </div>

                <div className="relative mt-8 group/input">
                    <input type="text" className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-8 pr-16 text-sm text-white placeholder:text-slate-600 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all shadow-inner disabled:opacity-50" placeholder={aiStatus === 'loading' ? "Waiting for analysis..." : "Analyze specific elements of the generation..."} value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isAsking && aiStatus === 'complete' && handleSubmitQuestion()} disabled={isAsking || aiStatus !== 'complete'} />
                    <button onClick={handleSubmitQuestion} disabled={!question.trim() || isAsking || aiStatus !== 'complete'} className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xl transition-all hover:scale-105 disabled:opacity-30 disabled:hover:scale-100">
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </section>
      )}
      
      {/* 2. Scene Overview */}
      <section className="glass-card rounded-3xl p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Layers size={80} className="text-indigo-400" />
        </div>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 ring-1 ring-indigo-500/20">
             {aiStatus === 'loading' && data.sceneOverview.length === 0 ? <Loader2 size={24} className="animate-spin" /> : <Layers size={24} />}
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Scene Intelligence</h2>
            {isOffline && <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1 block">Local Recovery Mode</span>}
          </div>
        </div>
        
        <div className="space-y-6">
            {/* Loading state specifically for the Attribute List, keeping Context visible */}
            {aiStatus === 'loading' && data.sceneOverview.length === 0 ? (
                <div className="space-y-6 animate-pulse">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-6 items-center">
                            <div className="w-32 h-2 bg-slate-800 rounded-full"></div>
                            <div className="flex-1 h-2 bg-slate-800 rounded-full"></div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid gap-6">
                    {data.sceneOverview.length > 0 ? (
                        data.sceneOverview.map((item, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:gap-6 items-start">
                                <span className="min-w-[140px] text-xs font-black text-indigo-300/60 uppercase tracking-[0.2em] mt-1.5">
                                    {item.category}
                                </span>
                                <p className="text-slate-200 leading-relaxed text-base">
                                    {item.details}
                                </p>
                            </div>
                        ))
                    ) : (
                        <div className="text-slate-500 font-medium py-4 flex items-center gap-3">
                            <Info size={18} className="text-indigo-500/50" />
                            {isOffline ? "Forensic scene description is unavailable in offline mode." : "Waiting for scan..."}
                        </div>
                    )}
                </div>
            )}
            
            {/* Narrative Context - Always Visible */}
            <div className="pt-8 mt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                        <BookOpen size={14} className="text-indigo-400" /> Narrative Context
                    </div>
                    {!isEditingBackstory && (
                        <button onClick={handleStartEditBackstory} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                            <Edit2 size={12} /> Edit Story
                        </button>
                    )}
                </div>
                
                {isEditingBackstory ? (
                    <div className="space-y-4">
                        <textarea 
                            className="w-full bg-black/30 border border-white/10 rounded-2xl p-5 text-sm text-slate-200 min-h-[120px] focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all placeholder:text-slate-700"
                            placeholder="Write the backstory or inspiration for this image..."
                            value={tempBackstory}
                            onChange={(e) => setTempBackstory(e.target.value)}
                            autoFocus
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={handleCancelEditBackstory} className="px-5 py-2 text-xs font-bold text-slate-500 hover:text-slate-300 uppercase">Cancel</button>
                            <button onClick={handleSaveBackstory} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20">SAVE CONTEXT</button>
                        </div>
                    </div>
                ) : (
                    <div onClick={handleStartEditBackstory} className="group cursor-pointer rounded-2xl p-5 -mx-5 border border-transparent hover:bg-white/5 transition-all">
                            {data.sceneBackstory ? (
                            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{data.sceneBackstory}</p>
                            ) : (
                            <span className="text-slate-600 italic text-sm font-medium flex items-center gap-3">
                                <Plus size={16} className="text-indigo-500/30" />
                                No narrative context added. Click to add a backstory or inspiration notes.
                            </span>
                            )}
                    </div>
                )}
            </div>
        </div>
      </section>

      {/* 3. Quality Analysis */}
      {!isOffline && (
        <section className="glass-card rounded-3xl p-8 relative group">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-400 ring-1 ring-rose-500/20">
                         {aiStatus === 'loading' && !data.qualityAnalysis ? <Loader2 size={24} className="animate-spin" /> : <AlertTriangle size={24} />}
                    </div>
                    <div>
                        <h2 className="text-2xl font-extrabold text-white tracking-tight">Forensic Report</h2>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Pixel-level artifact detection</div>
                    </div>
                </div>

                {data.qualityAnalysis && (
                    <div className="flex flex-wrap items-center gap-4">
                         <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                            <Filter size={14} className="text-slate-500"/>
                            <span className="text-[10px] font-black text-slate-400">{confidenceThreshold}% CONF</span>
                            <input type="range" min="0" max="100" value={confidenceThreshold} onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))} className="w-20 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer accent-indigo-500" />
                         </div>

                         <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                            <Gauge size={14} className="text-slate-500"/>
                            <select value={passCount} onChange={(e) => setPassCount(Number(e.target.value))} className="bg-transparent text-[10px] font-black text-slate-300 uppercase tracking-widest outline-none border-none cursor-pointer">
                                <option value="1">1 Pass</option>
                                <option value="3">3 Passes</option>
                                <option value="5">5 Passes</option>
                            </select>
                         </div>
                         
                         <button onClick={handleRunConsensus} disabled={isRunningConsensus} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50">
                             {isRunningConsensus ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
                             {isRunningConsensus ? 'AUDITING...' : 'RUN AUDIT'}
                         </button>

                        <div className="flex flex-row items-center gap-4 bg-black/40 px-5 py-2.5 rounded-2xl border border-white/5 shadow-inner">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Score</span>
                            <span className={`text-xl font-black ${getScoreColor(data.qualityAnalysis.overallScore)}`}>
                                {data.qualityAnalysis.overallScore}<span className="text-xs text-slate-600 ml-0.5">/10</span>
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {aiStatus === 'loading' && !data.qualityAnalysis ? (
                 <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3 border border-dashed border-white/5 rounded-2xl bg-white/5 animate-pulse">
                     <Loader2 size={32} className="animate-spin text-rose-500/50" />
                     <p className="text-xs font-bold uppercase tracking-widest">Scanning artifacts...</p>
                 </div>
            ) : data.qualityAnalysis && (
                <div className="space-y-4">
                    {filteredIssues.map((issue, idx) => (
                        <div key={issue.id || idx} className="bg-white/5 rounded-2xl border border-white/5 p-6 group/issue relative transition-all hover:bg-white/[0.08] hover:border-white/10">
                            {editingIssueIndex === idx && editingIssue ? (
                                 <div className="space-y-4">
                                     <div className="flex gap-4">
                                         <select className="bg-slate-900 border border-white/10 rounded-xl text-xs font-bold uppercase text-slate-300 px-4 py-2" value={editingIssue.severity} onChange={(e) => setEditingIssue({ ...editingIssue, severity: e.target.value as any })}>
                                             <option value="Note">Note</option>
                                             <option value="Minor">Minor</option>
                                             <option value="Major">Major</option>
                                             <option value="Critical">Critical</option>
                                         </select>
                                         <input type="text" className="flex-1 bg-slate-900 border border-white/10 rounded-xl text-sm font-bold text-white px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500/30" value={editingIssue.type} onChange={(e) => setEditingIssue({ ...editingIssue, type: e.target.value })} />
                                     </div>
                                     <textarea className="w-full bg-slate-900 border border-white/10 rounded-xl text-sm text-slate-300 px-4 py-4 min-h-[80px] outline-none" value={editingIssue.description} onChange={(e) => setEditingIssue({ ...editingIssue, description: e.target.value })} />
                                     <div className="flex justify-end gap-3">
                                         <button onClick={handleCancelEditing} className="px-6 py-2 text-xs font-bold text-slate-500 hover:text-white uppercase tracking-wider">Cancel</button>
                                         <button onClick={() => handleSaveIssue(idx, editingIssue)} className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg uppercase tracking-wider">Save Changes</button>
                                     </div>
                                 </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-start gap-6">
                                        <div className="flex flex-col gap-2 shrink-0">
                                            <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border text-center ${getSeverityColor(issue.severity)}`}>
                                                {issue.severity === 'Note' ? '—' : issue.severity}
                                            </div>
                                            {issue.confidence !== undefined && (
                                                <div className={`px-3 py-1 rounded-lg text-[9px] font-mono border text-center ${getConfidenceColor(issue.confidence)}`}>
                                                    {issue.confidence}%
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 pr-20">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-lg font-bold text-white tracking-tight">{issue.type}</span>
                                                {issue.box_2d && onFocusRegion && (
                                                    <button onClick={() => handleFocusIssue(issue)} className="p-1.5 text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 rounded-lg transition-all" title="Focus Region">
                                                        <ScanEye size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-slate-400 text-sm leading-relaxed">{issue.description}</p>
                                        </div>
                                        
                                        <div className="absolute top-6 right-6 flex gap-1 opacity-0 group-hover/issue:opacity-100 transition-opacity">
                                            <button onClick={() => toggleNote(issue.id)} className={`p-2 rounded-xl hover:bg-white/10 ${issue.userNotes ? 'text-indigo-400' : 'text-slate-500'}`} title="Context Note"><StickyNote size={16} /></button>
                                            <button onClick={() => handleStartEditing(idx, issue)} className="p-2 text-slate-500 hover:text-white rounded-xl hover:bg-white/10"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDeleteIssue(idx)} className="p-2 text-slate-500 hover:text-red-400 rounded-xl hover:bg-white/10"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    {expandedNotes.has(issue.id) && (
                                        <div className="ml-10 p-5 bg-black/40 border-l-4 border-indigo-500/50 rounded-r-2xl text-sm animate-in slide-in-from-top-2">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                                    <StickyNote size={12} /> Researcher Context
                                                </div>
                                                {!editingNoteId && <button onClick={() => handleStartNoteEdit(issue)} className="text-[10px] font-bold text-slate-500 hover:text-indigo-300 uppercase">Edit</button>}
                                            </div>
                                            {editingNoteId === issue.id ? (
                                                <div className="space-y-4">
                                                    <textarea className="w-full bg-slate-900 border border-white/5 rounded-xl text-sm text-slate-200 p-4 min-h-[100px] outline-none" value={tempNoteContent} onChange={(e) => setTempNoteContent(e.target.value)} autoFocus />
                                                    <div className="flex justify-end gap-3">
                                                        <button onClick={handleCancelNoteEdit} className="text-[10px] font-black text-slate-500 uppercase">Cancel</button>
                                                        <button onClick={() => handleSaveNote(issue)} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase">Save Note</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="italic text-slate-400 leading-relaxed">{issue.userNotes || "No context added yet."}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {newIssue ? (
                         <div className="bg-indigo-500/5 rounded-3xl border border-dashed border-indigo-500/30 p-8 space-y-4 animate-in zoom-in-95">
                              <h4 className="text-sm font-black text-indigo-300 uppercase tracking-widest">New Manual Entry</h4>
                              <div className="flex gap-4">
                                    <select className="bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-slate-300 px-4" value={newIssue.severity || 'Minor'} onChange={(e) => setNewIssue({ ...newIssue, severity: e.target.value as any })}>
                                        <option value="Note">Note</option>
                                        <option value="Minor">Minor</option>
                                        <option value="Major">Major</option>
                                        <option value="Critical">Critical</option>
                                    </select>
                                    <input type="text" placeholder="Artifact Type..." className="flex-1 bg-slate-950 border border-white/10 rounded-xl text-sm text-white px-5 py-3 outline-none" value={newIssue.type || ''} onChange={(e) => setNewIssue({ ...newIssue, type: e.target.value })} />
                                </div>
                                <textarea placeholder="Observation details..." className="w-full bg-slate-950 border border-white/10 rounded-xl text-sm text-slate-300 px-5 py-4 min-h-[100px] outline-none" value={newIssue.description || ''} onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })} />
                                <div className="flex justify-end gap-4">
                                    <button onClick={() => setNewIssue(null)} className="text-xs font-bold text-slate-500 uppercase">Discard</button>
                                    <button onClick={handleAddIssue} className="px-8 py-3 bg-white text-slate-900 rounded-full text-xs font-black uppercase shadow-xl hover:scale-105 transition-transform">Add & Audit</button>
                                </div>
                         </div>
                    ) : (
                        <button onClick={() => setNewIssue({ severity: 'Minor', score: 0.5, type: '', userNotes: '' })} className="w-full py-4 border-2 border-dashed border-white/5 rounded-2xl text-sm font-bold text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-3">
                            <Plus size={20} /> MANUALLY TAG ARTIFACT
                        </button>
                    )}
                </div>
            )}
        </section>
      )}

      {/* 4. Prompt Analysis */}
      {!isOffline && (
        <section className="glass-card rounded-3xl p-8 group relative">
            {isRefiningPrompt && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-30 flex flex-col items-center justify-center gap-4 rounded-3xl">
                     <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                     <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-200">Revising Prompt Theory...</p>
                </div>
            )}

            <div className="flex items-center justify-between mb-10 pb-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400 ring-1 ring-purple-500/20">
                         {aiStatus === 'loading' && !data.promptAnalysis ? <Loader2 size={24} className="animate-spin" /> : <Wand2 size={24} />}
                    </div>
                    <div>
                        <h2 className="text-2xl font-extrabold text-white tracking-tight">Prompt Audit</h2>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Linguistic adherence scoring</div>
                    </div>
                </div>
                
                {data.promptAnalysis && (
                    <div className="flex items-center gap-4">
                        <button onClick={() => onRefreshPromptAnalysis?.(data)} className="p-2.5 text-slate-500 hover:text-white rounded-xl hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"><RefreshCw size={20} /></button>
                        <div className="bg-black/40 px-5 py-2.5 rounded-2xl border border-white/5 shadow-inner flex items-center gap-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Adherence</span>
                            <span className={`text-xl font-black ${getScoreColor(data.promptAnalysis.adherenceScore)}`}>
                                {data.promptAnalysis.adherenceScore}<span className="text-xs text-slate-600 ml-0.5">/10</span>
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {aiStatus === 'loading' && !data.promptAnalysis ? (
                 <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3 border border-dashed border-white/5 rounded-2xl bg-white/5 animate-pulse">
                     <Loader2 size={32} className="animate-spin text-purple-500/50" />
                     <p className="text-xs font-bold uppercase tracking-widest">Analyzing prompt structure...</p>
                 </div>
            ) : data.promptAnalysis && (
                <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Theoretical Critique</h3>
                            <button onClick={handleStartEditPrompt} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300">Edit</button>
                        </div>
                        {editingPromptAnalysis ? (
                            <div className="space-y-4">
                                 <textarea className="w-full bg-slate-900 border border-white/5 rounded-2xl p-5 text-sm text-slate-300 min-h-[180px] outline-none" value={editedCritique} onChange={(e) => setEditedCritique(e.target.value)} />
                                 <div className="flex justify-end gap-3">
                                    <button onClick={() => setEditingPromptAnalysis(false)} className="text-[10px] font-black text-slate-500 uppercase px-4">Cancel</button>
                                    <button onClick={handleSavePromptAnalysis} className="px-6 py-2 bg-white text-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest">Update Critique</button>
                                 </div>
                            </div>
                        ) : (
                            <div className="p-6 bg-black/30 rounded-2xl border border-white/5 text-slate-300 text-sm leading-relaxed shadow-inner">
                                {data.promptAnalysis.critique}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Technical Refinements</h3>
                        <ul className="space-y-3">
                            {filteredIssues.map((issue) => {
                               const fixes = issue.suggestedFixes || (issue.suggestedFix ? [issue.suggestedFix] : []);
                               if (fixes.length === 0) return null;
                               return (
                                 <li key={issue.id} className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl animate-in slide-in-from-right-4 duration-500">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-1.5 h-1.5 rounded-full ${issue.severity === 'Note' ? 'bg-slate-400' : 'bg-rose-400'}`} />
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${issue.severity === 'Note' ? 'text-slate-400' : 'text-rose-300'}`}>
                                            {issue.type}
                                        </span>
                                    </div>
                                    <div className="space-y-2 pl-4">
                                        {fixes.map((fix, fIdx) => (
                                            <div key={fIdx} className="flex items-start gap-3">
                                                <ArrowRight size={12} className="text-indigo-500 mt-1 shrink-0" />
                                                <span className="text-sm text-slate-200 font-medium">{fix}</span>
                                            </div>
                                        ))}
                                    </div>
                                 </li>
                               );
                            })}

                            {data.promptAnalysis.improvements.map((tip, idx) => (
                                <li key={`gen-${idx}`} className="group/item flex items-start gap-4 p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/[0.08] transition-all">
                                    <Sparkles size={14} className="text-indigo-400 mt-1 shrink-0" />
                                    <span className="text-sm text-slate-300 leading-relaxed flex-1">{tip}</span>
                                    <button onClick={() => handleDeleteImprovement(idx)} className="opacity-0 group-hover/item:opacity-100 p-1.5 text-slate-600 hover:text-red-400 transition-all"><X size={14} /></button>
                                </li>
                            ))}
                            
                            <li className="flex items-center gap-3 pt-4">
                                <input type="text" placeholder="Add observation..." className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-5 py-3 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/30" value={newImprovement} onChange={(e) => setNewImprovement(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddImprovement()} />
                                <button onClick={handleAddImprovement} disabled={!newImprovement.trim()} className="p-3.5 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-500 disabled:opacity-50 transition-all"><Plus size={18} /></button>
                            </li>
                        </ul>
                    </div>
                </div>
            )}
        </section>
      )}

      {/* 5. Parameters Grid */}
      <section className="glass-card rounded-3xl p-8 relative group">
        <div className="flex items-center gap-4 mb-10 pb-6 border-b border-white/5">
          <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400 ring-1 ring-amber-500/20">
            <Sliders size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Technical Profile</h2>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Hyperparameter extraction</div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(data.parameters).map(([key, value]) => (
            (value || value === 0) && (
              <div key={key} className="bg-black/30 p-5 rounded-2xl border border-white/5 shadow-inner group/param hover:border-amber-500/30 transition-all">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 group-hover:text-amber-500/60 transition-colors">
                  {key}
                </div>
                <div className="text-sm font-mono text-slate-200 break-all bg-slate-950/50 p-2.5 rounded-xl ring-1 ring-white/5">
                  {String(value)}
                </div>
              </div>
            )
          ))}
        </div>
      </section>

      {/* 6. Workflow Graph */}
      <section className="glass-card rounded-3xl p-8 relative">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/5">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 ring-1 ring-emerald-500/20">
            <Zap size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Workflow Topology</h2>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Interactive node reconstruction</div>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
            {workflowData ? <WorkflowGraph workflow={workflowData} /> : <div className="p-20 text-center text-slate-500 font-bold uppercase tracking-widest bg-black/20">Topology data missing</div>}
        </div>
      </section>

    </div>
  );
};
