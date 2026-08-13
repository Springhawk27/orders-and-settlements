import type { PaginationMeta } from '@crossval/shared';
import type { Response } from 'express';

type ResponsePayload<T> = {
  statusCode: number;
  message?: string;
  meta?: PaginationMeta;
  data: T;
};

/** Single place every successful response is shaped, so the envelope stays uniform. */
const sendResponse = <T>(res: Response, payload: ResponsePayload<T>): void => {
  res.status(payload.statusCode).json({
    statusCode: payload.statusCode,
    success: true,
    message: payload.message ?? null,
    ...(payload.meta ? { meta: payload.meta } : {}),
    data: payload.data,
  });
};

export default sendResponse;
