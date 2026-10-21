import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { createDisciplineRouter } from '../server/routes/disciplineRouter.ts';
import { withPrimaryDatabase, requiresPrimaryDatabase } from '../server/databasePolicy.ts';

// In-memory fixtures only. No application database module or production bootstrap is imported.
const secret = 'isolated-test-signing-key-never-used-by-the-app';
const owned = { id: 's1', registerNo: '001', name: 'Fixture Student', email: 'fixture@example.invalid',
  year: '2nd Year', section: 'A', department: 'AI & DS', created_by_faculty_id: 'f1' };
const outside = { ...owned, id: 's2', registerNo: '002', created_by_faculty_id: 'f2', section: 'B' };
let saved = [];
let deleted = [];
let updated = [];
let auditFails = false;
let recordsFail = false;
let assignment;
let inactiveAccount = false;
const db = {
  getUserById: async id => ({ id, role: id === 'h1' ? 'HOD' : id === 'a1' ? 'ADMIN' : 'FACULTY',
    name: 'Fixture Faculty', email: 'staff@example.invalid', is_active: inactiveAccount ? 0 : 1 }),
  getFacultyAssignment: async () => assignment,
  getAllFacultyAssignments: async () => ({}),
  getAllStudents: async () => [owned, outside],
  getStudentByRegisterNo: async reg => [owned, outside].find(s => s.registerNo === reg) || null,
  getAllDisciplineIssues: async filters => {
    if (recordsFail) throw new Error('private database connection detail');
    return [{ id: 'r1', studentId: 's1', assignedFacultyId: 'f1' }]
      .filter(row => filters.role !== 'FACULTY' || filters.facultyId === row.assignedFacultyId);
  },
  addDisciplineIssue: async input => { assert.equal(requiresPrimaryDatabase(), true); saved.push(input); return { id: 'new-record', ...input }; },
  deleteDisciplineIssue: async (id, scope) => { assert.equal(scope.facultyId, 'f1'); assert.equal(scope.role, 'FACULTY'); deleted.push(id); return true; },
  logAudit: async () => { if (auditFails) throw new Error('isolated audit failure'); }
};
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, '') || req.cookies.aids_faculty_token;
  try { req.user = jwt.verify(token, secret); next(); }
  catch { res.status(401).json({ error: 'Unauthorized' }); }
};
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};
const { router } = createDisciplineRouter({ db, authenticateToken, requireRole,
  normalizeYear: value => value || '', normalizeSection: value => value || '',
  primaryDatabaseOnly: (_req, _res, next) => withPrimaryDatabase(next) });
const app = express();
app.use(express.json(), cookieParser());
app.use('/api/discipline', router);
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
after(() => new Promise(resolve => server.close(resolve)));
const root = `http://127.0.0.1:${server.address().port}/api/discipline`;
const token = (role = 'FACULTY', id = 'f1') => jwt.sign({ role, id, name: 'Fixture Staff', email: 'staff@example.invalid' }, secret);
async function request(path, { role = 'FACULTY', id, method = 'GET', body, cookie = false } = {}) {
  id ??= role === 'HOD' ? 'h1' : role === 'ADMIN' ? 'a1' : 'f1';
  const headers = { 'Content-Type': 'application/json' };
  if (role) {
    if (cookie) headers.Cookie = `aids_faculty_token=${token(role, id)}`;
    else headers.Authorization = `Bearer ${token(role, id)}`;
  }
  return fetch(root + path, { headers, method, body: body ? JSON.stringify(body) : undefined });
}

test('every discipline endpoint rejects unauthenticated access before reaching data', async () => {
  for (const [path, method] of [['/records', 'GET'], ['/students/search?q=Fixture', 'GET'],
    ['/lookup-student/001', 'GET'], ['/records', 'POST'], ['/records/r1', 'PUT'], ['/records/r1', 'DELETE']]) {
    assert.equal((await request(path, { role: null, method })).status, 401);
  }
});
test('student sessions cannot read or mutate staff discipline routes', async () => {
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    assert.equal((await request(method === 'DELETE' || method === 'PUT' ? '/records/r1' : '/records', { role: 'STUDENT', method })).status, 403);
  }
});
test('role-scoped cookie sessions work and private responses forbid caching', async () => {
  const response = await request('/records', { cookie: true });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('faculty cannot discover students outside their workspace', async () => {
  assert.equal((await (await request('/lookup-student/002')).json()).found, false);
  const { students } = await (await request('/students/search?q=Fixture')).json();
  assert.deepEqual(students.map(s => s.id), ['s1']);
});
test('faculty cannot create or delete records outside their workspace', async () => {
  saved = []; deleted = [];
  const response = await request('/records', { method: 'POST', body: { registerNo: '002', issue: 'Late Arrival' } });
  assert.equal(response.status, 403);
  assert.equal((await request('/records/another-record', { method: 'DELETE' })).status, 404);
  assert.equal(saved.length, 0); assert.equal(deleted.length, 0);
});
test('HOD and Admin retain department-wide lookup access', async () => {
  for (const role of ['HOD', 'ADMIN']) {
    assert.equal((await (await request('/lookup-student/002', { role })).json()).found, true);
  }
});
test('malformed inputs, negative fines, and invalid incident dates do not persist', async () => {
  saved = [];
  for (const invalid of [{ issue: {} }, { fineAmount: -1 }, { fineAmount: 'Infinity' },
    { date: '2026-02-30' }, { time: '25:00' }, { remarks: [] }]) {
    const response = await request('/records', { method: 'POST', body: { registerNo: '001', issue: 'Late Arrival', ...invalid } });
    assert.equal(response.status, 400);
  }
  assert.equal(saved.length, 0);
});
test('a persisted record still returns success when the separate audit service fails', async () => {
  auditFails = true;
  try {
    const response = await request('/records', { method: 'POST', body: { registerNo: '001', issue: 'Late Arrival' } });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).record.id, 'new-record');
  } finally { auditFails = false; }
});
test('database failures return generic JSON without infrastructure details', async () => {
  recordsFail = true;
  try {
    const response = await request('/records');
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(await response.json()), /private database/);
  } finally { recordsFail = false; }
});
test('primary-only database policy stays isolated across asynchronous requests', async () => {
  assert.equal(requiresPrimaryDatabase(), false);
  await withPrimaryDatabase(async () => {
    await Promise.resolve();
    assert.equal(requiresPrimaryDatabase(), true);
  });
  assert.equal(requiresPrimaryDatabase(), false);
});

