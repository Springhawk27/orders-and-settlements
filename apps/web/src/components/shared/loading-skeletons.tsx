import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type TableSkeletonProps = {
  rows?: number;
  columns?: number;
  className?: string;
};

export const TableSkeleton = ({ rows = 5, columns = 4, className }: TableSkeletonProps) => (
  <div className={cn('rounded-lg border', className)} aria-hidden>
    <div className="flex gap-4 border-b px-4 py-3">
      {Array.from({ length: columns }, (_, column) => (
        <Skeleton key={column} className="h-4 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }, (_, row) => (
      <div key={row} className="flex gap-4 border-b px-4 py-4 last:border-b-0">
        {Array.from({ length: columns }, (_, column) => (
          <Skeleton key={column} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton = ({ className }: { className?: string }) => (
  <Card className={className} aria-hidden>
    <CardHeader>
      <Skeleton className="h-4 w-1/3" />
    </CardHeader>
    <CardContent className="space-y-2">
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </CardContent>
  </Card>
);
