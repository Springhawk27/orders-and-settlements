import type { Currency, PaymentStatus } from '@crossval/shared';
import type { Types } from 'mongoose';

export type LineItemAttrs = {
  _id: Types.ObjectId;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
};

export type OrderAttrs = {
  userId: Types.ObjectId;
  orderNumber: string;
  customer: {
    name: string;
    /** Lowercased copy of the name, so search does not need a case-insensitive scan. */
    nameLower: string;
    email?: string;
  };
  currency: Currency;
  issueDate: Date;
  dueDate: Date;
  notes?: string;
  lineItems: LineItemAttrs[];
  subtotalMinor: number;
  totalMinor: number;
  /**
   * Kept in step with the payments collection by the atomic write in the
   * payment repository. The payments themselves remain the source of truth;
   * this is a cache so the list page does not need a lookup per row.
   */
  amountPaidMinor: number;
  paymentStatus: PaymentStatus;
  paidInFullAt: Date | null;
  paymentCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type OrderCounterAttrs = {
  /** `${userId}:${year}`, so numbering restarts per user each year. */
  _id: string;
  seq: number;
};
