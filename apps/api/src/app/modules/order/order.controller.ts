import {
  dateRangeQuerySchema,
  orderListQuerySchema,
  type CreateOrderInput,
  type UpdateOrderInput,
} from '@crossval/shared';
import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import { getUserId } from '../../../helpers/requestUser';
import sendResponse from '../../../shared/sendResponse';
import { auditService } from '../audit/audit.service';
import { orderService } from './order.service';

const create: RequestHandler = async (req, res) => {
  const order = await orderService.create(getUserId(req), req.body as CreateOrderInput);

  sendResponse(res, { statusCode: StatusCodes.CREATED, message: 'Order created', data: order });
};

const list: RequestHandler = async (req, res) => {
  // Query strings are parsed here rather than in middleware, because Express 5
  // exposes req.query as a getter that cannot be reassigned.
  const query = orderListQuerySchema.parse(req.query);
  const { orders, meta } = await orderService.list(getUserId(req), query);

  sendResponse(res, { statusCode: StatusCodes.OK, meta, data: orders });
};

const exportCsv: RequestHandler = async (req, res) => {
  const range = dateRangeQuerySchema.parse(req.query);
  const csv = await orderService.exportCsv(getUserId(req), range);

  // Naming the range in the file means a folder of exports stays readable.
  const asDate = (value: Date | undefined) => value?.toISOString().slice(0, 10);
  const label = [asDate(range.from), asDate(range.to)].filter(Boolean).join('_to_');
  const suffix = label || new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orders-${suffix}.csv"`);
  res.status(StatusCodes.OK).send(csv);
};

const getById: RequestHandler = async (req, res) => {
  const order = await orderService.getById(getUserId(req), req.params.id as string);

  sendResponse(res, { statusCode: StatusCodes.OK, data: order });
};

const update: RequestHandler = async (req, res) => {
  const order = await orderService.update(
    getUserId(req),
    req.params.id as string,
    req.body as UpdateOrderInput,
  );

  sendResponse(res, { statusCode: StatusCodes.OK, message: 'Order updated', data: order });
};

const remove: RequestHandler = async (req, res) => {
  await orderService.remove(getUserId(req), req.params.id as string);

  sendResponse(res, { statusCode: StatusCodes.OK, message: 'Order deleted', data: null });
};

const listAuditTrail: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const order = await orderService.requireOwnedOrder(req.params.id as string, userId);

  const events = await auditService.listForEntity('order', order._id, new Types.ObjectId(userId));

  sendResponse(res, { statusCode: StatusCodes.OK, data: events });
};

export const orderController = {
  create,
  list,
  exportCsv,
  getById,
  update,
  remove,
  listAuditTrail,
};
