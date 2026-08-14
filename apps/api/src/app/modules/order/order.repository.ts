import { PAYMENT_STATUS, type OrderListQuery } from '@crossval/shared';
import type { ClientSession, QueryFilter, SortOrder, Types } from 'mongoose';
import { toSkip } from '../../../helpers/pagination';
import type { OrderAttrs } from './order.interface';
import { Order, OrderCounter } from './order.model';
import { overdueCutoff } from './order.utils';

export type OrderDocument = OrderAttrs & { _id: Types.ObjectId };

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * `overdue` is not a stored value, so filtering by it means reproducing the same
 * condition the badge uses. Both sides come from `overdueCutoff`, which is what
 * stops the list and the row disagreeing.
 */
export const buildOrderFilter = (
  userId: Types.ObjectId,
  query: OrderListQuery,
  now: Date = new Date(),
): QueryFilter<OrderAttrs> => {
  // Tenant scoping belongs in the query, never in a check after the read.
  const filter: QueryFilter<OrderAttrs> = { userId };

  if (query.status === 'overdue') {
    filter.paymentStatus = { $ne: PAYMENT_STATUS.PAID };
    filter.dueDate = { $lte: overdueCutoff(now) };
  } else if (query.status) {
    filter.paymentStatus = query.status;
  }

  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');

    filter.$or = [{ 'customer.nameLower': pattern }, { orderNumber: pattern }];
  }

  // Ranges apply to the issue date, leaving dueDate free for the overdue condition.
  if (query.from || query.to) {
    filter.issueDate = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }

  return filter;
};

/**
 * `_id` breaks ties. Sorting on a field with duplicate values leaves the order
 * of those rows undefined, which shuffles the list between refreshes and, worse,
 * lets skip/limit pagination repeat one row on two pages while missing another.
 */
const buildSort = (query: OrderListQuery): Record<string, SortOrder> => {
  const direction: SortOrder = query.sortDir === 'asc' ? 1 : -1;

  return { [query.sortBy]: direction, _id: direction };
};

const findPage = async (
  filter: QueryFilter<OrderAttrs>,
  query: OrderListQuery,
): Promise<{ orders: OrderDocument[]; total: number }> => {
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort(buildSort(query))
      .skip(toSkip(query.page, query.limit))
      .limit(query.limit)
      .lean<OrderDocument[]>(),
    Order.countDocuments(filter),
  ]);

  return { orders, total };
};

const findOwned = async (orderId: string, userId: Types.ObjectId): Promise<OrderDocument | null> =>
  Order.findOne({ _id: orderId, userId }).lean<OrderDocument>();

/**
 * Atomic increment, so two orders created in the same instant cannot be handed
 * the same number. Counting existing orders would race.
 */
const nextOrderNumber = async (
  userId: Types.ObjectId,
  issueDate: Date,
  session?: ClientSession,
): Promise<string> => {
  const year = issueDate.getUTCFullYear();

  const counter = await OrderCounter.findByIdAndUpdate(
    `${userId.toString()}:${year}`,
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true, ...(session ? { session } : {}) },
  );

  return `ORD-${year}-${String(counter?.seq ?? 1).padStart(4, '0')}`;
};

export const orderRepository = {
  buildOrderFilter,
  findPage,
  findOwned,
  nextOrderNumber,
};
