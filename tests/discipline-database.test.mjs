import assert from 'node:assert/strict';
import { test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { isolateServer } from './helpers/isolated-server.mjs';

// Both drivers are in-memory substitutes. No environment file or live database is used.
let queries = 0;
let fallbacks = 0;
let failure = true;
globalThis.__pgPool = { query: async () => {
  queries++;
  if (failure) throw new Error('isolated database outage');
  return { rows: [{ id: 'primary-only-fixture' }], rowCount: 1 };
} };
process.env.DATABASE_URL = 'postgresql://isolated.invalid/never-connected';
process.env.USE_SQLITE = 'false';
process.env.DATABASE_PATH = path.join(os.tmpdir(), 'avsec-driver-fixture-no-file-created.sqlite');
delete process.env.VERCEL;
class InMemorySqlite {
  pragma() {}
  prepare() { return { all() { fallbacks++; return []; }, get() { fallbacks++; return null; }, run() { fallbacks++; return { changes: 1 }; } }; }
}
isolateServer({}, { 'better-sqlite3': InMemorySqlite });
const adapter = await import('../server/postgresAdapter.ts');
const { withPrimaryDatabase } = await import('../server/databasePolicy.ts');
for (let attempt = 0; !adapter.sqliteDb && attempt < 20; attempt++) await new Promise(setImmediate);
assert.ok(adapter.sqliteDb, 'Isolated fallback driver initialized');

test('primary-only reads retry the primary and never use a disconnected fallback', async () => {
  queries = 0; fallbacks = 0;
  await assert.rejects(withPrimaryDatabase(() => adapter.queryAll('SELECT isolated_fixture')), /isolated database outage/);
  assert.equal(queries, 2);
  assert.equal(fallbacks, 0);
});
test('primary-only writes are attempted once and never fall back after an ambiguous failure', async () => {
  queries = 0; fallbacks = 0;
  await assert.rejects(withPrimaryDatabase(() => adapter.executeRun('INSERT INTO isolated_fixture VALUES (?)', [1])), /isolated database outage/);
  assert.equal(queries, 1);
  assert.equal(fallbacks, 0);
});
test('the existing fallback behavior of unrelated requests is preserved', async () => {
  queries = 0; fallbacks = 0;
  await adapter.queryAll('SELECT isolated_fixture');
  assert.equal(fallbacks, 1);
});
test('healthy primary database operations return their actual results', async () => {
  failure = false; fallbacks = 0;
  try {
    assert.deepEqual(await withPrimaryDatabase(() => adapter.queryOne('SELECT isolated_fixture')), { id: 'primary-only-fixture' });
    assert.deepEqual(await withPrimaryDatabase(() => adapter.executeRun('INSERT INTO isolated_fixture VALUES (?)', [1])), { changes: 1 });
    assert.equal(fallbacks, 0);
  } finally { failure = true; }
});
