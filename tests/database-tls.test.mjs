import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isolateServer } from './helpers/isolated-server.mjs';

isolateServer({});
const { resolvePgConnection, toPgSql } = await import('../server/postgresAdapter.ts');

test('resolvePgConnection upgrades Neon connections to verify-full and strict TLS', () => {
  const neonConn = 'postgresql://neondb_owner:dummy_pass@ep-morning-hat-b3a7h7ov-pooler.c-4.ap-southeast-1.aws.neon.tech:5432/neondb?sslmode=require';
  const resolved = resolvePgConnection(neonConn);

  assert.equal(resolved.provider, 'neon');
  assert.equal(resolved.host, 'ep-morning-hat-b3a7h7ov-pooler.c-4.ap-southeast-1.aws.neon.tech');
  assert.equal(resolved.port, 5432);
  assert.equal(resolved.ssl?.rejectUnauthorized, true);
  assert.ok(resolved.effectiveConnStr.includes('sslmode=verify-full'));
  assert.ok(!resolved.effectiveConnStr.includes('sslmode=require'));
});

test('resolvePgConnection routes Supabase pooler to port 6543 transaction mode with resilient TLS', () => {
  const supabaseConn = 'postgresql://postgres.xxx:dummy_pass@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres';
  const resolved = resolvePgConnection(supabaseConn);

  assert.equal(resolved.provider, 'supabase');
  assert.equal(resolved.host, 'aws-0-ap-southeast-2.pooler.supabase.com');
  assert.equal(resolved.port, 6543);
  assert.ok(resolved.effectiveConnStr.includes(':6543'));
  assert.equal(resolved.ssl?.rejectUnauthorized, false);
});

test('resolvePgConnection respects DATABASE_SSL_REJECT_UNAUTHORIZED override', () => {
  const saved = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  try {
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = 'false';
    const neonConn = 'postgresql://user:pass@ep-test.neon.tech/neondb?sslmode=require';
    const resolvedFalse = resolvePgConnection(neonConn);
    assert.equal(resolvedFalse.ssl?.rejectUnauthorized, false);

    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = 'true';
    const supaConn = 'postgresql://user:pass@pooler.supabase.com:6543/postgres';
    const resolvedTrue = resolvePgConnection(supaConn);
    assert.equal(resolvedTrue.ssl?.rejectUnauthorized, true);
  } finally {
    if (saved !== undefined) process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = saved;
    else delete process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  }
});

test('toPgSql properly translates SQLite positional ? parameters to PostgreSQL ordinal $n parameters', () => {
  const sqliteSql = 'SELECT * FROM students WHERE year = ? AND section = ? AND status = ?';
  const pgSql = toPgSql(sqliteSql);
  assert.equal(pgSql, 'SELECT * FROM students WHERE year = $1 AND section = $2 AND status = $3');

  const insertSql = 'INSERT OR IGNORE INTO sessions_revocation (token_digest, revoked_at) VALUES (?, ?)';
  const pgInsert = toPgSql(insertSql);
  assert.equal(pgInsert, 'INSERT INTO sessions_revocation (token_digest, revoked_at) VALUES ($1, $2)');
});
