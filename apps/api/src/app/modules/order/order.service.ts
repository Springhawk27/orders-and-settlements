import {
  lineTotalMinor,
  sumMinor,
  type CreateOrderInput,
  type LineItemInput,
  type Order as OrderDto,
  type OrderListQuery,
  type OrderSummary,
  type UpdateOrderInput,
} from '@crossval/shared';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { buildPaginationMeta } from '../../../helpers/pagination';
import type { PaginationMeta } from '@crossval/shared';
import { auditService } from '../audit/audit.service';
import type { LineItemAttrs } from './order.interface';
import { Order } from './order.model';
import { orderRepository, type OrderDocument } from './order.repository';
import {
  agingBucketFor,
  amountDueMinor,
  daysOverdue,
  deriveDisplayStatus,
  isOverdue,
  wasPaidLate,
} from './order.utils';

const toObjectId = (value: string): Types.ObjectId => new Types.ObjectId(value);

const buildLineItems = (
  inputs: LineItemInput[],
): { lineItems: LineItemAttrs[]; subtotalMinor: number } => {
  const lineItems = inputs.map((item) => ({
    _id: new Types.ObjectId(),
    description: item.description,
    quantity: item.quantity,
    unitPriceMinor: item.unitPriceMinor,
    lineTotalMinor: lineTotalMinor(item.quantity, item.unitPriceMinor),
  }));

  return { lineItems, subtotalMinor: sumMinor(lineItems.map((item) => item.lineTotalMinor)) };
};

/**
 * The time-dependent fields are computed here on every read rather than stored,
 * so the client is handed one answer and never derives a second one.
 */
const toSummary = (order: OrderDocument, now: Date = new Date()): OrderSummary => ({
  id: order._id.toString(),
  orderNumber: order.orderNumber,
  customer: {
    name: order.customer.name,
    ...(order.customer.email && { email: order.customer.email }),
  },
  currency: order.currency,
  issueDate: order.issueDate.toISOString(),
  dueDate: order.dueDate.toISOString(),
  subtotalMinor: order.subtotalMinor,
  totalMinor: order.totalMinor,
  amountPaidMinor: order.amountPaidMinor,
  amountDueMinor: amountDueMinor(order.totalMinor, order.amountPaidMinor),
  paymentStatus: order.paymentStatus,
  displayStatus: deriveDisplayStatus(order.paymentStatus, order.dueDate, now),
  isOverdue: isOverdue(order.paymentStatus, order.dueDate, now),
  daysOverdue: isOverdue(order.paymentStatus, order.dueDate, now)
    ? daysOverdue(order.dueDate, now)
    : 0,
  agingBucket: agingBucketFor(order.paymentStatus, order.dueDate, now),
  paidInFullAt: order.paidInFullAt ? order.paidInFullAt.toISOString() : null,
  wasPaidLate: wasPaidLate(order.paidInFullAt, order.dueDate),
  paymentCount: order.paymentCount,
  ...(order.notes && { notes: order.notes }),
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
});

const toDetail = (order: OrderDocument, now: Date = new Date()): OrderDto => ({
  ...toSummary(order, now),
  lineItems: order.lineItems.map((item) => ({
    id: item._id.toString(),
    description: item.description,
    quantity: item.quantity,
    unitPriceMinor: item.unitPriceMinor,
    lineTotalMinor: item.lineTotalMinor,
  })),
});

const requireOwnedOrder = async (orderId: string, userId: string): Promise<OrderDocument> => {
  const order = await orderRepository.findOwned(orderId, toObjectId(userId));

  // Also the answer when the order belongs to somebody else: a 404 does not
  // confirm that an id exists for another account.
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
  }

  return order;
};

