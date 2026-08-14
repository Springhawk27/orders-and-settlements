export const API_VERSION = 'v1';

/**
 * One currency. Orders store it, so adding more is schema-compatible, but the
 * dashboard sums balances across all of them and totalling two currencies would
 * be meaningless without per-currency aggregation and a rate at payment time.
 */
export const SUPPORTED_CURRENCIES = ['USD'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'USD';

/**
 * Persisted on the order. A pure function of amount paid against the order
 * total, so it only changes when money moves and is safe to store.
 */
export const PAYMENT_STATUSES = ['pending', 'partially_paid', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
} as const satisfies Record<string, PaymentStatus>;

/**
 * What the client renders. Adds `overdue`, which depends on the current time
 * rather than on stored data and so is derived on every read, never persisted.
 */
export const DISPLAY_STATUSES = ['pending', 'partially_paid', 'paid', 'overdue'] as const;
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

export const PAYMENT_METHODS = ['bank_transfer', 'card', 'cash', 'cheque', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Everything that mutates an order or a payment writes one of these. Append only. */
export const AUDIT_ACTIONS = [
  'order.created',
  'order.updated',
  'order.line_items_replaced',
  'order.deleted',
  'payment.recorded',
  'payment.voided',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Receivables ageing, measured in whole days past the due date. */
export const AGING_BUCKETS = ['current', '1-30', '31-60', '61-90', '90+'] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export const AGING_BUCKET = {
  CURRENT: 'current',
  DAYS_1_30: '1-30',
  DAYS_31_60: '31-60',
  DAYS_61_90: '61-90',
  DAYS_90_PLUS: '90+',
} as const satisfies Record<string, AgingBucket>;

export const MINOR_UNITS_PER_MAJOR = 100;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const ORDER_SORT_FIELDS = ['createdAt', 'dueDate', 'totalMinor', 'orderNumber'] as const;
export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];
