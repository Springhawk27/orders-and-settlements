import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/**
 * Replaces the raw body with the parsed result, so handlers receive values that
 * are already coerced — dates as Date, money as integer minor units.
 *
 * A rejection here propagates to the error handler on its own: Express 5
 * forwards rejected promises from handlers, which is why there is no try/catch
 * wrapper anywhere in this codebase.
 */
const validateRequest =
  (schema: ZodType): RequestHandler =>
  async (req, _res, next) => {
    req.body = await schema.parseAsync(req.body);
    next();
  };

export default validateRequest;
