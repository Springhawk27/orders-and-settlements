'use client';

import type { Currency, Payment, PaymentMethod } from '@crossval/shared';
import { Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Money } from '@/components/shared/money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useVoidPayment } from '../hooks';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cash: 'Cash',
  cheque: 'Cheque',
  other: 'Other',
};

type PaymentHistoryProps = {
  orderId: string;
  currency: Currency;
  payments: Payment[];
};

export const PaymentHistory = ({ orderId, currency, payments }: PaymentHistoryProps) => {
  const [target, setTarget] = useState<Payment | null>(null);
  const [reason, setReason] = useState('');
  const voidPayment = useVoidPayment(orderId);

  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing has been collected against this order yet.
      </p>
    );
  }

  const confirmVoid = async () => {
    if (!target || reason.trim().length === 0) {
      return;
    }

    await voidPayment.mutateAsync({ paymentId: target.id, reason: reason.trim() });
    setTarget(null);
    setReason('');
  };

  return (
    <>
      <ul className="divide-y">
        {payments.map((payment) => (
          <li key={payment.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{formatDate(payment.paidAt)}</span>
                {payment.isReversal ? <Badge variant="secondary">Reversal</Badge> : null}
                {payment.voidedAt ? <Badge variant="outline">Voided</Badge> : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {[
                  payment.method ? METHOD_LABELS[payment.method] : null,
                  payment.reference,
                  payment.note,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </p>
            </div>

            <Money
              minorUnits={payment.amountMinor}
              currency={currency}
              className={cn(
                'w-32 font-medium',
                payment.amountMinor < 0 && 'text-rose-600 dark:text-rose-400',
                payment.voidedAt && 'text-muted-foreground line-through',
              )}
            />

            {!payment.isReversal && !payment.voidedAt ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTarget(payment)}
                aria-label={`Void the payment of ${payment.amountMinor}`}
              >
                <Undo2 className="size-4" />
                Void
              </Button>
            ) : (
              <div className="w-[5.5rem]" aria-hidden />
            )}
          </li>
        ))}
      </ul>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Void this payment</DialogTitle>
            <DialogDescription>
              The payment is kept and a reversing entry is written against it, so the history stays
              intact. The balance returns to what it was before.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="void-reason">Reason</Label>
            <Input
              id="void-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Recorded against the wrong order"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length === 0 || voidPayment.isPending}
              onClick={() => void confirmVoid()}
            >
              {voidPayment.isPending ? 'Voiding…' : 'Void payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
