import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The shared contract package ships as TypeScript source, so Next compiles it
  // alongside the app rather than consuming a prebuilt bundle.
  transpilePackages: ['@crossval/shared'],
};

export default nextConfig;
