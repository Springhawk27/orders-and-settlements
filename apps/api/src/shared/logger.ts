import { pino } from 'pino';
import config from '../config/index.js';

// Pretty printing runs in a worker thread, which serverless does not allow.
const usePrettyOutput = config.nodeEnv === 'development' && !process.env.VERCEL;

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
  ...(usePrettyOutput
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

export default logger;
