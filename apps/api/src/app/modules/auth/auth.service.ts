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
    rotatedAt: null,
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

/**
 * How long a just-exchanged refresh token keeps working.
 *
 * Strict single-use rotation is the textbook rule, but on its own it signs
 * people out during ordinary use: a second tab, or a request already in flight,
 * still holds the cookie the first exchange replaced. Cookies are shared across
 * tabs while any client-side de-duplication is not. A short window absorbs that
 * without giving a stolen token any meaningful life, since the access token it
 * buys lasts minutes.
 */
const REPLAY_GRACE_MS = 30_000;

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

  const tokenHash = hashToken(refreshToken);

  // Claiming the session and marking it rotated in one operation, so two
  // concurrent refreshes cannot both win the race.
  const claimed = await Session.findOneAndUpdate(
    { tokenHash, rotatedAt: null },
    { $set: { rotatedAt: new Date() } },
  );

  if (!claimed) {
    const alreadyRotated = await Session.findOne({ tokenHash });
    const rotatedAt = alreadyRotated?.rotatedAt;

    // A token replayed long after it was exchanged is treated as stolen and
    // every session for the user is dropped.
    if (!rotatedAt || Date.now() - rotatedAt.getTime() > REPLAY_GRACE_MS) {
      await Session.deleteMany({ userId: new Types.ObjectId(payload.sub) });
      logger.warn({ userId: payload.sub }, 'refresh token reuse detected, sessions revoked');
      throw sessionExpired();
    }

    // Inside the grace window this is ordinary behaviour rather than theft: a
    // second tab, or a retry, still holding the cookie the first one just
    // exchanged. Revoking here would sign people out during normal use.
    logger.debug({ userId: payload.sub }, 'refresh replayed within the grace window');
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
