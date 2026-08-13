'use client';

import { DISPLAY_STATUSES, type DisplayStatus } from '@crossval/shared';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_LABELS: Record<DisplayStatus, string> = {
  pending: 'Pending',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  overdue: 'Overdue',
};

const ALL_STATUSES = 'all';

type OrdersFiltersProps = {
  search: string;
  status: DisplayStatus | undefined;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: DisplayStatus | undefined) => void;
};

export const OrdersFilters = ({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: OrdersFiltersProps) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search customer or order number"
        aria-label="Search orders"
        className="pl-8"
      />
      {search ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear search"
          onClick={() => onSearchChange('')}
          className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>

    <Select
      value={status ?? ALL_STATUSES}
      onValueChange={(value) =>
        onStatusChange(value === ALL_STATUSES ? undefined : (value as DisplayStatus))
      }
    >
      <SelectTrigger className="w-[11rem]" aria-label="Filter by status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
        {DISPLAY_STATUSES.map((value) => (
          <SelectItem key={value} value={value}>
            {STATUS_LABELS[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);
