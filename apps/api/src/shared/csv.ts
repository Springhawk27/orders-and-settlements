/**
 * Quotes every field and doubles any embedded quote, per RFC 4180. Naively
 * joining with commas breaks the moment a customer name contains one.
 */
const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '""';
  }

  return `"${String(value).replace(/"/g, '""')}"`;
};

export const toCsv = (headers: readonly string[], rows: readonly unknown[][]): string =>
  [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
