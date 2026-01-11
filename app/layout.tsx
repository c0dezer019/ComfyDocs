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
      <body className="antialiased">{children}</body>
    </html>
  );
}
