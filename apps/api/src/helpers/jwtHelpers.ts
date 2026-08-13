import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';

export const signToken = (
  payload: Record<string, unknown>,
  secret: Secret,
  expiresIn: string,
): string => jwt.sign(payload, secret, { expiresIn: expiresIn as SignOptions['expiresIn'] });

export const verifyToken = <T>(token: string, secret: Secret): T => jwt.verify(token, secret) as T;

/**
 * Cookie lifetime is read back off the signed token rather than configured
 * separately, so the cookie and the token it carries always expire together.
 */
export const millisecondsUntilExpiry = (token: string): number => {
  const decoded = jwt.decode(token);

  if (typeof decoded !== 'object' || decoded === null || typeof decoded.exp !== 'number') {
    return 0;
  }

  return Math.max(0, decoded.exp * 1000 - Date.now());
};
