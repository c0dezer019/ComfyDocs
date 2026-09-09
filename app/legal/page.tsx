import Link from 'next/link';
import { LaunchPlaceholder, LegalLayout } from '@/components/LegalLayout';

const notices = [
  [
    'Privacy Policy',
    '/legal/privacy',
    'What the browser stores, what leaves the browser, and how to contact us.',
  ],
  ['Terms of Service', '/legal/terms', 'Rules for using ComfyDocs and limits on reliance.'],
  [
    'EULA / Software License',
    '/legal/eula',
    'License terms for the client-side ComfyDocs software.',
  ],
  [
    'Copyright & DMCA',
    '/legal/copyright',
    'Copyright ownership, permissions, and infringement notices.',
  ],
  [
    'AI Disclosure',
    '/legal/ai-disclosure',
    'How AI-generated analysis should and should not be used.',
  ],
  [
    'Accessibility Statement',
    '/legal/accessibility',
    'Our accessibility commitment and support contact.',
  ],
];

export default function LegalIndexPage() {
  return (
    <LegalLayout title="Legal notices">
      <LaunchPlaceholder />
      <p>
        These notices describe the current ComfyDocs browser-based product. They are informational
        drafts, not legal advice, and must be completed and reviewed before production launch.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {notices.map(([label, href, description]) => (
          <Link
            key={href}
            href={href}
            className="rounded-card border border-border bg-surface p-5 transition-colors hover:border-accent"
          >
            <h2 className="font-heading text-xl font-semibold text-text">{label}</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
          </Link>
        ))}
      </div>
    </LegalLayout>
  );
}
