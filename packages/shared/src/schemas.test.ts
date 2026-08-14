import { describe, expect, it } from 'vitest';
import {
  createOrderSchema,
  loginSchema,
  orderListQuerySchema,
  recordPaymentSchema,
  registerSchema,
  updateOrderSchema,
} from './schemas';

const validOrder = {
  customer: { name: 'Gulf Trading LLC', email: 'AP@GulfTrading.ae' },
  dueDate: '2026-09-14',
  lineItems: [
    { description: 'Consulting retainer', quantity: 2, unitPrice: '500' },
    { description: 'Onboarding', quantity: 1, unitPrice: 1250.5 },
  ],
};

describe('createOrderSchema', () => {
  it('parses prices into minor units and names the field accordingly', () => {
    const parsed = createOrderSchema.parse(validOrder);

    expect(parsed.lineItems[0]?.unitPriceMinor).toBe(50000);
    expect(parsed.lineItems[1]?.unitPriceMinor).toBe(125050);
  });

  it('normalises the customer email', () => {
    const parsed = createOrderSchema.parse(validOrder);

    expect(parsed.customer.email).toBe('ap@gulftrading.ae');
  });

  it('defaults the currency rather than trusting the client to send one', () => {
    expect(createOrderSchema.parse(validOrder).currency).toBe('USD');
  });

  it('treats the due date as UTC midnight', () => {
    const parsed = createOrderSchema.parse(validOrder);

    expect(parsed.dueDate.toISOString()).toBe('2026-09-14T00:00:00.000Z');
  });

  it('rejects a price with more than two decimal places', () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      lineItems: [{ description: 'Odd price', quantity: 1, unitPrice: '10.005' }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/two decimal places/);
  });

  it('rejects a negative price', () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      lineItems: [{ description: 'Refund line', quantity: 1, unitPrice: '-10' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a quantity below one', () => {
    for (const quantity of [0, -1, 1.5]) {
      const result = createOrderSchema.safeParse({
        ...validOrder,
        lineItems: [{ description: 'Bad quantity', quantity, unitPrice: '10' }],
      });

      expect(result.success, `quantity ${quantity} should be rejected`).toBe(false);
    }
  });

  it('requires at least one line item', () => {
    const result = createOrderSchema.safeParse({ ...validOrder, lineItems: [] });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/at least one line item/);
  });

  it('requires a due date', () => {
    const { dueDate: _dueDate, ...withoutDueDate } = validOrder;

    expect(createOrderSchema.safeParse(withoutDueDate).success).toBe(false);
  });

  it('accepts a blank optional email, which is what a form submits', () => {
    // The field is optional in the UI, so leaving it untouched must not fail.
    const result = createOrderSchema.safeParse({
      ...validOrder,
      customer: { name: 'Gulf Trading LLC', email: '' },
    });

    expect(result.success).toBe(true);
    expect(result.data?.customer.email).toBeUndefined();
  });

  it('still rejects a malformed optional email', () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      customer: { name: 'Gulf Trading LLC', email: 'not-an-email' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects a malformed due date', () => {
    expect(createOrderSchema.safeParse({ ...validOrder, dueDate: '14-09-2026' }).success).toBe(
      false,
    );
  });
});

describe('updateOrderSchema', () => {
  it('accepts a single field', () => {
    expect(updateOrderSchema.safeParse({ dueDate: '2026-10-01' }).success).toBe(true);
  });

  it('rejects an empty update', () => {
    const result = updateOrderSchema.safeParse({});

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/at least one field/);
  });
});

describe('recordPaymentSchema', () => {
  it('parses the amount into minor units and names the field accordingly', () => {
    expect(recordPaymentSchema.parse({ amount: '400' }).amountMinor).toBe(40000);
    expect(recordPaymentSchema.parse({ amount: 0.01 }).amountMinor).toBe(1);
  });

  it('rejects zero and negative amounts', () => {
    for (const amount of ['0', '0.00', '-5']) {
      expect(
        recordPaymentSchema.safeParse({ amount }).success,
        `amount ${amount} should be rejected`,
      ).toBe(false);
    }
  });

  it('rejects an unknown payment method', () => {
    expect(recordPaymentSchema.safeParse({ amount: '10', method: 'crypto' }).success).toBe(false);
  });
});

describe('orderListQuerySchema', () => {
  it('applies defaults when the query is empty', () => {
    const parsed = orderListQuerySchema.parse({});

    expect(parsed).toMatchObject({ page: 1, limit: 20, sortBy: 'createdAt', sortDir: 'desc' });
  });

  it('coerces the numeric strings that arrive on a query string', () => {
    const parsed = orderListQuerySchema.parse({ page: '3', limit: '50' });

    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(50);
  });

  it('caps the page size so a client cannot request the whole table', () => {
    expect(orderListQuerySchema.safeParse({ limit: '5000' }).success).toBe(false);
  });

  it('accepts overdue as a filter even though it is never stored', () => {
    expect(orderListQuerySchema.parse({ status: 'overdue' }).status).toBe('overdue');
  });

  it('rejects an unknown sort field', () => {
    expect(orderListQuerySchema.safeParse({ sortBy: 'customerName' }).success).toBe(false);
  });
});

describe('auth schemas', () => {
  it('lowercases and trims the email on register', () => {
    const parsed = registerSchema.parse({
      name: '  Sajjad  ',
      email: '  Sajjad@Example.COM ',
      password: 'correct-horse',
    });

    expect(parsed.email).toBe('sajjad@example.com');
    expect(parsed.name).toBe('Sajjad');
  });

  it('rejects a short password', () => {
    const result = registerSchema.safeParse({
      name: 'Sajjad',
      email: 'a@b.com',
      password: 'short',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/at least 8 characters/);
  });

  it('does not impose a length rule when logging in', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
});
