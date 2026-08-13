import type { Metadata } from 'next';
import { LayoutDashboard } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';

export const metadata: Metadata = {
  title: 'Dashboard',
};

const DashboardPage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader title="Dashboard" description="Outstanding balances and collection activity." />
    <EmptyState
      icon={LayoutDashboard}
      title="Nothing to report yet"
      description="Once orders and payments exist, the summary appears here."
    />
  </div>
);

export default DashboardPage;
