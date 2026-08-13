'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { register } from './api';
import { authKeys } from './query-keys';

export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: register,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.all }),
  });
};
