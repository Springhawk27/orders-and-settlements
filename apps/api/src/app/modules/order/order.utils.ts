import {
  AGING_BUCKET,
  PAYMENT_STATUS,
  type AgingBucket,
  type DisplayStatus,
  type PaymentStatus,
} from '@crossval/shared';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Stored on the order and updated only when money moves. `paid` is checked
 * first so an order totalling zero counts as settled rather than pending.
 */
export const derivePaymentStatus = (amountPaidMinor: number, totalMinor: number): PaymentStatus => {
  if (amountPaidMinor >= totalMinor) {
    return PAYMENT_STATUS.PAID;
  }

  return amountPaidMinor <= 0 ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.PARTIALLY_PAID;
};

export const amountDueMinor = (totalMinor: number, amountPaidMinor: number): number =>
  Math.max(0, totalMinor - amountPaidMinor);

/**
 * Due dates are stored at UTC midnight, so an order due on the 14th is not late
 * until the 15th begins — a full day has to elapse before it counts as one day
 * overdue.
 */
export const daysOverdue = (dueDate: Date, now: Date = new Date()): number => {
  const elapsed = now.getTime() - dueDate.getTime();

  return elapsed <= 0 ? 0 : Math.floor(elapsed / MILLISECONDS_PER_DAY);
};

export const isOverdue = (
  paymentStatus: PaymentStatus,
  dueDate: Date,
  now: Date = new Date(),
): boolean => paymentStatus !== PAYMENT_STATUS.PAID && daysOverdue(dueDate, now) >= 1;

/**
 * What the client renders. Never persisted, because it depends on the current
 * time: a stored value would be correct when written and wrong the next morning.
 */
export const deriveDisplayStatus = (
  paymentStatus: PaymentStatus,
  dueDate: Date,
  now: Date = new Date(),
): DisplayStatus => (isOverdue(paymentStatus, dueDate, now) ? 'overdue' : paymentStatus);

export const agingBucketFor = (
  paymentStatus: PaymentStatus,
  dueDate: Date,
  now: Date = new Date(),
): AgingBucket => {
  if (!isOverdue(paymentStatus, dueDate, now)) {
    return AGING_BUCKET.CURRENT;
  }

  const days = daysOverdue(dueDate, now);

  if (days <= 30) {
    return AGING_BUCKET.DAYS_1_30;
  }

  if (days <= 60) {
    return AGING_BUCKET.DAYS_31_60;
  }

  return days <= 90 ? AGING_BUCKET.DAYS_61_90 : AGING_BUCKET.DAYS_90_PLUS;
};

/**
 * The cutoff an indexed query uses to find overdue orders: a full day must have
 * passed, so anything due on or before this instant is late.
 */
export const overdueCutoff = (now: Date = new Date()): Date =>
  new Date(now.getTime() - MILLISECONDS_PER_DAY);

export const wasPaidLate = (paidInFullAt: Date | null | undefined, dueDate: Date): boolean =>
  paidInFullAt ? daysOverdue(dueDate, paidInFullAt) >= 1 : false;