const create = async (userId: string, input: CreateOrderInput): Promise<OrderDto> => {
  const ownerId = toObjectId(userId);
  const issueDate = input.issueDate ?? new Date();
  const { lineItems, subtotalMinor } = buildLineItems(input.lineItems);

  const order = await Order.create({
    userId: ownerId,
    orderNumber: await orderRepository.nextOrderNumber(ownerId, issueDate),
    customer: {
      name: input.customer.name,
      nameLower: input.customer.name.toLowerCase(),
      ...(input.customer.email && { email: input.customer.email }),
    },
    currency: input.currency,
    issueDate,
    dueDate: input.dueDate,
    ...(input.notes && { notes: input.notes }),
    lineItems,
    subtotalMinor,
    // No order-level tax or discount in this assignment, so the total is the subtotal.
    totalMinor: subtotalMinor,
    amountPaidMinor: 0,
    paymentStatus: 'pending',
    paidInFullAt: null,
    paymentCount: 0,
  });

  await auditService.record({
    userId: ownerId,
    entityType: 'order',
    entityId: order._id,
    action: 'order.created',
    summary: `Order ${order.orderNumber} created for ${order.customer.name}`,
    metadata: { totalMinor: order.totalMinor, currency: order.currency },
  });

  return toDetail(order.toObject<OrderDocument>());
};

const list = async (
  userId: string,
  query: OrderListQuery,
): Promise<{ orders: OrderSummary[]; meta: PaginationMeta }> => {
  const now = new Date();
  const filter = orderRepository.buildOrderFilter(toObjectId(userId), query, now);
  const { orders, total } = await orderRepository.findPage(filter, query);

  return {
    orders: orders.map((order) => toSummary(order, now)),
    meta: buildPaginationMeta(total, query.page, query.limit),
  };
};

const getById = async (userId: string, orderId: string): Promise<OrderDto> =>
  toDetail(await requireOwnedOrder(orderId, userId));

const update = async (
  userId: string,
  orderId: string,
  input: UpdateOrderInput,
): Promise<OrderDto> => {
  const existing = await requireOwnedOrder(orderId, userId);
  const ownerId = toObjectId(userId);

  // Line items are what the payments were made against. Once money has moved,
  // changing them would make the recorded payments describe a different order.
  if (input.lineItems && existing.paymentCount > 0) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Line items cannot be changed once a payment has been recorded',
      [
        {
          path: 'lineItems',
          message: `This order already has ${existing.paymentCount} payment(s). Void them first to edit the lines.`,
        },
      ],
    );
  }

  const changes: Record<string, unknown> = {};

  if (input.customer?.name) {
    changes['customer.name'] = input.customer.name;
    changes['customer.nameLower'] = input.customer.name.toLowerCase();
  }

  if (input.customer?.email) {
    changes['customer.email'] = input.customer.email;
  }

  if (input.dueDate) {
    changes.dueDate = input.dueDate;
  }

  if (input.notes !== undefined) {
    changes.notes = input.notes;
  }

  if (input.lineItems) {
    const { lineItems, subtotalMinor } = buildLineItems(input.lineItems);

    changes.lineItems = lineItems;
    changes.subtotalMinor = subtotalMinor;
    changes.totalMinor = subtotalMinor;
  }

  const updated = await Order.findOneAndUpdate(
    { _id: orderId, userId: ownerId },
    { $set: changes },
    { returnDocument: 'after' },
  ).lean<OrderDocument>();

  if (!updated) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
  }

  await auditService.record({
    userId: ownerId,
    entityType: 'order',
    entityId: updated._id,
    action: input.lineItems ? 'order.line_items_replaced' : 'order.updated',
    summary: `Order ${updated.orderNumber} updated: ${Object.keys(changes).join(', ')}`,
    metadata: { fields: Object.keys(changes) },
  });

  return toDetail(updated);
};

const remove = async (userId: string, orderId: string): Promise<void> => {
  const existing = await requireOwnedOrder(orderId, userId);

  // A financial record with money against it is never deleted.
  if (existing.paymentCount > 0) {
    throw new ApiError(StatusCodes.CONFLICT, 'An order with payments cannot be deleted', [
      {
        path: 'id',
        message: 'Void the payments recorded against this order first',
      },
    ]);
  }

  await Order.deleteOne({ _id: orderId, userId: toObjectId(userId) });

  await auditService.record({
    userId: toObjectId(userId),
    entityType: 'order',
    entityId: existing._id,
    action: 'order.deleted',
    summary: `Order ${existing.orderNumber} deleted`,
  });
};

export const orderService = {
  create,
  list,
  getById,
  update,
  remove,
  toSummary,
  toDetail,
  requireOwnedOrder,
};
