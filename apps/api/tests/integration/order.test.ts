import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import { createTestUser, type TestUser } from '../helpers/auth';

const ORDERS = '/api/v1/orders';

const orderPayload = (overrides: Record<string, unknown> = {}) => ({
  customer: { name: 'Gulf Trading LLC', email: 'ap@gulftrading.ae' },
  dueDate: '2030-01-15',
  lineItems: [{ description: 'Consulting', quantity: 2, unitPrice: '500' }],
  ...overrides,
});

let owner: TestUser;

beforeEach(async () => {
  owner = await createTestUser('owner');
});

const createOrder = (user: TestUser, overrides: Record<string, unknown> = {}) =>
  request(app).post(ORDERS).set('Cookie', user.cookies).send(orderPayload(overrides));

describe('POST /orders', () => {
  it('computes line totals and the order total server side', async () => {
    const response = await createOrder(owner);

    expect(response.status).toBe(201);
    // 2 x $500.00, held as integer minor units.
    expect(response.body.data).toMatchObject({
      subtotalMinor: 100000,
      totalMinor: 100000,
      amountPaidMinor: 0,
      amountDueMinor: 100000,
      paymentStatus: 'pending',
      displayStatus: 'pending',
    });
    expect(response.body.data.lineItems[0].lineTotalMinor).toBe(100000);
  });

  it('numbers orders sequentially per user', async () => {
    const first = await createOrder(owner);
    const second = await createOrder(owner);

    expect(first.body.data.orderNumber).toMatch(/^ORD-\d{4}-0001$/);
    expect(second.body.data.orderNumber).toMatch(/^ORD-\d{4}-0002$/);
  });

  it('does not share a number sequence between users', async () => {
    const other = await createTestUser('other');

    await createOrder(owner);
    const theirs = await createOrder(other);

    expect(theirs.body.data.orderNumber).toMatch(/-0001$/);
  });

  it('rejects an order with no line items', async () => {
    const response = await createOrder(owner, { lineItems: [] });

    expect(response.status).toBe(400);
    expect(response.body.errorMessages[0].message).toMatch(/at least one line item/);
  });

  it('rejects a price with more than two decimal places instead of rounding it', async () => {
    const response = await createOrder(owner, {
      lineItems: [{ description: 'Odd', quantity: 1, unitPrice: '10.005' }],
    });

    expect(response.status).toBe(400);
  });

  it('requires authentication', async () => {
    const response = await request(app).post(ORDERS).send(orderPayload());

    expect(response.status).toBe(401);
  });
});

describe('GET /orders', () => {
  it('returns only the signed-in user orders', async () => {
    const other = await createTestUser('other');

    await createOrder(owner);
    await createOrder(other, { customer: { name: 'Someone Else' } });

    const response = await request(app).get(ORDERS).set('Cookie', owner.cookies);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].customer.name).toBe('Gulf Trading LLC');
  });

  it('reports pagination meta', async () => {
    await createOrder(owner);
    await createOrder(owner);
    await createOrder(owner);

    const response = await request(app)
      .get(`${ORDERS}?page=1&limit=2`)
      .set('Cookie', owner.cookies);

    expect(response.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(response.body.data).toHaveLength(2);
  });

  it('filters by stored status', async () => {
    await createOrder(owner);

    const pending = await request(app).get(`${ORDERS}?status=pending`).set('Cookie', owner.cookies);
    const paid = await request(app).get(`${ORDERS}?status=paid`).set('Cookie', owner.cookies);

    expect(pending.body.data).toHaveLength(1);
    expect(paid.body.data).toHaveLength(0);
  });

  it('filters by overdue, which is never stored', async () => {
    await createOrder(owner, { dueDate: '2020-01-01' });
    await createOrder(owner, { dueDate: '2030-01-01' });

    const response = await request(app)
      .get(`${ORDERS}?status=overdue`)
      .set('Cookie', owner.cookies);

    expect(response.body.data).toHaveLength(1);

    // The filter and the badge have to agree, or a row appears under a status
    // it does not display.
    expect(response.body.data[0].displayStatus).toBe('overdue');
    expect(response.body.data[0].isOverdue).toBe(true);
    expect(response.body.data[0].daysOverdue).toBeGreaterThan(0);
  });

  it('searches by customer name and by order number', async () => {
    await createOrder(owner, { customer: { name: 'Alpha Holdings' } });
    const beta = await createOrder(owner, { customer: { name: 'Beta Logistics' } });

    const byName = await request(app).get(`${ORDERS}?q=beta`).set('Cookie', owner.cookies);
    expect(byName.body.data).toHaveLength(1);
    expect(byName.body.data[0].customer.name).toBe('Beta Logistics');

    const byNumber = await request(app)
      .get(`${ORDERS}?q=${beta.body.data.orderNumber}`)
      .set('Cookie', owner.cookies);
    expect(byNumber.body.data).toHaveLength(1);
  });

  it('returns the same order every time when sort values tie', async () => {
    // Created in one go, so their createdAt values are identical. Without a
    // tiebreaker the database is free to return them in any order, which both
    // shuffles the list and breaks paging.
    await Promise.all([createOrder(owner), createOrder(owner), createOrder(owner)]);

    const pageOne = await request(app).get(ORDERS).set('Cookie', owner.cookies);
    const pageTwo = await request(app).get(ORDERS).set('Cookie', owner.cookies);

    const ids = (response: typeof pageOne) =>
      response.body.data.map((order: { id: string }) => order.id);

    expect(ids(pageOne)).toEqual(ids(pageTwo));
  });

  it('never repeats or drops a row across pages when values tie', async () => {
    await Promise.all(Array.from({ length: 6 }, () => createOrder(owner)));

    const first = await request(app).get(`${ORDERS}?page=1&limit=3`).set('Cookie', owner.cookies);
    const second = await request(app).get(`${ORDERS}?page=2&limit=3`).set('Cookie', owner.cookies);

    const seen = [...first.body.data, ...second.body.data].map((order: { id: string }) => order.id);

    expect(new Set(seen).size).toBe(6);
  });

  it('sorts by a chosen field and direction', async () => {
    await createOrder(owner, { dueDate: '2032-01-01' });
    await createOrder(owner, { dueDate: '2030-01-01' });
    await createOrder(owner, { dueDate: '2031-01-01' });

    const response = await request(app)
      .get(`${ORDERS}?sortBy=dueDate&sortDir=asc`)
      .set('Cookie', owner.cookies);

    const dates = response.body.data.map((order: { dueDate: string }) =>
      order.dueDate.slice(0, 10),
    );

    expect(dates).toEqual([...dates].sort());
  });

  it('rejects a page size beyond the cap', async () => {
    const response = await request(app).get(`${ORDERS}?limit=5000`).set('Cookie', owner.cookies);

    expect(response.status).toBe(400);
  });
});