test('active year/section assignments permit access but missing or wildcard assignments do not', async () => {
  try {
    assignment = { is_active: 1, year: '2nd Year', section: 'B' };
    assert.equal((await (await request('/lookup-student/002')).json()).found, true);
    assignment = { ...assignment, is_active: 0 };
    assert.equal((await (await request('/lookup-student/002')).json()).found, false);
    assignment = { is_active: 1, year: 'ALL', section: 'ALL' };
    assert.equal((await (await request('/lookup-student/002')).json()).found, false);
  } finally { assignment = undefined; }
});
test('a deactivated staff account cannot use an otherwise valid token', async () => {
  inactiveAccount = true;
  try { assert.equal((await request('/records')).status, 403); }
  finally { inactiveAccount = false; }
});
test('authorized insert and deletion retain their response contracts', async () => {
  saved = []; deleted = [];
  const response = await request('/records', { method: 'POST', body: { registerNo: '001', issue: 'Late Arrival', fineAmount: 0 } });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).record.registerNo, '001');
  assert.equal(saved[0].studentId, 's1');
  assert.equal((await request('/records/r1', { method: 'DELETE' })).status, 200);
  assert.deepEqual(deleted, ['r1']);
});
test('authorized faculty can update an in-scope incident and persist its status', async () => {
  updated = [];
  const response = await request('/records/r1', { method: 'PUT', body: {
    issue: 'Late Arrival', ruleViolated: 'Rule 2', actionTaken: 'Warning issued',
    fineAmount: 0, fineDetails: '', remarks: 'Fixture update', date: '2026-10-01',
    time: '09:15', status: 'RESOLVED'
  } });
  assert.equal(response.status, 200);
  assert.deepEqual(updated, [{
    id: 'r1', date: '2026-10-01', time: '09:15', category: 'Late Arrival',
    ruleViolated: 'Rule 2', actionTaken: 'Warning issued', fineAmount: 0,
    fineDetails: '', remark: 'Fixture update', status: 'RESOLVED'
  }]);
  assert.equal((await request('/records/outside', { method: 'PUT', body: {
    issue: 'Late Arrival', ruleViolated: '', actionTaken: '', fineAmount: 0,
    fineDetails: '', remarks: '', date: '2026-10-01', time: '09:15', status: 'OPEN'
  } })).status, 404);
});
test('invalid incident status cannot be written', async () => {
  const response = await request('/records/r1', { method: 'PUT', body: {
    issue: 'Late Arrival', ruleViolated: '', actionTaken: '', fineAmount: 0,
    fineDetails: '', remarks: '', date: '2026-10-01', time: '09:15', status: 'FORGED'
  } });
  assert.equal(response.status, 400);
});
test('record list scope always comes from the authenticated identity', async () => {
  const response = await request('/records?facultyId=f1&role=ADMIN', { id: 'f2' });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).records, []);
});

test('clients cannot forge the student identity, staff attribution, or faculty assignment on insert', async () => {
  saved = [];
  const response = await request('/records', { method: 'POST', body: {
    registerNo: '001', issue: 'Late Arrival', studentId: 's2', recordedBy: 'forged',
    assignedFacultyId: 'f2', assignedStaffName: 'forged', facultyId: 'f2', role: 'ADMIN'
  } });
  assert.equal(response.status, 201);
  assert.equal(saved[0].studentId, 's1');
  assert.equal(saved[0].assignedFacultyId, 'f1');
  assert.equal(saved[0].recordedBy, 'Fixture Faculty (staff@example.invalid)');
});
