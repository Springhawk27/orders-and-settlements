import type {
  AuditEvent,
  CreateOrderRequest,
  DashboardSummary,
  Order,
  OrderSummary,
  Payment,
  PaymentResult,
  PaginationMeta,
  UpdateOrderRequest,
} from '@crossval/shared';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import type { OrderListParams } from './query-keys';

const toQueryString = (params: OrderListParams): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }

  const query = search.toString();

  return query ? `?${query}` : '';
};

export const fetchOrders = async (
  params: OrderListParams,
  signal?: AbortSignal,
): Promise<{ orders: OrderSummary[]; meta?: PaginationMeta }> => {
  const { data, meta } = await apiGet<OrderSummary[]>(`/orders${toQueryString(params)}`, {
    signal,
  });

  return { orders: data, meta };
};

export const fetchOrder = async (orderId: string, signal?: AbortSignal): Promise<Order> =>
  (await apiGet<Order>(`/orders/${orderId}`, { signal })).data;

export const fetchOrderAudit = async (
  orderId: string,
  signal?: AbortSignal,
): Promise<AuditEvent[]> =>
  (await apiGet<AuditEvent[]>(`/orders/${orderId}/audit`, { signal })).data;

export const fetchOrderPayments = async (
  orderId: string,
  signal?: AbortSignal,
): Promise<Payment[]> => (await apiGet<Payment[]>(`/orders/${orderId}/payments`, { signal })).data;

// These take the unparsed request shape, not the schema's output: the API parses
// the raw values itself, and a parsed one would fail its validation.
export const createOrder = async (input: CreateOrderRequest): Promise<Order> =>
  (await apiPost<Order>('/orders', input)).data;

export const updateOrder = async (orderId: string, input: UpdateOrderRequest): Promise<Order> =>
  (await apiPatch<Order>(`/orders/${orderId}`, input)).data;

export const deleteOrder = async (orderId: string): Promise<void> => {
  await apiDelete(`/orders/${orderId}`);
};

export type RecordPaymentPayload = {
  orderId: string;
  amount: string;
  method?: string;
  reference?: string;
  note?: string;
  /** Generated per submission so a retry after a timeout cannot pay twice. */
  idempotencyKey: string;
};

export const recordPayment = async ({
  orderId,
  idempotencyKey,
  ...body
}: RecordPaymentPayload): Promise<PaymentResult> =>
  (await apiPost<PaymentResult>(`/orders/${orderId}/payments`, body, { idempotencyKey })).data;

export const voidPayment = async (paymentId: string, reason: string): Promise<PaymentResult> =>
  (await apiPost<PaymentResult>(`/payments/${paymentId}/void`, { reason })).data;

export const fetchDashboardSummary = async (signal?: AbortSignal): Promise<DashboardSummary> =>
  (await apiGet<DashboardSummary>('/dashboard/summary', { signal })).data;
