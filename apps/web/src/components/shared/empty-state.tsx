import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center',
      className,
    )}
  >
    <Icon className="size-8 text-muted-foreground" aria-hidden />
    <div className="space-y-1">
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-balance text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {action}
  </div>
);
