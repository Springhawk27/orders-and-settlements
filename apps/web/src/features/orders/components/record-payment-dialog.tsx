'use client';

import {
  PAYMENT_METHODS,
  formatMinor,
  recordPaymentSchema,
  type Order,
  type PaymentMethod,
} from '@crossval/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { handleFormApiError } from '@/lib/form-errors';
import { useRecordPayment } from '../hooks';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  card: 'Card',
  cash: 'Cash',
  cheque: 'Cheque',
  other: 'Other',
};

/**
 * The schema converts the amount a person types into minor units, so the values
 * the fields hold and the values the handler receives are different shapes.
 * react-hook-form needs both stated.
 */
type FormInput = z.input<typeof recordPaymentSchema>;
type FormOutput = z.output<typeof recordPaymentSchema>;

type RecordPaymentDialogProps = {
  order: Order;
};

export const RecordPaymentDialog = ({ order }: RecordPaymentDialogProps) => {
  const [open, setOpen] = useState(false);
  const recordPayment = useRecordPayment();

  /**
   * One key per attempt, not per request. If the network drops after the server
   * committed, resubmitting reuses this key and the API returns the original
   * payment instead of taking the money twice.
   */
  const idempotencyKey = useRef(crypto.randomUUID());

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: { amount: '', reference: '', note: '' },
  });

  const { formState, handleSubmit, register, reset, setError, setValue, watch } = form;
  const method = watch('method');

  useEffect(() => {
    if (open) {
      idempotencyKey.current = crypto.randomUUID();
      reset({ amount: '', reference: '', note: '' });
    }
  }, [open, reset]);

  const onSubmit = useCallback(
    async (values: FormOutput) => {
      try {
        await recordPayment.mutateAsync({
          orderId: order.id,
          // Back to a decimal string for the wire; the API parses it again and
          // stays the authority on what a valid amount is.
          amount: (values.amountMinor / 100).toFixed(2),
          ...(values.method && { method: values.method }),
          ...(values.reference && { reference: values.reference }),
          ...(values.note && { note: values.note }),
          idempotencyKey: idempotencyKey.current,
        });

        setOpen(false);
      } catch (error) {
        // The API answers an over-payment with the exact amount still allowed,
        // so its message is more useful than anything guessed here.
        handleFormApiError(error, setError);
      }
    },
    [order.id, recordPayment, setError],
  );

  const isSettled = order.amountDueMinor === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={isSettled}>{isSettled ? 'Paid in full' : 'Record payment'}</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            {order.orderNumber} — {formatMinor(order.amountDueMinor, order.currency)} still owed of{' '}
            {formatMinor(order.totalMinor, order.currency)}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
          <FieldGroup>
            <Field>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="amount">Amount</FieldLabel>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() =>
                    setValue('amount', (order.amountDueMinor / 100).toFixed(2), {
                      shouldValidate: true,
                    })
                  }
                >
                  Pay the full {formatMinor(order.amountDueMinor, order.currency)}
                </Button>
              </div>
              <Input
                id="amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                className="tabular-nums"
                aria-invalid={Boolean(formState.errors.amount)}
                {...register('amount')}
              />
              <FieldError
                errors={formState.errors.amount ? [formState.errors.amount] : undefined}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="method">Method</FieldLabel>
              <Select
                value={method ?? ''}
                onValueChange={(value) => setValue('method', value as PaymentMethod)}
              >
                <SelectTrigger id="method">
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {METHOD_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="reference">Reference</FieldLabel>
              <Input
                id="reference"
                autoComplete="off"
                placeholder="Bank reference or cheque number"
                {...register('reference')}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="note">Note</FieldLabel>
              <Input id="note" autoComplete="off" placeholder="Optional" {...register('note')} />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? 'Recording…' : 'Record payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
