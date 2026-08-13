import type { Types } from 'mongoose';

export type UserAttrs = {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SessionAttrs = {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
};

export type RefreshTokenPayload = {
  sub: string;
  /** Makes every refresh token unique, so two issued in the same second differ. */
  jti: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};
