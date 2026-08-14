'use client';

import { formatMinor, minorToInputValue, updateOrderSchema, type Order } from '@crossval/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Money } from '@/components/shared/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { handleFormApiError } from '@/lib/form-errors';
import { useUpdateOrder } from '../hooks';

type FormInput = z.input<typeof updateOrderSchema>;
type FormOutput = z.output<typeof updateOrderSchema>;

const emptyLine = { description: '', quantity: 1, unitPrice: '' };

export const EditOrderForm = ({ order }: { order: Order }) => {
  const router = useRouter();
  const updateOrder = useUpdateOrder(order.id);

  // Line items are what the recorded payments were measured against, so the
  // server rejects changing them once money has moved.
  const lineItemsLocked = order.paymentCount > 0;

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(updateOrderSchema),
    defaultValues: {
      customer: { name: order.customer.name, email: order.customer.email ?? '' },
      dueDate: order.dueDate.slice(0, 10),
      notes: order.notes ?? '',
      ...(lineItemsLocked
        ? {}
        : {
            lineItems: order.lineItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: minorToInputValue(item.unitPriceMinor),
            })),
          }),
    },
  });

  const { control, formState, handleSubmit, register, setError } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });

  const onSubmit = async (values: FormOutput) => {
    // Line items are only sent when they were actually touched, so a due-date
    // change does not show up in the activity log as a line replacement.
    const { lineItems, ...rest } = values;
    const payload = formState.dirtyFields.lineItems ? values : rest;

    try {
      await updateOrder.mutateAsync(payload);
      router.push(`/orders/${order.id}`);
    } catch (error) {
      handleFormApiError(error, setError);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer and terms</CardTitle>
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
          <CardTitle className="flex items-center gap-2">
            Line items
            {lineItemsLocked ? <Lock className="size-3.5 text-muted-foreground" /> : null}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {lineItemsLocked ? (
            <>
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
                    {order.lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                        <TableCell>
                          <Money minorUnits={item.unitPriceMinor} currency={order.currency} />
                        </TableCell>
                        <TableCell>
                          <Money minorUnits={item.lineTotalMinor} currency={order.currency} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-muted-foreground">
                Locked because {order.paymentCount}{' '}
                {order.paymentCount === 1 ? 'payment has' : 'payments have'} been recorded against
                these lines, totalling {formatMinor(order.amountPaidMinor, order.currency)}. Void
                them to edit the lines again. Terms above stay editable, and every change is written
                to the activity log.
              </p>
            </>
          ) : (
            <>
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
                    className="justify-self-start"
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

              <p className="text-xs text-muted-foreground">
                No payments have been recorded yet, so these lines can still be changed. Once one
                is, they lock.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(`/orders/${order.id}`)}>
          Cancel
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
};
