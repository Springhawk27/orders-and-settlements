import { DEFAULT_CURRENCY, MINOR_UNITS_PER_MAJOR, type Currency } from './constants.js';

/** A plain decimal with at most two fractional digits. No separators, no currency symbol. */
export const MONEY_PATTERN = /^-?\d+(\.\d{1,2})?$/;

export class MoneyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyParseError';
  }
}

/**
 * Convert a decimal amount into integer minor units. Digits are read off the
 * string rather than multiplied by 100, because `19.99 * 100` is
 * 1998.9999999999998 and rounding that hides the error rather than avoiding it.
 */
export const parseMoneyToMinor = (input: string | number): number => {
  const raw = typeof input === 'number' ? String(input) : input.trim();

  if (raw.length === 0) {
    throw new MoneyParseError('An amount is required');
  }

  // Also catches exponent notation from very large numbers, e.g. String(1e21).
  if (!MONEY_PATTERN.test(raw)) {
    throw new MoneyParseError(
      `"${raw}" is not a valid amount. Use at most two decimal places, for example 1250.50`,
    );
  }

  const isNegative = raw.startsWith('-');
  const [whole = '0', fraction = ''] = raw.replace('-', '').split('.');
  const minorUnits = Number(whole) * MINOR_UNITS_PER_MAJOR + Number(fraction.padEnd(2, '0'));

  if (!Number.isSafeInteger(minorUnits)) {
    throw new MoneyParseError(`"${raw}" is larger than this system can represent exactly`);
  }

  return isNegative ? -minorUnits : minorUnits;
};

/** Render minor units for display. Formatting happens here and nowhere else. */
export const formatMinor = (minorUnits: number, currency: Currency = DEFAULT_CURRENCY): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / MINOR_UNITS_PER_MAJOR);

/**
 * Minor units as a plain decimal string to put in a form field: no currency,
 * no separators, always two places. Round-trips through `parseMoneyToMinor`.
 */
export const minorToInputValue = (minorUnits: number): string =>
  (minorUnits / MINOR_UNITS_PER_MAJOR).toFixed(2);

/** Integer multiplied by integer, so the result is exact at any scale. */
export const lineTotalMinor = (quantity: number, unitPriceMinor: number): number =>
  quantity * unitPriceMinor;

export const sumMinor = (amounts: readonly number[]): number =>
  amounts.reduce((total, amount) => total + amount, 0);
