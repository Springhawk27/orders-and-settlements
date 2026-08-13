export const API_VERSION = 'v1';

/** ISO 4217 codes the app accepts. Amounts are always stored in minor units. */
export const SUPPORTED_CURRENCIES = ['AED', 'USD'] as const;

export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'AED';
