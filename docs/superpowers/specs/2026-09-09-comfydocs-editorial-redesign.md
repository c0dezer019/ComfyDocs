# ComfyDocs Whole-Product Editorial Redesign

## Goal

Make ComfyDocs feel like a calm, credible forensic documentation tool rather than a generic AI-generated SaaS interface, without changing its analysis workflows or data behavior.

## Design direction

The product uses a warm-stone canvas (`#fafaf9`), white surfaces, near-black primary text, warm-gray secondary text, hairline stone borders, and one restrained cyan brand/action accent. Inter Tight is used for display and headings; Inter is used for body copy, navigation, controls, and captions. Content is left-aligned within a centered max-width layout with generous but controlled spacing.

The Seline reference supplies visual language only. ComfyDocs keeps its own terminology, upload flow, analysis surfaces, reports, workflow graphs, linting, settings, and dialogs.

## Interaction and information architecture

- Landing remains the entry state for new visitors.
- Upload and analysis remain application states driven by the existing `HomePage` state machine.
- Documentation and report switching remains contextual to an analyzed image; it is not promoted to global navigation.
- Dialogs remain overlays.
- Tabs are used only for genuine local navigation, not to expose preview-only states.
- Existing data, callbacks, encryption, caching, image annotation, graph, report, and lint behavior must remain unchanged.

## Token and accessibility rules

- `variables.css` is the runtime semantic token layer.
- `tokens.json` remains the source/reference token inventory.
- `theme.css` is not imported as Tailwind v4 syntax because the project uses Tailwind 3.4.
- Use Inter Tight as the heading substitute for unlicensed Roobert files.
- Cyan (`#3ba6f1` / `#3398e1`) is reserved for brand actions, links, focus, and highlights.
- Preserve restrained semantic colors for quality findings, errors, warnings, success, and severity labels.
- Remove gradients, glassmorphism, decorative blur blobs, repeated lift animations, and arbitrary multicolor feature accents.
- Preserve visible keyboard focus, reduced-motion behavior, responsive stacking from desktop to 320px, and readable contrast.
- Do not alter or deploy the trial Roobert archives in `public/`.

## Surface hierarchy

- Canvas: warm-stone background.
- Cards and panels: flat white with a 1px stone border and restrained shadow.
- Floating image/product preview: the only surface with the deeper preview shadow.
- Inverted sections: use soot sparingly for local controls or emphasis.

## Implementation boundaries

The redesign is implemented in existing files first. Shared primitives may be introduced only when they remove real repetition. No broad feature-folder migration or unrelated refactor is part of this work.

Primary files:

- `app/layout.tsx`
- `app/globals.css`
- `tailwind.config.ts`
- `src/components/Landing.tsx`
- `app/page.tsx`
- `src/components/ui/SectionCard.tsx`
- viewer, section, lint, modal, and graph components containing the old dark palette

Existing dirty-tree changes in `app/page.tsx`, `src/components/Landing.tsx`, `next.config.ts`, `package.json`, `scripts/`, and `src/lib/assetPath.ts` must be preserved.

## Verification

Run formatting, lint, production build, and static build checks. Verify landing, empty upload, demo analysis, documentation/report switching, dialogs, focus states, reduced motion, and responsive layouts at desktop, tablet, and mobile widths. Visual claims require rendered browser evidence where available; automated checks do not prove runtime or visual behavior.
