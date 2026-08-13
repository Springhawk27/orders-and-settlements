import type { ApiErrorDetail } from '@crossval/shared';

/** The shape every error reducer returns before the handler writes a response. */
export type SimplifiedError = {
  statusCode: number;
  message: string;
  errorMessages: ApiErrorDetail[];
};
