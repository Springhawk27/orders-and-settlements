import type { CookieOptions, Request, Response } from 'express';
import crypto from 'node:crypto';
import config from '../../../config';
import { millisecondsUntilExpiry } from '../../../helpers/jwtHelpers';
import type { AuthTokens } from './auth.interface';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  // The web app reaches the API through a same-origin proxy, so these are
  // first-party cookies and do not need SameSite=None.
  sameSite: 'lax',
  path: '/',
};

export const setAuthCookies = (res: Response, tokens: AuthTokens): void => {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: millisecondsUntilExpiry(tokens.accessToken),
  });

  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: millisecondsUntilExpiry(tokens.refreshToken),
  });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions);
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions);
};

/** Cookie first for the browser, bearer header for API clients and Swagger. */
export const readAccessToken = (req: Request): string | undefined => {
  const cookieToken = (req.cookies as Record<string, string | undefined>)[ACCESS_COOKIE];

  if (cookieToken) {
    return cookieToken;
  }

  const header = req.headers.authorization;

  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
};

export const readRefreshToken = (req: Request): string | undefined =>
  (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
