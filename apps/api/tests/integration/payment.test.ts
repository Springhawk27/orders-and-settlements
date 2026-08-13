import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { createTestUser, type TestUser } from '../helpers/auth';

const ORDERS = '/api/v1/orders';

let owner: TestUser;
let orderId: string;

/** An order for AED 1,000.00, matching the scenario in the brief. */
const createThousandOrder = async (user: TestUser, dueDate = '2030-01-15') => {
  const response = await request(app)
    .post(ORDERS)
    .set('Cookie', user.cookies)
    .send({
      customer: { name: 'Gulf Trading LLC' },
      dueDate,
      lineItems: [{ description: 'Consulting', quantity: 2, unitPrice: '500' }],
    });

  return response.body.data.id as string;
};

const pay = (amount: string, key?: string) => {
  const req = request(app).post(`${ORDERS}/${orderId}/payments`).set('Cookie', owner.cookies);

  return key ? req.set('Idempotency-Key', key).send({ amount }) : req.send({ amount });
};

const fetchOrder = () => request(app).get(`${ORDERS}/${orderId}`).set('Cookie', owner.cookies);

const reconcile = () =>
  request(app).get(`${ORDERS}/${orderId}/payments/reconcile`).set('Cookie', owner.cookies);

beforeEach(async () => {
  owner = await createTestUser('owner');
  orderId = await createThousandOrder(owner);
});

describe('the payment scenario from the brief', () => {
  it('walks 1000 -> 400 -> 600 -> rejected', async () => {
    const first = await pay('400');
    expect(first.status).toBe(201);
    expect(first.body.data.order).toMatchObject({
      paymentStatus: 'partially_paid',
      amountPaidMinor: 40000,
      amountDueMinor: 60000,
    });

    const second = await pay('600');
    expect(second.status).toBe(201);
    expect(second.body.data.order).toMatchObject({
      paymentStatus: 'paid',
      amountPaidMinor: 100000,
      amountDueMinor: 0,
    });

    const overPayment = await pay('1');
    expect(overPayment.status).toBe(409);
    expect(overPayment.body.errorMessages[0].message).toMatch(/already paid in full/i);
  });

  it('names the maximum that can still be recorded', async () => {
    await pay('400');

    const tooMuch = await pay('700');

    expect(tooMuch.status).toBe(409);
    // The brief asks for an actionable error, so the remaining balance is named.
    expect(tooMuch.body.errorMessages[0].message).toMatch(/600\.00/);
  });

  it('stamps when the order was settled and whether that was late', async () => {
    const lateOrderId = await createThousandOrder(owner, '2020-01-01');

    await request(app)
      .post(`${ORDERS}/${lateOrderId}/payments`)
      .set('Cookie', owner.cookies)
      .send({ amount: '1000' });

    const response = await request(app)
      .get(`${ORDERS}/${lateOrderId}`)
      .set('Cookie', owner.cookies);

    expect(response.body.data.paidInFullAt).not.toBeNull();
    expect(response.body.data.wasPaidLate).toBe(true);
    // Settled, so it is no longer shown as overdue even though it was.
    expect(response.body.data.displayStatus).toBe('paid');
  });
});

describe('concurrency', () => {
  it('cannot be over-paid by simultaneous requests', async () => {
    // Eight requests for AED 200.00 land at once against a AED 1,000.00 order.
    // Exactly five fit. A read-then-write implementation lets all eight through.
    const responses = await Promise.all(Array.from({ length: 8 }, () => pay('200')));

    const accepted = responses.filter((response) => response.status === 201);
    const rejected = responses.filter((response) => response.status === 409);

    expect(accepted).toHaveLength(5);
    expect(rejected).toHaveLength(3);

    const order = await fetchOrder();
    expect(order.body.data.amountPaidMinor).toBe(100000);
    expect(order.body.data.paymentStatus).toBe('paid');

    // The denormalised balance still equals the sum of the payment records.
    const check = await reconcile();
    expect(check.body.data).toMatchObject({
      storedMinor: 100000,
      recomputedMinor: 100000,
      inSync: true,
    });
  });

  it('accepts concurrent payments that together still fit', async () => {
    // The guard must not reject work that is legitimately within the balance.
    const responses = await Promise.all([pay('300'), pay('300'), pay('400')]);

    expect(responses.every((response) => response.status === 201)).toBe(true);

    const order = await fetchOrder();
    expect(order.body.data.amountPaidMinor).toBe(100000);
  });
});

describe('idempotency', () => {
  it('records one payment when the same key arrives twice', async () => {
    const key = 'retry-after-timeout-0001';

    const first = await pay('400', key);
    const second = await pay('400', key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.headers['idempotent-replay']).toBe('true');

    // Same payment returned, not a second one created.
    expect(second.body.data.payment.id).toBe(first.body.data.payment.id);

    const order = await fetchOrder();
    expect(order.body.data.amountPaidMinor).toBe(40000);
    expect(order.body.data.paymentCount).toBe(1);
  });

  it('treats different keys as different payments', async () => {
    await pay('400', 'key-one');
    await pay('400', 'key-two');

    const order = await fetchOrder();
    expect(order.body.data.amountPaidMinor).toBe(80000);
    expect(order.body.data.paymentCount).toBe(2);
  });

  it('records every payment when no key is supplied', async () => {
    await pay('100');
    await pay('100');

    const order = await fetchOrder();
    expect(order.body.data.amountPaidMinor).toBe(20000);
  });
});

