import { z } from 'zod';
import {
  DEFAULT_CURRENCY,
  DISPLAY_STATUSES,
  ORDER_SORT_FIELDS,
  PAGINATION,
  PAYMENT_METHODS,
  SORT_DIRECTIONS,
  SUPPORTED_CURRENCIES,
} from './constants';
import { MONEY_PATTERN, parseMoneyToMinor } from './money';

/**
 * Accepts an amount as typed by a person and yields integer minor units.
 * Validation happens against the string form so that "12.345" is rejected
 * rather than quietly rounded.
 */
const money = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === 'number' ? String(value) : value.trim()))
  .refine((value) => MONEY_PATTERN.test(value), {
    error: 'Use at most two decimal places, for example 1250.50',
  })
  .transform(parseMoneyToMinor);

const nonNegativeMoney = money.refine((minorUnits) => minorUnits >= 0, {
  error: 'Amount cannot be negative',
});

const positiveMoney = money.refine((minorUnits) => minorUnits > 0, {
  error: 'Amount must be greater than zero',
});

/** A calendar date. Stored at UTC midnight so comparisons are timezone-stable. */
const calendarDate = z.iso.date().transform((value) => new Date(`${value}T00:00:00.000Z`));

// Normalise before validating: an address pasted with a trailing space is a
// valid address, and rejecting it would be a validation bug rather than a rule.
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address' }));

/**
 * An optional email as a form actually submits one. An untouched input sends
 * `""`, not `undefined`, and treating that as a malformed address would reject
 * the field for being left blank — which is the opposite of optional.
 */
export const optionalEmailSchema = z
  .union([z.literal(''), emailSchema])
  .transform((value) => (value === '' ? undefined : value))
  .optional();

export const passwordSchema = z
  .string()
  .min(8, { error: 'Password must be at least 8 characters' })
  .max(128, { error: 'Password must be at most 128 characters' });

export const registerSchema = z.object({
  name: z.string().trim().min(1, { error: 'Name is required' }).max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'Password is required' }),
});

/**
 * Renamed on the way out: the request carries `unitPrice` as a decimal, and
 * everything downstream works in minor units. The name says which one it holds.
 */
export const lineItemInputSchema = z
  .object({
    description: z.string().trim().min(1, { error: 'Description is required' }).max(200),
    quantity: z
      .int({ error: 'Quantity must be a whole number' })
      .min(1, { error: 'Quantity must be at least 1' })
      .max(1_000_000),
    unitPrice: nonNegativeMoney,
  })
  .transform(({ unitPrice, ...rest }) => ({ ...rest, unitPriceMinor: unitPrice }));

export const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1, { error: 'Customer name is required' }).max(160),
    email: optionalEmailSchema,
  }),
  currency: z.enum(SUPPORTED_CURRENCIES).default(DEFAULT_CURRENCY),
  issueDate: calendarDate.optional(),
  dueDate: calendarDate,
  notes: z.string().trim().max(1000).optional(),
  lineItems: z
    .array(lineItemInputSchema)
    .min(1, { error: 'An order needs at least one line item' })
    .max(100),
});

/**
 * Line items may be edited only while the order has no payments against it.
 * That rule depends on stored state, so it is enforced in the service rather
 * than by leaving the field out of the request shape.
 */
export const updateOrderSchema = z
  .object({
    customer: z
      .object({
        name: z.string().trim().min(1).max(160).optional(),
        email: optionalEmailSchema,
      })
      .optional(),
    dueDate: calendarDate.optional(),
    notes: z.string().trim().max(1000).optional(),
    lineItems: z.array(lineItemInputSchema).min(1).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    error: 'Provide at least one field to update',
  });

export const recordPaymentSchema = z
  .object({
    amount: positiveMoney,
    paidAt: calendarDate.optional(),
    method: z.enum(PAYMENT_METHODS).optional(),
    reference: z.string().trim().max(120).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .transform(({ amount, ...rest }) => ({ ...rest, amountMinor: amount }));

export const voidPaymentSchema = z.object({
  reason: z.string().trim().min(1, { error: 'A reason is required' }).max(500),
});

export const orderListQuerySchema = z.object({
  status: z.enum(DISPLAY_STATUSES).optional(),
  q: z.string().trim().max(160).optional(),
  from: calendarDate.optional(),
  to: calendarDate.optional(),
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
  sortBy: z.enum(ORDER_SORT_FIELDS).default('createdAt'),
  sortDir: z.enum(SORT_DIRECTIONS).default('desc'),
});

export const dateRangeQuerySchema = z.object({
  from: calendarDate.optional(),
  to: calendarDate.optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type LineItemInput = z.infer<typeof lineItemInputSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
