import { AsyncLocalStorage } from 'node:async_hooks';

const policy = new AsyncLocalStorage<{ primaryOnly: boolean }>();

/** Discipline requests must not fall back to a disconnected local database. */
export function withPrimaryDatabase<T>(callback: () => T): T {
  return policy.run({ primaryOnly: true }, callback);
}

export function requiresPrimaryDatabase(): boolean {
  return policy.getStore()?.primaryOnly === true;
}
