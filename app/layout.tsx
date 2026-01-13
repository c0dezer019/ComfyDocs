import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ComfyDocs | ComfyUI Forensic Documentation',
  description:
    'AI-powered metadata extraction and scene documentation for ComfyUI generations. Recover workflows and analyze image quality with Gemini.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-[200] focus:bg-indigo-600 focus:text-white focus:px-4 focus:py-2 focus:m-2"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
