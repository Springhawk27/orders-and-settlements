'use client';

import Link from 'next/link';
import { CardSkeleton } from '@/components/shared/loading-skeletons';
import { PageHeader } from '@/components/shared/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useOrder } from '../hooks';
import { EditOrderForm } from './edit-order-form';

export const EditOrderView = ({ orderId }: { orderId: string }) => {
  const { data, isPending, isError } = useOrder(orderId);

  if (isPending) {
    return <CardSkeleton />;
  }

  if (isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Order not found</AlertTitle>
        <AlertDescription>
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">Back to orders</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title={`Edit ${data.orderNumber}`} description={data.customer.name} />
      <EditOrderForm order={data} />
    </div>
  );
};
