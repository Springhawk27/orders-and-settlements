import { StatusCodes } from 'http-status-codes';
import type { SimplifiedError } from '../interfaces/error';

type MongoDuplicateKeyError = {
  keyValue?: Record<string, unknown>;
};

/**
 * A unique index rejected the write (MongoServerError E11000). The index name
 * is deliberately not echoed back — the client is told which field collided,
 * not how the collection is indexed.
 */
const handleDuplicateError = (error: MongoDuplicateKeyError): SimplifiedError => {
  const [path = 'value'] = Object.keys(error.keyValue ?? {});

  return {
    statusCode: StatusCodes.CONFLICT,
    message: 'Already exists',
    errorMessages: [{ path, message: `This ${path} is already in use` }],
  };
};

export default handleDuplicateError;
