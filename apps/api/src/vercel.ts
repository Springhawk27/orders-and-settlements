import app from './app';

/**
 * Serverless entry point. Vercel invokes the exported handler per request, so
 * this does not call `app.listen` — an Express app is itself a valid handler.
 */
export default app;
