import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import config from '../../config/index.js';
import ApiError from '../../errors/ApiError.js';
import { verifyToken } from '../../helpers/jwtHelpers.js';
import type { AccessTokenPayload } from '../modules/auth/auth.interface.js';
import { readAccessToken } from '../modules/auth/auth.utils.js';

const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readAccessToken(req);

  if (!token) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }

  try {
    req.user = verifyToken<AccessTokenPayload>(token, config.jwt.accessSecret);
  } catch {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Session expired, please sign in again');
  }

  next();
};

export default requireAuth;
