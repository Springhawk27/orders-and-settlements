import type { Metadata } from 'next';
import { ReceiptText } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';

export const metadata: Metadata = {
  title: 'Orders',
};

const OrdersPage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader title="Orders" description="Every order with what has been paid against it." />
    <EmptyState
      icon={ReceiptText}
      title="No orders yet"
      description="Orders you create will be listed here."
    />
  </div>
);

export default OrdersPage;
