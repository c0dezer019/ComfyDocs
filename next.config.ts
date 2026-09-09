import type { NextConfig } from 'next';

// Two supported build modes, selected via `pnpm build` (SSR) vs
// `pnpm build:static` (static export):
//
// - SSR (default): full Next.js server build. Middleware runs, so
//   mobile CSP/CORS headers are applied there. Deployed to Vercel.
// - Static export (BUILD_MODE=static): `output: 'export'` produces
//   out/. Next.js does not support Middleware with static export at
//   all (the build fails if middleware.ts is present), so
//   `scripts/build-static.mjs` temporarily moves middleware.ts aside
//   for the duration of this build. Static export also can't run the
//   headers() function below — Next silently ignores it — so if the
//   static deployment target needs those headers, configure them at
//   the host (e.g. a _headers file, CDN config) instead.
//
// NEXT_PUBLIC_BASE_PATH keeps basePath and the app's own asset-path
// helper (src/lib/assetPath.ts) in sync when the static export is
// served from a subpath instead of domain root.
const isStaticExport = process.env.BUILD_MODE === 'static';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  // Enable React strict mode for development
  reactStrictMode: true,

  // Disable x-powered-by header
  poweredByHeader: false,

  ...(isStaticExport
    ? {
        output: 'export' as const,
        basePath,
      }
    : {}),

  // Configure images if needed
  images: {
    unoptimized: true, // For static export compatibility
  },

  // Skip TypeScript errors during builds (for migration)
  typescript: {
    ignoreBuildErrors: false,
  },

  // Headers to support mobile API connectivity.
  // SSR-only: static export ignores this (see note above).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
