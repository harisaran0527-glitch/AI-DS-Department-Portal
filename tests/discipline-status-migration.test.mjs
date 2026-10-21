import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import Database from 'better-sqlite3';
import { isolateServer } from './helpers/isolated-server.mjs';

const memory = new Database(':memory:');
after(() => memory.close());

memory.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, identifier TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL,
    year TEXT, section TEXT, faculty_role TEXT, is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE students (
    id TEXT PRIMARY KEY, register_no TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, department TEXT NOT NULL DEFAULT 'AI & DS',
    year TEXT NOT NULL, section TEXT NOT NULL, batch TEXT NOT NULL,
    class_coordinator_name TEXT NOT NULL DEFAULT 'Assigned Faculty', cgpa REAL DEFAULT NULL,
    overall_score REAL NOT NULL DEFAULT 0.0, current_rank INTEGER NOT NULL DEFAULT 99,
    is_representative INTEGER NOT NULL DEFAULT 0, created_by_faculty_id TEXT,
    faculty_workspace_id TEXT, personal_email TEXT, mobile_number TEXT, address TEXT
  );
  CREATE TABLE discipline_records (
    id TEXT PRIMARY KEY, student_id TEXT NOT NULL, date TEXT NOT NULL, category TEXT NOT NULL,
    remark TEXT NOT NULL, warning_action TEXT NOT NULL, recorded_by TEXT NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );
  INSERT INTO students (id, register_no, name, email, year, section, batch)
    VALUES ('legacy-student', 'AVS001', 'Existing Student', 'student@example.invalid', '2nd Year', 'A', '2025-2029');
  INSERT INTO discipline_records (id, student_id, date, category, remark, warning_action, recorded_by)
    VALUES ('legacy-record', 'legacy-student', '2026-10-01', 'Attendance', 'Original note', 'Warning', 'faculty-1');
`);

class MemoryOnlyDriver {
  constructor() { return memory; }
}

process.env.DATABASE_PATH = ':memory:';
process.env.USE_SQLITE = 'true';
delete process.env.VERCEL;
isolateServer(undefined, { 'better-sqlite3': MemoryOnlyDriver }, { loadRealDatabase: true });
const { databaseReady, initDatabaseSchema } = await import('../server/db.ts');

test('status migration preserves existing discipline records and defaults them to OPEN', async () => {
  await databaseReady;

  const record = memory.prepare('SELECT * FROM discipline_records WHERE id = ?').get('legacy-record');
  assert.equal(record.status, 'OPEN');
  assert.equal(record.student_id, 'legacy-student');
  assert.equal(record.date, '2026-10-01');
  assert.equal(record.category, 'Attendance');
  assert.equal(record.remark, 'Original note');
  assert.equal(record.warning_action, 'Warning');
  assert.equal(record.recorded_by, 'faculty-1');
  assert.equal(memory.prepare('SELECT COUNT(*) AS count FROM users').get().count, 0);
});

test('status migration is idempotent for already-migrated data', async () => {
  await databaseReady;
  memory.prepare('UPDATE discipline_records SET status = ? WHERE id = ?').run('RESOLVED', 'legacy-record');

  await initDatabaseSchema();

  const record = memory.prepare('SELECT * FROM discipline_records WHERE id = ?').get('legacy-record');
  assert.equal(record.status, 'RESOLVED');
  assert.equal(record.remark, 'Original note');
});
