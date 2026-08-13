import type { Metadata } from 'next';
import { OrdersView } from '@/features/orders/components/orders-view';

export const metadata: Metadata = {
  title: 'Orders',
};

const OrdersPage = () => <OrdersView />;

export default OrdersPage;
