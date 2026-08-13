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

let inFlightRefresh: Promise<boolean> | null = null;

/**
 * Rotates the session, and deliberately shares one attempt between every caller.
 *
 * Refresh tokens are single use: presenting one that has already been rotated
 * is treated by the API as a stolen token and revokes every session for the
 * user. Two requests expiring at the same moment would do exactly that, so
 * concurrent callers wait on the same promise instead of each rotating.
 */
const refreshSession = (): Promise<boolean> => {
  inFlightRefresh ??= fetch(`${BASE_PATH}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      inFlightRefresh = null;
    });

  return inFlightRefresh;
};

type RequestConfig = {
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

const send = async (path: string, config: RequestConfig): Promise<Response> => {
  const hasBody = config.body !== undefined;

  return fetch(`${BASE_PATH}${path}`, {
    method: config.method,
    credentials: 'include',
    signal: config.signal,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...config.headers,
    },
    body: hasBody ? JSON.stringify(config.body) : undefined,
  });
};

const request = async <T>(
  path: string,
  config: RequestConfig,
  allowRefresh = true,
): Promise<ApiClientResult<T>> => {
  const response = await send(path, config);

  // The access token lasts minutes while the session lasts days, so a 401 is
  // usually just an expired token. Retry once behind a refresh; a second 401
  // means the session is genuinely over.
  if (response.status === 401 && allowRefresh && !path.startsWith('/auth/')) {
    if (await refreshSession()) {
      return request<T>(path, config, false);
    }
  }

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

  if (payload === null) {
    throw new ApiClientError(response.status, FALLBACK_MESSAGE);
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
