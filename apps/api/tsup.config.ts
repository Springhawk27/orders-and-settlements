import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  outDir: 'dist',
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  clean: true,
  // Bundle the workspace package into the output so the deployed artifact
  // does not depend on the monorepo layout being present at runtime.
  noExternal: ['@crossval/shared'],
});
