/**
 * Resolves a public/ asset path against the app's base path.
 *
 * Hardcoding "/demo.png" breaks whenever the app is served from a
 * subpath (static export deployed under e.g. /ComfyDocs/) or opened
 * from the filesystem, because Next.js only rewrites its own
 * generated _next/* links for you — it never touches raw src="/..."
 * strings in app code. NEXT_PUBLIC_BASE_PATH is set at build time to
 * the same value passed as `basePath` in next.config.ts, so this stays
 * in sync between SSR and static-export builds.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const assetPath = (path: string): string => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${normalized}`;
};
