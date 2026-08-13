import type { DisplayStatus } from '@crossval/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STATUS_PRESENTATION: Record<DisplayStatus, { label: string; className: string }> = {
  paid: {
    label: 'Paid',
    className: 'border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  partially_paid: {
    label: 'Partially paid',
    className: 'border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  overdue: {
    label: 'Overdue',
    className: 'border-rose-600/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  },
  pending: {
    label: 'Pending',
    className: 'text-muted-foreground',
  },
};

type StatusBadgeProps = {
  status: DisplayStatus;
  className?: string;
};

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const presentation = STATUS_PRESENTATION[status];

  return (
    <Badge variant="outline" className={cn(presentation.className, className)}>
      {presentation.label}
    </Badge>
  );
};
