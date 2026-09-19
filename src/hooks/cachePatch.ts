import type { QueryClient, QueryFilters } from '@tanstack/react-query'

// setQueryData stamps an entry as freshly fetched. For an optimistic patch that
// is untrue — flipping one flag says nothing about how old the rest of the page
// is — and it restarts the staleness clock on every tap. This applies the same
// update to every matching cache but keeps each entry's original fetch time, so
// a patch is invisible to freshness: it neither extends the stale window nor
// needs an invalidation (and the refetch that comes with one) to repair it.
export function patchQueriesKeepingAge<T>(
  queryClient: QueryClient,
  filters: QueryFilters,
  updater: (old: T | undefined) => T | undefined,
): void {
  for (const query of queryClient.getQueryCache().findAll(filters)) {
    queryClient.setQueryData<T>(query.queryKey, updater, {
      updatedAt: query.state.dataUpdatedAt,
    })
  }
}
