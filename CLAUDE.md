# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ComfyDocs is a React-based forensic analysis tool for ComfyUI-generated images. It extracts embedded workflow metadata from PNG files, performs AI-powered quality analysis using Google Gemini API, and generates comprehensive documentation reports. The app works entirely client-side with intelligent caching to avoid redundant API calls.

## Development Commands

**Development server:**

```bash
pnpm run dev
```

Starts Vite dev server with hot module replacement.

**Production build:**

```bash
pnpm run build
```

Compiles TypeScript and bundles for production. Output goes to `dist/`.

**Preview production build:**

```bash
pnpm run preview
```

Serves the production build locally for testing.

**Install dependencies:**

```bash
pnpm install
```

## Architecture Overview

### Tech Stack

- **Framework:** React 19.2.3 with TypeScript 5.8
- **Build Tool:** Vite 7.3.1
- **AI Integration:** Google Gemini API (@google/genai)
- **Styling:** Tailwind CSS (loaded via CDN in index.html)
- **State Management:** React hooks (no Redux/Zustand)

### Component Hierarchy

The app follows a hierarchical component structure with state managed at the App level:

```
App.tsx (main orchestrator)
├── Landing.tsx (first-time landing screen)
├── DocumentationViewer.tsx (analysis results + editing)
│   ├── WorkflowGraph.tsx (interactive node graph)
│   ├── MarkdownViewer.tsx (markdown rendering)
│   └── Quality Issue editing (inline UI)
├── ReportViewer.tsx (PDF-ready forensic report)
├── ImagePreviewModal.tsx (zoomable image with spatial annotations)
├── SettingsModal.tsx (API key configuration)
└── UnlockModal.tsx (API key decryption)
```

### File Processing Pipeline

1. **Upload:** User uploads PNG file via drag-drop or file picker
2. **Parse:** `pngParser.ts` extracts PNG tEXt chunks for `workflow`, `prompt`, and `ComfyDocs_Report` metadata
3. **Cache Check:** `cacheService.ts` checks IndexedDB using SHA-256 file hash
4. **Local Analysis:** `workflowAnalyzer.ts` provides offline fallback by tracing ComfyUI node graph heuristically
5. **AI Analysis:** `geminiService.ts` sends image + metadata to Gemini API for comprehensive quality analysis
6. **Cache:** Results stored in IndexedDB for instant re-load
7. **Display:** Results shown in DocumentationViewer with interactive Q&A capability

### Key Architectural Patterns

**Graceful Degradation:**
The app operates in multiple modes based on available resources:

1. Full AI Analysis (with API key)
2. Offline Local Analysis (no API key - heuristic parameter extraction)
3. Demo Mode (pre-computed sample data)
4. Cache Hits (instant re-load from IndexedDB)

**PNG Metadata Handling:**

- PNG files contain embedded ComfyUI workflow JSON in tEXt chunks
- `pngParser.ts` manually parses PNG binary format (no external library)
- `pngWriter.ts` can embed analysis results back into PNG as `ComfyDocs_Report` chunk
- This enables "round-trip" analysis sharing (PNG with embedded report)

**API Key Security:**

- API keys encrypted with password-based XOR cipher (`encryption.ts`)
- Stored encrypted in localStorage, decrypted to sessionStorage during session
- Not cryptographically strong (client-side obfuscation only)
- Never stored in plain text

**Image Annotation System:**

- Quality issues and Q&A responses include spatial bounding boxes
- Normalized coordinates (0-1 range) for resolution independence
- Two overlay styles: `box` (outlined rectangles) and `paint` (translucent fills)
- ImagePreviewModal renders annotations over zoomable image

## Services Layer

### geminiService.ts

All Gemini API interactions go through this service:

**`generateSceneDocumentation()`** - Main analysis pipeline

- Model: `gemini-3-pro-preview`
- Takes base64 image + workflow/prompt JSON
- Returns structured `SceneDocumentation` with scene overview, quality analysis, prompt adherence scoring

**`runConsensusQualityAnalysis()`** - Multi-pass quality verification

- Runs N parallel passes with `gemini-3-flash-preview` (faster)
- Judge pass consolidation with `gemini-3-pro-preview` (smarter)
- Calculates confidence percentages based on issue recurrence across passes
- Assigns spatial bounding boxes to issues

**`askQuestion()`** - Interactive Q&A with image context

- Allows follow-up questions about the image
- Returns spatial annotations (bounding boxes with labels)
- Can update critique and improvements

**`generateIssuesFromNotes()`** - Convert user notes to quality issues

- Processes user observations with optional reference images
- Generates formal quality issues with severity levels

**`generateIssueFix()`** - Single-issue fix generation

- Respects user context when generating fix suggestions
- Can validate intentional style choices

**`refreshPromptAnalysis()`** - Updates prompt engineering feedback

API key retrieval: All functions use `getApiKey()` which reads from sessionStorage.

## Utilities

### pngParser.ts

Parses PNG binary format to extract tEXt chunks:

- `workflow`: ComfyUI node graph
- `prompt`: Generation parameters
- `ComfyDocs_Report`: Pre-computed analysis (for embedded reports)
- Includes demo workflow for interactive demo mode

### workflowAnalyzer.ts

