import Link from 'next/link';

export function LegalFooter() {
  return (
    <footer className="border-t border-border bg-surface px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-[var(--page-max-width)] flex-col gap-4 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} ComfyDocs. All rights reserved.</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link className="hover:text-text" href="/legal/privacy">
            Privacy
          </Link>
          <Link className="hover:text-text" href="/legal/terms">
            Terms
          </Link>
          <Link className="hover:text-text" href="/legal/eula">
            EULA
          </Link>
          <Link className="hover:text-text" href="/legal/copyright">
            Copyright
          </Link>
          <Link className="hover:text-text" href="/legal/accessibility">
            Accessibility
          </Link>
        </nav>
      </div>
    </footer>
  );
}
