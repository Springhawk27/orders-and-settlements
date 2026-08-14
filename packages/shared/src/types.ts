import type {
  AgingBucket,
  AuditAction,
  Currency,
  DisplayStatus,
  PaymentMethod,
  PaymentStatus,
} from './constants.js';

/** Every successful response is wrapped in this envelope. */
export type ApiResponse<T> = {
  statusCode: number;
  success: true;
  message: string | null;
  meta?: PaginationMeta;
  data: T | null;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  errorMessages: ApiErrorDetail[];
};

/**
 * Discriminated on `success`, so narrowing on it gives the client either `data`
 * or `errorMessages` without a cast.
 */
export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

export type ApiErrorDetail = {
  path: string;
  message: string;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Customer = {
  name: string;
  email?: string;
};

export type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
};

/**
 * `paymentStatus` is stored. `displayStatus`, `isOverdue` and `daysOverdue`
 * depend on the current time, so the server computes them on every read and
 * the client renders what it is given rather than deriving its own answer.
 */
export type OrderSummary = {
  id: string;
  orderNumber: string;
  customer: Customer;
  currency: Currency;
  issueDate: string;
  dueDate: string;
  subtotalMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  amountDueMinor: number;
  paymentStatus: PaymentStatus;
  displayStatus: DisplayStatus;
  isOverdue: boolean;
  daysOverdue: number;
  agingBucket: AgingBucket;
  paidInFullAt: string | null;
  wasPaidLate: boolean;
  paymentCount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type Order = OrderSummary & {
  lineItems: LineItem[];
};

export type Payment = {
  id: string;
  orderId: string;
  amountMinor: number;
  paidAt: string;
  method?: PaymentMethod;
  reference?: string;
  note?: string;
  /** A reversal is the compensating entry written when a payment is voided. */
  isReversal: boolean;
  reversedPaymentId?: string;
  voidedAt: string | null;
  createdAt: string;
};

/** Recording or voiding a payment returns the updated order too, so the client
 * does not have to refetch to show the new balance. */
export type PaymentResult = {
  payment: Payment;
  order: OrderSummary;
};

export type AuditEvent = {
  id: string;
  action: AuditAction;
  summary: string;
  at: string;
  actor: { id: string; name: string } | null;
};

export type AgingBreakdown = {
  bucket: AgingBucket;
  orderCount: number;
  amountMinor: number;
};

export type DashboardSummary = {
  currency: Currency;
  totalOutstandingMinor: number;
  totalOverdueMinor: number;
  collectedThisMonthMinor: number;
  orderCount: number;
  countsByStatus: Record<DisplayStatus, number>;
  aging: AgingBreakdown[];
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};
