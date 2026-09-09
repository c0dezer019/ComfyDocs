import Link from 'next/link';
import { LegalFooter } from './LegalFooter';

export function LegalLayout({
  title,
  eyebrow = 'Legal',
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-page font-sans text-text">
      <header className="border-b border-border bg-page">
        <div className="mx-auto flex min-h-16 max-w-[var(--page-max-width)] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-heading text-xl font-semibold tracking-tight">
            ComfyDocs
          </Link>
          <Link href="/" className="text-sm text-text-secondary hover:text-text">
            Back to app
          </Link>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
          {eyebrow}
        </p>
        <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <div className="mt-10 space-y-8 text-[15px] leading-7 text-text-secondary">{children}</div>
      </main>
      <LegalFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-heading text-2xl font-semibold tracking-tight text-text">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function LaunchPlaceholder() {
  return (
    <aside className="rounded-card border border-status-warning/30 bg-status-warning/10 p-4 text-sm text-text">
      <strong>Before launch:</strong> replace bracketed fields such as [LEGAL ENTITY NAME],
      [JURISDICTION], and [LEGAL CONTACT EMAIL]. Have counsel review these notices for the
      jurisdictions where you operate and where the service is offered.
    </aside>
  );
}
