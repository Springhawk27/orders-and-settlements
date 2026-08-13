import type { Metadata } from 'next';
import { DashboardView } from '@/features/orders/components/dashboard-view';

export const metadata: Metadata = {
  title: 'Dashboard',
};

const DashboardPage = () => <DashboardView />;

export default DashboardPage;
