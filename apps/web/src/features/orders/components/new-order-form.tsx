'use client';

import {
  createOrderSchema,
  formatMinor,
  lineTotalMinor,
  parseMoneyToMinor,
} from '@crossval/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { handleFormApiError } from '@/lib/form-errors';
import { useCreateOrder } from '../hooks';

type FormInput = z.input<typeof createOrderSchema>;
type FormOutput = z.output<typeof createOrderSchema>;

const emptyLine = { description: '', quantity: 1, unitPrice: '' };

const inThirtyDays = (): string => {
  const date = new Date();

  date.setDate(date.getDate() + 30);

  return date.toISOString().slice(0, 10);
};

/** Best effort while typing; the server recomputes every total on submit. */
const previewLineTotal = (quantity: unknown, unitPrice: unknown): number => {
  try {
    return lineTotalMinor(Number(quantity) || 0, parseMoneyToMinor(String(unitPrice ?? '')));
  } catch {
    return 0;
  }
};

export const NewOrderForm = () => {
  const router = useRouter();
  const createOrder = useCreateOrder();

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customer: { name: '', email: '' },
      dueDate: inThirtyDays(),
      lineItems: [{ ...emptyLine }],
    },
  });

  const { control, formState, handleSubmit, register, setError } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const watchedLines = useWatch({ control, name: 'lineItems' });

  const previewTotal = (watchedLines ?? []).reduce(
    (total, line) => total + previewLineTotal(line?.quantity, line?.unitPrice),
    0,
  );

  const onSubmit = async (values: FormOutput) => {
    try {
      const order = await createOrder.mutateAsync(values);

      router.push(`/orders/${order.id}`);
    } catch (error) {
      handleFormApiError(error, setError);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="sm:grid sm:grid-cols-2 sm:gap-4">
            <Field>
              <FieldLabel htmlFor="customer-name">Name</FieldLabel>
              <Input id="customer-name" autoComplete="off" {...register('customer.name')} />
              <FieldError
                errors={
                  formState.errors.customer?.name ? [formState.errors.customer.name] : undefined
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="customer-email">Email</FieldLabel>
              <Input
                id="customer-email"
                type="email"
                autoComplete="off"
                placeholder="Optional"
                {...register('customer.email')}
              />
              <FieldError
                errors={
                  formState.errors.customer?.email ? [formState.errors.customer.email] : undefined
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="dueDate">Due date</FieldLabel>
              <Input id="dueDate" type="date" {...register('dueDate')} />
              <FieldError
                errors={formState.errors.dueDate ? [formState.errors.dueDate] : undefined}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Input id="notes" autoComplete="off" placeholder="Optional" {...register('notes')} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 sm:grid-cols-[1fr_5rem_8rem_auto]">
              <Field>
                <FieldLabel htmlFor={`line-${index}-description`} className="sm:sr-only">
                  Description
                </FieldLabel>
                <Input
                  id={`line-${index}-description`}
                  placeholder="Description"
                  autoComplete="off"
                  {...register(`lineItems.${index}.description`)}
                />
                <FieldError
                  errors={
                    formState.errors.lineItems?.[index]?.description
                      ? [formState.errors.lineItems[index].description]
                      : undefined
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor={`line-${index}-quantity`} className="sm:sr-only">
                  Quantity
                </FieldLabel>
                <Input
                  id={`line-${index}-quantity`}
                  inputMode="numeric"
                  placeholder="Qty"
                  className="tabular-nums"
                  {...register(`lineItems.${index}.quantity`, { valueAsNumber: true })}
                />
                <FieldError
                  errors={
                    formState.errors.lineItems?.[index]?.quantity
                      ? [formState.errors.lineItems[index].quantity]
                      : undefined
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor={`line-${index}-price`} className="sm:sr-only">
                  Unit price
                </FieldLabel>
                <Input
                  id={`line-${index}-price`}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="tabular-nums"
                  {...register(`lineItems.${index}.unitPrice`)}
                />
                <FieldError
                  errors={
                    formState.errors.lineItems?.[index]?.unitPrice
                      ? [formState.errors.lineItems[index].unitPrice]
                      : undefined
                  }
                />
              </Field>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove line ${index + 1}`}
                disabled={fields.length === 1}
                onClick={() => remove(index)}
                className="justify-self-start sm:mt-0"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ ...emptyLine })}
          >
            <Plus className="size-4" />
            Add line
          </Button>

          <Separator />

          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Order total</span>
            <span className="text-lg font-semibold tabular-nums">{formatMinor(previewTotal)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push('/orders')}>
          Cancel
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Creating…' : 'Create order'}
        </Button>
      </div>
    </form>
  );
};
