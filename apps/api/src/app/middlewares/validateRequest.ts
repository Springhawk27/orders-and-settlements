import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/**
 * Replaces the raw body with the parsed result, so handlers receive dates as
 * Date and money as integer minor units. A rejection reaches the error handler
 * on its own: Express 5 forwards them, which is why nothing here wraps a
 * handler in try/catch.
 */
const validateRequest =
  (schema: ZodType): RequestHandler =>
  async (req, _res, next) => {
    req.body = await schema.parseAsync(req.body);
    next();
  };

export default validateRequest;
