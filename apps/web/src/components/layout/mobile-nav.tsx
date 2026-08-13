'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { APP_NAME } from './nav-items';
import { SidebarNav } from './sidebar-nav';

export const MobileNav = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-3">
        <SheetHeader className="p-0">
          <SheetTitle>{APP_NAME}</SheetTitle>
        </SheetHeader>
        <SidebarNav onNavigate={() => setIsOpen(false)} className="mt-4" />
      </SheetContent>
    </Sheet>
  );
};
