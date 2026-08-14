'use client';

import { DISPLAY_STATUSES, type DisplayStatus } from '@crossval/shared';
import { FileText, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { TableSkeleton } from '@/components/shared/loading-skeletons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useOrders } from '../hooks';
import { ExportOrdersButton } from './export-orders-button';
import { OrdersFilters } from './orders-filters';
import { OrdersPagination } from './orders-pagination';
import { OrdersTable } from './orders-table';

const PAGE_SIZE = 20;

const isDisplayStatus = (value: string | null): value is DisplayStatus =>
  value !== null && (DISPLAY_STATUSES as readonly string[]).includes(value);

export const OrdersView = () => {
  // Seeded from the URL so links like /orders?status=overdue arrive filtered.
  // The dashboard sends people here that way, and ignoring the parameter would
  // silently drop them on an unfiltered list.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialStatus = searchParams.get('status');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<DisplayStatus | undefined>(
    isDisplayStatus(initialStatus) ? initialStatus : undefined,
  );
  const [page, setPage] = useState(1);

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Changing a filter is handled here rather than in an effect: a narrower
  // filter can leave the current page beyond the last one, and resetting it
  // where the change happens avoids a second render pass.
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // The URL is kept in step with the status filter so the page can be
  // refreshed, bookmarked or shared and come back showing the same thing.
  // `replace` rather than `push`, so filtering does not fill up the back button.
  const handleStatusChange = (value: DisplayStatus | undefined) => {
    setStatus(value);
    setPage(1);
    router.replace(value ? `${pathname}?status=${value}` : pathname, { scroll: false });
  };

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(debouncedSearch && { q: debouncedSearch }),
      ...(status && { status }),
    }),
    [page, debouncedSearch, status],
  );

  const { data, isPending, isError, error, refetch } = useOrders(params);

  const orders = data?.orders ?? [];
  const isFiltered = Boolean(debouncedSearch || status);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Every order, what has been collected against it, and what is still owed."
        action={
          <>
            <ExportOrdersButton />
            <Button asChild>
              <Link href="/orders/new">
                <Plus className="size-4" />
                New order
              </Link>
            </Button>
          </>
        }
      />

      <OrdersFilters
        search={search}
        status={status}
        onSearchChange={handleSearchChange}
        onStatusChange={handleStatusChange}
      />

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>Orders could not be loaded</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{error instanceof Error ? error.message : 'Please try again.'}</span>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : isPending ? (
        <TableSkeleton />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={isFiltered ? 'No orders match those filters' : 'No orders yet'}
          description={
            isFiltered
              ? 'Try a different search term or clear the status filter.'
              : 'Create your first order to start tracking what customers owe you.'
          }
          action={
            isFiltered ? (
              <Button
                variant="outline"
                onClick={() => {
                  handleSearchChange('');
                  handleStatusChange(undefined);
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button asChild>
                <Link href="/orders/new">New order</Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          <OrdersTable orders={orders} />
          <OrdersPagination meta={data?.meta} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
};
