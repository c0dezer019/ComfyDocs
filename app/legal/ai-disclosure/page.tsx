import { LaunchPlaceholder, LegalLayout, LegalSection } from '@/components/LegalLayout';

export default function AiDisclosurePage() {
  return (
    <LegalLayout title="AI disclosure">
      <p className="text-sm text-text-muted">
        Effective date: September 9, 2026 · Last updated: September 9, 2026
      </p>
      <LaunchPlaceholder />
      <p>
        ComfyDocs can use Google Gemini to produce scene descriptions, workflow explanations,
        quality findings, prompt suggestions, and answers to follow-up questions. Some features also
        work locally without AI.
      </p>
      <LegalSection title="What this means">
        <p>
          AI output is probabilistic and can hallucinate, omit details, misread images, misclassify
          content, or suggest unsafe or ineffective changes. Scores and findings are opinions, not
          objective measurements or guarantees.
        </p>
        <p>
          Do not treat output as professional advice or as a substitute for human review. Do not use
          it alone for decisions affecting health, employment, housing, credit, insurance, legal
          rights, safety, or other high-impact matters.
        </p>
      </LegalSection>
      <LegalSection title="Data path and provider rules">
        <p>
          When AI is enabled, your browser sends the selected image and workflow/prompt context to
          Google Gemini using your own API key. Google’s current Gemini API terms, privacy policy,
          paid/unpaid data practices, region rules, and prohibited-use policy apply. Review them
          before using sensitive material.
        </p>
      </LegalSection>
      <LegalSection title="Your responsibilities">
        <p>
          Use an API key you control, monitor quota and billing, confirm you are using an allowed
          service tier and region, and obtain any consent or license required for the material you
          submit. Verify output before sharing or acting on it.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
