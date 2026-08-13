import { MoneyParseError } from '@crossval/shared';
import type { ErrorRequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import config from '../../config';
import ApiError from '../../errors/ApiError';
import handleCastError from '../../errors/handleCastError';
import handleDuplicateError from '../../errors/handleDuplicateError';
import handleValidationError from '../../errors/handleValidationError';
import handleZodError from '../../errors/handleZodError';
import type { SimplifiedError } from '../../interfaces/error';
import logger from '../../shared/logger';

const isDuplicateKeyError = (error: unknown): error is { keyValue?: Record<string, unknown> } =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code: unknown }).code === 11000;

const toSimplifiedError = (error: unknown): SimplifiedError => {
  if (error instanceof ZodError) {
    return handleZodError(error);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return handleValidationError(error);
  }

  if (error instanceof mongoose.Error.CastError) {
    return handleCastError(error);
  }

  if (isDuplicateKeyError(error)) {
    return handleDuplicateError(error);
  }

  if (error instanceof MoneyParseError) {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'Validation failed',
      errorMessages: [{ path: 'amount', message: error.message }],
    };
  }

  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      errorMessages: error.details,
    };
  }

  // Anything else is a bug. The real message goes to the log, not to the client.
  return {
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    message: 'Something went wrong',
    errorMessages: [],
  };
};

const globalErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const simplified = toSimplifiedError(error);

  if (simplified.statusCode >= StatusCodes.INTERNAL_SERVER_ERROR) {
    logger.error({ err: error }, 'unhandled error');
  }

  res.status(simplified.statusCode).json({
    success: false,
    message: simplified.message,
    errorMessages: simplified.errorMessages,
    ...(config.isProduction || !(error instanceof Error) ? {} : { stack: error.stack }),
  });
};

export default globalErrorHandler;
