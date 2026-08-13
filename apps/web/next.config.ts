import type { NextConfig } from 'next';

// Falls back so that `next build` still resolves a destination when the
// variable is absent; a bare `undefined` would produce an invalid rewrite.
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:5000';

const nextConfig: NextConfig = {
  // The shared contract package ships as TypeScript source, so Next compiles it
  // alongside the app rather than consuming a prebuilt bundle.
  transpilePackages: ['@crossval/shared'],

  // The browser only ever talks to the web origin. That keeps the API's
  // httpOnly auth cookies first-party SameSite=Lax and avoids CORS preflights,
  // so browser code must never call API_ORIGIN directly.
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: `${apiOrigin}/api/:path*`,
    },
  ],
};

export default nextConfig;
