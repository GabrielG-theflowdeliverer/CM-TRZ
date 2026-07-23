import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface AuthStatus {
  authenticated: boolean;
  /** False when the server runs without auth configured (local dev). */
  authRequired: boolean;
}

/** Current session state. Cheap, cached; the editor gate reads this. */
export function useAuthStatus() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<AuthStatus>('/api/auth/me'),
    staleTime: 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => api.post<void>('/api/auth/login', { password }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/api/auth/logout'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }),
  });
}
