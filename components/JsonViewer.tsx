import React, { useState } from 'react';
import { Copy, Download, Check } from 'lucide-react';

interface JsonViewerProps {
  data: any;
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
      <div className="p-8 text-center text-slate-400 bg-slate-900/50 rounded-lg border border-slate-800">
        No {label} data found in this image.
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-slate-900 rounded-lg border border-slate-800 overflow-hidden shadow-xl h-[75vh]">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700">
        <h3 className="font-semibold text-slate-200">{label}</h3>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors"
          >
            <Download size={14} />
            Download .json
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-[#0d1117]">
        <pre className="text-xs font-mono text-slate-200 leading-relaxed whitespace-pre">
          {jsonString}
        </pre>
      </div>
    </div>
  );
};
