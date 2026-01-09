# Copilot Instructions for ComfyDocs

Short, actionable guidance to help AI code agents be productive in this repository.

## What this project is
- React + TypeScript single-page app (Vite) for forensic analysis of ComfyUI-generated PNGs.
- Extracts ComfyUI workflow/prompt metadata from PNG tEXt chunks, runs local heuristics and (optional) Google Gemini analysis, and displays a report with spatial annotations.

## Quick dev commands
- Install: `npm install`
- Dev server: `npm run dev` (Vite with HMR)
- Build: `npm run build` (outputs `dist/`)
- Preview production build: `npm run preview`
- Notes: There are no test or CI scripts present (no `test`/`.github/workflows`).

## Where to look first (high-impact files)
- App entry & orchestrator: `App.tsx` (file handling, key management, demo path)
- AI interactions: `services/geminiService.ts` (models used, response schemas, helper functions)
- PNG IO: `utils/pngParser.ts` (parses `workflow`, `prompt`, `ComfyDocs_Report` tEXt chunks)
- PNG writing: `utils/pngWriter.ts` (embeds `ComfyDocs_Report` chunk into PNG)
- Local analysis & heuristics: `utils/workflowAnalyzer.ts`
- Caching: `utils/cacheService.ts` (IndexedDB; `calculateFileHash` uses SHA-256)
- Key obfuscation: `utils/encryption.ts` (simple XOR + base64 with `::COMFY_LITE_V2::` prefix)
- Types: `types.ts` (canonical structures: `SceneDocumentation`, `QualityIssue`, `Annotation`)
- UI components: `components/` (especially `DocumentationViewer.tsx`, `ImagePreviewModal.tsx`, `ReportViewer.tsx`)

## Important conventions & patterns
- PNG metadata is stored in tEXt chunks with these keyword names: `workflow`, `prompt`, `ComfyDocs_Report`.
- All AI calls expect the Gemini API key to be present in sessionStorage under `gemini_api_key_decrypted`. The app encrypts the key with `encrypt()` and stores the ciphertext in localStorage as `gemini_api_key_encrypted` (unlocking places the plaintext in sessionStorage).
- `geminiService.ts` uses `gemini-3-pro-preview` and `gemini-3-flash-preview`; follow the existing response schemas (Type.*) when adding new model endpoints.
- For quality issues: enforce severity rules used across the repo (e.g., if severity === 'Note', score must be 0).
- Spatial annotations use normalized box coordinates `[ymin, xmin, ymax, xmax]` in 0-1 range; `style` is either `box` (outline) or `paint` (translucent fill).
- Offline/demo modes: uploading `assets/demo.png` or a file named `demo.png` causes `extractComfyMetadata()` to return a demo workflow (handled in `pngParser.ts`).
- No global state library—state is managed with React hooks in `App.tsx` and passed via props.
- Styling is Tailwind via CDN from `index.html` (no local Tailwind build).

## How to add/change an AI integration
1. Add a typed function to `services/geminiService.ts` and export it.
2. Use `getApiKey()` (already used internally) which reads `sessionStorage['gemini_api_key_decrypted']`.
3. Mirror existing `responseSchema` patterns (Type.OBJECT / Type.ARRAY) and use the same error semantics (throw `API_KEY_NOT_FOUND` to surface unlock UI behavior).
4. Add/adjust TypeScript interfaces in `types.ts` where necessary.
5. Update UI components (e.g., `DocumentationViewer`) to drive calls and render new outputs.

## Debugging & common pitfalls
- If AI features fail: check `gemini_api_key_encrypted` (localStorage) and `gemini_api_key_decrypted` (sessionStorage) and confirm the stored plaintext starts with `AIza` (Google key).
- PNG parsing is hand-rolled—be careful when changing `pngParser.ts` and `pngWriter.ts` (chunk offsets and CRC correctness matter).
- Cache lookups use SHA-256 of the file; changing hashing behavior will change cache keys and UX.
- The README mentions `.env.local` but the app handles API keys via the UI (localStorage/sessionStorage). Prefer UI-based key management unless you intentionally wire env support.

## Examples to reference in PRs
- Add AI function: follow `generateSceneDocumentation()` and `runConsensusQualityAnalysis()` in `services/geminiService.ts`.
- Embed a report into a PNG: mimic `embedReportInPng()` in `utils/pngWriter.ts` (tEXt chunk `ComfyDocs_Report`).
- Create an offline fallback: see `analyzeWorkflowLocally()` usage in `App.tsx`.

---
If you want, I can open a draft PR with this file added; tell me if you prefer different wording or want additional examples (e.g., code snippets for typical changes).