'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { login } from './api';
import { authKeys } from './query-keys';

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    // Returned so the mutation settles only once the session is loaded, which
    // keeps the caller from redirecting into a shell with no user yet.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.all }),
  });
};
