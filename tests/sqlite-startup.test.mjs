import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { isolateServer } from './helpers/isolated-server.mjs';

// Exercise asynchronous native-driver loading with an in-memory substitute. No file is opened.
const memory = new Database(':memory:');
after(() => memory.close());
const forbiddenFile = path.join(os.tmpdir(), `avsec-memory-only-${process.pid}.sqlite`);
const opened = [];
class MemoryOnlyDriver {
  constructor(filename) { opened.push(filename); return memory; }
}
process.env.DATABASE_PATH = forbiddenFile;
process.env.USE_SQLITE = 'true';
delete process.env.VERCEL;
isolateServer(undefined, { 'better-sqlite3': MemoryOnlyDriver }, { loadRealDatabase: true });
const { db, databaseReady } = await import('../server/db.ts');

test('local database startup waits for the asynchronous driver and creates schema without default accounts', async () => {
  assert.ok(databaseReady instanceof Promise);
  await databaseReady;
  assert.deepEqual(opened, [forbiddenFile]);
  assert.equal(memory.prepare('SELECT COUNT(*) AS count FROM users').get().count, 0);
  assert.equal(memory.prepare('SELECT COUNT(*) AS count FROM students').get().count, 0);
  assert.equal(memory.prepare('SELECT COUNT(*) AS count FROM discipline_records').get().count, 0);
  assert.equal(memory.prepare('SELECT COUNT(*) AS count FROM scoring_configuration').get().count, 1);
  assert.equal(await db.isSessionRevoked('memory-only-digest'), false);
  assert.equal(fs.existsSync(forbiddenFile), false);
});

test('persisted revocations are idempotent and preserve all existing account rows', async () => {
  await databaseReady;
  const before = memory.prepare('SELECT * FROM users').all();
  await db.revokeSessionToken('memory-only-digest', 'memory-only-user');
  await db.revokeSessionToken('memory-only-digest', 'memory-only-user');
  assert.equal(await db.isSessionRevoked('memory-only-digest'), true);
  assert.equal(memory.prepare('SELECT COUNT(*) AS count FROM sessions_revocation').get().count, 1);
  assert.deepEqual(memory.prepare('SELECT * FROM users').all(), before);
});
