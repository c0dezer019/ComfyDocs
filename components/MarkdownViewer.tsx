import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownViewerProps {
  content: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  return (
    <div className="prose prose-invert prose-slate max-w-none p-6 bg-slate-900/50 rounded-lg border border-slate-800 shadow-xl break-words">
      <ReactMarkdown
        components={{
          h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-indigo-300 mb-4 pb-2 border-b border-slate-700" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-xl font-semibold text-slate-100 mt-6 mb-3" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-lg font-medium text-slate-200 mt-4 mb-2" {...props} />,
          p: ({node, ...props}) => <p className="text-slate-300 leading-relaxed mb-4" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc list-inside text-slate-300 mb-4 space-y-1" {...props} />,
          li: ({node, ...props}) => <li className="text-slate-300" {...props} />,
          strong: ({node, ...props}) => <strong className="text-indigo-200 font-semibold" {...props} />,
          code: ({node, ...props}) => <code className="bg-slate-800 text-pink-300 px-1.5 py-0.5 rounded text-sm font-mono break-all" {...props} />,
          pre: ({node, ...props}) => <pre className="bg-slate-950 p-4 rounded-lg overflow-x-auto text-slate-200 my-4 border border-slate-800" {...props} />,
          a: ({node, ...props}) => <a className="text-indigo-300 hover:text-indigo-200 underline decoration-indigo-300/30 underline-offset-2 transition-colors" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500/50 pl-4 italic text-slate-400 my-4" {...props} />,
          table: ({node, ...props}) => <div className="overflow-x-auto my-6 border border-slate-800 rounded-lg"><table className="w-full text-left text-sm text-slate-300" {...props} /></div>,
          th: ({node, ...props}) => <th className="bg-slate-800/50 p-3 font-semibold text-slate-200 border-b border-slate-700" {...props} />,
          td: ({node, ...props}) => <td className="p-3 border-b border-slate-800" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
