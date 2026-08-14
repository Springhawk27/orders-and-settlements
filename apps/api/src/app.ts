import { API_VERSION } from '@crossval/shared';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import { apiRateLimiter } from './app/middlewares/rateLimiter';
import routes from './app/routes';
import config from './config';
import { connectDatabase } from './config/database';
import { openApiDocument } from './docs/openapi';
import logger from './shared/logger';

const app = express();

// Vercel terminates TLS one hop in front, so the client IP the rate limiter
// reads comes from X-Forwarded-For.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(compression());
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === '/health' },
  }),
);

// Opens the connection rather than only reporting on one someone else made, so
// a cold instance answers with the truth instead of "disconnected".
app.get('/health', async (_req, res) => {
  const connected = await connectDatabase()
    .then(() => mongoose.connection.readyState === mongoose.ConnectionStates.connected)
    .catch(() => false);

  res.status(connected ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
    status: connected ? 'ok' : 'degraded',
    version: API_VERSION,
    database: connected ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
  });
});

// Connecting here rather than at boot keeps the app usable on serverless, where
// each invocation may start cold. The connection itself is cached and reused.
app.use(async (_req, _res, next) => {
  await connectDatabase();
  next();
});

app.get('/api/docs.json', (_req, res) => {
  res.json(openApiDocument);
});

app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, { customSiteTitle: 'Orders and Settlements API' }),
);

app.use(apiRateLimiter);
app.use(`/api/${API_VERSION}`, routes);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
