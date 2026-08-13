import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppTopbar } from '@/components/layout/app-topbar';

const DashboardLayout = ({ children }: LayoutProps<'/'>) => (
  <div className="flex flex-1 flex-col">
    <AppTopbar />
    <div className="flex flex-1">
      <AppSidebar className="hidden md:block" />
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  </div>
);

export default DashboardLayout;
