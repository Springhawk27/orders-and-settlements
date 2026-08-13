import type { AccessTokenPayload } from '../app/modules/auth/auth.interface';

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export {};
