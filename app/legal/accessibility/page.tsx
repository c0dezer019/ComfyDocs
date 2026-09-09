import { LaunchPlaceholder, LegalLayout, LegalSection } from '@/components/LegalLayout';

export default function AccessibilityPage() {
  return (
    <LegalLayout title="Accessibility statement">
      <p className="text-sm text-text-muted">
        Effective date: September 9, 2026 · Last updated: September 9, 2026
      </p>
      <LaunchPlaceholder />
      <p>
        ComfyDocs is committed to making its website usable by people with disabilities. We are
        working toward conformance with WCAG 2.2 Level AA, while recognizing that some interactive
        image, graph, and file-upload experiences may still need improvement.
      </p>
      <LegalSection title="Help and feedback">
        <p>
          If you encounter an accessibility barrier, contact [ACCESSIBILITY CONTACT EMAIL] and
          describe the page, task, browser, assistive technology, and the accommodation you need. We
          will use that feedback to prioritize improvements.
        </p>
      </LegalSection>
      <LegalSection title="Current scope">
        <p>
          We aim to support keyboard navigation, visible focus, readable contrast, text
          alternatives, responsive layouts, reduced motion, and accessible status messages.
          Automated checks are not a guarantee of accessibility; please report barriers that testing
          misses.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
