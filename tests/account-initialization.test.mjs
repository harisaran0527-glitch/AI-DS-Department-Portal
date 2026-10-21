import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { registerHooks } from 'node:module';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { isolateServer } from './helpers/isolated-server.mjs';

// Both stores are memory-only. No application .env, files or real accounts are loaded.
const stored = new Map();
globalThis.localStorage = {
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value)
};
globalThis.window = new EventTarget();
const memory = new Database(':memory:');
after(() => memory.close());
globalThis.__bootstrapAdapter = {
  sqliteDb: memory,
  sqliteReady: Promise.resolve(),
  isPostgresActive: () => false,
  queryOne: async (sql, params = []) => memory.prepare(sql).get(...params),
  queryAll: async (sql, params = []) => memory.prepare(sql).all(...params),
  executeRun: async (sql, params = []) => memory.prepare(sql).run(...params),
  executeTransaction: () => { throw new Error('Unexpected transaction during schema startup'); }
};
isolateServer(undefined, {}, { loadRealDatabase: true });
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './postgresAdapter.js') return { url: 'isolated-bootstrap:adapter', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'isolated-bootstrap:adapter') return { format: 'module', shortCircuit: true,
      source: Object.keys(globalThis.__bootstrapAdapter).map(key => `export const ${key} = globalThis.__bootstrapAdapter.${key};`).join('\n') };
    return next(url, context);
  }
});
const { DBService } = await import('../src/services/db.ts');
const { db, SQLiteDB } = await import('../server/db.ts');
await SQLiteDB.initSystemAccounts();

test('browser initialization never provisions default Admin or HOD accounts', async () => {
  await DBService.initialize();
  assert.equal(stored.has('aids_secure_admin_v2'), false);
  assert.equal(stored.has('aids_secure_hod_v2'), false);
});

test('browser initialization preserves existing account records byte for byte', async () => {
  for (const role of ['admin', 'hod']) stored.set(`aids_secure_${role}_v2`, JSON.stringify({ id: 'memory-only-' + role, passwordHash: 'existing-memory-fixture-hash' }));
  const before = [...stored];
  await DBService.initialize();
  assert.deepEqual([...stored], before);
});

test('server schema initialization creates no accounts and preserves existing users and hashes', async () => {
  assert.equal(memory.prepare('SELECT COUNT(*) AS count FROM users').get().count, 0);
  memory.prepare(`INSERT INTO users (id,email,identifier,name,role,password_hash,is_active,created_at)
    VALUES (?,?,?,?,?,?,?,?)`).run('memory-only-admin', 'admin@example.invalid', 'existing-memory-admin', 'Memory fixture', 'ADMIN', 'existing-memory-fixture-hash', 1, '2026-01-01');
  const before = memory.prepare('SELECT * FROM users').all();
  await SQLiteDB.initSystemAccounts();
  await SQLiteDB.initSystemAccounts();
  assert.deepEqual(memory.prepare('SELECT * FROM users').all(), before);
});

test('faculty student creation rejects missing passwords before creating any account or student', async () => {
  db.getFacultyAssignment = async () => undefined;
  const before = memory.prepare('SELECT * FROM users').all();
  await assert.rejects(db.createStudentForFaculty('memory-only-admin', { registerNo: 'memory-only', email: 'student@example.invalid' }), /explicit College Portal Password/);
  assert.deepEqual(memory.prepare('SELECT * FROM users').all(), before);
  assert.equal(memory.prepare('SELECT COUNT(*) AS count FROM students').get().count, 0);
});

test('legacy browser import requires an explicit password', async () => {
  await assert.rejects(DBService.bulkImportStudents([]), /explicit portal password/);
});

test('roster onboarding never uses a register number as a password and updates preserve existing credentials', async () => {
  const student = { registerNo: 'memory-only-register', name: 'Memory-only fixture', email: 'memory-only-student@example.invalid', year: '2nd Year', section: 'A' };
  await db.upsertStudentWithUserLogin(student);
  const first = await db.findUserByIdentifier(student.email, 'STUDENT');
  assert.ok(first);
  assert.equal(bcrypt.compareSync(student.registerNo, first.password_hash), false);
  await db.upsertStudentWithUserLogin(student);
  const second = await db.findUserByIdentifier(student.email, 'STUDENT');
  assert.equal(second.id, first.id);
  assert.equal(second.password_hash, first.password_hash);
});
