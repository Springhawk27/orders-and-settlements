import {
  lineTotalMinor,
  sumMinor,
  type CreateOrderInput,
  type DateRangeQuery,
  type LineItemInput,
  type Order as OrderDto,
  type OrderListQuery,
  type OrderSummary,
  type PaginationMeta,
  type UpdateOrderInput,
} from '@crossval/shared';
import { StatusCodes } from 'http-status-codes';
import { Types, type QueryFilter } from 'mongoose';
import ApiError from '../../../errors/ApiError.js';
import { buildPaginationMeta } from '../../../helpers/pagination.js';
import { toCsv } from '../../../shared/csv.js';
import { auditService } from '../audit/audit.service.js';
import type { LineItemAttrs, OrderAttrs } from './order.interface.js';
import { Order } from './order.model.js';
import { orderRepository, type OrderDocument } from './order.repository.js';
import {
  agingBucketFor,
  amountDueMinor,
  daysOverdue,
  deriveDisplayStatus,
  isOverdue,
  wasPaidLate,
} from './order.utils.js';

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

const matchesStoredLines = (order: OrderDocument, incoming: LineItemInput[]): boolean =>
  order.lineItems.length === incoming.length &&
  order.lineItems.every((stored, index) => {
    const next = incoming[index];

    return (
      stored.description === next?.description &&
      stored.quantity === next.quantity &&
      stored.unitPriceMinor === next.unitPriceMinor
    );
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

  // Only fields that differ from what is stored. A request repeats every field
  // the form holds, so recording all of them would log a due-date change as
  // though the customer had been renamed too.
  const changed: string[] = [];

  if (input.customer?.name && input.customer.name !== existing.customer.name) {
    changes['customer.name'] = input.customer.name;
    changes['customer.nameLower'] = input.customer.name.toLowerCase();
    changed.push('customer name');
  }

  if (input.customer?.email && input.customer.email !== existing.customer.email) {
    changes['customer.email'] = input.customer.email;
    changed.push('customer email');
  }

  if (input.dueDate && input.dueDate.getTime() !== existing.dueDate.getTime()) {
    changes.dueDate = input.dueDate;
    changed.push('due date');
  }

  if (input.notes !== undefined && input.notes !== (existing.notes ?? '')) {
    changes.notes = input.notes;
    changed.push('notes');
  }

  const lineItemsChanged = input.lineItems ? !matchesStoredLines(existing, input.lineItems) : false;

  if (input.lineItems && lineItemsChanged) {
    const { lineItems, subtotalMinor } = buildLineItems(input.lineItems);

    changes.lineItems = lineItems;
    changes.subtotalMinor = subtotalMinor;
    changes.totalMinor = subtotalMinor;
    changed.push('line items');
  }

  if (changed.length === 0) {
    return toDetail(existing);
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
    action: lineItemsChanged ? 'order.line_items_replaced' : 'order.updated',
    summary: `Order updated: ${changed.join(', ')}`,
    metadata: { fields: changed },
  });

  return toDetail(updated);
};

const exportCsv = async (userId: string, range: DateRangeQuery): Promise<string> => {
  const now = new Date();
  const filter: QueryFilter<OrderAttrs> = { userId: toObjectId(userId) };

  if (range.from || range.to) {
    filter.issueDate = {
      ...(range.from && { $gte: range.from }),
      ...(range.to && { $lte: range.to }),
    };
  }

  const orders = await Order.find(filter).sort({ issueDate: -1 }).lean<OrderDocument[]>();

  const headers = [
    'Order number',
    'Customer',
    'Issue date',
    'Due date',
    'Status',
    'Currency',
    'Total',
    'Paid',
    'Due',
    'Days overdue',
  ];

  // Amounts go out as plain decimals rather than formatted currency, so a
  // spreadsheet reads them as numbers instead of text.
  const rows = orders.map((order) => [
    order.orderNumber,
    order.customer.name,
    order.issueDate.toISOString().slice(0, 10),
    order.dueDate.toISOString().slice(0, 10),
    deriveDisplayStatus(order.paymentStatus, order.dueDate, now),
    order.currency,
    (order.totalMinor / 100).toFixed(2),
    (order.amountPaidMinor / 100).toFixed(2),
    (amountDueMinor(order.totalMinor, order.amountPaidMinor) / 100).toFixed(2),
    isOverdue(order.paymentStatus, order.dueDate, now) ? daysOverdue(order.dueDate, now) : 0,
  ]);

  return toCsv(headers, rows);
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
  exportCsv,
  toSummary,
  toDetail,
  requireOwnedOrder,
};
