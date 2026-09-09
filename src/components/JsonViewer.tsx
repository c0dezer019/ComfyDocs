'use client';

import React, { useState } from 'react';
import { Copy, Download, Check } from 'lucide-react';

interface JsonViewerProps {
  data: unknown;
  filename: string;
  label: string;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data, filename, label }) => {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!data) {
    return (
      <div className="rounded-card border border-border bg-surface-muted p-8 text-center text-text-secondary">
        No {label} data found in this image.
      </div>
    );
  }

  return (
    <div className="flex h-[75vh] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border bg-surface-muted px-4 py-3">
        <h3 className="font-heading font-semibold text-text">{label}</h3>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-button border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-muted"
          >
            {copied ? <Check size={14} className="text-status-success" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-button bg-accent px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-accent-hover"
          >
            <Download size={14} />
            Download .json
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-surface-muted p-4">
        <pre className="whitespace-pre font-mono text-xs leading-relaxed text-text">
          {jsonString}
        </pre>
      </div>
    </div>
  );
};
