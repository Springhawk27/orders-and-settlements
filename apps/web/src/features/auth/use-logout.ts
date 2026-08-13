'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logout } from './api';

export const useLogout = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Every cached response belonged to the session that just ended.
      queryClient.clear();
      router.replace('/login');
    },
  });
};
