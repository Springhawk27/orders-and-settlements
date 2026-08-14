import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TableSkeleton } from '@/components/shared/loading-skeletons';
import { OrdersView } from '@/features/orders/components/orders-view';

export const metadata: Metadata = {
  title: 'Orders',
};

// The view seeds its filters from the query string, which Next requires to be
// read inside a boundary so the rest of the page can still be prerendered.
const OrdersPage = () => (
  <Suspense fallback={<TableSkeleton />}>
    <OrdersView />
  </Suspense>
);

export default OrdersPage;
