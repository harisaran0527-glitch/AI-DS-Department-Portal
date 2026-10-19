import { AsyncLocalStorage } from 'async_hooks';

export interface RequestMetrics {
  startTime: number;
  dbTimeMs: number;
  dbQueries: number;
  dbConnTimeMs: number;
  bcryptTimeMs: number;
}

export const metricsStorage = new AsyncLocalStorage<RequestMetrics>();

export function getMetrics(): RequestMetrics | undefined {
  return metricsStorage.getStore();
}

export function recordDbQuery(durationMs: number): void {
  const store = metricsStorage.getStore();
  if (store) {
    store.dbTimeMs += durationMs;
    store.dbQueries += 1;
  }
}

export function recordDbConn(durationMs: number): void {
  const store = metricsStorage.getStore();
  if (store) {
    store.dbConnTimeMs += durationMs;
  }
}

export function recordBcrypt(durationMs: number): void {
  const store = metricsStorage.getStore();
  if (store) {
    store.bcryptTimeMs += durationMs;
  }
}
