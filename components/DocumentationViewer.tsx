
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
  
  // Quality Settings
  const [passCount, setPassCount] = useState<number>(3);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0);
  const [isRunningConsensus, setIsRunningConsensus] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Inline Note Editing State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNoteContent, setTempNoteContent] = useState("");

  // Scene Notes State
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

  // Backstory Editing State
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
      onUpdateData({
          ...data,
          sceneBackstory: tempBackstory
      });
      setIsEditingBackstory(false);
  };

  const getSeverityColor = (severity: string) => {
      switch(severity.toLowerCase()) {
          case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
          case 'major': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
          case 'minor': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
          case 'note': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
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
      // Cancel edit if closing
      if (expandedNotes.has(id) && editingNoteId === id) {
          setEditingNoteId(null);
      }
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
      
      onUpdateData({
          ...data,
          qualityAnalysis: {
              ...data.qualityAnalysis,
              issues: newIssues
          }
      });
      
      setEditingNoteId(null);

      // Trigger regen if note content changed significantly
      if (issue.userNotes !== tempNoteContent && onRegenerateIssueFix) {
          setRegeneratingFixForId(issue.id);
          await onRegenerateIssueFix(updatedIssue);
          setRegeneratingFixForId(null);
      }
  };

  // --- Scene Notes Handlers ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          Array.from(e.target.files).forEach(file => {
              const reader = new FileReader();
              reader.onloadend = () => {
                  const base64 = (reader.result as string).split(',')[1];
                  setNewNoteImages(prev => [...prev, base64]);
              };
              reader.readAsDataURL(file);
          });
      }
      e.target.value = ''; // reset
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
      try {
          await onGenerateIssuesFromNotes(data.userSceneNotes);
      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingIssues(false);
      }
  };

  // Scroll to bottom of QA when new message arrives
  useEffect(() => {
    if (data.qa && qaContainerRef.current) {
      qaContainerRef.current.scrollTop = qaContainerRef.current.scrollHeight;
    }
  }, [data.qa]);

  // --- Quality Analysis Handlers ---

  const calculateScore = (issues: QualityIssue[]) => {
      const penalties = issues.reduce((acc, issue) => acc + issue.score, 0);
      let newScore = 10 - penalties;
      newScore = Math.max(0, Math.min(10, newScore));
      return Math.round(newScore * 10) / 10;
  };

  const handleRunConsensus = async () => {
      if (!data.qualityAnalysis) return;
      
      const imgElement = document.querySelector('img[alt="ComfyUI Generation"]') as HTMLImageElement;
      if (!imgElement) return;

      setIsRunningConsensus(true);
      try {
          // Convert current blob src to base64
          const response = await fetch(imgElement.src);
          const blob = await response.blob();
          const reader = new FileReader();
          // Cast to any to fix type error where blob might be inferred as unknown
          reader.readAsDataURL(blob as any);
          reader.onloadend = async () => {
             const base64 = (reader.result as string).split(',')[1];
             const newIssues = await runConsensusQualityAnalysis(base64, passCount);
             
             // Update Data
             const newScore = calculateScore(newIssues);
             onUpdateData({
                 ...data,
                 qualityAnalysis: {
                     overallScore: newScore,
                     issues: newIssues
                 }
             });
             setIsRunningConsensus(false);
          };
      } catch (e) {
          console.error(e);
          setIsRunningConsensus(false);
      }
  };

  const handleDeleteIssue = (index: number) => {
      if (!data.qualityAnalysis) return;
      const newIssues = data.qualityAnalysis.issues.filter((_, i) => i !== index);
      const newScore = calculateScore(newIssues);
      
      onUpdateData({
          ...data,
          qualityAnalysis: {
              ...data.qualityAnalysis,
              issues: newIssues,
              overallScore: newScore
          }
      });
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
      const noteChanged = originalIssue.userNotes !== updatedIssue.userNotes;
      const descChanged = originalIssue.description !== updatedIssue.description;

      const newIssues = [...data.qualityAnalysis.issues];
      newIssues[index] = updatedIssue;
      const newScore = calculateScore(newIssues);

      onUpdateData({
          ...data,
          qualityAnalysis: {
              ...data.qualityAnalysis,
              issues: newIssues,
              overallScore: newScore
          }
      });
      setEditingIssueIndex(null);
      setEditingIssue(null);

      // If note changed, trigger regen
      if ((noteChanged || descChanged) && onRegenerateIssueFix) {
          setRegeneratingFixForId(updatedIssue.id);
          await onRegenerateIssueFix(updatedIssue);
          setRegeneratingFixForId(null);
      }
  };

  const handleAddIssue = async () => {
      if (!newIssue || !newIssue.description || !data.qualityAnalysis) return;
      
      const issueToAdd: QualityIssue = {
          id: crypto.randomUUID(),
          type: newIssue.type || 'Manual Entry',
          description: newIssue.description,
          severity: (newIssue.severity as any) || 'Minor',
          score: newIssue.score || 0.5,
          suggestedFixes: ["Generating fix..."],
          confidence: 100,
          passCount: 1,
          userNotes: newIssue.userNotes || ""
      };

      const newIssues = [...data.qualityAnalysis.issues, issueToAdd];
      const newScore = calculateScore(newIssues);

      onUpdateData({
          ...data,
          qualityAnalysis: {
              ...data.qualityAnalysis,
              issues: newIssues,
              overallScore: newScore
          }
      });
      setNewIssue(null);
      
      // Auto expand the note of the new issue if it exists
      if (issueToAdd.userNotes) {
          setExpandedNotes(prev => new Set(prev).add(issueToAdd.id));
      }

      // Granular regen
      if (onRegenerateIssueFix) {
          setRegeneratingFixForId(issueToAdd.id);
          await onRegenerateIssueFix(issueToAdd);
          setRegeneratingFixForId(null);
      }
  };

  // --- Prompt Analysis Handlers ---

  const handleStartEditPrompt = () => {
      if (!data.promptAnalysis) return;
      setEditedCritique(data.promptAnalysis.critique);
      setEditingPromptAnalysis(true);
  };

  const handleDeleteImprovement = (index: number) => {
      if (!data.promptAnalysis) return;
      const newImprovements = data.promptAnalysis.improvements.filter((_, i) => i !== index);
      onUpdateData({
          ...data,
          promptAnalysis: {
              ...data.promptAnalysis,
              improvements: newImprovements
          }
      });
  };

  const handleAddImprovement = () => {
      if (!newImprovement.trim() || !data.promptAnalysis) return;
      const newImprovements = [...data.promptAnalysis.improvements, newImprovement.trim()];
      onUpdateData({
          ...data,
          promptAnalysis: {
              ...data.promptAnalysis,
              improvements: newImprovements
          }
      });
      setNewImprovement('');
  };

  const handleSavePromptAnalysis = () => {
      if (!data.promptAnalysis) return;
      onUpdateData({
          ...data,
          promptAnalysis: {
              ...data.promptAnalysis,
              critique: editedCritique
          }
      });
      setEditingPromptAnalysis(false);
  };

  const handleSubmitQuestion = async () => {
      if (!question.trim() || !onAskAi) return;
      
      setIsAsking(true);
      try {
          await onAskAi(question);
          setQuestion('');
      } catch (error) {
          console.error(error);
      } finally {
          setIsAsking(false);
      }
  };

  const handleFocusIssue = (issue: QualityIssue) => {
      if (onFocusRegion && issue.box_2d) {
          onFocusRegion({
              label: issue.type,
              style: issue.style || 'box',
              box_2d: issue.box_2d
          });
      }
  };

  // Filter Logic
  const filteredIssues = data.qualityAnalysis?.issues.filter(i => (i.confidence || 100) >= confidenceThreshold) || [];

  return (
    <div className="space-y-8 pb-12">
      
      {/* 1. Scene Overview */}
      <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-sm min-h-[160px]">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
             {aiStatus === 'loading' ? <Loader2 size={20} className="animate-spin" /> : <Layers size={20} />}
          </div>
          <h2 className="text-xl font-semibold text-slate-100">
              {aiStatus === 'loading' ? 'Generating Scene Overview...' : 'Scene Overview'}
          </h2>
          {isOffline && <span className="text-xs px-2 py-1 bg-slate-800 rounded text-slate-400">Local Mode</span>}
        </div>

        {aiStatus === 'loading' ? (
            <div className="space-y-4 animate-pulse mb-8">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex gap-4">
                        <div className="w-24 h-4 bg-slate-800 rounded"></div>
                        <div className="flex-1 h-4 bg-slate-800 rounded w-full"></div>
                    </div>
                ))}
            </div>
        ) : (
            <>
                {data.sceneOverview.length > 0 ? (
                    <div className="grid gap-4 mb-8">
                        {data.sceneOverview.map((item, idx) => (
                            <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start">
                            <span className="min-w-[120px] text-sm font-bold text-indigo-300 uppercase tracking-wider mt-1">
                                {item.category}
                            </span>
                            <p className="text-slate-300 leading-relaxed text-sm sm:text-base">
                                {item.details}
                            </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-slate-500 italic flex items-center gap-2 mb-8">
                        <Info size={16} />
                        {isOffline 
                            ? "Enable AI mode to generate a detailed scene description." 
                            : "No scene overview generated."}
                    </div>
                )}
            </>
        )}
        
        {/* Inspiration / Backstory Section */}
        <div className="pt-6 border-t border-slate-800/50">
            <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold uppercase tracking-wider">
                        <BookOpen size={14} /> Inspiration & Backstory
                    </div>
                    {!isEditingBackstory && (
                        <button 
                            onClick={handleStartEditBackstory} 
                            className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors"
                            title="Edit Backstory"
                        >
                            <Edit2 size={14} />
                        </button>
                    )}
            </div>
            
            {isEditingBackstory ? (
                <div className="relative animate-in fade-in duration-200">
                    <textarea 
                        className="w-full bg-slate-950/50 border border-slate-700/50 rounded-lg p-3 text-sm text-slate-300 min-h-[100px] focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-600 focus:bg-slate-950"
                        placeholder="Share the story behind this image..."
                        value={tempBackstory}
                        onChange={(e) => setTempBackstory(e.target.value)}
                        autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-2">
                        <button 
                            onClick={handleCancelEditBackstory}
                            className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveBackstory}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow-lg shadow-indigo-500/20 transition-all"
                        >
                            <Save size={14} /> Save
                        </button>
                    </div>
                </div>
            ) : (
                <div 
                    onClick={handleStartEditBackstory}
                    className="group cursor-pointer rounded-lg p-3 -mx-3 border border-transparent hover:border-slate-800/50 hover:bg-slate-900/30 transition-all"
                >
                     {data.sceneBackstory ? (
                        <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{data.sceneBackstory}</p>
                     ) : (
                        <span className="text-slate-600 italic text-sm flex items-center gap-2 group-hover:text-slate-500 transition-colors">
                            <Plus size={14} className="opacity-50" />
                            Click to add inspiration notes or character backstory...
                        </span>
                     )}
                </div>
            )}
        </div>
      </section>

      {/* 2. AI Assistant Q&A */}
      {!isOffline && onAskAi && (
        <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
                    <Bot size={20} />
                </div>
                <h2 className="text-xl font-semibold text-slate-100">AI Assistant</h2>
                <div className="ml-auto text-xs text-slate-500">
                    Context: Image + Analysis
                </div>
            </div>

            <div className="space-y-4">
                <div 
                    ref={qaContainerRef}
                    className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar p-1"
                >
                    {(!data.qa || data.qa.length === 0) && (
                        <div className="text-center py-8 text-slate-500 text-sm">
                            <p>Ask a question about the image or the workflow.</p>
                            <p className="text-xs opacity-70 mt-1">"Why do the hands look weird?" • "How can I improve the lighting?"</p>
                        </div>
                    )}
                    
                    {data.qa?.map((item) => (
                        <div key={item.id} className="space-y-2">
                             <div className="flex justify-end">
                                 <div className="bg-indigo-600 text-white rounded-l-2xl rounded-tr-2xl rounded-br-sm px-4 py-2.5 max-w-[85%] text-sm shadow-md">
                                     {item.question}
                                 </div>
                             </div>
                             <div className="flex flex-col items-start gap-1">
                                 <div className="bg-slate-800 text-slate-200 rounded-r-2xl rounded-tl-2xl rounded-bl-sm px-4 py-3 max-w-[90%] text-sm shadow-sm border border-slate-700 leading-relaxed">
                                     <MarkdownViewer content={item.answer} />
                                 </div>
                                 
                                 {/* Annotated Image Thumbnails */}
                                 {item.annotations && item.annotations.length > 0 && onFocusRegion && (
                                     <div className="flex flex-wrap gap-2 mt-1 ml-2">
                                         {item.annotations.map((ann, idx) => (
                                             <button
                                                 key={idx}
                                                 onClick={() => onFocusRegion(ann)}
                                                 className="group relative flex items-center gap-2 px-3 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-indigo-500/50 rounded-lg transition-all"
                                             >
                                                 {/* Visual indication of 'attached image' */}
                                                 <div className="relative w-8 h-8 bg-black/50 rounded border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                                                     <ImageIcon size={14} className="text-slate-500 group-hover:text-indigo-400" />
                                                     <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                 </div>
                                                 <div className="flex flex-col items-start">
                                                     <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Inspect</span>
                                                     <span className="text-indigo-300 group-hover:text-white transition-colors">{ann.label}</span>
                                                 </div>
                                                 <ScanEye size={14} className="ml-1 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                                             </button>
                                         ))}
                                     </div>
                                 )}
                             </div>
                        </div>
                    ))}
                    
                     {isAsking && (
                        <div className="flex justify-start">
                             <div className="bg-slate-800/50 rounded-r-2xl rounded-tl-2xl rounded-bl-sm px-4 py-3 min-w-[100px] flex items-center gap-2 text-slate-400 text-sm border border-slate-700/50">
                                <Loader2 size={16} className="animate-spin" /> Thinking...
                             </div>
                        </div>
                    )}
                </div>

                <div className="relative mt-4">
                    <input 
                        type="text" 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 pl-4 pr-12 text-sm text-white placeholder:text-slate-500 focus:ring-1 focus:ring-sky-500/50 outline-none transition-all"
                        placeholder="Ask a question about this generation..."
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isAsking && handleSubmitQuestion()}
                        disabled={isAsking}
                    />
                    <button 
                        onClick={handleSubmitQuestion}
                        disabled={!question.trim() || isAsking}
                        className="absolute right-2 top-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500 transition-colors"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </section>
      )}

      {/* 3. Scene Notes */}
      <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400">
                    <NotebookPen size={20} />
                </div>
                <h2 className="text-xl font-semibold text-slate-100">Scene Notes</h2>
              </div>
              
              {onGenerateIssuesFromNotes && (
                  <button
                    onClick={handleGenerateIssues}
                    disabled={isGeneratingIssues || !data.userSceneNotes || data.userSceneNotes.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:bg-slate-800 transition-colors"
                  >
                     {isGeneratingIssues ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14} />}
                     Analyze Notes & Create Suggestions
                  </button>
              )}
          </div>
          
          <div className="space-y-4">
              {/* Note List */}
              {data.userSceneNotes && data.userSceneNotes.length > 0 ? (
                  <div className="grid gap-3">
                      {data.userSceneNotes.map((note) => (
                          <div key={note.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 group relative hover:border-violet-500/30 transition-colors">
                              <p className="text-slate-300 text-sm whitespace-pre-wrap">{note.text}</p>
                              
                              {note.images && note.images.length > 0 && (
                                  <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                                      {note.images.map((img, idx) => (
                                          <div key={idx} className="w-16 h-16 rounded border border-slate-800 bg-slate-900 flex-shrink-0 overflow-hidden">
                                              <img src={`data:image/png;base64,${img}`} alt="Reference" className="w-full h-full object-cover" />
                                          </div>
                                      ))}
                                  </div>
                              )}
                              
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleDeleteNote(note.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded">
                                      <Trash2 size={14} />
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="text-slate-500 text-sm italic p-4 text-center border border-dashed border-slate-800 rounded-lg">
                      No notes yet. Add your observations or ideas below.
                  </div>
              )}

              {/* Add Note Input */}
              <div className="bg-slate-950/50 border border-slate-700/50 rounded-lg p-4">
                  <textarea 
                    className="w-full bg-transparent border-none p-0 text-sm text-slate-200 min-h-[60px] focus:ring-0 outline-none placeholder:text-slate-600 resize-none"
                    placeholder="Add a new note..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddNote();
                        }
                    }}
                  />
                  
                  {newNoteImages.length > 0 && (
                      <div className="flex gap-2 mt-2 mb-2 overflow-x-auto">
                          {newNoteImages.map((img, idx) => (
                              <div key={idx} className="relative w-12 h-12 rounded border border-slate-700 bg-slate-900 flex-shrink-0 overflow-hidden group/img">
                                  <img src={`data:image/png;base64,${img}`} alt="Preview" className="w-full h-full object-cover" />
                                  <button 
                                    onClick={() => handleRemoveNewNoteImage(idx)}
                                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/img:opacity-100 text-white"
                                  >
                                      <X size={12} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  )}

                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800/50">
                      <div className="flex gap-2">
                          <input 
                             type="file" 
                             ref={fileInputRef} 
                             className="hidden" 
                             accept="image/*" 
                             multiple 
                             onChange={handleImageUpload} 
                          />
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-slate-500 hover:text-indigo-400 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-900 transition-colors"
                          >
                              <ImageIcon size={14} /> Attach Reference
                          </button>
                      </div>
                      <button 
                        onClick={handleAddNote}
                        disabled={!newNoteText.trim()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium disabled:opacity-50 transition-colors"
                      >
                          Add Note
                      </button>
                  </div>
              </div>
          </div>
      </section>

      {/* 4. Quality Analysis */}
      {!isOffline && data.qualityAnalysis && (
        <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-slate-800 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-100">Quality & Artifacts</h2>
                        <div className="text-xs text-slate-500 mt-1">AI-detected issues and improvements</div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                     {/* Confidence Slider */}
                     <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 h-9" title="Filter issues by confidence">
                        <Filter size={14} className="text-slate-400"/>
                        <span className="text-xs text-slate-500 font-medium">{confidenceThreshold}%</span>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={confidenceThreshold} 
                            onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
                            className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                     </div>

                     <div className="flex items-center gap-2 bg-slate-950 px-2 py-1.5 rounded-lg border border-slate-800 h-9">
                        <Gauge size={14} className="text-slate-400"/>
                        <select 
                            value={passCount}
                            onChange={(e) => setPassCount(Number(e.target.value))}
                            className="bg-transparent text-xs text-slate-300 outline-none border-none cursor-pointer"
                        >
                            <option value="1">1 Pass</option>
                            <option value="3">3 Passes</option>
                            <option value="5">5 Passes</option>
                        </select>
                     </div>
                     
                     <button 
                        onClick={handleRunConsensus}
                        disabled={isRunningConsensus}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 h-9"
                     >
                         {isRunningConsensus ? <Loader2 size={12} className="animate-spin" /> : <Target size={12} />}
                         {isRunningConsensus ? 'Analyzing...' : 'Run Analysis'}
                     </button>

                    <div className="flex flex-row items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 h-9 shrink-0 whitespace-nowrap min-w-fit">
                        <span className="text-xs text-slate-400 uppercase font-bold tracking-wider whitespace-nowrap">Health Score</span>
                        <span className={`text-base font-bold ${getScoreColor(data.qualityAnalysis.overallScore)} whitespace-nowrap`}>
                            {data.qualityAnalysis.overallScore}/10
                        </span>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {filteredIssues.map((issue, idx) => (
                    <div key={issue.id || idx} className="bg-slate-950/50 rounded-lg border border-slate-800 p-4 group relative transition-colors hover:border-slate-700">
                        {editingIssueIndex === idx && editingIssue ? (
                             // Edit Mode
                             <div className="space-y-3">
                                 <div className="flex gap-2">
                                     <select 
                                        className="bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 px-2 py-1"
                                        value={editingIssue.severity}
                                        onChange={(e) => setEditingIssue({ ...editingIssue, severity: e.target.value as any })}
                                     >
                                         <option value="Note">Note</option>
                                         <option value="Minor">Minor</option>
                                         <option value="Major">Major</option>
                                         <option value="Critical">Critical</option>
                                     </select>
                                     <input 
                                        type="text" 
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 px-2 py-1"
                                        value={editingIssue.type}
                                        onChange={(e) => setEditingIssue({ ...editingIssue, type: e.target.value })}
                                     />
                                 </div>
                                 <textarea 
                                    className="w-full bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 px-2 py-2 min-h-[60px]"
                                    value={editingIssue.description}
                                    onChange={(e) => setEditingIssue({ ...editingIssue, description: e.target.value })}
                                    placeholder="Issue Description"
                                 />
                                 
                                 {/* Edit Note Field (in full edit mode) */}
                                 <div className="bg-slate-900/50 p-2 rounded border border-slate-800/50">
                                    <div className="text-xs text-indigo-400 font-bold mb-1 flex items-center gap-1">
                                        <StickyNote size={12} /> Context Note
                                    </div>
                                    <textarea 
                                        className="w-full bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 px-2 py-2 min-h-[40px] select-text"
                                        value={editingIssue.userNotes || ''}
                                        onChange={(e) => setEditingIssue({ ...editingIssue, userNotes: e.target.value })}
                                        placeholder="Add context (e.g., 'Intentional style choice', 'Character is wearing gloves')"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">Changes to notes will trigger a regeneration of fix suggestions.</p>
                                 </div>

                                 <div className="flex justify-end gap-2">
                                     <button onClick={handleCancelEditing} className="px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 rounded">Cancel</button>
                                     <button onClick={() => handleSaveIssue(idx, editingIssue)} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500">Save</button>
                                 </div>
                             </div>
                        ) : (
                            // View Mode
                            <div className="flex flex-col gap-3">
                                <div className="flex items-start gap-4">
                                    <div className="flex flex-col gap-2">
                                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border text-center ${getSeverityColor(issue.severity)}`}>
                                            {issue.severity}
                                        </div>
                                        {issue.confidence !== undefined && (
                                            <div className={`px-2 py-0.5 rounded text-[9px] font-mono border text-center ${getConfidenceColor(issue.confidence)}`} title={`Found in ${issue.passCount} passes`}>
                                                {issue.confidence}% Conf
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 pr-16">
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-slate-200">{issue.type}</span>
                                                {/* Spatial Focus Button */}
                                                {issue.box_2d && onFocusRegion && (
                                                    <button 
                                                        onClick={() => handleFocusIssue(issue)}
                                                        className="p-1 text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-500 rounded transition-all"
                                                        title="Focus on image"
                                                    >
                                                        <ScanEye size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-500">Penalty: -{issue.score}</span>
                                        </div>
                                        <p className="text-slate-400 text-sm">{issue.description}</p>
                                    </div>
                                    
                                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/80 p-1 rounded-lg backdrop-blur-sm z-10">
                                        <button 
                                            onClick={() => toggleNote(issue.id)} 
                                            className={`p-1.5 rounded hover:bg-slate-800 ${issue.userNotes ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 hover:text-indigo-300'}`}
                                            title={expandedNotes.has(issue.id) ? "Hide Note" : "View/Add Note"}
                                        >
                                            <StickyNote size={14} />
                                        </button>
                                        <button onClick={() => handleStartEditing(idx, issue)} className="p-1.5 hover:text-indigo-400 text-slate-500 rounded hover:bg-slate-800"><Edit2 size={14} /></button>
                                        <button onClick={() => handleDeleteIssue(idx)} className="p-1.5 hover:text-red-400 text-slate-500 rounded hover:bg-slate-800"><Trash2 size={14} /></button>
                                    </div>
                                </div>

                                {/* Expandable Note Block */}
                                {expandedNotes.has(issue.id) && (
                                    <div className="animate-in slide-in-from-top-1 duration-200" onClick={(e) => e.stopPropagation()}>
                                        <div className="ml-16 mr-4 p-3 bg-indigo-950/20 border-l-2 border-indigo-500/30 rounded-r text-sm text-slate-300 relative group/note-block">
                                            <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                                                <div className="flex items-center gap-1"><StickyNote size={10} /> User Context Note</div>
                                                {/* Edit controls for note */}
                                                {!editingNoteId && (
                                                     <button 
                                                        onClick={() => handleStartNoteEdit(issue)}
                                                        className="text-[9px] text-slate-500 hover:text-indigo-300 flex items-center gap-1 opacity-50 group-hover/note-block:opacity-100 transition-opacity"
                                                     >
                                                        <Edit2 size={8} /> Edit Note
                                                     </button>
                                                )}
                                            </div>

                                            {editingNoteId === issue.id ? (
                                                <div className="space-y-2">
                                                    <textarea 
                                                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded text-xs text-slate-200 p-2 min-h-[60px] focus:ring-1 focus:ring-indigo-500/50 outline-none select-text"
                                                        value={tempNoteContent}
                                                        onChange={(e) => setTempNoteContent(e.target.value)}
                                                        placeholder="Enter context notes..."
                                                        autoFocus
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={handleCancelNoteEdit}
                                                            className="px-2 py-1 text-[10px] bg-slate-800 text-slate-400 hover:text-slate-300 rounded"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            onClick={() => handleSaveNote(issue)}
                                                            className="px-2 py-1 text-[10px] bg-indigo-600 text-white rounded hover:bg-indigo-500 flex items-center gap-1"
                                                        >
                                                            <Check size={10} /> Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {issue.userNotes ? (
                                                        <p className="italic text-slate-400 cursor-pointer hover:text-slate-300 transition-colors" onClick={() => handleStartNoteEdit(issue)}>
                                                            {issue.userNotes}
                                                        </p>
                                                    ) : (
                                                        <button 
                                                            onClick={() => handleStartNoteEdit(issue)}
                                                            className="text-slate-500 italic hover:text-indigo-400 flex items-center gap-1.5 transition-colors w-full text-left"
                                                        >
                                                            <span className="underline decoration-dotted decoration-slate-600 group-hover/add-note:decoration-indigo-400">No notes added. Click here to add context.</span>
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                
                {/* Add New Issue UI */}
                {newIssue ? (
                     <div className="bg-slate-900/30 rounded-lg border border-dashed border-indigo-500/50 p-4 space-y-3">
                         <div className="text-xs font-bold text-indigo-400 uppercase">Add New Issue</div>
                          <div className="flex gap-2">
                                <select 
                                className="bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 px-2 py-1"
                                value={newIssue.severity || 'Minor'}
                                onChange={(e) => setNewIssue({ ...newIssue, severity: e.target.value as any })}
                                >
                                    <option value="Minor">Minor</option>
                                    <option value="Major">Major</option>
                                    <option value="Critical">Critical</option>
                                </select>
                                <input 
                                type="text" 
                                placeholder="Issue Type (e.g. Hands)"
                                className="flex-1 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 px-2 py-1"
                                value={newIssue.type || ''}
                                onChange={(e) => setNewIssue({ ...newIssue, type: e.target.value })}
                                />
                            </div>
                            <textarea 
                            placeholder="Description of the issue..."
                            className="w-full bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 px-2 py-2 min-h-[60px]"
                            value={newIssue.description || ''}
                            onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                            />
                            
                            {/* Add Note on Creation */}
                            <div className="bg-slate-900/50 p-2 rounded border border-slate-800/50">
                                <div className="text-xs text-indigo-400 font-bold mb-1 flex items-center gap-1">
                                    <StickyNote size={12} /> Context Note (Optional)
                                </div>
                                <textarea 
                                    className="w-full bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 px-2 py-2 min-h-[40px] select-text"
                                    value={newIssue.userNotes || ''}
                                    onChange={(e) => setNewIssue({ ...newIssue, userNotes: e.target.value })}
                                    placeholder="Add context (e.g., 'Intentional style choice')"
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <button onClick={() => setNewIssue(null)} className="px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 rounded">Cancel</button>
                                <button onClick={handleAddIssue} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500">Add & Generate Fix</button>
                            </div>
                     </div>
                ) : (
                    <button 
                        onClick={() => setNewIssue({ severity: 'Minor', score: 0.5, type: '', userNotes: '' })}
                        className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-sm text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={14} /> Add Manual Issue
                    </button>
                )}

                {filteredIssues.length === 0 && !newIssue && (
                    <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/5 p-4 rounded-lg border border-emerald-500/20">
                        <CheckCircle2 size={18} />
                        <span className="text-sm font-medium">
                            {data.qualityAnalysis.issues.length > 0 
                             ? "All issues hidden by confidence threshold." 
                             : "No issues detected. Use the button above to add one manually."}
                        </span>
                    </div>
                )}
            </div>
        </section>
      )}

      {/* 5. Prompt Analysis */}
      {!isOffline && data.promptAnalysis && (
        <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-sm group/section relative overflow-hidden">
            
            {/* Loading Overlay for Refining */}
            {isRefiningPrompt && (
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-10 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                         <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                         <p className="text-sm font-medium text-indigo-200">Updating Analysis based on changes...</p>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                        <Wand2 size={20} />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-100">Prompt Engineering</h2>
                </div>
                
                <div className="flex items-center gap-3">
                    {!editingPromptAnalysis && (
                         <button 
                             onClick={handleStartEditPrompt}
                             className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors opacity-0 group-hover/section:opacity-100"
                             title="Edit Critique"
                         >
                             <Edit2 size={16} />
                         </button>
                    )}
                    {/* Manual Refresh Button */}
                    {!isRefiningPrompt && onRefreshPromptAnalysis && (
                         <button 
                             onClick={() => onRefreshPromptAnalysis(data)}
                             className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors opacity-0 group-hover/section:opacity-100"
                             title="Full Refresh (Regenerate entire section)"
                         >
                             <RefreshCw size={16} />
                         </button>
                    )}
                    
                    <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                        <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Adherence</span>
                        <span className={`text-lg font-bold ${getScoreColor(data.promptAnalysis.adherenceScore)}`}>
                            {data.promptAnalysis.adherenceScore}/10
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Critique</h3>
                    {editingPromptAnalysis ? (
                        <div className="space-y-2">
                             <textarea 
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 min-h-[150px] focus:ring-1 focus:ring-indigo-500 outline-none"
                                value={editedCritique}
                                onChange={(e) => setEditedCritique(e.target.value)}
                             />
                             <div className="flex justify-end gap-2">
                                <button onClick={() => setEditingPromptAnalysis(false)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 rounded">
                                    <XCircle size={12} /> Cancel
                                </button>
                                <button onClick={handleSavePromptAnalysis} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500">
                                    <Save size={12} /> Save Changes
                                </button>
                             </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 text-sm leading-relaxed min-h-[100px]">
                            {data.promptAnalysis.critique}
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Suggested Improvements</h3>
                    <ul className="space-y-2">
                        {/* 1. Render Specific Issue Fixes - Grouped by Linked Issue */}
                        {filteredIssues.map((issue) => {
                           // Support both deprecated suggestedFix and new suggestedFixes array
                           const fixes = issue.suggestedFixes || (issue.suggestedFix ? [issue.suggestedFix] : []);
                           
                           if (fixes.length === 0) return null;

                           return (
                             <li key={issue.id} className="group/item flex flex-col gap-1 text-sm text-slate-300 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg relative hover:bg-indigo-500/10 transition-colors">
                                <div className="flex items-center gap-2 mb-1">
                                    {issue.severity === 'Note' ? (
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                    ) : (
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                                    )}
                                    <span className={`text-xs font-bold ${issue.severity === 'Note' ? 'text-blue-300/80 border-blue-500/20' : 'text-rose-300/80 border-rose-500/20'} border px-1 rounded uppercase`}>
                                        {issue.severity === 'Note' ? 'NOTE: ' : 'FIX: '} {issue.type}
                                    </span>
                                    {issue.confidence && (
                                        <span className={`text-[9px] px-1 rounded border ${getConfidenceColor(issue.confidence)}`}>
                                            {issue.confidence}%
                                        </span>
                                    )}
                                </div>
                                
                                {regeneratingFixForId === issue.id ? (
                                    <span className="inline-flex items-center gap-2 text-slate-400 italic">
                                        <Loader2 size={12} className="animate-spin" /> Updating suggestions...
                                    </span>
                                ) : (
                                    <div className="pl-4 space-y-1">
                                        {fixes.map((fix, fIdx) => (
                                            <div key={fIdx} className="flex items-start gap-2">
                                                <span className="text-indigo-500/50">•</span>
                                                <span className="text-slate-300">{fix}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                             </li>
                           );
                        })}

                        {/* 2. Render General Improvements */}
                        {data.promptAnalysis.improvements.map((tip, idx) => (
                            <li key={`gen-${idx}`} className="group/item flex items-start gap-2.5 text-sm text-slate-300 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg relative hover:bg-indigo-500/10 transition-colors">
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                <span className="flex-1">{tip}</span>
                                <button 
                                    onClick={() => handleDeleteImprovement(idx)}
                                    className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-opacity absolute top-2 right-2"
                                >
                                    <X size={14} />
                                </button>
                            </li>
                        ))}
                        
                        {/* Add Improvement Input */}
                        <li className="flex items-center gap-2 pt-2">
                            <input 
                                type="text"
                                placeholder="Add your own suggestion..."
                                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 outline-none"
                                value={newImprovement}
                                onChange={(e) => setNewImprovement(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddImprovement()}
                            />
                            <button 
                                onClick={handleAddImprovement}
                                disabled={!newImprovement.trim()}
                                className="p-2 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-400 rounded transition-colors disabled:opacity-50 disabled:hover:bg-slate-800"
                            >
                                <Plus size={16} />
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        </section>
      )}

      {/* 6. Workflow Graph (Always Shown) */}
      <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
            <Zap size={20} />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">
             Workflow Graph
          </h2>
        </div>
        
        {workflowData ? (
            <WorkflowGraph workflow={workflowData} />
        ) : (
            <div className="text-slate-500 italic p-4 text-center">No workflow data available to visualize.</div>
        )}
      </section>

      {/* 7. Parameters */}
      <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
            <Sliders size={20} />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">Key Parameters</h2>
          {aiStatus === 'loading' && <Loader2 size={14} className="animate-spin text-slate-500 ml-auto" />}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(data.parameters).map(([key, value]) => (
            (value || value === 0) && (
              <div key={key} className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                  {key}
                </div>
                <div className="text-sm font-mono text-slate-200 break-all">
                  {String(value)}
                </div>
              </div>
            )
          ))}
          {/* Handle empty case */}
          {Object.values(data.parameters).every(v => !v && v !== 0) && (
             <div className="col-span-full text-slate-500 text-sm italic">
                Could not automatically extract standard parameters.
             </div>
          )}
        </div>
      </section>

      {/* 8. Prompts */}
      <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
          <div className="p-2 bg-pink-500/10 rounded-lg text-pink-400">
            <MessageSquare size={20} />
          </div>
          <h2 className="text-xl font-semibold text-slate-100">Prompts</h2>
          {aiStatus === 'loading' && <Loader2 size={14} className="animate-spin text-slate-500 ml-auto" />}
        </div>
        
        <div className="space-y-6">
          {/* Positive Prompts */}
          <div className="grid gap-4">
            {data.prompts.map((prompt, idx) => (
              <div key={idx} className="relative group animate-in slide-in-from-bottom-2 duration-300 fill-mode-both" style={{animationDelay: `${idx * 50}ms`}}>
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg opacity-10 group-hover:opacity-20 transition duration-200"></div>
                <div className="relative bg-slate-950 p-5 rounded-lg border border-slate-800">
                  <div className="text-xs font-bold text-indigo-400 mb-2 uppercase flex items-center gap-2">
                    <Quote size={12} />
                    {prompt.label}
                  </div>
                  <p className="text-slate-300 leading-relaxed text-sm whitespace-pre-wrap font-mono bg-slate-900/50 p-3 rounded border border-slate-900/50">
                    {prompt.text}
                  </p>
                </div>
              </div>
            ))}
             {data.prompts.length === 0 && (
                <div className="text-slate-500 text-sm italic">No positive text prompts found.</div>
            )}
          </div>

          {/* Negative Prompt */}
          {data.negativePrompt && (
             <div className="relative group animate-in slide-in-from-bottom-2 duration-300 fill-mode-both">
               <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 to-red-600 rounded-lg opacity-10 group-hover:opacity-20 transition duration-200"></div>
               <div className="relative bg-slate-950 p-5 rounded-lg border border-slate-800">
                 <div className="text-xs font-bold text-rose-400 mb-2 uppercase flex items-center gap-2">
                   <Quote size={12} />
                   Negative Prompt
                 </div>
                 <p className="text-slate-300 leading-relaxed text-sm whitespace-pre-wrap font-mono bg-slate-900/50 p-3 rounded border border-slate-900/50">
                   {data.negativePrompt}
                 </p>
               </div>
             </div>
          )}
        </div>
      </section>

    </div>
  );
};
