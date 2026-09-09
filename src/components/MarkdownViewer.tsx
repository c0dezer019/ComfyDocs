'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownViewerProps {
  content: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content }) => {
  return (
    <div className="prose max-w-none break-words rounded-card border border-border bg-surface p-6 text-text shadow-card">
      <ReactMarkdown
        components={{
          h1: ({ children, ...props }) => (
            <h1
              className="mb-4 border-b border-border pb-2 font-heading text-2xl font-semibold text-text"
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="mt-6 mb-3 font-heading text-xl font-semibold text-text" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="mt-4 mb-2 font-heading text-lg font-medium text-text" {...props}>
              {children}
            </h3>
          ),
          p: ({ ...props }) => (
            <p className="mb-4 leading-relaxed text-text-secondary" {...props} />
          ),
          ul: ({ ...props }) => (
            <ul className="mb-4 list-inside list-disc space-y-1 text-text-secondary" {...props} />
          ),
          li: ({ ...props }) => <li className="text-text-secondary" {...props} />,
          strong: ({ ...props }) => <strong className="font-semibold text-text" {...props} />,
          code: ({ ...props }) => (
            <code
              className="break-all rounded bg-surface-muted px-1.5 py-0.5 font-mono text-sm text-text"
              {...props}
            />
          ),
          pre: ({ ...props }) => (
            <pre
              className="my-4 overflow-x-auto rounded-input border border-border bg-surface-muted p-4 text-text"
              {...props}
            />
          ),
          a: ({ children, ...props }) => (
            <a
              className="text-status-info underline decoration-status-info/40 underline-offset-2 transition-colors hover:text-text"
              {...props}
            >
              {children}
            </a>
          ),
          blockquote: ({ ...props }) => (
            <blockquote
              className="my-4 border-l-4 border-accent pl-4 italic text-text-secondary"
              {...props}
            />
          ),
          table: ({ ...props }) => (
            <div className="my-6 overflow-x-auto rounded-input border border-border">
              <table className="w-full text-left text-sm text-text-secondary" {...props} />
            </div>
          ),
          th: ({ ...props }) => (
            <th
              className="border-b border-border bg-surface-muted p-3 font-semibold text-text"
              {...props}
            />
          ),
          td: ({ ...props }) => <td className="border-b border-border p-3" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
