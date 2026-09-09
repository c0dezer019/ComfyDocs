# ComfyDocs Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved editorial design system across the entire ComfyDocs experience while preserving existing workflows and behavior.

**Architecture:** Keep the current React component organization and HomePage state machine. Establish one semantic CSS token contract, map Tailwind utilities to it, then replace dark/glass styling in shared primitives and product surfaces in coherent groups. Add no new application state for the redesign.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 3.4, CSS custom properties, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-09-09-comfydocs-editorial-redesign.md`

## Global Constraints

- Preserve existing content, callbacks, state transitions, parsing, caching, encryption, annotation, graph, report, and lint behavior.
- Use `variables.css` as the runtime semantic token layer; do not import `theme.css` into this Tailwind 3.4 project.
- Use Inter Tight for headings and Inter for body/UI text.
- Keep cyan as the brand/action accent; retain muted semantic colors for status and severity meaning.
- Remove gradients, glassmorphism, decorative blur blobs, and repeated hover-lift animation.
- Preserve current dirty-tree asset-path/static-export changes.
- Keep keyboard focus, reduced-motion support, responsive stacking, and accessible contrast.

### Task 1: Establish runtime design foundations

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `variables.css`
- Validate: `tokens.json`, `theme.css`

**Interfaces:** `layout.tsx` supplies font variables to the document; `globals.css` consumes semantic custom properties; Tailwind color/font/radius/shadow aliases resolve to those properties.

- [ ] Inspect current Tailwind configuration and all global selectors before editing.
- [ ] Remove Google-font `@import`, Plus Jakarta/JetBrains defaults, dark radial backgrounds, glass utilities, gradient text, and indigo focus rules from `app/globals.css`.
- [ ] Import `variables.css` from the global stylesheet and define Inter Tight through `next/font/google` in `app/layout.tsx`, with Inter as the body fallback.
- [ ] Add semantic page, surface, text, border, accent, status, focus, spacing, radius, and shadow aliases to `tailwind.config.ts` without removing existing utility support needed by unaffected components.
- [ ] Define base body, heading, form-control, selection, scrollbar, focus-visible, reduced-motion, and print rules against the new tokens.
- [ ] Run `npm run format:check` and `npm run lint`.

### Task 2: Redesign shared shell and landing experience

**Files:**
- Modify: `src/components/Landing.tsx`
- Modify: `app/page.tsx`
- Modify: `src/components/ui/SectionCard.tsx`

**Interfaces:** Existing `Landing` props and HomePage callbacks remain unchanged; SectionCard continues to accept its existing children/props.

- [ ] Replace centered gradient hero, glow blob, uppercase eyebrow, multicolor icon grid, and glass cards with the approved left-aligned editorial landing layout.
- [ ] Keep the demo image, CTA callbacks, asset-path helper, and truthful ComfyDocs copy intact.
- [ ] Use one highlighted phrase per headline, pill actions, white bordered surfaces, and a single elevated preview treatment.
- [ ] Redesign `SectionCard` as a flat white semantic panel so analysis surfaces inherit the new system.
- [ ] Update the persistent HomePage header/empty state classes while retaining upload, settings, unlock, and demo behavior.
- [ ] Run the development build and verify landing plus empty upload state at desktop and mobile widths.

### Task 3: Restyle analysis workspace and shared sections

**Files:**
- Modify: `src/components/DocumentationViewer.tsx`
- Modify: `src/components/ReportViewer.tsx`
- Modify: `src/components/MarkdownViewer.tsx`
- Modify: `src/components/JsonViewer.tsx`
- Modify: `src/components/WorkflowGraph.tsx`
- Modify: `src/components/WorkflowGraphEnhanced.tsx`
- Modify: `src/components/sections/*.tsx`

**Interfaces:** Preserve component props, graph data contracts, tab callbacks, markdown rendering, and export actions.

- [ ] Replace hardcoded dark slate/white/translucent classes with semantic canvas, surface, text, border, and accent classes.
- [ ] Preserve documentation/report navigation and make active states use the soot/cyan system only where they convey selection.
- [ ] Keep graph node-category distinction readable through labels, shape, line treatment, and restrained semantic colors rather than a rainbow palette.
- [ ] Keep image preview, annotation controls, prompt content, workflow topology, parameters, and scene overview behavior unchanged.
- [ ] Verify analyzed demo state, report switching, graph rendering, markdown, JSON, and image preview interactions.

### Task 4: Restyle linting, dialogs, and settings

**Files:**
- Modify: `src/components/lint/*.tsx`
- Modify: `src/components/SettingsModal.tsx`
- Modify: `src/components/UnlockModal.tsx`
- Modify: `src/components/ImagePreviewModal.tsx`
- Modify: `src/components/ui/*.tsx` as needed

**Interfaces:** Preserve lint rule output, severity semantics, modal open/close callbacks, API-key encryption flow, annotation editing, and keyboard behavior.

- [ ] Convert lint cards and summary surfaces to bordered white panels with semantic severity colors and readable status labels.
- [ ] Convert settings, unlock, and image-preview dialogs to full-window overlays with centered white modal containers, compact form rows, and visible focus states.
- [ ] Preserve alert/error semantics and make dynamic state announcements readable on the new canvas.
- [ ] Add reduced-motion guards to any remaining transitions and remove purely decorative animation.
- [ ] Verify dialogs with keyboard navigation, escape/close actions, focus return, lint empty/error/success states, and annotation actions.

### Task 5: Whole-product verification and cleanup

**Files:**
- Modify: any remaining component with old palette classes identified by `rg`.
- Validate: `app/layout.tsx`, `app/globals.css`, `tailwind.config.ts`, all redesigned components.

- [ ] Search for remaining `bg-slate`, `text-white`, `border-white`, indigo/violet/purple gradients, `glass`, and unrestricted `animate-in` classes.
- [ ] Replace only instances belonging to the redesign; preserve intentional image/graph/status semantics.
- [ ] Run `npm run format:check`, `npm run lint`, `npm run build`, and `npm run build:static`.
- [ ] Exercise landing, upload, demo analysis, documentation/report switching, report export, graph, lint, settings, unlock, image preview, and print states.
- [ ] Record any unrun browser/device/CI verification explicitly; do not treat automated checks as visual proof.

## Review checkpoints

- After Task 1: inspect computed fonts, body canvas, focus ring, and token resolution.
- After Task 2: inspect landing and upload states at 1440px, 1024px, and 390px.
- After Tasks 3–4: inspect analyzed, report, graph, lint, modal, and settings states.
- Before completion: review dirty-tree ownership and confirm no unrelated files were reverted.
