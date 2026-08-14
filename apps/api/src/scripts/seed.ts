import {
  DEFAULT_CURRENCY,
  formatMinor,
  lineTotalMinor,
  parseMoneyToMinor,
  sumMinor,
} from '@crossval/shared';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import config from '../config';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { AuditEvent } from '../app/modules/audit/audit.model';
import { Session, User } from '../app/modules/auth/auth.model';
import { Order, OrderCounter } from '../app/modules/order/order.model';
import { derivePaymentStatus } from '../app/modules/order/order.utils';
import { Payment } from '../app/modules/payment/payment.model';
import logger from '../shared/logger';

const DEMO_EMAIL = 'demo@settlements.app';
const DEMO_PASSWORD = 'demo-password-2026';

const daysFromNow = (days: number): Date => {
  const date = new Date();

  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);

  return date;
};

type SeedOrder = {
  customer: string;
  email?: string;
  dueInDays: number;
  issuedDaysAgo: number;
  lines: { description: string; quantity: number; unitPrice: string }[];
  /** Amounts to record against the order, in the order they were collected. */
  payments: string[];
};

/**
 * Chosen so every status and every ageing bucket is represented the moment the
 * demo account is opened, rather than leaving the dashboard empty.
 */
const seedOrders: SeedOrder[] = [
  {
    customer: 'Gulf Trading LLC',
    email: 'ap@gulftrading.ae',
    issuedDaysAgo: 12,
    dueInDays: 18,
    lines: [{ description: 'Quarterly advisory retainer', quantity: 3, unitPrice: '4500' }],
    payments: [],
  },
  {
    customer: 'Nakheel Contracting',
    email: 'finance@nakheelcontracting.ae',
    issuedDaysAgo: 20,
    dueInDays: 10,
    lines: [
      { description: 'Site survey', quantity: 1, unitPrice: '7800' },
      { description: 'Structural report', quantity: 2, unitPrice: '3100' },
    ],
    payments: ['5000'],
  },
  {
    customer: 'Emirates Logistics FZE',
    email: 'accounts@emirateslogistics.ae',
    issuedDaysAgo: 45,
    dueInDays: -15,
    lines: [{ description: 'Freight forwarding, March', quantity: 1, unitPrice: '18250.75' }],
    payments: [],
  },
  {
    customer: 'Al Barsha Interiors',
    issuedDaysAgo: 70,
    dueInDays: -40,
    lines: [
      { description: 'Fit-out design', quantity: 1, unitPrice: '22000' },
      { description: 'Revisions', quantity: 4, unitPrice: '850' },
    ],
    payments: ['9000'],
  },
  {
    customer: 'Sharjah Media Group',
    email: 'payables@shjmedia.ae',
    issuedDaysAgo: 100,
    dueInDays: -72,
    lines: [{ description: 'Campaign production', quantity: 1, unitPrice: '31400' }],
    payments: ['10000', '5400'],
  },
  {
    customer: 'Dubai Health Partners',
    issuedDaysAgo: 140,
    dueInDays: -110,
    lines: [{ description: 'Compliance audit', quantity: 1, unitPrice: '14600' }],
    payments: [],
  },
  {
    customer: 'Jebel Ali Steelworks',
    email: 'ar@jasteel.ae',
    issuedDaysAgo: 30,
    dueInDays: -3,
    lines: [{ description: 'Fabrication, batch 214', quantity: 6, unitPrice: '2150' }],
    payments: ['12900'],
  },
  {
    customer: 'Marina Hospitality',
    email: 'accounts@marinahospitality.ae',
    issuedDaysAgo: 26,
    dueInDays: -6,
    lines: [{ description: 'Menu photography', quantity: 1, unitPrice: '6400' }],
    payments: ['6400'],
  },
  {
    customer: 'RAK Ceramics Supply',
    issuedDaysAgo: 8,
    dueInDays: 22,
    lines: [{ description: 'Tile consignment', quantity: 40, unitPrice: '312.50' }],
    payments: ['5000', '3500'],
  },
  {
    customer: 'Abu Dhabi Facilities',
    email: 'finance@adfacilities.ae',
    issuedDaysAgo: 5,
    dueInDays: 25,
    lines: [{ description: 'Annual maintenance contract', quantity: 1, unitPrice: '48000' }],
    payments: ['48000'],
  },
];

const FILLER_CUSTOMERS = [
  'Al Quoz Printing',
  'Deira Wholesale',
  'Palm Facilities Group',
  'Creek Marine Services',
  'Yas Events Company',
  'Mussafah Industrial',
  'Karama Textiles',
  'Silicon Oasis Systems',
  'Bur Dubai Catering',
  'Fujairah Freight',
  'Ajman Packaging',
  'Motor City Automotive',
  'Discovery Gardens Retail',
  'Barsha Heights Media',
  'Dubai Marina Fitness',
  'Umm Suqeim Interiors',
];

