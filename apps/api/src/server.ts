import app from './app';
import config from './config';
import { connectDatabase } from './config/database';
import logger from './shared/logger';

const bootstrap = async (): Promise<void> => {
  await connectDatabase();

  app.listen(config.port, () => {
    logger.info(`api listening on http://localhost:${config.port}`);
  });
};

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, 'failed to start the api');
  process.exit(1);
});
