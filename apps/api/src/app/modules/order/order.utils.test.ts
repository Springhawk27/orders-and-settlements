import { describe, expect, it } from 'vitest';
import {
  agingBucketFor,
  amountDueMinor,
  daysOverdue,
  derivePaymentStatus,
  deriveDisplayStatus,
  isOverdue,
  overdueCutoff,
  wasPaidLate,
} from './order.utils';

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const DUE = utc('2026-09-14');

describe('derivePaymentStatus', () => {
  it('is pending until something is paid', () => {
    expect(derivePaymentStatus(0, 100000)).toBe('pending');
  });

  it('is partially_paid between zero and the total', () => {
    expect(derivePaymentStatus(1, 100000)).toBe('partially_paid');
    expect(derivePaymentStatus(99999, 100000)).toBe('partially_paid');
  });

  it('is paid once the total is reached', () => {
    expect(derivePaymentStatus(100000, 100000)).toBe('paid');
  });

  it('treats a zero-total order as settled rather than pending', () => {
    expect(derivePaymentStatus(0, 0)).toBe('paid');
  });

  it('follows the brief: 1000 order, 400 then 600', () => {
    expect(derivePaymentStatus(0, 100000)).toBe('pending');
    expect(derivePaymentStatus(40000, 100000)).toBe('partially_paid');
    expect(derivePaymentStatus(100000, 100000)).toBe('paid');
  });
});

describe('amountDueMinor', () => {
  it('is the remaining balance', () => {
    expect(amountDueMinor(100000, 40000)).toBe(60000);
    expect(amountDueMinor(100000, 100000)).toBe(0);
  });

  it('never reports a negative balance', () => {
    expect(amountDueMinor(100000, 120000)).toBe(0);
  });
});

describe('daysOverdue', () => {
  it('is zero before the due date', () => {
    expect(daysOverdue(DUE, utc('2026-09-13'))).toBe(0);
  });

  it('is still zero on the due date itself', () => {
    expect(daysOverdue(DUE, utc('2026-09-14'))).toBe(0);
    expect(daysOverdue(DUE, new Date('2026-09-14T23:59:00.000Z'))).toBe(0);
  });

  it('becomes one the day after', () => {
    expect(daysOverdue(DUE, utc('2026-09-15'))).toBe(1);
  });

  it('counts whole elapsed days', () => {
    expect(daysOverdue(DUE, utc('2026-10-14'))).toBe(30);
  });
});

describe('isOverdue', () => {
  it('is false while the due date has not passed', () => {
    expect(isOverdue('pending', DUE, utc('2026-09-14'))).toBe(false);
  });

  it('is true once a full day has elapsed and money is still owed', () => {
    expect(isOverdue('pending', DUE, utc('2026-09-15'))).toBe(true);
    expect(isOverdue('partially_paid', DUE, utc('2026-09-15'))).toBe(true);
  });

  it('is never true for a paid order, however late it was settled', () => {
    expect(isOverdue('paid', DUE, utc('2027-01-01'))).toBe(false);
  });
});

describe('deriveDisplayStatus', () => {
  it('passes the stored status through when the order is not late', () => {
    expect(deriveDisplayStatus('pending', DUE, utc('2026-09-14'))).toBe('pending');
    expect(deriveDisplayStatus('partially_paid', DUE, utc('2026-09-14'))).toBe('partially_paid');
  });

  it('outranks both pending and partially_paid once late', () => {
    expect(deriveDisplayStatus('pending', DUE, utc('2026-09-20'))).toBe('overdue');
    expect(deriveDisplayStatus('partially_paid', DUE, utc('2026-09-20'))).toBe('overdue');
  });

  it('answers the brief edge case: an order that was overdue but is now fully paid', () => {
    // Nothing had to be cleaned up when it was paid; the answer simply changes
    // because the status is computed rather than stored.
    expect(deriveDisplayStatus('pending', DUE, utc('2026-10-01'))).toBe('overdue');
    expect(deriveDisplayStatus('paid', DUE, utc('2026-10-01'))).toBe('paid');
  });
});

describe('agingBucketFor', () => {
  it('is current when not overdue', () => {
    expect(agingBucketFor('pending', DUE, utc('2026-09-14'))).toBe('current');
    expect(agingBucketFor('paid', DUE, utc('2027-01-01'))).toBe('current');
  });

  it('places overdue orders in day ranges', () => {
    expect(agingBucketFor('pending', DUE, utc('2026-09-15'))).toBe('1-30');
    expect(agingBucketFor('pending', DUE, utc('2026-10-14'))).toBe('1-30');
    expect(agingBucketFor('pending', DUE, utc('2026-10-15'))).toBe('31-60');
    expect(agingBucketFor('pending', DUE, utc('2026-11-14'))).toBe('61-90');
    // 2026-09-14 plus 90 days lands on 2026-12-13, so that is the last day in the bucket.
    expect(agingBucketFor('pending', DUE, utc('2026-12-13'))).toBe('61-90');
    expect(agingBucketFor('pending', DUE, utc('2026-12-14'))).toBe('90+');
  });
});

describe('overdueCutoff', () => {
  it('matches what isOverdue considers late, so the query and the badge agree', () => {
    const now = utc('2026-09-15');
    const cutoff = overdueCutoff(now);

    // An order due at the cutoff is late; one due a moment later is not.
    expect(DUE.getTime() <= cutoff.getTime()).toBe(true);
    expect(isOverdue('pending', DUE, now)).toBe(true);

    const notYetDue = utc('2026-09-15');
    expect(notYetDue.getTime() <= cutoff.getTime()).toBe(false);
    expect(isOverdue('pending', notYetDue, now)).toBe(false);
  });
});

describe('wasPaidLate', () => {
  it('is false when the order was never paid', () => {
    expect(wasPaidLate(null, DUE)).toBe(false);
  });

  it('is false when settled on time', () => {
    expect(wasPaidLate(utc('2026-09-14'), DUE)).toBe(false);
  });

  it('is true when settled after the due date passed', () => {
    expect(wasPaidLate(utc('2026-09-20'), DUE)).toBe(true);
  });
});
