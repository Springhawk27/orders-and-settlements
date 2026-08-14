import type { Request } from 'express';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../errors/ApiError.js';

/**
 * `requireAuth` has already populated this. The check exists so a route that
 * forgets the middleware fails loudly instead of reading undefined.
 */
export const getUserId = (req: Request): string => {
  if (!req.user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }

  return req.user.sub;
};
