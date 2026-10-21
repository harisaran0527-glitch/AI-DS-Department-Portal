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
    id TEXT PRIMARY KEY, student_id TEXT NOT NULL, date TEXT NOT NULL, category TEXT NOT NULL, location TEXT DEFAULT '',
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
const { databaseReady, initDatabaseSchema, db } = await import('../server/db.ts');

test('status migration preserves existing discipline records and defaults them to OPEN', async () => {
  await databaseReady;

  const record = memory.prepare('SELECT * FROM discipline_records WHERE id = ?').get('legacy-record');
  const columns = new Set(memory.prepare('PRAGMA table_info(discipline_records)').all().map(column => column.name));
  assert.equal(record.status, 'OPEN');
  assert.equal(record.student_id, 'legacy-student');
  assert.equal(record.date, '2026-10-01');
  assert.equal(record.category, 'Attendance');
  assert.equal(record.remark, 'Original note');
  assert.equal(record.warning_action, 'Warning');
  assert.equal(record.recorded_by, 'faculty-1');
  assert.ok(columns.has('assigned_faculty_id'));
  assert.ok(columns.has('assigned_staff_name'));
  assert.ok(columns.has('created_at'));
  assert.ok(columns.has('location'));
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

test('discipline issue create, history read, edit, and status persist in the isolated database', async () => {
  await databaseReady;
  const created = await db.addDisciplineIssue({
    studentId: 'legacy-student',
    date: '2026-10-20',
    time: '09:30:00',
    category: 'Fixture Incident',
    location: 'Gate',
    ruleViolated: 'Fixture rule',
    actionTaken: 'Warning',
    fineAmount: 0,
    fineDetails: '',
    remark: 'Created in memory only',
    status: 'OPEN',
    recordedBy: 'Fixture faculty',
    assignedFacultyId: 'fixture-faculty',
    assignedStaffName: 'Fixture Faculty'
  });
  const scope = { facultyId: 'fixture-hod', role: 'HOD' };
  const firstRead = await db.getAllDisciplineIssues({ registerNo: 'AVS001', ...scope });
  assert.ok(firstRead.some(record => record.id === created.id && record.status === 'OPEN'));

  const updated = await db.updateDisciplineIssue(created.id, {
    date: '2026-10-20',
    time: '10:15:00',
    category: 'Fixture Incident Updated',
    location: 'Ground',
    ruleViolated: 'Updated fixture rule',
    actionTaken: 'Follow-up completed',
    fineAmount: 25,
    fineDetails: 'Fixture amount',
    remark: 'Updated in memory only',
    status: 'RESOLVED'
  }, scope);
  assert.equal(updated, true);

  const refreshedRead = await db.getAllDisciplineIssues({ registerNo: 'AVS001', ...scope });
  const persisted = refreshedRead.find(record => record.id === created.id);
  assert.equal(persisted.category, 'Fixture Incident Updated');
  assert.equal(persisted.time, '10:15:00');
  assert.equal(persisted.location, 'Ground');
  assert.equal(persisted.fineAmount, 25);
  assert.equal(persisted.remarks, 'Updated in memory only');
  assert.equal(persisted.status, 'RESOLVED');
  assert.equal(await db.updateDisciplineIssue(created.id, {
    date: '2026-10-20', time: '10:15:00', category: 'Unauthorized', ruleViolated: '',
    actionTaken: '', fineAmount: 0, fineDetails: '', remark: '', status: 'OPEN'
  }), false);

  const existing = memory.prepare('SELECT remark, status FROM discipline_records WHERE id = ?').get('legacy-record');
  assert.deepEqual(existing, { remark: 'Original note', status: 'RESOLVED' });
});
