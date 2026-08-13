import type { ClientSession, Types } from 'mongoose';
import { Order } from '../order/order.model';
import type { OrderDocument } from '../order/order.repository';
import { Payment } from './payment.model';

/**
 * Move an order's balance by `deltaMinor` and recompute its status, in one
 * atomic operation.
 *
 * The guard lives in the *filter*, not in application code. A read-then-check-
 * then-write would leave a window where two requests both read the old balance,
 * both decide there is room, and both write — collecting more than the order is
 * worth. Because a single-document update in MongoDB is atomic, putting the
 * condition in the filter closes that window: whichever request loses simply
 * fails to match and gets `null` back.
 *
 * The update is an aggregation pipeline rather than a plain `$set` so the new
 * status can be computed *from the new balance* in the same operation. Working
 * it out in application code would mean deriving it from a value read earlier,
 * which reintroduces the staleness the guard just removed.
 *
 * Returns `null` when the order does not exist, is not owned by this user, or
 * the change would take the balance outside `0 .. totalMinor`.
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
