const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@avwatch/shared'],
  webpack: (config, { dev }) => {
    // Point webpack directly at the shared package source so it doesn't
    // need to find it via node_modules resolution (which won't work when
    // the package is hoisted to the monorepo root).
    config.resolve.alias['@avwatch/shared'] = path.resolve(
      __dirname,
      '../packages/shared/src/index.ts'
    );

    if (dev) {
      config.watchOptions = {
        ignored: ['**/node_modules/**', '**/.git/**'],
        poll: false,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost', port: '9000' },
    ],
  },
  async rewrites() {
    // In production the Python backend is on Railway; locally it's on port 8000.
    // If NEXT_PUBLIC_API_URL is not set (e.g. Vercel with no backend), skip the rewrite.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl || apiUrl === '') return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
