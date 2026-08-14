import { describe, expect, it } from 'vitest';
import {
  MoneyParseError,
  formatMinor,
  lineTotalMinor,
  minorToInputValue,
  parseMoneyToMinor,
  sumMinor,
} from './money.js';

describe('parseMoneyToMinor', () => {
  it('converts whole and fractional amounts', () => {
    expect(parseMoneyToMinor('0')).toBe(0);
    expect(parseMoneyToMinor('1')).toBe(100);
    expect(parseMoneyToMinor('500')).toBe(50000);
    expect(parseMoneyToMinor('1250.50')).toBe(125050);
    expect(parseMoneyToMinor('0.05')).toBe(5);
    expect(parseMoneyToMinor('0.5')).toBe(50);
  });

  it('is exact for the amounts that break floating point multiplication', () => {
    // 19.99 * 100 evaluates to 1998.9999999999998, and 0.29 * 100 to 28.999999999999996.
    // Parsing the string form sidesteps the representation error rather than rounding it away.
    expect(19.99 * 100).not.toBe(1999);
    expect(parseMoneyToMinor('19.99')).toBe(1999);

    expect(0.29 * 100).not.toBe(29);
    expect(parseMoneyToMinor('0.29')).toBe(29);
  });

  it('accepts numbers as well as strings', () => {
    expect(parseMoneyToMinor(1250.5)).toBe(125050);
    expect(parseMoneyToMinor(19.99)).toBe(1999);
    expect(parseMoneyToMinor(0)).toBe(0);
  });

  it('handles negative amounts, used by payment reversals', () => {
    expect(parseMoneyToMinor('-50.25')).toBe(-5025);
    expect(parseMoneyToMinor(-1)).toBe(-100);
  });

  it('trims surrounding whitespace', () => {
    expect(parseMoneyToMinor('  1250.50  ')).toBe(125050);
  });

  it('rejects more than two decimal places rather than rounding silently', () => {
    expect(() => parseMoneyToMinor('1250.555')).toThrow(MoneyParseError);
    expect(() => parseMoneyToMinor('1.001')).toThrow(MoneyParseError);
  });

  it('rejects input that is not a plain decimal', () => {
    for (const bad of ['', '   ', 'abc', '1,250.50', '12.50 AED', '.5', '1.', '1e3', '--5']) {
      expect(() => parseMoneyToMinor(bad), `expected "${bad}" to be rejected`).toThrow(
        MoneyParseError,
      );
    }
  });

  it('rejects values that cannot be represented exactly as integers', () => {
    expect(() => parseMoneyToMinor(1e21)).toThrow(MoneyParseError);
    expect(() => parseMoneyToMinor('999999999999999999')).toThrow(MoneyParseError);
  });

  it('explains what a valid amount looks like when it rejects one', () => {
    expect(() => parseMoneyToMinor('12.345')).toThrow(/two decimal places/);
  });
});

describe('formatMinor', () => {
  it('renders minor units as a currency amount with two decimals', () => {
    expect(formatMinor(125050)).toMatch(/1,250\.50/);
    expect(formatMinor(0)).toMatch(/0\.00/);
    expect(formatMinor(5)).toMatch(/0\.05/);
  });

  it('matches the notation the brief uses for its sample scenario', () => {
    expect(formatMinor(100000)).toBe('$1,000.00');
    expect(formatMinor(40000)).toBe('$400.00');
    expect(formatMinor(60000)).toBe('$600.00');
  });

  it('round-trips with parseMoneyToMinor', () => {
    for (const amount of ['0', '0.01', '19.99', '1250.50', '999999.99']) {
      const minor = parseMoneyToMinor(amount);
      const formatted = formatMinor(minor).replace(/[^\d.]/g, '');
      expect(parseMoneyToMinor(formatted)).toBe(minor);
    }
  });
});

describe('minorToInputValue', () => {
  it('renders a value a form field can hold and the parser can read back', () => {
    for (const minor of [0, 1, 50, 1999, 125050, 99999999]) {
      const asInput = minorToInputValue(minor);

      expect(asInput).toMatch(/^\d+\.\d{2}$/);
      expect(parseMoneyToMinor(asInput)).toBe(minor);
    }
  });
});

describe('lineTotalMinor', () => {
  it('multiplies quantity by unit price without leaving integer space', () => {
    expect(lineTotalMinor(2, 50000)).toBe(100000);
    expect(lineTotalMinor(1, 1999)).toBe(1999);
    expect(lineTotalMinor(3, 33333)).toBe(99999);
  });

  it('matches the brief: two units at 500.00 is 1000.00', () => {
    expect(lineTotalMinor(2, parseMoneyToMinor('500'))).toBe(parseMoneyToMinor('1000'));
  });
});

describe('sumMinor', () => {
  it('adds minor unit amounts exactly', () => {
    expect(sumMinor([])).toBe(0);
    expect(sumMinor([1999, 29, 125050])).toBe(127078);
  });

  it('stays exact where summing the decimal equivalents would not', () => {
    // 0.1 + 0.2 !== 0.3 in floating point; in minor units it is just 10 + 20.
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumMinor([10, 20])).toBe(30);
  });
});
