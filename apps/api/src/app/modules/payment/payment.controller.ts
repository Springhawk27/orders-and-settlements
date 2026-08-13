import type { RecordPaymentInput, VoidPaymentInput } from '@crossval/shared';
import type { Request, RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getUserId } from '../../../helpers/requestUser';
import sendResponse from '../../../shared/sendResponse';
import { paymentService } from './payment.service';

const readIdempotencyKey = (req: Request): string | undefined => {
  const header = req.get('Idempotency-Key');

  return header && header.trim().length > 0 ? header.trim() : undefined;
};

const record: RequestHandler = async (req, res) => {
  const { result, replayed } = await paymentService.record(
    getUserId(req),
    req.params.orderId as string,
    req.body as RecordPaymentInput,
    readIdempotencyKey(req),
  );

  // Signals that this response is the original outcome being returned again,
  // so a client retrying after a timeout can tell the two apart.
  if (replayed) {
    res.set('Idempotent-Replay', 'true');
  }

  sendResponse(res, {
    statusCode: replayed ? StatusCodes.OK : StatusCodes.CREATED,
    message: replayed ? 'Payment already recorded' : 'Payment recorded',
    data: result,
  });
};

const listForOrder: RequestHandler = async (req, res) => {
  const payments = await paymentService.listForOrder(getUserId(req), req.params.orderId as string);

  sendResponse(res, { statusCode: StatusCodes.OK, data: payments });
};

const voidPayment: RequestHandler = async (req, res) => {
  const result = await paymentService.voidPayment(
    getUserId(req),
    req.params.id as string,
    req.body as VoidPaymentInput,
  );

  sendResponse(res, { statusCode: StatusCodes.OK, message: 'Payment voided', data: result });
};

const reconcile: RequestHandler = async (req, res) => {
  const summary = await paymentService.reconcile(getUserId(req), req.params.orderId as string);

  sendResponse(res, { statusCode: StatusCodes.OK, data: summary });
};

export const paymentController = {
  record,
  listForOrder,
  voidPayment,
  reconcile,
};
