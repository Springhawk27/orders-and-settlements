import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import config from '../../config';
import ApiError from '../../errors/ApiError';
import { verifyToken } from '../../helpers/jwtHelpers';
import type { AccessTokenPayload } from '../modules/auth/auth.interface';
import { readAccessToken } from '../modules/auth/auth.utils';

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
