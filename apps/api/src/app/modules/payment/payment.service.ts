import {
  formatMinor,
  type Payment as PaymentDto,
  type PaymentResult,
  type RecordPaymentInput,
  type VoidPaymentInput,
} from '@crossval/shared';
import { StatusCodes } from 'http-status-codes';
import mongoose, { Types } from 'mongoose';
import ApiError from '../../../errors/ApiError';
import { auditService } from '../audit/audit.service';
import { Order } from '../order/order.model';
import type { OrderDocument } from '../order/order.repository';
import { amountDueMinor } from '../order/order.utils';
import { orderService } from '../order/order.service';
import type { PaymentAttrs, PaymentDocument } from './payment.interface';
import { Payment } from './payment.model';
import { paymentRepository } from './payment.repository';

const toObjectId = (value: string): Types.ObjectId => new Types.ObjectId(value);

const toPaymentDto = (payment: PaymentDocument | PaymentAttrs): PaymentDto => {
  const document = payment as PaymentDocument;

  return {
    id: document._id.toString(),
    orderId: document.orderId.toString(),
    amountMinor: document.amountMinor,
    paidAt: document.paidAt.toISOString(),
    ...(document.method && { method: document.method }),
    ...(document.reference && { reference: document.reference }),
    ...(document.note && { note: document.note }),
    isReversal: document.isReversal,
    ...(document.reversedPaymentId && {
      reversedPaymentId: document.reversedPaymentId.toString(),
    }),
    voidedAt: document.voidedAt ? document.voidedAt.toISOString() : null,
    createdAt: document.createdAt.toISOString(),
  };
};

/**
 * The guarded update returned nothing, so re-read the order to say exactly how
 * much room is left. The brief asks for the maximum allowed amount, and a
 * message a person can act on beats a bare rejection.
 */