describe('GET /orders/:id', () => {
  it('returns the order with its line items', async () => {
    const created = await createOrder(owner);

    const response = await request(app)
      .get(`${ORDERS}/${created.body.data.id}`)
      .set('Cookie', owner.cookies);

    expect(response.status).toBe(200);
    expect(response.body.data.lineItems).toHaveLength(1);
  });

  it('hides another user order behind a 404 rather than a 403', async () => {
    const other = await createTestUser('other');
    const theirs = await createOrder(other);

    const response = await request(app)
      .get(`${ORDERS}/${theirs.body.data.id}`)
      .set('Cookie', owner.cookies);

    // 403 would confirm the id exists; 404 discloses nothing.
    expect(response.status).toBe(404);
  });

  it('returns a clear 400 for a malformed id', async () => {
    const response = await request(app).get(`${ORDERS}/not-an-id`).set('Cookie', owner.cookies);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid identifier');
  });
});

describe('PATCH /orders/:id', () => {
  it('updates the customer and due date', async () => {
    const created = await createOrder(owner);

    const response = await request(app)
      .patch(`${ORDERS}/${created.body.data.id}`)
      .set('Cookie', owner.cookies)
      .send({ customer: { name: 'Renamed Co' }, dueDate: '2031-02-01' });

    expect(response.status).toBe(200);
    expect(response.body.data.customer.name).toBe('Renamed Co');
    expect(response.body.data.dueDate).toBe('2031-02-01T00:00:00.000Z');
  });

  it('replaces line items and recomputes the total while the order is unpaid', async () => {
    const created = await createOrder(owner);

    const response = await request(app)
      .patch(`${ORDERS}/${created.body.data.id}`)
      .set('Cookie', owner.cookies)
      .send({ lineItems: [{ description: 'Revised', quantity: 3, unitPrice: '100' }] });

    expect(response.status).toBe(200);
    expect(response.body.data.totalMinor).toBe(30000);
  });

  it('rejects an empty update', async () => {
    const created = await createOrder(owner);

    const response = await request(app)
      .patch(`${ORDERS}/${created.body.data.id}`)
      .set('Cookie', owner.cookies)
      .send({});

    expect(response.status).toBe(400);
  });
});

describe('DELETE /orders/:id', () => {
  it('deletes an order that has no payments', async () => {
    const created = await createOrder(owner);

    const response = await request(app)
      .delete(`${ORDERS}/${created.body.data.id}`)
      .set('Cookie', owner.cookies);

    expect(response.status).toBe(200);

    const after = await request(app).get(ORDERS).set('Cookie', owner.cookies);
    expect(after.body.data).toHaveLength(0);
  });
});

describe('GET /orders/:id/audit', () => {
  it('records creation and every subsequent change', async () => {
    const created = await createOrder(owner);

    await request(app)
      .patch(`${ORDERS}/${created.body.data.id}`)
      .set('Cookie', owner.cookies)
      .send({ dueDate: '2031-03-01' });

    const response = await request(app)
      .get(`${ORDERS}/${created.body.data.id}/audit`)
      .set('Cookie', owner.cookies);

    expect(response.status).toBe(200);

    const actions = response.body.data.map((event: { action: string }) => event.action);
    expect(actions).toContain('order.created');
    expect(actions).toContain('order.updated');
  });
});
