'use client';

import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from './api';
import { authKeys } from './query-keys';

export const useCurrentUser = () =>
  useQuery({
    queryKey: authKeys.currentUser,
    queryFn: ({ signal }) => getCurrentUser(signal),
    // A signed-out visitor is a definitive answer, not a transient failure.
    retry: false,
  });
