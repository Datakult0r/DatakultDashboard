import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Turbopack root pinned to this directory — silences "multiple lockfiles" warning.
  // Use process.cwd() for ESM-safety (no __dirname).
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
