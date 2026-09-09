import { LaunchPlaceholder, LegalLayout, LegalSection } from '@/components/LegalLayout';

export default function EulaPage() {
  return (
    <LegalLayout title="EULA / Software License">
      <p className="text-sm text-text-muted">
        Effective date: September 9, 2026 · Last updated: September 9, 2026
      </p>
      <LaunchPlaceholder />
      <p>
        This EULA applies to the ComfyDocs client-side software delivered through the website. It
        supplements the Terms of Service; if the two conflict, the Terms control unless this EULA
        expressly says otherwise.
      </p>
      <LegalSection title="License grant">
        <p>
          Subject to your compliance with the Terms, [LEGAL ENTITY NAME] grants you a limited,
          non-exclusive, non-transferable, revocable license to run the ComfyDocs software in a
          supported browser for your internal, lawful use.
        </p>
      </LegalSection>
      <LegalSection title="Restrictions">
        <p>
          You may not resell, sublicense, distribute, modify, reverse engineer, decompile, scrape,
          or create a competing service from ComfyDocs except where applicable law cannot prohibit
          that activity. You may not remove proprietary notices or use the software to violate a
          third party’s rights.
        </p>
      </LegalSection>
      <LegalSection title="Ownership and open source">
        <p>
          ComfyDocs and its original code, design, trademarks, and documentation belong to [LEGAL
          ENTITY NAME] or its licensors. Third-party and open-source components remain governed by
          their own licenses. A software copyright notice does not transfer ownership of your
          uploaded files or generated content.
        </p>
      </LegalSection>
      <LegalSection title="Updates and support">
        <p>
          We may update, replace, or discontinue the software. Unless separately promised in
          writing, support, service levels, backups, and compatibility are not guaranteed.
        </p>
      </LegalSection>
      <LegalSection title="Disclaimer and termination">
        <p>
          The software is licensed without warranties to the maximum extent permitted by law. This
          license ends when you stop using the service, when the Terms end, or when we revoke it for
          a breach. Contact: [LEGAL CONTACT EMAIL].
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
