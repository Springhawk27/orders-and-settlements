'use client';

import { ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Money } from '@/components/shared/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrders } from '../hooks';

const VISIBLE_COUNT = 5;

/**
 * The overdue figure on its own only tells you there is a problem. This is the
 * list of orders that make it up, worst first, so the next action is one click
 * away rather than a search.
 */
export const NeedsAttention = () => {
  const { data, isPending } = useOrders({
    status: 'overdue',
    limit: VISIBLE_COUNT,
    sortBy: 'dueDate',
    sortDir: 'asc',
  });

  const orders = data?.orders ?? [];
  const total = data?.meta?.total ?? 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Needs chasing</CardTitle>
        {total > VISIBLE_COUNT ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/orders?status=overdue">
              All {total}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : null}
      </CardHeader>

      <CardContent>
        {isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : orders.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            Nothing is past its due date.
          </div>
        ) : (
          <ul className="divide-y">
            {orders.map((order) => (
              <li key={order.id} className="group relative flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/orders/${order.id}`}
                    className="block truncate rounded-sm text-sm font-medium underline-offset-4 after:absolute after:inset-0 after:content-[''] group-hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {order.customer.name}
                  </Link>
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {order.orderNumber} · {order.daysOverdue}{' '}
                    {order.daysOverdue === 1 ? 'day' : 'days'} overdue
                  </p>
                </div>
                <Money
                  minorUnits={order.amountDueMinor}
                  currency={order.currency}
                  className="text-sm font-medium"
                />
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
