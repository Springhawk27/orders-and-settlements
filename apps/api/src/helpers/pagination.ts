import type { PaginationMeta } from '@crossval/shared';

export const toSkip = (page: number, limit: number): number => (page - 1) * limit;

export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number,
): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
