import { LaunchPlaceholder, LegalLayout, LegalSection } from '@/components/LegalLayout';

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p className="text-sm text-text-muted">
        Effective date: September 9, 2026 · Last updated: September 9, 2026
      </p>
      <LaunchPlaceholder />
      <p>
        This Privacy Policy explains how [LEGAL ENTITY NAME] (“ComfyDocs,” “we,” “us”) handles
        information when you use the ComfyDocs website and related services.
      </p>
      <LegalSection title="The short version">
        <p>
          ComfyDocs is designed to process your uploaded PNG in your browser. We do not currently
          provide accounts or operate a server-side upload store.
        </p>
        <p>
          If you choose to use AI features, the browser sends the image and selected workflow or
          prompt data to Google Gemini using the API key you provide. Google’s terms and privacy
          practices then apply to that request.
        </p>
      </LegalSection>
      <LegalSection title="Information processed">
        <p>
          <strong>Files and metadata:</strong> the PNG, embedded ComfyUI workflow metadata, prompts,
          and generated analysis may be held temporarily in browser memory and cached in your
          browser’s IndexedDB so repeat analyses can load faster.
        </p>
        <p>
          <strong>API key:</strong> an optional Gemini key is stored locally in encrypted/obfuscated
          local storage and placed in session storage while unlocked. This client-side protection is
          not a substitute for a secure secret manager. Do not use a key you are not authorized to
          use.
        </p>
        <p>
          <strong>Device and technical data:</strong> the hosting provider or network services may
          receive ordinary request data such as IP address, browser, device, and access logs.
          Confirm the providers and retention periods before publishing this policy.
        </p>
      </LegalSection>
      <LegalSection title="How we use information">
        <p>
          We use information to provide the analyzer, display reports, remember local preferences,
          maintain security, diagnose errors, and improve the product if you voluntarily contact us.
          We do not currently sell uploaded files or use them to train our own models.
        </p>
      </LegalSection>
      <LegalSection title="Third-party services">
        <p>
          AI requests use Google Gemini. You are responsible for reviewing Google’s current API
          terms and choosing an appropriate paid or unpaid service tier. Hosting, fonts, error
          monitoring, analytics, and other providers must be listed here if they are added.
        </p>
      </LegalSection>
      <LegalSection title="Your choices and deletion">
        <p>
          You can clear ComfyDocs browser storage through your browser settings, remove the saved
          API key from Settings, and avoid sending a file to AI by using offline analysis. For a
          privacy request, email [PRIVACY CONTACT EMAIL] with enough information to locate the
          request, without sending sensitive files unless asked.
        </p>
      </LegalSection>
      <LegalSection title="Children and sensitive data">
        <p>
          ComfyDocs is not directed to children under 18. Do not upload personal, confidential,
          biometric, medical, or regulated information unless you have a lawful basis and are
          comfortable sending it to the selected AI provider.
        </p>
      </LegalSection>
      <LegalSection title="Changes and contact">
        <p>
          We may update this policy as the product changes. The current version will be posted here
          with a revised date. Contact: [LEGAL CONTACT EMAIL]. Mailing address: [LEGAL MAILING
          ADDRESS].
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
