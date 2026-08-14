import rateLimit, { type Options } from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import config from '../../config/index.js';

/**
 * Counters live in process memory, so on a serverless deployment each instance
 * limits independently. That is acceptable for slowing down credential
 * stuffing; a shared store would be needed to enforce a hard global ceiling.
 */
const buildLimiter = (options: Partial<Options>) =>
  rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (_req, res) => {
      res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        message: 'Too many requests',
        errorMessages: [{ path: '', message: 'Please wait a moment and try again' }],
      });
    },
    ...options,
  });

/** Tight, because these endpoints are the ones worth guessing against. */
export const authRateLimiter = buildLimiter({ windowMs: 15 * 60 * 1000, limit: 20 });

export const apiRateLimiter = buildLimiter({ windowMs: 60 * 1000, limit: 120 });
