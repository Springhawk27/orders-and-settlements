'use client';

import type { CreateOrderInput } from '@crossval/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createOrder,
  deleteOrder,
  fetchDashboardSummary,
  fetchOrder,
  fetchOrderAudit,
  fetchOrderPayments,
  fetchOrders,
  recordPayment,
  updateOrder,
  voidPayment,
  type RecordPaymentPayload,
} from './api';
import { dashboardKeys, orderKeys, type OrderListParams } from './query-keys';

export const useOrders = (params: OrderListParams) =>
  useQuery({
    queryKey: orderKeys.list(params),
    queryFn: ({ signal }) => fetchOrders(params, signal),
    // Keeps the previous page on screen while the next one loads, so filtering
    // does not blank the table on every keystroke.
    placeholderData: (previous) => previous,
  });

export const useOrder = (orderId: string) =>
  useQuery({
    queryKey: orderKeys.detail(orderId),
    queryFn: ({ signal }) => fetchOrder(orderId, signal),
  });

export const useOrderPayments = (orderId: string) =>
  useQuery({
    queryKey: orderKeys.payments(orderId),
    queryFn: ({ signal }) => fetchOrderPayments(orderId, signal),
  });

export const useOrderAudit = (orderId: string) =>
  useQuery({
    queryKey: orderKeys.audit(orderId),
    queryFn: ({ signal }) => fetchOrderAudit(orderId, signal),
  });

export const useDashboardSummary = () =>
  useQuery({
    queryKey: dashboardKeys.summary,
    queryFn: ({ signal }) => fetchDashboardSummary(signal),
  });

export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrderInput) => createOrder(input),
    onSuccess: async (order) => {
      toast.success(`Order ${order.orderNumber} created`);
      await queryClient.invalidateQueries({ queryKey: orderKeys.all });
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.summary });
    },
  });
};

export const useUpdateOrder = (orderId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: unknown) => updateOrder(orderId, input),
    onSuccess: async () => {
      toast.success('Order updated');
      await queryClient.invalidateQueries({ queryKey: orderKeys.all });
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.summary });
    },
  });
};

export const useDeleteOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => deleteOrder(orderId),
    onSuccess: async () => {
      toast.success('Order deleted');
      await queryClient.invalidateQueries({ queryKey: orderKeys.all });
      await queryClient.invalidateQueries({ queryKey: dashboardKeys.summary });
    },
  });
};

/**
 * Every change here can move a balance, so the order, its payment history, its
 * audit trail and the dashboard totals are all refetched rather than patched
 * locally. The server is the only thing that knows the new status.
 */
const invalidateAfterPayment = async (
  queryClient: ReturnType<typeof useQueryClient>,
  orderId: string,
) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) }),
    queryClient.invalidateQueries({ queryKey: orderKeys.payments(orderId) }),
    queryClient.invalidateQueries({ queryKey: orderKeys.audit(orderId) }),
    queryClient.invalidateQueries({ queryKey: orderKeys.lists }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.summary }),
  ]);
};

export const useRecordPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RecordPaymentPayload) => recordPayment(payload),
    onSuccess: async (result, variables) => {
      toast.success(`Payment recorded against ${result.order.orderNumber}`);
      await invalidateAfterPayment(queryClient, variables.orderId);
    },
  });
};

export const useVoidPayment = (orderId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      voidPayment(paymentId, reason),
    onSuccess: async () => {
      toast.success('Payment voided');
      await invalidateAfterPayment(queryClient, orderId);
    },
  });
};
