import { toast } from 'sonner';

/**
 * A submit that fails validation on a field the form does not render leaves no
 * trace: no error appears and nothing happens. This makes that case visible
 * rather than silent.
 */
export const reportInvalid = (): void => {
  toast.error('Please check the highlighted fields and try again');
};
