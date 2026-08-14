'use client';

import type { OrderSummary } from '@crossval/shared';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Money } from '@/components/shared/money';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type OrdersTableProps = {
  orders: OrderSummary[];
};

const DueDate = ({ order }: { order: OrderSummary }) => (
  <div className="space-y-0.5">
    <div className="tabular-nums">{formatDate(order.dueDate)}</div>
    {order.isOverdue ? (
      <div className="text-xs text-rose-600 dark:text-rose-400">
        {order.daysOverdue} {order.daysOverdue === 1 ? 'day' : 'days'} overdue
      </div>
    ) : null}
  </div>
);

export const OrdersTable = ({ orders }: OrdersTableProps) => (
  <div className="overflow-x-auto rounded-lg border">
    <Table>
      <TableHeader>
        {/* Total and Paid drop away on narrow screens; the balance still owed
            and how late it is are what the page is actually for. */}
        <TableRow className="hover:bg-transparent">
          <TableHead>Order</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Total</TableHead>
          <TableHead className="hidden text-right lg:table-cell">Paid</TableHead>
          <TableHead className="text-right">Due</TableHead>
          <TableHead className="hidden sm:table-cell">Due date</TableHead>
          <TableHead>
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          /**
           * The whole row opens the order. The link sits on the order number and
           * stretches over the row with a pseudo-element, so there is still one
           * real anchor: keyboard focus, middle-click and copy-link all behave
           * normally, which a click handler on the row would break.
           */
          <TableRow key={order.id} className="group relative cursor-pointer">
            <TableCell className="font-medium">
              <Link
                href={`/orders/${order.id}`}
                className="rounded-sm underline-offset-4 after:absolute after:inset-0 after:content-[''] group-hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {order.orderNumber}
              </Link>
            </TableCell>
            <TableCell>
              <div className="max-w-[18rem] truncate">{order.customer.name}</div>
              {order.customer.email ? (
                <div className="max-w-[18rem] truncate text-xs text-muted-foreground">
                  {order.customer.email}
                </div>
              ) : null}
            </TableCell>
            <TableCell>
              <StatusBadge status={order.displayStatus} />
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <Money minorUnits={order.totalMinor} currency={order.currency} />
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <Money
                minorUnits={order.amountPaidMinor}
                currency={order.currency}
                className="text-muted-foreground"
              />
            </TableCell>
            <TableCell>
              <Money
                minorUnits={order.amountDueMinor}
                currency={order.currency}
                className={cn(
                  'font-medium',
                  order.amountDueMinor === 0 && 'font-normal text-muted-foreground',
                )}
              />
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <DueDate order={order} />
            </TableCell>
            <TableCell className="w-8">
              <ChevronRight
                aria-hidden
                className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
