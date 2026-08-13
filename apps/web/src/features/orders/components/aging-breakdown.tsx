import type {
  AgingBreakdown as AgingBreakdownEntry,
  AgingBucket,
  Currency,
} from '@crossval/shared';
import { formatMinor } from '@crossval/shared';
import { cn } from '@/lib/utils';

const BUCKET_LABELS: Record<AgingBucket, string> = {
  current: 'Not yet due',
  '1-30': '1–30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': 'Over 90 days',
};

// Deliberately escalating, so how bad the position is reads before any number does.
const BUCKET_TONES: Record<AgingBucket, string> = {
  current: 'bg-muted-foreground/30',
  '1-30': 'bg-amber-400',
  '31-60': 'bg-amber-500',
  '61-90': 'bg-orange-500',
  '90+': 'bg-rose-600',
};

type AgingBreakdownProps = {
  aging: AgingBreakdownEntry[];
  currency: Currency;
};

export const AgingBreakdown = ({ aging, currency }: AgingBreakdownProps) => {
  const largest = Math.max(...aging.map((entry) => entry.amountMinor), 1);
  const hasAny = aging.some((entry) => entry.orderCount > 0);

  if (!hasAny) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing outstanding. Every order has been settled.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {aging.map((entry) => (
        <li key={entry.bucket} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className={cn(entry.orderCount === 0 && 'text-muted-foreground')}>
              {BUCKET_LABELS[entry.bucket]}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {entry.orderCount} {entry.orderCount === 1 ? 'order' : 'orders'}
              </span>
              <span className="font-medium tabular-nums">
                {formatMinor(entry.amountMinor, currency)}
              </span>
            </span>
          </div>

          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${BUCKET_LABELS[entry.bucket]}: ${formatMinor(entry.amountMinor, currency)} across ${entry.orderCount} orders`}
          >
            <div
              className={cn('h-full rounded-full transition-all', BUCKET_TONES[entry.bucket])}
              style={{ width: `${Math.round((entry.amountMinor / largest) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};
