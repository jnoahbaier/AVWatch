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
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
