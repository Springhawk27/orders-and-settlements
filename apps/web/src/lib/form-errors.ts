import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Puts the API's per-field errors back on the fields that produced them and
 * shows the top-level message as a toast, so a path the form does not own is
 * still visible to the person filling it in.
 */
export const handleFormApiError = <TValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TValues>,
): void => {
  if (!(error instanceof ApiClientError)) {
    toast.error(FALLBACK_MESSAGE);
    return;
  }

  for (const detail of error.errorMessages) {
    if (detail.path) {
      setError(detail.path as Path<TValues>, { type: 'server', message: detail.message });
    }
  }

  toast.error(error.message);
};
