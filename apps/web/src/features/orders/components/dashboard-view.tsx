'use client';

import { AlertTriangle, ArrowRight, Banknote, Wallet } from 'lucide-react';
import Link from 'next/link';
import { FadeIn } from '@/components/shared/fade-in';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { CardSkeleton } from '@/components/shared/loading-skeletons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardSummary } from '../hooks';
import { AgingBreakdown } from './aging-breakdown';
import { KpiCard } from './kpi-card';
import { NeedsAttention } from './needs-attention';

const STATUS_ORDER = ['pending', 'partially_paid', 'overdue', 'paid'] as const;

export const DashboardView = () => {
  const { data, isPending, isError, refetch } = useDashboardSummary();

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>The summary could not be loaded</AlertTitle>
        <AlertDescription>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="What is outstanding, what is late, and what has come in this month."
        action={
          <Button variant="outline" asChild>
            <Link href="/orders">
              View orders
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FadeIn>
          <KpiCard
            label="Outstanding"
            minorUnits={data.totalOutstandingMinor}
            currency={data.currency}
            icon={Wallet}
            hint={`Across ${data.orderCount} ${data.orderCount === 1 ? 'order' : 'orders'}`}
          />
        </FadeIn>
        <FadeIn delay={0.06}>
          <KpiCard
            label="Overdue"
            minorUnits={data.totalOverdueMinor}
            currency={data.currency}
            icon={AlertTriangle}
            tone="warning"
            hint={
              data.countsByStatus.overdue > 0
                ? `${data.countsByStatus.overdue} past their due date`
                : 'Nothing past its due date'
            }
          />
        </FadeIn>
        <FadeIn delay={0.12}>
          <KpiCard
            label="Collected this month"
            minorUnits={data.collectedThisMonthMinor}
            currency={data.currency}
            icon={Banknote}
          />
        </FadeIn>
      </div>

      <NeedsAttention />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Receivables ageing</CardTitle>
          </CardHeader>
          <CardContent>
            <AgingBreakdown aging={data.aging} currency={data.currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {STATUS_ORDER.map((status) => (
                <li key={status} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/orders?status=${status}`}
                    className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <StatusBadge status={status} />
                  </Link>
                  <span className="text-sm font-medium tabular-nums">
                    {data.countsByStatus[status]}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              An order can be counted as both partially paid and overdue, because overdue is worked
              out from the due date rather than stored.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
