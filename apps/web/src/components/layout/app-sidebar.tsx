import { SidebarNav } from './sidebar-nav';
import { cn } from '@/lib/utils';

export const AppSidebar = ({ className }: { className?: string }) => (
  <aside className={cn('w-60 shrink-0 border-r p-3', className)}>
    <SidebarNav />
  </aside>
);
