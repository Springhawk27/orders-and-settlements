'use client';

import type { Currency } from '@crossval/shared';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Money } from '@/components/shared/money';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { CardSkeleton } from '@/components/shared/loading-skeletons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { useOrder, useOrderAudit, useOrderPayments } from '../hooks';
import { AuditTimeline } from './audit-timeline';
import { OrderActions } from './order-actions';
import { PaymentHistory } from './payment-history';
import { RecordPaymentDialog } from './record-payment-dialog';

const SummaryFigure = ({
  label,
  minorUnits,
  currency,
  emphasis = false,
}: {
  label: string;
  minorUnits: number;
  currency: Currency;
  emphasis?: boolean;
}) => (
  <div className="space-y-1">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <Money
      minorUnits={minorUnits}
      currency={currency}
      className={emphasis ? 'text-left text-xl font-semibold' : 'text-left text-base'}
    />
  </div>
);

export const OrderDetail = ({ orderId }: { orderId: string }) => {
  const order = useOrder(orderId);
  const payments = useOrderPayments(orderId);
  const audit = useOrderAudit(orderId);

  if (order.isPending) {
    return <CardSkeleton />;
  }

  if (order.isError || !order.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Order not found</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>It may have been deleted, or it belongs to another account.</span>
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">Back to orders</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const data = order.data;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
        <Link href="/orders">
          <ArrowLeft className="size-4" />
          Orders
        </Link>
      </Button>

      <PageHeader
        title={data.orderNumber}
        description={data.customer.email ?? undefined}
        action={
          <>
            <OrderActions order={data} />
            <RecordPaymentDialog order={data} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={data.displayStatus} />
        {data.wasPaidLate ? (
          <span className="text-xs text-muted-foreground">
            Settled {formatDate(data.paidInFullAt ?? '')}, after the due date
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                        <TableCell>
                          <Money minorUnits={item.unitPriceMinor} currency={data.currency} />
                        </TableCell>
                        <TableCell>
                          <Money minorUnits={item.lineTotalMinor} currency={data.currency} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {data.paymentCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Line items are locked because a payment has been recorded against this order.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.isPending ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <PaymentHistory
                  orderId={orderId}
                  currency={data.currency}
                  payments={payments.data ?? []}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Balance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SummaryFigure label="Total" minorUnits={data.totalMinor} currency={data.currency} />
              <SummaryFigure
                label="Paid"
                minorUnits={data.amountPaidMinor}
                currency={data.currency}
              />
              <Separator />
              <SummaryFigure
                label="Still owed"
                minorUnits={data.amountDueMinor}
                currency={data.currency}
                emphasis
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Customer</span>
                <span className="text-right">{data.customer.name}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Issued</span>
                <span className="tabular-nums">{formatDate(data.issueDate)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Due</span>
                <span className="tabular-nums">{formatDate(data.dueDate)}</span>
              </div>
              {data.isOverdue ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Overdue by</span>
                  <span className="tabular-nums text-rose-600 dark:text-rose-400">
                    {data.daysOverdue} {data.daysOverdue === 1 ? 'day' : 'days'}
                  </span>
                </div>
              ) : null}
              {data.notes ? <p className="pt-2 text-muted-foreground">{data.notes}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {audit.isPending ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <AuditTimeline events={audit.data ?? []} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
