'use client';

import React, { useState } from 'react';
import { SceneDocumentation } from '@/lib/types';
import { Printer, FileText, ImageDown, CheckCircle2, FileJson } from 'lucide-react';
import { embedReportInPng } from '@/utils/pngWriter';

interface ReportViewerProps {
  data: SceneDocumentation;
  imageSrc: string | null;
  originalFile: File | null;
  fileHash: string | null;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({
  data,
  imageSrc,
  originalFile,
  fileHash,
}) => {
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
${data.sceneOverview.map((s) => `- **${s.category}:** ${s.details}`).join('\n')}

## Narrative Context
${data.sceneBackstory || 'No backstory provided.'}

## Quality Assurance
${
  data.qualityAnalysis?.issues
    .map(
      (i) => `
### ${i.type} (${i.severity})
* **Description:** ${i.description}
* **Score Impact:** ${i.severity === 'Note' ? 'None' : '-' + i.score}
* **Fix:** ${i.suggestedFixes?.join(', ')}
`,
    )
    .join('\n') || 'No issues detected.'
}

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
      console.error('Failed to embed report', e);
      alert('Failed to embed report into image.');
    } finally {
      setIsEmbedLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Action Bar (Hidden when printing) */}
      <div className="mb-6 flex w-full max-w-[210mm] flex-col gap-3 no-print sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-text-secondary">Report View & Export</div>
        <div className="flex flex-wrap gap-2 sm:justify-end sm:gap-3">
          <button
            onClick={handleDownloadMd}
            className="flex items-center gap-2 rounded-button border border-border bg-surface px-4 py-2 text-xs font-semibold text-text transition-colors hover:bg-surface-muted"
          >
            <FileText size={16} /> MD
          </button>
          <button
            onClick={handleEmbedAndDownload}
            disabled={!originalFile || isEmbedLoading}
            className="flex items-center gap-2 rounded-button border border-border bg-surface px-4 py-2 text-xs font-semibold text-status-success transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            {isEmbedLoading ? (
              <FileJson size={16} className="animate-spin" />
            ) : (
              <ImageDown size={16} />
            )}
            {isEmbedLoading ? 'Embedding...' : 'Save to PNG'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-button bg-accent px-5 py-2 text-xs font-semibold text-text shadow-card transition-colors hover:bg-accent-hover"
          >
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* A4 Paper Container */}
      <div className="print-only relative mx-auto w-full max-w-[210mm] rounded-sm bg-surface p-4 text-text shadow-preview sm:p-8 print:min-h-[297mm] print:p-[15mm]">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 border-b-2 border-text pb-4 sm:flex-row sm:items-end sm:justify-between print:flex-row print:items-end print:justify-between">
          <div>
            <h1 className="mb-1 font-heading text-2xl font-semibold text-text">
              Forensic Audit Report
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
              ComfyDocs Automated Analysis
            </p>
          </div>
          <div className="text-left sm:text-right print:text-right">
            <div className="mb-1 font-mono text-xs text-text-secondary">
              {new Date().toLocaleDateString()}
            </div>
            <div className="font-mono text-[10px] text-text-muted">
              ID: {fileHash?.substring(0, 12)}
            </div>
          </div>
        </div>

        {/* Score & Image */}
        <div className="mb-8 grid gap-6 avoid-break md:grid-cols-12 print:grid-cols-12">
          <div className="flex flex-col gap-4 md:col-span-8 print:col-span-8">
            {/* Summary Stats */}
            <div className="flex flex-col gap-3 min-[420px]:flex-row print:flex-row">
              <div className="flex-1 rounded-input border border-border bg-surface-muted p-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
                  Quality Score
                </div>
                <div
                  className={`text-2xl font-semibold ${data.qualityAnalysis?.overallScore && data.qualityAnalysis.overallScore >= 8 ? 'text-status-success' : 'text-text'}`}
                >
                  {data.qualityAnalysis?.overallScore || 'N/A'}
                  <span className="text-xs font-normal text-text-muted">/10</span>
                </div>
              </div>
              <div className="flex-1 rounded-input border border-border bg-surface-muted p-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
                  Adherence
                </div>
                <div className="text-2xl font-semibold text-text">
                  {data.promptAnalysis?.adherenceScore || 'N/A'}
                  <span className="text-xs font-normal text-text-muted">/10</span>
                </div>
              </div>
            </div>

            {/* Executive Summary */}
            <div>
              <h3 className="mb-2 border-b border-border pb-1 font-heading text-base font-semibold text-text">
                Executive Summary
              </h3>
              <div className="space-y-1.5">
                {data.sceneOverview.map((s, i) => (
                  <div key={i} className="text-xs leading-relaxed">
                    <span className="mr-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                      {s.category}:
                    </span>
                    {s.details}
                  </div>
                ))}
              </div>
            </div>

            {data.sceneBackstory && (
              <div className="mt-2 border-l-4 border-accent bg-surface-muted p-3 text-xs italic text-text-secondary">
                {data.sceneBackstory}
              </div>
            )}
          </div>

          <div className="md:col-span-4 print:col-span-4">
            {imageSrc && (
              <div className="rotate-1 border border-border bg-surface p-1 shadow-subtle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  className="w-full h-auto object-cover"
                  alt="ComfyUI generation under forensic analysis"
                />
              </div>
            )}
          </div>
        </div>

        {/* Technical Profile */}
        <div className="mb-8 avoid-break">
          <h3 className="mb-3 border-b border-border pb-1 font-heading text-base font-semibold text-text">
            Technical Profile
          </h3>
          <div className="grid grid-cols-1 gap-3 text-[10px] min-[420px]:grid-cols-2 md:grid-cols-4 print:grid-cols-4">
            <div className="rounded-input border border-border bg-surface-muted p-2">
              <div className="mb-0.5 text-text-secondary font-semibold uppercase">Model</div>
              <div className="font-mono truncate">{data.parameters.model || 'Unknown'}</div>
            </div>
            <div className="rounded-input border border-border bg-surface-muted p-2">
              <div className="mb-0.5 text-text-secondary font-semibold uppercase">Sampler</div>
              <div className="font-mono">{data.parameters.sampler}</div>
            </div>
            <div className="rounded-input border border-border bg-surface-muted p-2">
              <div className="mb-0.5 text-text-secondary font-semibold uppercase">Steps / CFG</div>
              <div className="font-mono">
                {data.parameters.steps} / {data.parameters.cfg}
              </div>
            </div>
            <div className="rounded-input border border-border bg-surface-muted p-2">
              <div className="mb-0.5 text-text-secondary font-semibold uppercase">Seed</div>
              <div className="font-mono">{data.parameters.seed}</div>
            </div>
          </div>
        </div>

        {/* Issues Table */}
        <div className="mb-8">
          <h3 className="mb-3 border-b border-border pb-1 font-heading text-base font-semibold text-text">
            Quality Assurance Log
          </h3>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[36rem] text-left text-xs print:min-w-0">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-[10px] font-semibold uppercase text-text-secondary">
                  <th scope="col" className="py-2 px-2 w-20">
                    Severity
                  </th>
                  <th scope="col" className="py-2 px-2 w-28">
                    Type
                  </th>
                  <th scope="col" className="py-2 px-2">
                    Description & Remediation
                  </th>
                  <th scope="col" className="py-2 px-2 w-12 text-right">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.qualityAnalysis?.issues.map((issue, idx) => (
                  <tr key={idx} className="break-inside-avoid border-b border-border">
                    <td className="py-2 px-2 align-top">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                          issue.severity === 'Critical'
                            ? 'border-status-error/30 bg-status-error/10 text-status-error'
                            : issue.severity === 'Major'
                              ? 'border-status-warning/30 bg-status-warning/10 text-status-warning'
                              : issue.severity === 'Minor'
                                ? 'border-status-warning/30 bg-status-warning/10 text-status-warning'
                                : 'border-border bg-surface-muted text-text-secondary'
                        }`}
                      >
                        {issue.severity === 'Note' ? '—' : issue.severity}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-top font-medium text-text-secondary">
                      {issue.type}
                    </td>
                    <td className="py-2 px-2 align-top">
                      <div className="mb-1 leading-snug text-text">{issue.description}</div>
                      {issue.suggestedFixes && (
                        <div className="text-[10px] italic leading-tight text-text-secondary">
                          <span className="font-semibold not-italic text-text-muted">Fix: </span>
                          {issue.suggestedFixes.join(', ')}
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-2 py-2 text-right align-top font-mono font-medium ${issue.score > 0 ? 'text-status-error' : 'text-text-muted'}`}
                    >
                      {issue.score > 0 ? `-${issue.score}` : '-'}
                    </td>
                  </tr>
                )) || (
                  <tr>
                    <td colSpan={4} className="py-4 text-center italic text-text-muted">
                      No issues detected.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Prompt Audit */}
        <div className="avoid-break">
          <h3 className="mb-3 border-b border-border pb-1 font-heading text-base font-semibold text-text">
            Prompt Engineering Audit
          </h3>
          <div className="mb-3 rounded-input border border-border bg-surface-muted p-3 text-xs leading-relaxed text-text">
            {data.promptAnalysis?.critique}
          </div>
          {data.promptAnalysis?.improvements && data.promptAnalysis.improvements.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase text-text-secondary">
                Recommended Improvements
              </div>
              <ul className="list-none space-y-1">
                {data.promptAnalysis.improvements.map((imp, i) => (
                  <li key={i} className="text-xs flex items-start gap-2">
                    <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-status-success" />
                    <span className="text-text-secondary">{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col gap-1 border-t border-border pt-3 font-mono text-[8px] uppercase tracking-widest text-text-muted sm:flex-row sm:justify-between print:absolute print:right-12 print:bottom-6 print:left-12 print:mt-0">
          <div>Generated by ComfyDocs</div>
          <div>Page 1 of 1</div>
        </div>
      </div>
    </div>
  );
};
