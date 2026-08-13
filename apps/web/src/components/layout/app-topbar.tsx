import Link from 'next/link';
import { MobileNav } from './mobile-nav';
import { APP_NAME } from './nav-items';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export const AppTopbar = () => (
  <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
    <MobileNav />
    <Link href="/dashboard" className="font-semibold tracking-tight">
      {APP_NAME}
    </Link>
    <div className="ml-auto flex items-center gap-1">
      <ThemeToggle />
      <UserMenu />
    </div>
  </header>
);
