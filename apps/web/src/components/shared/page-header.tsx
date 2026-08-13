import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export const PageHeader = ({ title, description, action, className }: PageHeaderProps) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
    {action ? <div className="flex items-center gap-2">{action}</div> : null}
  </div>
);
