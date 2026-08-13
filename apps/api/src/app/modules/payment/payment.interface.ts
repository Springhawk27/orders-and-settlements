import type { PaymentMethod } from '@crossval/shared';
import type { Types } from 'mongoose';

export type PaymentAttrs = {
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  /** Signed: positive for a payment, negative for the reversal that voids one. */
  amountMinor: number;
  paidAt: Date;
  method?: PaymentMethod;
  reference?: string;
  note?: string;
  isReversal: boolean;
  reversedPaymentId?: Types.ObjectId;
  voidedAt: Date | null;
  /** Present only when the client supplied an Idempotency-Key header. */
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentDocument = PaymentAttrs & { _id: Types.ObjectId };