describe('voiding a payment', () => {
  const voidPayment = (paymentId: string, reason = 'Recorded against the wrong order') =>
    request(app)
      .post(`/api/v1/payments/${paymentId}/void`)
      .set('Cookie', owner.cookies)
      .send({ reason });

  it('writes a compensating entry rather than deleting the record', async () => {
    const recorded = await pay('400');
    const paymentId = recorded.body.data.payment.id as string;

    const voided = await voidPayment(paymentId);

    expect(voided.status).toBe(200);
    expect(voided.body.data.payment).toMatchObject({
      amountMinor: -40000,
      isReversal: true,
      reversedPaymentId: paymentId,
    });
    expect(voided.body.data.order).toMatchObject({
      amountPaidMinor: 0,
      paymentStatus: 'pending',
    });

    // Three records: the original, now marked voided, and the reversal.
    const history = await request(app)
      .get(`${ORDERS}/${orderId}/payments`)
      .set('Cookie', owner.cookies);

    expect(history.body.data).toHaveLength(2);
    expect(history.body.data.some((entry: { voidedAt: string | null }) => entry.voidedAt)).toBe(
      true,
    );
  });

  it('keeps the recomputed balance in step after a void', async () => {
    const recorded = await pay('400');
    await voidPayment(recorded.body.data.payment.id as string);

    const check = await reconcile();
    // 400 recorded plus -400 reversal sums to zero, matching the stored value.
    expect(check.body.data).toMatchObject({ storedMinor: 0, recomputedMinor: 0, inSync: true });
  });

  it('refuses to void the same payment twice', async () => {
    const recorded = await pay('400');
    const paymentId = recorded.body.data.payment.id as string;

    await voidPayment(paymentId);
    const again = await voidPayment(paymentId);

    expect(again.status).toBe(409);
  });

  it('refuses to void a reversal entry', async () => {
    const recorded = await pay('400');
    const voided = await voidPayment(recorded.body.data.payment.id as string);

    const response = await voidPayment(voided.body.data.payment.id as string);

    expect(response.status).toBe(409);
  });

  it('requires a reason', async () => {
    const recorded = await pay('400');

    const response = await request(app)
      .post(`/api/v1/payments/${recorded.body.data.payment.id}/void`)
      .set('Cookie', owner.cookies)
      .send({});

    expect(response.status).toBe(400);
  });
});

describe('what a payment locks on the order', () => {
  it('freezes the line items once money has been recorded', async () => {
    await pay('400');

    const response = await request(app)
      .patch(`${ORDERS}/${orderId}`)
      .set('Cookie', owner.cookies)
      .send({ lineItems: [{ description: 'Changed', quantity: 1, unitPrice: '10' }] });

    expect(response.status).toBe(409);
    expect(response.body.errorMessages[0].path).toBe('lineItems');
  });

  it('still allows the due date and customer to be changed', async () => {
    await pay('400');

    const response = await request(app)
      .patch(`${ORDERS}/${orderId}`)
      .set('Cookie', owner.cookies)
      .send({ dueDate: '2031-06-01' });

    expect(response.status).toBe(200);
  });

  it('blocks deleting an order that has payments', async () => {
    await pay('400');

    const response = await request(app).delete(`${ORDERS}/${orderId}`).set('Cookie', owner.cookies);

    expect(response.status).toBe(409);
  });

  it('allows the line items to be edited again once the payment is voided', async () => {
    const recorded = await pay('400');

    await request(app)
      .post(`/api/v1/payments/${recorded.body.data.payment.id}/void`)
      .set('Cookie', owner.cookies)
      .send({ reason: 'Entered in error' });

    const response = await request(app)
      .patch(`${ORDERS}/${orderId}`)
      .set('Cookie', owner.cookies)
      .send({ lineItems: [{ description: 'Revised', quantity: 1, unitPrice: '250' }] });

    expect(response.status).toBe(200);
    expect(response.body.data.totalMinor).toBe(25000);
  });
});

describe('validation and ownership', () => {
  it('rejects a zero or negative amount', async () => {
    expect((await pay('0')).status).toBe(400);
    expect((await pay('-50')).status).toBe(400);
  });

  it('rejects an amount with more than two decimal places', async () => {
    expect((await pay('10.005')).status).toBe(400);
  });

  it('will not record a payment against another user order', async () => {
    const other = await createTestUser('other');

    const response = await request(app)
      .post(`${ORDERS}/${orderId}/payments`)
      .set('Cookie', other.cookies)
      .send({ amount: '100' });

    expect(response.status).toBe(404);
  });

  it('requires authentication', async () => {
    const response = await request(app)
      .post(`${ORDERS}/${orderId}/payments`)
      .send({ amount: '10' });

    expect(response.status).toBe(401);
  });
});
