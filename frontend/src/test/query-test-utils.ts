import type { QueryClient } from '@tanstack/react-query'

// fetchQuery/prefetchQuery descartam queries que falham; para simular erro em testes SSR
// injetamos o estado de erro direto no cache do React Query
export function seedErrorState(client: QueryClient, queryKey: readonly unknown[], error: Error = new Error('falha')) {
  client.getQueryCache().build(
    client,
    { queryKey },
    {
      data: undefined,
      dataUpdatedAt: 0,
      dataUpdateCount: 0,
      error,
      errorUpdatedAt: 1,
      errorUpdateCount: 1,
      fetchFailureCount: 0,
      fetchFailureReason: null,
      fetchMeta: null,
      isInvalidated: false,
      status: 'error',
      fetchStatus: 'idle',
    },
  )
}
