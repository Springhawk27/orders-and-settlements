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
  /**
   * Set when this token is exchanged. The row is kept rather than deleted so a
   * replay can be told apart from a token that never existed.
   */
  rotatedAt: Date | null;
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
