import type { Metadata } from 'next';
import { OrderDetail } from '@/features/orders/components/order-detail';

export const metadata: Metadata = {
  title: 'Order',
};

const OrderDetailPage = async ({ params }: PageProps<'/orders/[id]'>) => {
  const { id } = await params;

  return <OrderDetail orderId={id} />;
};

export default OrderDetailPage;
