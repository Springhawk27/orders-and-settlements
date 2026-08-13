import type { AuthUser, LoginInput, RegisterInput } from '@crossval/shared';
import { apiGet, apiPost } from '@/lib/api-client';

// Auth is cookie-based. Nothing here returns or stores a token; the browser
// carries the httpOnly cookies the API set through the rewrite.
export const getCurrentUser = async (signal?: AbortSignal): Promise<AuthUser> => {
  const { data } = await apiGet<AuthUser>('/auth/me', { signal });

  return data;
};

export const login = async (input: LoginInput): Promise<void> => {
  await apiPost('/auth/login', input);
};

export const register = async (input: RegisterInput): Promise<void> => {
  await apiPost('/auth/register', input);
};

export const logout = async (): Promise<void> => {
  await apiPost('/auth/logout');
};

export const refreshSession = async (): Promise<void> => {
  await apiPost('/auth/refresh');
};