Offline fallback for parameter extraction:

- Traces KSampler nodes to text inputs
- Resolves Reroute nodes transparently
- Extracts: seed, steps, CFG, sampler, scheduler, denoise, model, VAE
- Handles both standard and SDXL workflows

### cacheService.ts

IndexedDB persistence layer:

- SHA-256 file hashing for uniqueness
- Caches entire `SceneDocumentation` objects
- Dramatically improves UX for repeated analyses
- Prevents redundant API calls (cost savings)

### encryption.ts

API key encryption/decryption:

- XOR cipher with base64 encoding
- Password-based encryption (client-side obfuscation)
- Prefix validation (`::COMFY_LITE_V2::`)

### pngWriter.ts

Embeds analysis reports back into PNG files:

- Creates new PNG with `ComfyDocs_Report` tEXt chunk
- Preserves original workflow/prompt metadata
- Enables analysis sharing

## Type System

All TypeScript interfaces are defined in `types.ts`:

**`SceneDocumentation`** - Main analysis result structure containing:

- `sceneOverview`: Scene categorization and details
- `workflowAnalysis`: Text analysis of ComfyUI workflow
- `parameters`: Extracted generation parameters
- `qualityAnalysis`: Quality issues with spatial bounding boxes
- `promptAnalysis`: Prompt adherence scoring and feedback
- `qa`: Q&A history with annotations
- `userSceneNotes`: User annotations

**`QualityIssue`** - Defect/observation record:

- Type, description, severity (Critical/Major/Minor/Note)
- Score (0-10 impact), confidence (0-100%)
- Spatial bounding box + overlay style
- suggestedFixes array

**`Annotation`** - Image region markup with normalized coordinates

## Build Configuration

### vite.config.ts

Manual chunk splitting for optimal loading:

- `vendor-react`: React/ReactDOM
- `vendor-ai`: Gemini SDK
- `vendor-ui`: Lucide + Markdown
- Chunk size warning limit: 1000kB

### tsconfig.json

- Target: ES2022
- Module resolution: bundler
- Path aliases: `@/*` maps to project root
- JSX: react-jsx
- Experimental decorators enabled

## State Management

State is managed in `App.tsx` using React hooks:

- 15+ useState hooks for processing, analysis results, file handling, API keys
- Props callbacks for child-to-parent communication
- No global state management library (Redux/Zustand)
- Cache synchronization on state changes

Key state variables:

- `imageData`: Current PNG file data
- `documentation`: Analysis results
- `processing`: Loading states
- `apiKey`: Decrypted key in sessionStorage
- `showSettings`/`showUnlock`: Modal states

## API Key Configuration

The app requires a Google Gemini API key for AI features:

1. User enters API key in Settings modal
2. Key is encrypted with user password using XOR cipher
3. Encrypted key stored in localStorage
4. On session start, user unlocks key with password
5. Decrypted key stored in sessionStorage for API calls
6. Key retrieved via `getApiKey()` in geminiService.ts

**Note:** Create a `.env.local` file is mentioned in README but not actually used by the app. The app uses localStorage/sessionStorage instead for API key management.

## Common Development Patterns

**Adding a new Gemini API function:**

1. Add function to `services/geminiService.ts`
2. Use `getApiKey()` to retrieve session API key
3. Define TypeScript interface in `types.ts` if needed
4. Handle errors gracefully with try/catch
5. Update relevant component to call the function

**Adding a new component:**

1. Create in `components/` directory
2. Use TypeScript with proper prop interfaces
3. Import and use in parent component (likely App.tsx or DocumentationViewer.tsx)
4. Pass state and callbacks via props
5. Follow existing Tailwind styling patterns (glassmorphism, dark theme)

**Modifying PNG metadata handling:**

1. Update `pngParser.ts` for reading new chunks
2. Update `pngWriter.ts` for writing new chunks
3. Update `types.ts` if data structure changes
4. Handle backward compatibility with existing PNG files

**Adding new quality issue types:**

- Update Gemini prompts in `geminiService.ts`
- Ensure severity levels map correctly (Critical/Major/Minor/Note)
- Verify spatial annotation rendering in ImagePreviewModal
- Update ReportViewer if report format needs changes

## Styling

The app uses Tailwind CSS loaded via CDN in `index.html`:

- Dark theme: slate-900/slate-950 base colors
- Glassmorphism: Frosted glass effect with backdrop blur
- Primary: Indigo-600, Secondary: Violet-600
- Severity colors: Red (Critical), Orange (Major), Yellow (Minor), Slate (Note)
- Custom fonts: Plus Jakarta Sans (UI), JetBrains Mono (code)
- Print media queries for PDF export in ReportViewer

No CSS framework dependencies - pure Tailwind utility classes.

## Performance Considerations

- Image base64 encoding happens client-side (can be large for high-res images)
- Gemini API calls can be slow - show loading states
- Multiple parallel Gemini requests for consensus analysis (can be expensive)
- IndexedDB caching prevents redundant API calls
- Vite's code splitting keeps initial bundle size reasonable

## Import Path Alias

TypeScript is configured with path alias `@/*` mapping to project root:

```typescript
import { QualityIssue } from '@/types';
import { parseComfyMetadata } from '@/utils/pngParser';
```