/**
 * Enough orders that the list runs to a second page. Pagination hides itself
 * when everything fits on one, so without these a reviewer never sees it.
 */
const fillerOrders: SeedOrder[] = FILLER_CUSTOMERS.map((customer, index) => {
  const issuedDaysAgo = 4 + index * 3;
  const dueInDays = 30 - issuedDaysAgo;
  const unitPrice = (1200 + index * 340).toFixed(2);
  const quantity = 1 + (index % 4);
  const total = Number(unitPrice) * quantity;

  // A repeating pattern across the set: unpaid, part paid, settled.
  const payments =
    index % 3 === 0 ? [] : index % 3 === 1 ? [(total * 0.4).toFixed(2)] : [total.toFixed(2)];

  return {
    customer,
    issuedDaysAgo,
    dueInDays,
    lines: [{ description: 'Services rendered', quantity, unitPrice }],
    payments,
  };
});

const run = async (): Promise<void> => {
  await connectDatabase();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, config.bcryptSaltRounds);

  const user = await User.findOneAndUpdate(
    { email: DEMO_EMAIL },
    { $set: { name: 'Demo Account', email: DEMO_EMAIL, passwordHash } },
    { upsert: true, returnDocument: 'after' },
  ).orFail();

  const userId = user._id;

  // Re-running the seed replaces the demo data rather than stacking a second
  // copy on top of it.
  await Promise.all([
    Order.deleteMany({ userId }),
    Payment.deleteMany({ userId }),
    AuditEvent.deleteMany({ userId }),
    Session.deleteMany({ userId }),
    OrderCounter.deleteMany({ _id: new RegExp(`^${userId.toString()}:`) }),
  ]);

  const year = new Date().getUTCFullYear();
  let sequence = 0;

  for (const seed of [...seedOrders, ...fillerOrders]) {
    sequence += 1;

    const lineItems = seed.lines.map((line) => {
      const unitPriceMinor = parseMoneyToMinor(line.unitPrice);

      return {
        _id: new Types.ObjectId(),
        description: line.description,
        quantity: line.quantity,
        unitPriceMinor,
        lineTotalMinor: lineTotalMinor(line.quantity, unitPriceMinor),
      };
    });

    const subtotalMinor = sumMinor(lineItems.map((item) => item.lineTotalMinor));
    const paidMinor = sumMinor(seed.payments.map(parseMoneyToMinor));
    const dueDate = daysFromNow(seed.dueInDays);
    const issueDate = daysFromNow(-seed.issuedDaysAgo);
    const paymentStatus = derivePaymentStatus(paidMinor, subtotalMinor);

    const order = await Order.create({
      userId,
      orderNumber: `ORD-${year}-${String(sequence).padStart(4, '0')}`,
      customer: {
        name: seed.customer,
        nameLower: seed.customer.toLowerCase(),
        ...(seed.email && { email: seed.email }),
      },
      currency: DEFAULT_CURRENCY,
      issueDate,
      dueDate,
      lineItems,
      subtotalMinor,
      totalMinor: subtotalMinor,
      amountPaidMinor: paidMinor,
      paymentStatus,
      paidInFullAt: paymentStatus === 'paid' ? daysFromNow(-1) : null,
      paymentCount: seed.payments.length,
    });

    await AuditEvent.create({
      userId,
      entityType: 'order',
      entityId: order._id,
      action: 'order.created',
      summary: `Order ${order.orderNumber} created for ${seed.customer}`,
      at: issueDate,
    });

    for (const [index, amount] of seed.payments.entries()) {
      const amountMinor = parseMoneyToMinor(amount);
      const paidAt = daysFromNow(-(seed.issuedDaysAgo - (index + 1) * 2));

      const payment = await Payment.create({
        userId,
        orderId: order._id,
        amountMinor,
        paidAt,
        method: 'bank_transfer',
        reference: `TRF-${order.orderNumber}-${index + 1}`,
        isReversal: false,
        voidedAt: null,
      });

      await AuditEvent.create({
        userId,
        entityType: 'order',
        entityId: order._id,
        action: 'payment.recorded',
        summary: `Payment of ${formatMinor(amountMinor)} recorded`,
        metadata: { paymentId: payment._id.toString(), amountMinor },
        at: paidAt,
      });
    }
  }

  // The counter has to continue from the seeded numbers, or the first order a
  // reviewer creates would collide with an existing one.
  await OrderCounter.findByIdAndUpdate(
    `${userId.toString()}:${year}`,
    { $set: { seq: sequence } },
    { upsert: true },
  );

  logger.info(
    { email: DEMO_EMAIL, orders: sequence },
    'demo data seeded — sign in with the demo credentials',
  );

  await disconnectDatabase();
};

run().catch((error: unknown) => {
  logger.fatal({ err: error }, 'seeding failed');
  process.exit(1);
});
