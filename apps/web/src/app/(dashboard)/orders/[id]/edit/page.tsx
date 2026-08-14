import type { Metadata } from 'next';
import { EditOrderView } from '@/features/orders/components/edit-order-view';

export const metadata: Metadata = {
  title: 'Edit order',
};

const EditOrderPage = async ({ params }: PageProps<'/orders/[id]/edit'>) => {
  const { id } = await params;

  return <EditOrderView orderId={id} />;
};

export default EditOrderPage;
