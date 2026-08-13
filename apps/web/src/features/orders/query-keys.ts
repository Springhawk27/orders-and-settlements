import type { OrderListQuery } from '@crossval/shared';

export type OrderListParams = Partial<Omit<OrderListQuery, 'from' | 'to'>>;

export const orderKeys = {
  all: ['orders'] as const,
  lists: ['orders', 'list'] as const,
  list: (params: OrderListParams) => ['orders', 'list', params] as const,
  details: ['orders', 'detail'] as const,
  detail: (orderId: string) => ['orders', 'detail', orderId] as const,
  audit: (orderId: string) => ['orders', 'audit', orderId] as const,
  payments: (orderId: string) => ['orders', 'payments', orderId] as const,
};

export const dashboardKeys = {
  summary: ['dashboard', 'summary'] as const,
};
