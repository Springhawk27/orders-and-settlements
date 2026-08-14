import type { ClientSession, Types } from 'mongoose';
import { Order } from '../order/order.model.js';
import type { OrderDocument } from '../order/order.repository.js';
import { Payment } from './payment.model.js';

/**
 * Moves an order's balance and recomputes its status atomically.
 *
 * The guard is in the filter rather than in application code: a read-then-write
 * leaves a window where two requests both see room and both write. A pipeline
 * update rather than `$set` so the new status is derived from the new balance in
 * the same operation instead of from a value read earlier.
 *
 * Returns `null` if the order is not found, not owned, or the change would take
 * the balance outside `0 .. totalMinor`.
 */
export const applyBalanceDelta = async (
  orderId: Types.ObjectId,
  userId: Types.ObjectId,
  deltaMinor: number,
  paymentCountDelta: number,
  session: ClientSession,
): Promise<OrderDocument | null> =>
  Order.findOneAndUpdate(
    {
      _id: orderId,
      userId,
      $expr: {
        $and: [
          { $lte: [{ $add: ['$amountPaidMinor', deltaMinor] }, '$totalMinor'] },
          { $gte: [{ $add: ['$amountPaidMinor', deltaMinor] }, 0] },
        ],
      },
    },
    [
      {
        $set: {
          amountPaidMinor: { $add: ['$amountPaidMinor', deltaMinor] },
          paymentCount: { $add: ['$paymentCount', paymentCountDelta] },
        },
      },
      {
        // Reads the balance written by the stage above.
        $set: {
          paymentStatus: {
            $switch: {
              branches: [
                { case: { $gte: ['$amountPaidMinor', '$totalMinor'] }, then: 'paid' },
                { case: { $lte: ['$amountPaidMinor', 0] }, then: 'pending' },
              ],
              default: 'partially_paid',
            },
          },
        },
      },
      {
        // Stamped the first time the order reaches paid, and cleared if a void
        // takes it back below the total.
        $set: {
          paidInFullAt: {
            $cond: [
              { $eq: ['$paymentStatus', 'paid'] },
              { $ifNull: ['$paidInFullAt', '$$NOW'] },
              null,
            ],
          },
        },
      },
    ],
    // Mongoose 9 requires the pipeline form to be declared rather than inferred
    // from the update being an array.
    { session, returnDocument: 'after', updatePipeline: true },
  ).lean<OrderDocument>();

const findByIdempotencyKey = async (userId: Types.ObjectId, idempotencyKey: string) =>
  Payment.findOne({ userId, idempotencyKey }).lean();

const listForOrder = async (orderId: Types.ObjectId, userId: Types.ObjectId) =>
  Payment.find({ orderId, userId }).sort({ paidAt: -1, createdAt: -1 }).lean();

/**
 * Recomputes an order's balance from the payments themselves. The denormalised
 * field is a cache; this is how we prove it never silently drifts.
 */
const sumRecordedPayments = async (
  orderId: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<number> => {
  const [result] = await Payment.aggregate<{ total: number }>([
    { $match: { orderId, userId } },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } },
  ]);

  return result?.total ?? 0;
};

export const paymentRepository = {
  applyBalanceDelta,
  findByIdempotencyKey,
  listForOrder,
  sumRecordedPayments,
};
