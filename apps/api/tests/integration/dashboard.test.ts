import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { createTestUser, type TestUser } from '../helpers/auth';

const ORDERS = '/api/v1/orders';
const SUMMARY = '/api/v1/dashboard/summary';

let owner: TestUser;

const createOrder = async (
  user: TestUser,
  { customer = 'Gulf Trading LLC', dueDate = '2030-01-15', unitPrice = '500', quantity = 2 } = {},
) => {
  const response = await request(app)
    .post(ORDERS)
    .set('Cookie', user.cookies)
    .send({
      customer: { name: customer },
      dueDate,
      lineItems: [{ description: 'Work', quantity, unitPrice }],
    });

  return response.body.data.id as string;
};

const pay = (user: TestUser, orderId: string, amount: string) =>
  request(app).post(`${ORDERS}/${orderId}/payments`).set('Cookie', user.cookies).send({ amount });

const summary = (user: TestUser) => request(app).get(SUMMARY).set('Cookie', user.cookies);

beforeEach(async () => {
  owner = await createTestUser('owner');
});

describe('GET /dashboard/summary', () => {
  it('reports zeros for an account with no orders', async () => {
    const response = await summary(owner);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      totalOutstandingMinor: 0,
      totalOverdueMinor: 0,
      collectedThisMonthMinor: 0,
      orderCount: 0,
    });
    // Every bucket is present even when empty, so the chart has a stable shape.
    expect(response.body.data.aging).toHaveLength(5);
  });

  it('totals what is still owed, net of what has been paid', async () => {
    const first = await createOrder(owner);
    await createOrder(owner);
    await pay(owner, first, '400');

    const response = await summary(owner);

    // Two orders of 1000.00, with 400.00 collected against one of them.
    expect(response.body.data.totalOutstandingMinor).toBe(160000);
    expect(response.body.data.orderCount).toBe(2);
  });

  it('separates overdue from merely outstanding', async () => {
    await createOrder(owner, { dueDate: '2020-01-01' });
    await createOrder(owner, { dueDate: '2030-01-01' });

    const response = await summary(owner);

    expect(response.body.data.totalOutstandingMinor).toBe(200000);
    expect(response.body.data.totalOverdueMinor).toBe(100000);
  });

  it('counts an order as both partially paid and overdue', async () => {
    const late = await createOrder(owner, { dueDate: '2020-01-01' });
    await pay(owner, late, '400');

    const response = await summary(owner);

    // Overdue is derived, so it is reported alongside the stored status rather
    // than replacing it.
    expect(response.body.data.countsByStatus.partially_paid).toBe(1);
    expect(response.body.data.countsByStatus.overdue).toBe(1);
  });

  it('excludes settled orders from what is outstanding', async () => {
    const order = await createOrder(owner, { dueDate: '2020-01-01' });
    await pay(owner, order, '1000');

    const response = await summary(owner);

    expect(response.body.data.totalOutstandingMinor).toBe(0);
    expect(response.body.data.totalOverdueMinor).toBe(0);
    expect(response.body.data.countsByStatus.paid).toBe(1);
  });

  it('counts collections from the payments, not from order state', async () => {
    const order = await createOrder(owner);
    await pay(owner, order, '250');
    await pay(owner, order, '150');

    const response = await summary(owner);

    expect(response.body.data.collectedThisMonthMinor).toBe(40000);
  });

  it('places overdue orders into ageing buckets', async () => {
    await createOrder(owner, { dueDate: '2020-01-01' });

    const response = await summary(owner);
    const buckets = response.body.data.aging as { bucket: string; orderCount: number }[];
    const populated = buckets.filter((entry) => entry.orderCount > 0);

    expect(populated).toHaveLength(1);
    expect(populated[0]?.bucket).toBe('90+');
  });

  it('reports only the signed-in user figures', async () => {
    const other = await createTestUser('other');

    await createOrder(owner);
    await createOrder(other);
    await createOrder(other);

    expect((await summary(owner)).body.data.orderCount).toBe(1);
    expect((await summary(other)).body.data.orderCount).toBe(2);
  });

  it('requires authentication', async () => {
    expect((await request(app).get(SUMMARY)).status).toBe(401);
  });
});

describe('GET /orders/export', () => {
  it('returns a csv attachment', async () => {
    await createOrder(owner);

    const response = await request(app).get(`${ORDERS}/export`).set('Cookie', owner.cookies);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/csv/);
    expect(response.headers['content-disposition']).toMatch(/attachment; filename="orders-/);
  });

  it('writes a header row and one row per order', async () => {
    await createOrder(owner);
    await createOrder(owner);

    const response = await request(app).get(`${ORDERS}/export`).set('Cookie', owner.cookies);
    const lines = response.text.trim().split('\r\n');

    expect(lines[0]).toMatch(/^"Order number","Customer"/);
    expect(lines).toHaveLength(3);
  });

  it('quotes a customer name containing a comma so the columns do not shift', async () => {
    await createOrder(owner, { customer: 'Gulf Trading, LLC' });

    const response = await request(app).get(`${ORDERS}/export`).set('Cookie', owner.cookies);

    expect(response.text).toContain('"Gulf Trading, LLC"');
    // Header plus exactly one data row: the embedded comma did not split it.
    expect(response.text.trim().split('\r\n')).toHaveLength(2);
  });

  it('exports amounts as plain decimals a spreadsheet reads as numbers', async () => {
    const order = await createOrder(owner);
    await pay(owner, order, '400');

    const response = await request(app).get(`${ORDERS}/export`).set('Cookie', owner.cookies);

    expect(response.text).toContain('"1000.00"');
    expect(response.text).toContain('"400.00"');
    expect(response.text).toContain('"600.00"');
  });

  it('filters by issue date range', async () => {
    await createOrder(owner);

    const outside = await request(app)
      .get(`${ORDERS}/export?from=2019-01-01&to=2019-12-31`)
      .set('Cookie', owner.cookies);

    expect(outside.text.trim().split('\r\n')).toHaveLength(1);
  });
});
