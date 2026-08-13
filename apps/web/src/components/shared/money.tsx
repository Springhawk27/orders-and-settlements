import { formatMinor, type Currency } from '@crossval/shared';
import { cn } from '@/lib/utils';

type MoneyProps = {
  /** Integer minor units, exactly as the API stores them. Never divide by 100 here. */
  minorUnits: number;
  currency?: Currency;
  className?: string;
};

export const Money = ({ minorUnits, currency, className }: MoneyProps) => (
  <span className={cn('block text-right tabular-nums', className)}>
    {formatMinor(minorUnits, currency)}
  </span>
);
