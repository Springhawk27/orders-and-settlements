import { StatusCodes } from 'http-status-codes';
import type mongoose from 'mongoose';
import type { SimplifiedError } from '../interfaces/error';

/**
 * Schema-level validation that Zod did not already cover, for example a
 * required field stripped by a service before save.
 */
const handleValidationError = (error: mongoose.Error.ValidationError): SimplifiedError => ({
  statusCode: StatusCodes.BAD_REQUEST,
  message: 'Validation failed',
  errorMessages: Object.values(error.errors).map((issue) => ({
    path: issue.path,
    message: issue.message,
  })),
});

export default handleValidationError;
