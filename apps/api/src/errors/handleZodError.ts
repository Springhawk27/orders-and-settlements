import { StatusCodes } from 'http-status-codes';
import type { ZodError } from 'zod';
import type { SimplifiedError } from '../interfaces/error.js';

const handleZodError = (error: ZodError): SimplifiedError => ({
  statusCode: StatusCodes.BAD_REQUEST,
  message: 'Validation failed',
  errorMessages: error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  })),
});

export default handleZodError;
