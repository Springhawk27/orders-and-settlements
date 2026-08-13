import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';

const toDate = (value: string | Date): Date => (value instanceof Date ? value : parseISO(value));

export const formatDate = (value: string | Date): string => {
  const date = toDate(value);

  return isValid(date) ? format(date, 'd MMM yyyy') : '';
};

export const formatDateTime = (value: string | Date): string => {
  const date = toDate(value);

  return isValid(date) ? format(date, 'd MMM yyyy, HH:mm') : '';
};

/**
 * Display copy only. The server sends `isOverdue` and `daysOverdue` on an order
 * and those remain the authority, because they are measured against its clock.
 */
export const formatRelativeDueDate = (value: string | Date): string => {
  const date = toDate(value);

  if (!isValid(date)) {
    return '';
  }

  const days = differenceInCalendarDays(date, new Date());

  if (days === 0) {
    return 'Due today';
  }

  if (days === 1) {
    return 'Due tomorrow';
  }

  if (days > 1) {
    return `Due in ${days} days`;
  }

  return days === -1 ? '1 day overdue' : `${Math.abs(days)} days overdue`;
};
