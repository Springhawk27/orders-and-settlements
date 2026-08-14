import {
  AGING_BUCKETS,
  DEFAULT_CURRENCY,
  DISPLAY_STATUSES,
  PAYMENT_STATUS,
  type AgingBreakdown,
  type AgingBucket,
  type DashboardSummary,
  type DisplayStatus,
} from '@crossval/shared';
import { Types } from 'mongoose';
import { Order } from '../order/order.model.js';
import { overdueCutoff } from '../order/order.utils.js';
import { Payment } from '../payment/payment.model.js';

type StatusCount = { _id: string; count: number };
type BucketTotal = { _id: AgingBucket; orderCount: number; amountMinor: number };
type SingleTotal = { total: number };

const startOfMonth = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

/**
 * Ageing is expressed in the aggregation with the same day boundaries the API
 * uses elsewhere: an order is one day overdue once a full day has passed.
 */
const agingBucketExpression = (cutoff: Date) => ({
  $switch: {
    branches: [
      { case: { $gt: ['$dueDate', cutoff] }, then: 'current' },
      {
        case: { $gt: ['$dueDate', new Date(cutoff.getTime() - 30 * 86_400_000)] },
        then: '1-30',
      },
      {
        case: { $gt: ['$dueDate', new Date(cutoff.getTime() - 60 * 86_400_000)] },
        then: '31-60',
      },
      {
        case: { $gt: ['$dueDate', new Date(cutoff.getTime() - 90 * 86_400_000)] },
        then: '61-90',
      },
    ],
    default: '90+',
  },
});

const emptyBuckets = (): AgingBreakdown[] =>
  AGING_BUCKETS.map((bucket) => ({ bucket, orderCount: 0, amountMinor: 0 }));

const emptyStatusCounts = (): Record<DisplayStatus, number> =>
  Object.fromEntries(DISPLAY_STATUSES.map((status) => [status, 0])) as Record<
    DisplayStatus,
    number
  >;

/**
 * One round trip. `$facet` runs every branch over the same matched set, so the
 * KPI row, the status breakdown and the ageing chart cost a single pass rather
 * than five separate queries.
 */
const getSummary = async (userId: string): Promise<DashboardSummary> => {
  const ownerId = new Types.ObjectId(userId);
  const now = new Date();
  const cutoff = overdueCutoff(now);
  const unpaid = { $ne: PAYMENT_STATUS.PAID };

  const [facets] = await Order.aggregate<{
    outstanding: SingleTotal[];
    overdue: SingleTotal[];
    statusCounts: StatusCount[];
    overdueCount: StatusCount[];
    aging: BucketTotal[];
    orderCount: SingleTotal[];
  }>([
    { $match: { userId: ownerId } },
    {
      $facet: {
        outstanding: [
          { $match: { paymentStatus: unpaid } },
          {
            $group: {
              _id: null,
              total: { $sum: { $subtract: ['$totalMinor', '$amountPaidMinor'] } },
            },
          },
        ],
        overdue: [
          { $match: { paymentStatus: unpaid, dueDate: { $lte: cutoff } } },
          {
            $group: {
              _id: null,
              total: { $sum: { $subtract: ['$totalMinor', '$amountPaidMinor'] } },
            },
          },
        ],
        statusCounts: [{ $group: { _id: '$paymentStatus', count: { $sum: 1 } } }],
        overdueCount: [
          { $match: { paymentStatus: unpaid, dueDate: { $lte: cutoff } } },
          { $group: { _id: '$paymentStatus', count: { $sum: 1 } } },
        ],
        aging: [
          { $match: { paymentStatus: unpaid } },
          { $set: { bucket: agingBucketExpression(cutoff) } },
          {
            $group: {
              _id: '$bucket',
              orderCount: { $sum: 1 },
              amountMinor: { $sum: { $subtract: ['$totalMinor', '$amountPaidMinor'] } },
            },
          },
        ],
        orderCount: [{ $group: { _id: null, total: { $sum: 1 } } }],
      },
    },
  ]);

  // Collections are counted from the payments themselves, not from order state,
  // because an order can be settled in a month other than the one it was raised.
  const [collected] = await Payment.aggregate<SingleTotal>([
    { $match: { userId: ownerId, paidAt: { $gte: startOfMonth(now) } } },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } },
  ]);

  const countsByStatus = emptyStatusCounts();

  for (const entry of facets?.statusCounts ?? []) {
    if (entry._id in countsByStatus) {
      countsByStatus[entry._id as DisplayStatus] = entry.count;
    }
  }

  // Overdue is derived, so it is reported alongside the stored statuses rather
  // than replacing them: an order can be both partially paid and overdue.
  countsByStatus.overdue = (facets?.overdueCount ?? []).reduce(
    (total, entry) => total + entry.count,
    0,
  );

  const aging = emptyBuckets().map((empty) => {
    const found = (facets?.aging ?? []).find((entry) => entry._id === empty.bucket);

    return found
      ? { bucket: empty.bucket, orderCount: found.orderCount, amountMinor: found.amountMinor }
      : empty;
  });

  return {
    currency: DEFAULT_CURRENCY,
    totalOutstandingMinor: facets?.outstanding[0]?.total ?? 0,
    totalOverdueMinor: facets?.overdue[0]?.total ?? 0,
    collectedThisMonthMinor: collected?.total ?? 0,
    orderCount: facets?.orderCount[0]?.total ?? 0,
    countsByStatus,
    aging,
  };
};

export const dashboardService = {
  getSummary,
};
