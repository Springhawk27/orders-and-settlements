import { StatusCodes } from 'http-status-codes';
import type mongoose from 'mongoose';
import type { SimplifiedError } from '../interfaces/error';

/** Raised when a path cannot be cast, most often a malformed ObjectId in the URL. */
const handleCastError = (error: mongoose.Error.CastError): SimplifiedError => ({
  statusCode: StatusCodes.BAD_REQUEST,
  message: 'Invalid identifier',
  errorMessages: [
    {
      path: error.path,
      message: `"${String(error.value)}" is not a valid ${error.path}`,
    },
  ],
});

export default handleCastError;
