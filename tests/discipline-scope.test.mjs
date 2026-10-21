import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import Database from 'better-sqlite3';
import { isolateServer } from './helpers/isolated-server.mjs';

// Exercise the real repository SQL against an isolated in-memory database. No app schema initializer runs.
const memory = new Database(':memory:');
after(() => memory.close());
memory.exec(`
  CREATE TABLE students (id TEXT, register_no TEXT, name TEXT, email TEXT, year TEXT, section TEXT, department TEXT,
    created_by_faculty_id TEXT, faculty_workspace_id TEXT);
  CREATE TABLE discipline_records (id TEXT, student_id TEXT, date TEXT, time TEXT, category TEXT, rule_violated TEXT,
    remark TEXT, warning_action TEXT, action_taken TEXT, fine_amount REAL, fine_details TEXT, recorded_by TEXT,
    assigned_faculty_id TEXT, assigned_staff_name TEXT, created_at TEXT, status TEXT DEFAULT 'OPEN');
  CREATE TABLE faculty_assignments (faculty_id TEXT, year TEXT, section TEXT, is_active INTEGER);
`);
for (const [id, year, section, owner] of [['owned', '2nd Year', 'A', 'f1'], ['blank', '', '', 'f2'],
  ['assigned', '2nd Year', 'B', 'f2'], ['outside', '3rd Year', 'C', 'f2']]) {
  memory.prepare('INSERT INTO students VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, id, 'Memory fixture', 'fixture@example.invalid', year, section, 'AI & DS', owner, owner);
  memory.prepare('INSERT INTO discipline_records (id, student_id, date, category) VALUES (?, ?, ?, ?)')
    .run(`r-${id}`, id, '2026-10-01', 'Late Arrival');
}
process.env.VERCEL = '1'; // Prevent schema initialization, SQLite file loading, listeners, and schedulers.
process.env.USE_SQLITE = 'false';
process.env.DATABASE_URL = 'postgresql://isolated.invalid/never-connected';
globalThis.__pgPool = { query: async (sql, parameters) => {
  const statement = memory.prepare(sql.replace(/\$\d+/g, '?'));
  return statement.reader ? { rows: statement.all(...parameters) } : { rows: [], rowCount: statement.run(...parameters).changes };
} };
isolateServer(undefined, {}, { loadRealDatabase: true });
const { db, SQLiteDB } = await import('../server/db.ts');
async function visible(assignment) {
  memory.prepare('DELETE FROM faculty_assignments').run();
  if (assignment) memory.prepare('INSERT INTO faculty_assignments VALUES (?, ?, ?, ?)').run('f1', ...assignment);
  SQLiteDB.invalidateFacultyAssignmentCache();
  return (await db.getAllDisciplineIssues({ facultyId: 'f1', role: 'FACULTY' })).map(row => row.studentId).sort();
}
test('missing assignments do not match unrelated students with empty year and section', async () => {
  assert.deepEqual(await visible(), ['owned']);
});
test('active exact assignments include the assigned class but not unrelated classes', async () => {
  assert.deepEqual(await visible(['2nd Year', 'B', 1]), ['assigned', 'owned']);
});
test('inactive and wildcard assignments grant no additional workspace records', async () => {
  assert.deepEqual(await visible(['2nd Year', 'B', 0]), ['owned']);
  assert.deepEqual(await visible(['ALL', 'ALL', 1]), ['owned']);
});
test('Admin and HOD preserve their department-wide repository access', async () => {
  for (const role of ['HOD', 'ADMIN']) assert.equal((await db.getAllDisciplineIssues({ facultyId: 'lead', role })).length, 4);
});

test('repository reads deny missing identities and non-staff roles', async () => {
  for (const scope of [undefined, {}, { role: 'ADMIN' }, { facultyId: 'f1' }, { facultyId: 'f1', role: 'STUDENT' }]) {
    assert.deepEqual(await db.getAllDisciplineIssues(scope), []);
  }
});

test('discipline creation persists status and incident details in the isolated database', async () => {
  let createdId = '';
  try {
    const created = await db.addDisciplineIssue({
      studentId: 'owned', date: '2026-10-02', time: '10:00', category: 'Late Arrival',
      ruleViolated: 'Rule 2', actionTaken: 'Warning issued', fineAmount: 0, fineDetails: '',
      remark: 'Fixture description', status: 'UNDER_REVIEW', recordedBy: 'Fixture Faculty',
      assignedFacultyId: 'f1', assignedStaffName: 'Fixture Faculty'
    });
    createdId = created.id;
    assert.equal(created.status, 'UNDER_REVIEW');
    const persisted = memory.prepare('SELECT category, remark, status FROM discipline_records WHERE id = ?').get(created.id);
    assert.deepEqual(persisted, { category: 'Late Arrival', remark: 'Fixture description', status: 'UNDER_REVIEW' });
  } finally {
    if (createdId) memory.prepare('DELETE FROM discipline_records WHERE id = ?').run(createdId);
  }
});

test('Discipline reads do not trust a cached assignment after it has been revoked', async () => {
  await visible(['2nd Year', 'B', 1]);
  memory.prepare('UPDATE faculty_assignments SET is_active = 0 WHERE faculty_id = ?').run('f1');
  const records = await db.getAllDisciplineIssues({ facultyId: 'f1', role: 'FACULTY' });
  assert.deepEqual(records.map(record => record.studentId), ['owned']);
});

test('deletion rechecks live ownership and assignment rather than an earlier visible-record list', async () => {
  await visible(['2nd Year', 'B', 1]);
  const scope = { facultyId: 'f1', role: 'FACULTY' };
  assert.equal((await db.getAllDisciplineIssues(scope)).some(record => record.id === 'r-assigned'), true);
  memory.prepare('UPDATE faculty_assignments SET is_active = 0 WHERE faculty_id = ?').run('f1');
  assert.equal(await db.deleteDisciplineIssue('r-assigned', scope), false);
  assert.ok(memory.prepare('SELECT id FROM discipline_records WHERE id = ?').get('r-assigned'));
  assert.equal(await db.deleteDisciplineIssue('r-owned'), false);
  assert.equal(await db.deleteDisciplineIssue('r-owned', { facultyId: 'f1', role: 'STUDENT' }), false);
  assert.equal(await db.deleteDisciplineIssue('r-owned', scope), true);
});

test('updates recheck live faculty ownership and assignments at write time', async () => {
  await visible(['2nd Year', 'B', 1]);
  const scope = { facultyId: 'f1', role: 'FACULTY' };
  const values = {
    date: '2026-10-02', time: '10:00', category: 'Late Arrival', ruleViolated: '',
    actionTaken: '', fineAmount: 0, fineDetails: '', remark: '', status: 'RESOLVED'
  };
  assert.equal(await db.updateDisciplineIssue('r-assigned', values, scope), true);
  memory.prepare('UPDATE faculty_assignments SET is_active = 0 WHERE faculty_id = ?').run('f1');
  assert.equal(await db.updateDisciplineIssue('r-assigned', values, scope), false);
  assert.equal(memory.prepare('SELECT status FROM discipline_records WHERE id = ?').get('r-assigned').status, 'RESOLVED');
  assert.equal(await db.updateDisciplineIssue('r-outside', values, scope), false);
});
