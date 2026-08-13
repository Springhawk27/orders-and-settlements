import { PAYMENT_METHODS } from '@crossval/shared';
import { Schema, model, type Model } from 'mongoose';
import type { PaymentAttrs } from './payment.interface';

/**
 * The source of truth for what has been collected. `orders.amountPaidMinor` is
 * a cache of the sum here, kept in step by the atomic write in the repository
 * and checked against this collection by the reconciliation endpoint.
 */
const paymentSchema = new Schema<PaymentAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    amountMinor: { type: Number, required: true },
    paidAt: { type: Date, required: true },
    method: { type: String, enum: PAYMENT_METHODS },
    reference: { type: String, trim: true, maxlength: 120 },
    note: { type: String, trim: true, maxlength: 500 },
    isReversal: { type: Boolean, required: true, default: false },
    reversedPaymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    voidedAt: { type: Date, default: null },
    idempotencyKey: { type: String },
  },
  { timestamps: true },
);

// Payment history on the order detail page.
paymentSchema.index({ orderId: 1, paidAt: -1 });

// Collections reporting over a date range.
paymentSchema.index({ userId: 1, paidAt: -1 });

// Detects a retried request. Partial, so the payments recorded without a key —
// the seed script, for instance — do not all collide on a missing value.
paymentSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

export const Payment: Model<PaymentAttrs> = model<PaymentAttrs>('Payment', paymentSchema);
