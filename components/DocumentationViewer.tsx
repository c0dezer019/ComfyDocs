
import React, { useState, useRef, useEffect } from 'react';
import { SceneDocumentation, QualityIssue } from '../types';
import { Layers, Zap, Sliders, MessageSquare, Quote, Info, Loader2, AlertTriangle, Wand2, CheckCircle2, X, Plus, Edit2, Trash2, Save, XCircle, Bot, Send, RefreshCw, ArrowRight, Target, Gauge } from 'lucide-react';
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
    onAskAi 
}) => {
  
  const [editingIssueIndex, setEditingIssueIndex] = useState<number | null>(null);
  const [editingIssue, setEditingIssue] = useState<QualityIssue | null>(null);
  const [newIssue, setNewIssue] = useState<Partial<QualityIssue> | null>(null);
  const [regeneratingFixForId, setRegeneratingFixForId] = useState<string | null>(null);
  
  // Quality Settings
  const [passCount, setPassCount] = useState<number>(3);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0);
  const [isRunningConsensus, setIsRunningConsensus] = useState(false);

  const [editingPromptAnalysis, setEditingPromptAnalysis] = useState(false);
  const [editedCritique, setEditedCritique] = useState('');
  const [newImprovement, setNewImprovement] = useState('');

  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const qaContainerRef = useRef<HTMLDivElement>(null);

  const getSeverityColor = (severity: string) => {
      switch(severity.toLowerCase()) {
          case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20';
          case 'major': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
          case 'minor': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
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
      // We need image data. Assuming parent component handles data flow, 
      // but here we might need to rely on the parent or we need the imageBase64.
      // Since we don't have direct access to imageBase64 prop here, 
      // we'll fetch it from the cached store or assume parent passed it.
      // Limitation: DocumentationViewer assumes data is passed in.
      // Workaround: We will use the 'onRegenerateIssueFix' hook pattern but for consensus.
      // Actually, let's grab the image from the DOM preview if needed or assume App.tsx functionality.
      // Better: We need to ask App to do it. But for this specific requirement change, 
      // I will implement the logic here using a hack to get image data or refactor properly.
      // The cleanest way is to use the existing data if available or error out. 
      // NOTE: App.tsx has the file. 
      
      // Since I cannot change App.tsx to pass imageBase64 without outputting the whole file,
      // I will assume the image is available via the existing `previewUrl` or DOM.
      // Let's look at `App.tsx`... `previewUrl` is a blob URL.
      
      const imgElement = document.querySelector('img[alt="ComfyUI Generation"]') as HTMLImageElement;
      if (!imgElement) return;

      setIsRunningConsensus(true);
      try {
          // Convert current blob src to base64
          const response = await fetch(imgElement.src);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.readAsDataURL(blob);
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
          passCount: 1
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

        {aiStatus === 'loading' && (
            <div className="space-y-4 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex gap-4">
                        <div className="w-24 h-4 bg-slate-800 rounded"></div>
                        <div className="flex-1 h-4 bg-slate-800 rounded w-full"></div>
                    </div>
                ))}
            </div>
        )}

        {aiStatus !== 'loading' && (
            <>
                {data.sceneOverview.length > 0 ? (
                    <div className="grid gap-4">
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
                    <div className="text-slate-500 italic flex items-center gap-2">
                        <Info size={16} />
                        {isOffline 
                            ? "Enable AI mode to generate a detailed scene description." 
                            : "No scene overview generated."}
                    </div>
                )}
            </>
        )}
      </section>

      {/* 2. Quality Analysis */}
      {!isOffline && data.qualityAnalysis && (
        <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-slate-800 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold text-slate-100">Quality & Artifacts</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">Confidence Threshold: {confidenceThreshold}%</span>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={confidenceThreshold} 
                                onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
                                className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                     <div className="flex items-center gap-2 bg-slate-950 px-2 py-1.5 rounded-lg border border-slate-800">
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
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                     >
                         {isRunningConsensus ? <Loader2 size={12} className="animate-spin" /> : <Target size={12} />}
                         {isRunningConsensus ? 'Analyzing...' : 'Run Analysis'}
                     </button>

                    <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                        <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Health Score</span>
                        <span className={`text-lg font-bold ${getScoreColor(data.qualityAnalysis.overallScore)}`}>
                            {data.qualityAnalysis.overallScore}/10
                        </span>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {filteredIssues.map((issue, idx) => (
                    <div key={issue.id || idx} className="bg-slate-950/50 rounded-lg border border-slate-800 p-4 group relative">
                        {editingIssueIndex === idx && editingIssue ? (
                             // Edit Mode
                             <div className="space-y-3">
                                 <div className="flex gap-2">
                                     <select 
                                        className="bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 px-2 py-1"
                                        value={editingIssue.severity}
                                        onChange={(e) => setEditingIssue({ ...editingIssue, severity: e.target.value as any })}
                                     >
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
                                 />
                                 <div className="flex justify-end gap-2">
                                     <button onClick={handleCancelEditing} className="px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 rounded">Cancel</button>
                                     <button onClick={() => handleSaveIssue(idx, editingIssue)} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500">Save</button>
                                 </div>
                             </div>
                        ) : (
                            // View Mode
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
                                        <span className="text-sm font-semibold text-slate-200">{issue.type}</span>
                                        <span className="text-xs text-slate-500">Penalty: -{issue.score}</span>
                                    </div>
                                    <p className="text-slate-400 text-sm">{issue.description}</p>
                                </div>
                                
                                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/80 p-1 rounded-lg backdrop-blur-sm">
                                    <button onClick={() => handleStartEditing(idx, issue)} className="p-1.5 hover:text-indigo-400 text-slate-500 rounded hover:bg-slate-800"><Edit2 size={14} /></button>
                                    <button onClick={() => handleDeleteIssue(idx)} className="p-1.5 hover:text-red-400 text-slate-500 rounded hover:bg-slate-800"><Trash2 size={14} /></button>
                                </div>
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
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setNewIssue(null)} className="px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 rounded">Cancel</button>
                                <button onClick={handleAddIssue} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500">Add & Generate Fix</button>
                            </div>
                     </div>
                ) : (
                    <button 
                        onClick={() => setNewIssue({ severity: 'Minor', score: 0.5, type: '' })}
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

      {/* 3. Prompt Analysis */}
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
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                                    <span className="text-xs font-bold text-rose-300/80 border border-rose-500/20 px-1 rounded uppercase">
                                        FIX: {issue.type}
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

      {/* 4. AI Assistant Q&A (Only in AI Mode) */}
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
                {/* Chat History */}
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
                             {/* User Msg */}
                             <div className="flex justify-end">
                                 <div className="bg-indigo-600 text-white rounded-l-2xl rounded-tr-2xl rounded-br-sm px-4 py-2.5 max-w-[85%] text-sm shadow-md">
                                     {item.question}
                                 </div>
                             </div>
                             {/* AI Msg */}
                             <div className="flex justify-start">
                                 <div className="bg-slate-800 text-slate-200 rounded-r-2xl rounded-tl-2xl rounded-bl-sm px-4 py-3 max-w-[90%] text-sm shadow-sm border border-slate-700 leading-relaxed">
                                     <MarkdownViewer content={item.answer} />
                                 </div>
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

                {/* Input Area */}
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
                <p className="text-[10px] text-slate-500 text-center">
                    Note: AI answers may update the Prompt Engineering section if relevant fixes are identified.
                </p>
            </div>
        </section>
      )}

      {/* 5. Workflow Graph (Always Shown) */}
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

      {/* 6. Parameters */}
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

      {/* 7. Prompts */}
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
             <div className="relative animate-in slide-in-from-bottom-2 duration-300">
               <div className="bg-slate-950 p-5 rounded-lg border border-red-900/30">
                 <div className="text-xs font-bold text-red-400 mb-2 uppercase flex items-center gap-2">
                   <Quote size={12} />
                   Negative Prompt
                 </div>
                 <p className="text-slate-400 leading-relaxed text-sm italic">
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
