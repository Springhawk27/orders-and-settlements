import type { AuthUser, LoginInput, RegisterInput } from '@crossval/shared';
import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';
import { Types, type HydratedDocument } from 'mongoose';
import crypto from 'node:crypto';
import config from '../../../config';
import ApiError from '../../../errors/ApiError';
import { millisecondsUntilExpiry, signToken, verifyToken } from '../../../helpers/jwtHelpers';
import logger from '../../../shared/logger';
import type { AuthTokens, RefreshTokenPayload, UserAttrs } from './auth.interface';
import { Session, User } from './auth.model';
import { hashToken } from './auth.utils';

type AuthResult = {
  user: AuthUser;
  tokens: AuthTokens;
};

const toAuthUser = (user: HydratedDocument<UserAttrs>): AuthUser => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
});

const issueTokens = async (user: HydratedDocument<UserAttrs>): Promise<AuthTokens> => {
  const userId = user._id.toString();

  const accessToken = signToken(
    { sub: userId, email: user.email },
    config.jwt.accessSecret,
    config.jwt.accessExpiresIn,
  );

  const refreshToken = signToken(
    { sub: userId, jti: crypto.randomUUID() },
    config.jwt.refreshSecret,
    config.jwt.refreshExpiresIn,
  );

  await Session.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + millisecondsUntilExpiry(refreshToken)),
  });

  return { accessToken, refreshToken };
};

const register = async (input: RegisterInput): Promise<AuthResult> => {
  // The unique index is the real guard against a race between this check and
  // the insert; this exists only to return a friendlier message in the common case.
  if (await User.exists({ email: input.email })) {
    throw new ApiError(StatusCodes.CONFLICT, 'That email is already registered', [
      { path: 'email', message: 'An account with this email already exists' },
    ]);
  }

  const passwordHash = await bcrypt.hash(input.password, config.bcryptSaltRounds);
  const user = await User.create({ name: input.name, email: input.email, passwordHash });

  return { user: toAuthUser(user), tokens: await issueTokens(user) };
};

const login = async (input: LoginInput): Promise<AuthResult> => {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');

  // Identical response whether the email is unknown or the password is wrong,
  // so the endpoint cannot be used to discover which accounts exist.
  const invalidCredentials = new ApiError(
    StatusCodes.UNAUTHORIZED,
    'Email or password is incorrect',
  );

  if (!user) {
    throw invalidCredentials;
  }

  if (!(await bcrypt.compare(input.password, user.passwordHash))) {
    throw invalidCredentials;
  }

  return { user: toAuthUser(user), tokens: await issueTokens(user) };
};

const sessionExpired = () =>
  new ApiError(StatusCodes.UNAUTHORIZED, 'Session expired, please sign in again');

const refresh = async (refreshToken: string | undefined): Promise<AuthResult> => {
  if (!refreshToken) {
    throw sessionExpired();
  }

  let payload: RefreshTokenPayload;

  try {
    payload = verifyToken<RefreshTokenPayload>(refreshToken, config.jwt.refreshSecret);
  } catch {
    throw sessionExpired();
  }

  // Deleting and reading in one operation means two concurrent refreshes cannot
  // both succeed: whichever loses the race finds nothing.
  const session = await Session.findOneAndDelete({ tokenHash: hashToken(refreshToken) });

  if (!session) {
    // The signature is valid but the session is already gone, so this token was
    // rotated earlier and is being replayed. Assume it leaked and end every session.
    await Session.deleteMany({ userId: new Types.ObjectId(payload.sub) });
    logger.warn({ userId: payload.sub }, 'refresh token reuse detected, sessions revoked');
    throw sessionExpired();
  }

  const user = await User.findById(payload.sub);

  if (!user) {
    throw sessionExpired();
  }

  return { user: toAuthUser(user), tokens: await issueTokens(user) };
};

const logout = async (refreshToken: string | undefined): Promise<void> => {
  if (!refreshToken) {
    return;
  }

  await Session.deleteOne({ tokenHash: hashToken(refreshToken) });
};

const getCurrentUser = async (userId: string): Promise<AuthUser> => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  return toAuthUser(user);
};

export const authService = {
  register,
  login,
  refresh,
  logout,
  getCurrentUser,
};
