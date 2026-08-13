import type {
  ApiErrorDetail,
  ApiErrorResponse,
  ApiResponse,
  PaginationMeta,
} from '@crossval/shared';

/** Relative on purpose: requests go through the Next rewrite, never to the API origin. */
const BASE_PATH = '/api/v1';

const FALLBACK_MESSAGE = 'The request could not be completed';

export class ApiClientError extends Error {
  readonly status: number;
  readonly errorMessages: ApiErrorDetail[];

  constructor(status: number, message: string, errorMessages: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.errorMessages = errorMessages;
  }
}

export type ApiClientResult<T> = {
  data: T;
  meta?: PaginationMeta;
};

export type RequestOptions = {
  signal?: AbortSignal;
};

export type PostOptions = RequestOptions & {
  /** The API deduplicates payment writes on this key, so retries stay safe. */
  idempotencyKey?: string;
};

const isErrorEnvelope = (payload: unknown): payload is ApiErrorResponse =>
  typeof payload === 'object' && payload !== null && 'success' in payload && !payload.success;

type RequestConfig = {
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

const request = async <T>(path: string, config: RequestConfig): Promise<ApiClientResult<T>> => {
  const hasBody = config.body !== undefined;

  const response = await fetch(`${BASE_PATH}${path}`, {
    method: config.method,
    credentials: 'include',
    signal: config.signal,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...config.headers,
    },
    body: hasBody ? JSON.stringify(config.body) : undefined,
  });

  // A gateway or a crash can answer with something that is not the envelope,
  // so parsing is allowed to fail without masking the status code.
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const envelope = isErrorEnvelope(payload) ? payload : null;

    throw new ApiClientError(
      response.status,
      envelope?.message ?? FALLBACK_MESSAGE,
      envelope?.errorMessages ?? [],
    );
  }

  const envelope = payload as ApiResponse<T>;

  return { data: envelope.data as T, meta: envelope.meta };
};

export const apiGet = <T>(path: string, options: RequestOptions = {}) =>
  request<T>(path, { method: 'GET', signal: options.signal });

export const apiPost = <T>(path: string, body?: unknown, options: PostOptions = {}) =>
  request<T>(path, {
    method: 'POST',
    body,
    signal: options.signal,
    headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : undefined,
  });

export const apiPatch = <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
  request<T>(path, { method: 'PATCH', body, signal: options.signal });

export const apiDelete = <T>(path: string, options: RequestOptions = {}) =>
  request<T>(path, { method: 'DELETE', signal: options.signal });
