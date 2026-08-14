import app from './app';
import config from './config';
import logger from './shared/logger';

/**
 * `listen` is called at module scope rather than after awaiting the database,
 * because Vercel detects the HTTP server from this call during startup. The
 * connection is opened by middleware on the first request and cached, so
 * nothing here needs to block on it.
 */
app.listen(config.port, () => {
  logger.info(`api listening on http://localhost:${config.port}`);
});
