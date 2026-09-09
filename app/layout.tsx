import type { Metadata } from 'next';
import { Inter, Inter_Tight } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  display: 'swap',
});

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
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${interTight.variable}`}>
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-[200] focus:bg-surface-inverted focus:text-text-inverse focus:px-4 focus:py-2 focus:m-2"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
