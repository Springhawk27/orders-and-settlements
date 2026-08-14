import { defineConfig } from 'tsup';

export default defineConfig({
  // server.ts listens on a port for local development; vercel.ts exports the
  // app as a request handler for the deployed serverless function.
  entry: ['src/server.ts', 'src/vercel.ts'],
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  clean: true,
  // Bundle the workspace package into the output so the deployed artifact does
  // not depend on the monorepo layout being present at runtime.
  noExternal: ['@crossval/shared'],
});
