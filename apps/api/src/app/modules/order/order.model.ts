import { SUPPORTED_CURRENCIES, PAYMENT_STATUSES } from '@crossval/shared';
import { Schema, model, type Model } from 'mongoose';
import type { LineItemAttrs, OrderAttrs, OrderCounterAttrs } from './order.interface.js';

const lineItemSchema = new Schema<LineItemAttrs>(
  {
    description: { type: String, required: true, trim: true, maxlength: 200 },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const orderSchema = new Schema<OrderAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderNumber: { type: String, required: true },
    customer: {
      name: { type: String, required: true, trim: true, maxlength: 160 },
      nameLower: { type: String, required: true },
      email: { type: String, trim: true, lowercase: true },
    },
    currency: { type: String, enum: SUPPORTED_CURRENCIES, required: true },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    notes: { type: String, trim: true, maxlength: 1000 },
    // Embedded rather than a separate collection: line items are only ever read
    // and written as part of their order, and their count is bounded.
    lineItems: { type: [lineItemSchema], required: true },
    subtotalMinor: { type: Number, required: true, min: 0 },
    totalMinor: { type: Number, required: true, min: 0 },
    amountPaidMinor: { type: Number, required: true, default: 0, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, required: true, default: 'pending' },
    paidInFullAt: { type: Date, default: null },
    paymentCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Default list view, newest first.
orderSchema.index({ userId: 1, createdAt: -1 });

// Equality on userId and paymentStatus, range on dueDate: the field order lets
// this one index serve the status filter, the overdue query and ageing buckets.
orderSchema.index({ userId: 1, paymentStatus: 1, dueDate: 1 });

// Per-user numbering, and the lookup by reference.
orderSchema.index({ userId: 1, orderNumber: 1 }, { unique: true });

// Customer search. A prefix match uses this index; a contains match cannot,
// which is noted as a scaling limit rather than solved with a text index here.
orderSchema.index({ userId: 1, 'customer.nameLower': 1 });

const orderCounterSchema = new Schema<OrderCounterAttrs>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

export const Order: Model<OrderAttrs> = model<OrderAttrs>('Order', orderSchema);
export const OrderCounter: Model<OrderCounterAttrs> = model<OrderCounterAttrs>(
  'OrderCounter',
  orderCounterSchema,
);
