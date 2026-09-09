import { LaunchPlaceholder, LegalLayout, LegalSection } from '@/components/LegalLayout';

export default function CopyrightPage() {
  return (
    <LegalLayout title="Copyright & DMCA">
      <p className="text-sm text-text-muted">
        Effective date: September 9, 2026 · Last updated: September 9, 2026
      </p>
      <LaunchPlaceholder />
      <LegalSection title="Copyright notice">
        <p>
          © 2026 [LEGAL ENTITY NAME]. ComfyDocs, its original software, visual design,
          documentation, and site content are protected by copyright and other laws. “ComfyUI” and
          related marks belong to their respective owners; ComfyDocs is not affiliated with or
          endorsed by those owners unless expressly stated.
        </p>
      </LegalSection>
      <LegalSection title="Your files and third-party material">
        <p>
          You are responsible for permissions, licenses, releases, and other rights for every image,
          workflow, model reference, prompt, and other material you analyze. Do not use ComfyDocs to
          remove provenance or copyright-management information, or to publish material you do not
          have permission to use.
        </p>
      </LegalSection>
      <LegalSection title="DMCA notices">
        <p>
          If material is hosted or made available through ComfyDocs and you believe it infringes
          your copyright, send a signed notice to the designated agent below with the work, the
          allegedly infringing material and location, your contact details, good-faith statement,
          accuracy/authority statement, and signature. We may remove or disable access to material
          and may notify the affected user.
        </p>
        <p>
          <strong>Designated agent:</strong> [DMCA AGENT NAME] · [DMCA AGENT EMAIL] · [DMCA AGENT
          MAILING ADDRESS]
        </p>
      </LegalSection>
      <LegalSection title="Counter-notices and repeat infringement">
        <p>
          A user may send a counter-notice containing the information required by applicable law. We
          may terminate repeat infringers and may reject notices that are incomplete, fraudulent,
          abusive, or outside the DMCA process.
        </p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>
          General copyright questions: [COPYRIGHT CONTACT EMAIL]. This page is not a substitute for
          legal advice.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