const overPaymentError = async (
  orderId: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<ApiError> => {
  const current = await Order.findOne({ _id: orderId, userId }).lean<OrderDocument>();

  if (!current) {
    return new ApiError(StatusCodes.NOT_FOUND, 'Order not found');
  }

  const remaining = amountDueMinor(current.totalMinor, current.amountPaidMinor);

  return new ApiError(StatusCodes.CONFLICT, 'That payment would exceed the order total', [
    {
      path: 'amount',
      message:
        remaining === 0
          ? 'This order is already paid in full'
          : `The most that can be recorded against this order is ${formatMinor(remaining, current.currency)}`,
    },
  ]);
};

const record = async (
  userId: string,
  orderId: string,
  input: RecordPaymentInput,
  idempotencyKey?: string,
): Promise<{ result: PaymentResult; replayed: boolean }> => {
  // 404 rather than 403 when the order belongs to someone else.
  await orderService.requireOwnedOrder(orderId, userId);

  const ownerId = toObjectId(userId);
  const orderObjectId = toObjectId(orderId);

  // Fast path for a retry: the same key has already been recorded, so return
  // the original rather than taking the money twice.
  if (idempotencyKey) {
    const existing = await paymentRepository.findByIdempotencyKey(ownerId, idempotencyKey);

    if (existing) {
      const order = await Order.findOne({ _id: orderObjectId, userId: ownerId })
        .lean<OrderDocument>()
        .orFail();

      return {
        result: {
          payment: toPaymentDto(existing as PaymentDocument),
          order: orderService.toSummary(order),
        },
        replayed: true,
      };
    }
  }

  const session = await mongoose.startSession();

  try {
    let result: PaymentResult | undefined;

    // The transaction gives atomicity across three documents; the guard inside
    // applyBalanceDelta gives correctness under concurrency. Both are needed.
    await session.withTransaction(async () => {
      const updatedOrder = await paymentRepository.applyBalanceDelta(
        orderObjectId,
        ownerId,
        input.amountMinor,
        1,
        session,
      );

      if (!updatedOrder) {
        throw await overPaymentError(orderObjectId, ownerId);
      }

      const [payment] = await Payment.create(
        [
          {
            userId: ownerId,
            orderId: orderObjectId,
            amountMinor: input.amountMinor,
            paidAt: input.paidAt ?? new Date(),
            ...(input.method && { method: input.method }),
            ...(input.reference && { reference: input.reference }),
            ...(input.note && { note: input.note }),
            isReversal: false,
            voidedAt: null,
            ...(idempotencyKey && { idempotencyKey }),
          },
        ],
        { session },
      );

      if (!payment) {
        throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Payment could not be recorded');
      }

      // Recorded against the order, not the payment: the timeline a person
      // reads is the order's history, and money arriving is part of it.
      await auditService.record(
        {
          userId: ownerId,
          entityType: 'order',
          entityId: orderObjectId,
          action: 'payment.recorded',
          summary: `Payment of ${formatMinor(input.amountMinor, updatedOrder.currency)} recorded`,
          metadata: { paymentId: payment._id.toString(), amountMinor: input.amountMinor },
        },
        session,
      );

      result = {
        payment: toPaymentDto(payment.toObject<PaymentDocument>()),
        order: orderService.toSummary(updatedOrder),
      };
    });

    if (!result) {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Payment could not be recorded');
    }

    return { result, replayed: false };
  } finally {
    await session.endSession();
  }
};

const voidPayment = async (
  userId: string,
  paymentId: string,
  input: VoidPaymentInput,
): Promise<PaymentResult> => {
  const ownerId = toObjectId(userId);

  const original = await Payment.findOne({
    _id: paymentId,
    userId: ownerId,
  }).lean<PaymentDocument>();

  if (!original) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Payment not found');
  }

  if (original.voidedAt) {
    throw new ApiError(StatusCodes.CONFLICT, 'That payment has already been voided');
  }

  if (original.isReversal) {
    throw new ApiError(StatusCodes.CONFLICT, 'A reversal entry cannot itself be voided');
  }

  const session = await mongoose.startSession();

  try {
    let result: PaymentResult | undefined;

    await session.withTransaction(async () => {
      const updatedOrder = await paymentRepository.applyBalanceDelta(
        original.orderId,
        ownerId,
        -original.amountMinor,
        -1,
        session,
      );

      if (!updatedOrder) {
        throw new ApiError(StatusCodes.CONFLICT, 'That payment can no longer be voided');
      }

      await Payment.updateOne(
        { _id: original._id, userId: ownerId, voidedAt: null },
        { $set: { voidedAt: new Date() } },
        { session },
      );

      // The original record is kept and a compensating entry written against
      // it. A financial record is never deleted; the history of what happened
      // is itself data.
      const [reversal] = await Payment.create(
        [
          {
            userId: ownerId,
            orderId: original.orderId,
            amountMinor: -original.amountMinor,
            paidAt: new Date(),
            note: input.reason,
            isReversal: true,
            reversedPaymentId: original._id,
            voidedAt: null,
          },
        ],
        { session },
      );

      if (!reversal) {
        throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Payment could not be voided');
      }

      await auditService.record(
        {
          userId: ownerId,
          entityType: 'order',
          entityId: original.orderId,
          action: 'payment.voided',
          summary: `Payment of ${formatMinor(original.amountMinor, updatedOrder.currency)} voided: ${input.reason}`,
          metadata: {
            paymentId: original._id.toString(),
            reversalId: reversal._id.toString(),
            reason: input.reason,
          },
        },
        session,
      );

      result = {
        payment: toPaymentDto(reversal.toObject<PaymentDocument>()),
        order: orderService.toSummary(updatedOrder),
      };
    });

    if (!result) {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Payment could not be voided');
    }

    return result;
  } finally {
    await session.endSession();
  }
};

const listForOrder = async (userId: string, orderId: string): Promise<PaymentDto[]> => {
  await orderService.requireOwnedOrder(orderId, userId);

  const payments = await paymentRepository.listForOrder(toObjectId(orderId), toObjectId(userId));

  return payments.map((payment) => toPaymentDto(payment as PaymentDocument));
};

/**
 * Proves the denormalised balance still equals the sum of the payments. Exposed
 * as an endpoint and asserted after every scenario in the test suite, so drift
 * is detected rather than discovered by a customer.
 */
const reconcile = async (
  userId: string,
  orderId: string,
): Promise<{
  orderNumber: string;
  storedMinor: number;
  recomputedMinor: number;
  inSync: boolean;
}> => {
  const order = await orderService.requireOwnedOrder(orderId, userId);

  const recomputedMinor = await paymentRepository.sumRecordedPayments(
    order._id,
    toObjectId(userId),
  );

  return {
    orderNumber: order.orderNumber,
    storedMinor: order.amountPaidMinor,
    recomputedMinor,
    inSync: order.amountPaidMinor === recomputedMinor,
  };
};

export const paymentService = {
  record,
  voidPayment,
  listForOrder,
  reconcile,
};
