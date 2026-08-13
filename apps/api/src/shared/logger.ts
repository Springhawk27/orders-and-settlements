import { pino } from 'pino';
import config from '../config';

/**
 * Console transport only. Serverless filesystems are read only, so a file
 * transport would fail at runtime rather than in development.
 */
export const logger = pino({
  level: config.logLevel,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
    ],
    remove: true,
  },
  ...(config.isProduction || config.isTest
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
});

export default logger;
