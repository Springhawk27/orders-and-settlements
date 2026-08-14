'use client';

import {
  DISPLAY_STATUSES,
  type DisplayStatus,
  type OrderSortField,
  type SortDirection,
} from '@crossval/shared';
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

export type SortChoice = { sortBy: OrderSortField; sortDir: SortDirection };

const SORT_OPTIONS: { value: string; label: string; sort: SortChoice }[] = [
  {
    value: 'createdAt:desc',
    label: 'Newest first',
    sort: { sortBy: 'createdAt', sortDir: 'desc' },
  },
  { value: 'createdAt:asc', label: 'Oldest first', sort: { sortBy: 'createdAt', sortDir: 'asc' } },
  { value: 'dueDate:asc', label: 'Due soonest', sort: { sortBy: 'dueDate', sortDir: 'asc' } },
  { value: 'dueDate:desc', label: 'Due latest', sort: { sortBy: 'dueDate', sortDir: 'desc' } },
  {
    value: 'totalMinor:desc',
    label: 'Largest amount',
    sort: { sortBy: 'totalMinor', sortDir: 'desc' },
  },
  {
    value: 'totalMinor:asc',
    label: 'Smallest amount',
    sort: { sortBy: 'totalMinor', sortDir: 'asc' },
  },
];

type OrdersFiltersProps = {
  search: string;
  status: DisplayStatus | undefined;
  sort: SortChoice;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: DisplayStatus | undefined) => void;
  onSortChange: (value: SortChoice) => void;
};

export const OrdersFilters = ({
  search,
  status,
  sort,
  onSearchChange,
  onStatusChange,
  onSortChange,
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

    <Select
      value={`${sort.sortBy}:${sort.sortDir}`}
      onValueChange={(value) => {
        const option = SORT_OPTIONS.find((entry) => entry.value === value);

        if (option) {
          onSortChange(option.sort);
        }
      }}
    >
      <SelectTrigger className="w-[11rem]" aria-label="Sort orders">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);
