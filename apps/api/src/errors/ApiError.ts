import type { ApiErrorDetail } from '@crossval/shared';

/**
 * Every error the application raises deliberately. Anything else reaching the
 * error handler is treated as unexpected and reported as a 500.
 */
class ApiError extends Error {
  statusCode: number;
  details: ApiErrorDetail[];

  constructor(statusCode: number, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
