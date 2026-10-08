import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { createStore, del, get, set } from 'idb-keyval';
import { APP } from '@/config';

/**
 * Query cache that survives a refresh. Only public Horizon data lives here
 * (balances, payments, the asset directory, logos), so Home paints instantly
 * with the last known numbers, marked with their time, and then refreshes.
 * Nothing secret ever enters a query.
 */
const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 5_000,
      gcTime: DAY,
      refetchOnWindowFocus: true,
    },
  },
});

const cacheStore = typeof indexedDB !== 'undefined' ? createStore('stova-cache', 'queries') : null;

export const queryPersister = createAsyncStoragePersister({
  storage: cacheStore
    ? {
        getItem: (k) => get<string>(k, cacheStore).then((v) => v ?? null),
        setItem: (k, v) => set(k, v, cacheStore),
        removeItem: (k) => del(k, cacheStore),
      }
    : null,
  key: 'stova-query-cache',
  throttleTime: 1000,
});

export const persistOptions = {
  persister: queryPersister,
  maxAge: DAY,
  buster: APP.version,
  dehydrateOptions: {
    shouldDehydrateQuery: (q: { state: { status: string } }) => q.state.status === 'success',
  },
};

export async function clearQueryCache() {
  queryClient.clear();
  if (cacheStore) await del('stova-query-cache', cacheStore).catch(() => {});
}
