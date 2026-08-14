import app from './app';

/**
 * Serverless entry point. Vercel invokes the exported handler per request
 * rather than running a process that listens on a port, so this deliberately
 * does not call `app.listen`. An Express app is itself a valid handler.
 *
 * The database connection is opened by middleware in `app.ts` and cached on
 * globalThis, so a warm invocation reuses it instead of opening a new pool.
 */
export default app;
