import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-header';
import { NewOrderForm } from '@/features/orders/components/new-order-form';

export const metadata: Metadata = {
  title: 'New order',
};

const NewOrderPage = () => (
  <div className="mx-auto w-full max-w-3xl space-y-6">
    <PageHeader
      title="New order"
      description="Totals are worked out on the server when the order is saved."
    />
    <NewOrderForm />
  </div>
);

export default NewOrderPage;
