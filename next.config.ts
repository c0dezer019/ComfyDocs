import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React strict mode for development
  reactStrictMode: true,

  // Disable x-powered-by header
  poweredByHeader: false,

  // Configure images if needed
  images: {
    unoptimized: true, // For static export compatibility
  },

  // Skip ESLint during builds (run separately in CI)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Skip TypeScript errors during builds (for migration)
  typescript: {
    ignoreBuildErrors: false,
  },

  // Headers to support mobile API connectivity
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
