import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30 seconds
      gcTime: 5 * 60_000,      // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
