import { LaunchPlaceholder, LegalLayout, LegalSection } from '@/components/LegalLayout';

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p className="text-sm text-text-muted">
        Effective date: September 9, 2026 · Last updated: September 9, 2026
      </p>
      <LaunchPlaceholder />
      <p>
        These Terms govern your use of ComfyDocs, a browser-based tool for extracting ComfyUI
        metadata and generating documentation and quality-analysis reports. By using the service,
        you agree to these Terms. If you do not agree, do not use it.
      </p>
      <LegalSection title="Eligibility and acceptable use">
        <p>
          You must be at least 18 and legally able to accept these Terms. You may use ComfyDocs only
          for lawful purposes and only with files, prompts, images, API credentials, and other
          material you have the right to use.
        </p>
        <p>
          Do not use the service to infringe intellectual-property, privacy, publicity, or other
          rights; upload malware or unlawful content; evade AI safety controls; abuse third-party
          APIs; or make high-impact decisions about people.
        </p>
      </LegalSection>
      <LegalSection title="Your content and our limited license">
        <p>
          You retain your rights in files and material you submit. You grant ComfyDocs only the
          limited permission needed to operate the browser UI and, when you request AI analysis,
          transmit the selected material to the AI provider you chose. Because processing is
          currently browser-based, ComfyDocs does not claim a right to store or publish your files.
        </p>
      </LegalSection>
      <LegalSection title="Reports and AI output">
        <p>
          Reports may be incomplete, inaccurate, biased, or wrong. They are not professional, legal,
          medical, financial, safety, or copyright advice. Review every result before relying on it,
          publishing it, modifying a workflow, or making a decision.
        </p>
      </LegalSection>
      <LegalSection title="Third-party services and links">
        <p>
          ComfyDocs may rely on Google Gemini, hosting providers, browsers, and other third parties.
          Their terms, availability, fees, privacy practices, and errors are outside our control.
          You are responsible for your API key, quota, billing, and compliance with the provider’s
          terms.
        </p>
      </LegalSection>
      <LegalSection title="Availability, warranty, and liability">
        <p>
          The service is provided “as is” and “as available,” without warranties to the fullest
          extent permitted by law. We do not promise uninterrupted operation, preservation of
          browser data, accurate extraction, or a particular result.
        </p>
        <p>
          To the fullest extent permitted by law, [LEGAL ENTITY NAME] will not be liable for
          indirect, incidental, special, consequential, exemplary, or lost-profit damages arising
          from use of the service. Any aggregate direct-liability cap and exclusions required by the
          applicable jurisdiction should be completed by counsel before launch.
        </p>
      </LegalSection>
      <LegalSection title="Suspension, changes, and termination">
        <p>
          We may change, suspend, or discontinue features, or restrict access when needed for
          security, legal compliance, or service operation. You may stop using ComfyDocs at any
          time. Terms that should survive termination include intellectual-property, disclaimers,
          limitations, and dispute provisions.
        </p>
      </LegalSection>
      <LegalSection title="Governing law and contact">
        <p>
          These Terms are governed by the laws of [STATE/COUNTRY], excluding its conflict-of-law
          rules. Venue, arbitration, consumer-law carve-outs, and any required notices must be
          completed for your business and audience. Contact: [LEGAL CONTACT EMAIL] · [LEGAL MAILING
          ADDRESS].
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
