import type { Currency } from '@crossval/shared';
import type { LucideIcon } from 'lucide-react';
import { AnimatedMoney } from '@/components/shared/animated-money';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type KpiCardProps = {
  label: string;
  minorUnits: number;
  currency: Currency;
  icon: LucideIcon;
  hint?: string;
  tone?: 'default' | 'warning';
};

export const KpiCard = ({
  label,
  minorUnits,
  currency,
  icon: Icon,
  hint,
  tone = 'default',
}: KpiCardProps) => (
  <Card>
    <CardContent className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon
          aria-hidden
          className={cn(
            'size-4',
            tone === 'warning' ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground',
          )}
        />
      </div>

      <AnimatedMoney
        minorUnits={minorUnits}
        currency={currency}
        className={cn(
          'block text-2xl font-semibold tracking-tight',
          tone === 'warning' && minorUnits > 0 && 'text-rose-600 dark:text-rose-400',
        )}
      />

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </CardContent>
  </Card>
);
