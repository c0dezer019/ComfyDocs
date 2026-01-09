
import React, { useState } from 'react';
import { SceneDocumentation } from '../types';
import { Download, Printer, FileText, ImageDown, CheckCircle2, FileJson } from 'lucide-react';
import { embedReportInPng } from '../utils/pngWriter';

interface ReportViewerProps {
  data: SceneDocumentation;
  imageSrc: string | null;
  originalFile: File | null;
  fileHash: string | null;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ data, imageSrc, originalFile, fileHash }) => {
  const [isEmbedLoading, setIsEmbedLoading] = useState(false);

  const handlePrint = () => {
    // Small delay ensures UI is ready, though standard sync print() usually works.
    setTimeout(() => window.print(), 10);
  };

  const handleDownloadMd = () => {
    const md = `
# ComfyDocs Forensic Report
**Date:** ${new Date().toLocaleDateString()}
**File Hash:** ${fileHash || 'N/A'}
**Overall Score:** ${data.qualityAnalysis?.overallScore || 'N/A'}/10

## Executive Summary
${data.sceneOverview.map(s => `- **${s.category}:** ${s.details}`).join('\n')}

## Narrative Context
${data.sceneBackstory || "No backstory provided."}

## Quality Assurance
${data.qualityAnalysis?.issues.map(i => `
### ${i.type} (${i.severity})
* **Description:** ${i.description}
* **Score Impact:** ${i.severity === 'Note' ? 'None' : '-' + i.score}
* **Fix:** ${i.suggestedFixes?.join(', ')}
`).join('\n') || "No issues detected."}

## Technical Profile
* **Model:** ${data.parameters.model}
* **Seed:** ${data.parameters.seed}
* **Sampler:** ${data.parameters.sampler}
* **Steps:** ${data.parameters.steps} | **CFG:** ${data.parameters.cfg}

## Prompt Audit
**Adherence Score:** ${data.promptAnalysis?.adherenceScore}/10
**Critique:** ${data.promptAnalysis?.critique}
    `;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${fileHash?.substring(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEmbedAndDownload = async () => {
    if (!originalFile) return;
    setIsEmbedLoading(true);
    try {
        const reportStr = JSON.stringify(data, null, 2);
        const newBlob = await embedReportInPng(originalFile, reportStr);
        
        const url = URL.createObjectURL(newBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audited-${originalFile.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Failed to embed report", e);
        alert("Failed to embed report into image.");
    } finally {
        setIsEmbedLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Action Bar (Hidden when printing) */}
      <div className="w-full max-w-[210mm] mb-6 flex justify-between items-center no-print">
         <div className="text-sm text-slate-400">
             Report View & Export
         </div>
         <div className="flex gap-3">
             <button onClick={handleDownloadMd} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-colors">
                 <FileText size={16} /> MD
             </button>
             <button 
                onClick={handleEmbedAndDownload} 
                disabled={!originalFile || isEmbedLoading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
             >
                 {isEmbedLoading ? <FileJson size={16} className="animate-spin" /> : <ImageDown size={16} />}
                 {isEmbedLoading ? 'Embedding...' : 'Save to PNG'}
             </button>
             <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-500/20 transition-all">
                 <Printer size={16} /> Print / Save PDF
             </button>
         </div>
      </div>

      {/* A4 Paper Container */}
      <div className="print-only bg-white text-slate-900 w-full max-w-[210mm] min-h-[297mm] p-[15mm] shadow-2xl rounded-sm mx-auto relative">
         
         {/* Header */}
         <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end">
             <div>
                 <h1 className="text-3xl font-serif font-bold text-slate-900 mb-2">Forensic Audit Report</h1>
                 <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">ComfyDocs Automated Analysis</p>
             </div>
             <div className="text-right">
                 <div className="text-sm font-mono text-slate-500 mb-1">{new Date().toLocaleDateString()}</div>
                 <div className="text-[10px] font-mono text-slate-400">ID: {fileHash?.substring(0, 12)}</div>
             </div>
         </div>

         {/* Score & Image */}
         <div className="grid grid-cols-12 gap-8 mb-10 avoid-break">
             <div className="col-span-8 flex flex-col gap-6">
                 {/* Summary Stats */}
                 <div className="flex gap-4">
                     <div className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded">
                         <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Quality Score</div>
                         <div className={`text-3xl font-black ${data.qualityAnalysis?.overallScore && data.qualityAnalysis.overallScore >= 8 ? 'text-emerald-600' : 'text-slate-900'}`}>
                             {data.qualityAnalysis?.overallScore || 'N/A'}<span className="text-sm text-slate-400 font-normal">/10</span>
                         </div>
                     </div>
                     <div className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded">
                         <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Adherence</div>
                         <div className="text-3xl font-black text-slate-900">
                             {data.promptAnalysis?.adherenceScore || 'N/A'}<span className="text-sm text-slate-400 font-normal">/10</span>
                         </div>
                     </div>
                 </div>

                 {/* Executive Summary */}
                 <div>
                     <h3 className="font-serif font-bold text-lg mb-3 border-b border-slate-200 pb-1">Executive Summary</h3>
                     <div className="space-y-2">
                        {data.sceneOverview.map((s, i) => (
                            <div key={i} className="text-sm leading-relaxed">
                                <span className="font-bold text-slate-700 uppercase text-xs tracking-wide mr-2">{s.category}:</span>
                                {s.details}
                            </div>
                        ))}
                     </div>
                 </div>
                 
                 {data.sceneBackstory && (
                    <div className="mt-4 p-4 bg-slate-50 border-l-4 border-slate-300 italic text-sm text-slate-700">
                        {data.sceneBackstory}
                    </div>
                 )}
             </div>

             <div className="col-span-4">
                 {imageSrc && (
                     <div className="border border-slate-200 p-2 shadow-sm bg-white rotate-1">
                         <img src={imageSrc} className="w-full h-auto object-cover" alt="Subject" />
                     </div>
                 )}
             </div>
         </div>

         {/* Technical Profile */}
         <div className="mb-10 avoid-break">
             <h3 className="font-serif font-bold text-lg mb-4 border-b border-slate-200 pb-1">Technical Profile</h3>
             <div className="grid grid-cols-4 gap-4 text-xs">
                 <div className="p-3 bg-slate-50 rounded border border-slate-100">
                     <div className="font-bold text-slate-500 uppercase mb-1">Model</div>
                     <div className="font-mono truncate">{data.parameters.model || 'Unknown'}</div>
                 </div>
                 <div className="p-3 bg-slate-50 rounded border border-slate-100">
                     <div className="font-bold text-slate-500 uppercase mb-1">Sampler</div>
                     <div className="font-mono">{data.parameters.sampler}</div>
                 </div>
                 <div className="p-3 bg-slate-50 rounded border border-slate-100">
                     <div className="font-bold text-slate-500 uppercase mb-1">Steps / CFG</div>
                     <div className="font-mono">{data.parameters.steps} / {data.parameters.cfg}</div>
                 </div>
                 <div className="p-3 bg-slate-50 rounded border border-slate-100">
                     <div className="font-bold text-slate-500 uppercase mb-1">Seed</div>
                     <div className="font-mono">{data.parameters.seed}</div>
                 </div>
             </div>
         </div>

         {/* Issues Table */}
         <div className="mb-10 avoid-break">
             <h3 className="font-serif font-bold text-lg mb-4 border-b border-slate-200 pb-1">Quality Assurance Log</h3>
             <table className="w-full text-sm text-left">
                 <thead>
                     <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500 bg-slate-50">
                         <th className="py-2 px-2 w-24">Severity</th>
                         <th className="py-2 px-2 w-32">Type</th>
                         <th className="py-2 px-2">Description & Remediation</th>
                         <th className="py-2 px-2 w-16 text-right">Score</th>
                     </tr>
                 </thead>
                 <tbody>
                     {data.qualityAnalysis?.issues.map((issue, idx) => (
                         <tr key={idx} className="border-b border-slate-100">
                             <td className="py-3 px-2">
                                 <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                     issue.severity === 'Critical' ? 'bg-red-50 text-red-600 border-red-200' :
                                     issue.severity === 'Major' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                     issue.severity === 'Minor' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                     'bg-blue-50 text-blue-600 border-blue-200'
                                 }`}>
                                     {issue.severity === 'Note' ? '-' : issue.severity}
                                 </span>
                             </td>
                             <td className="py-3 px-2 font-medium text-slate-700">{issue.type}</td>
                             <td className="py-3 px-2">
                                 <div className="text-slate-800 mb-1">{issue.description}</div>
                                 {issue.suggestedFixes && (
                                     <div className="text-xs text-slate-500 italic">
                                         <span className="font-bold not-italic text-slate-400">Fix: </span> 
                                         {issue.suggestedFixes.join(', ')}
                                     </div>
                                 )}
                             </td>
                             <td className="py-3 px-2 text-right font-mono text-red-500 font-medium">
                                {issue.score > 0 ? `-${issue.score}` : '-'}
                             </td>
                         </tr>
                     )) || (
                        <tr><td colSpan={4} className="py-4 text-center text-slate-400 italic">No issues detected.</td></tr>
                     )}
                 </tbody>
             </table>
         </div>

         {/* Prompt Audit */}
         <div className="avoid-break">
            <h3 className="font-serif font-bold text-lg mb-4 border-b border-slate-200 pb-1">Prompt Engineering Audit</h3>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded text-sm text-slate-800 leading-relaxed mb-4">
                {data.promptAnalysis?.critique}
            </div>
            {data.promptAnalysis?.improvements && data.promptAnalysis.improvements.length > 0 && (
                <div>
                    <div className="text-xs font-bold uppercase text-slate-500 mb-2">Recommended Improvements</div>
                    <ul className="list-none space-y-1">
                        {data.promptAnalysis.improvements.map((imp, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                                <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                                <span className="text-slate-700">{imp}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
         </div>

         {/* Footer */}
         <div className="absolute bottom-8 left-12 right-12 border-t border-slate-200 pt-4 flex justify-between text-[10px] text-slate-400 uppercase tracking-widest font-mono">
             <div>Generated by ComfyDocs</div>
             <div>Page 1 of 1</div>
         </div>

      </div>
    </div>
  );
};
