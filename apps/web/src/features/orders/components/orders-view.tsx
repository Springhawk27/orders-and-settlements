'use client';

import type { DisplayStatus } from '@crossval/shared';
import { FileText, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { TableSkeleton } from '@/components/shared/loading-skeletons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useOrders } from '../hooks';
import { OrdersFilters } from './orders-filters';
import { OrdersPagination } from './orders-pagination';
import { OrdersTable } from './orders-table';

const PAGE_SIZE = 20;

export const OrdersView = () => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<DisplayStatus | undefined>();
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

  const handleStatusChange = (value: DisplayStatus | undefined) => {
    setStatus(value);
    setPage(1);
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
          <Button asChild>
            <Link href="/orders/new">
              <Plus className="size-4" />
              New order
            </Link>
          </Button>
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
