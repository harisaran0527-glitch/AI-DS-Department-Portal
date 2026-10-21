import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const databasePath = path.join(os.tmpdir(), `discipline-portal-test-${process.pid}-${Date.now()}.sqlite`);
process.env.USE_SQLITE = 'true';
process.env.DATABASE_PATH = databasePath;
process.env.JWT_SECRET = 'isolated-discipline-portal-test-secret-never-use-in-production';
process.env.NODE_ENV = 'test';
delete process.env.VERCEL;

const [{ default: express }, { default: cookieParser }, { databaseReady, db }, stores, portalRoutes] = await Promise.all([
  import('express'),
  import('cookie-parser'),
  import('../server/db.ts'),
  import('../server/disciplinePortalStore.ts'),
  import('../server/routes/disciplinePortal.ts')
]);

await databaseReady;
await stores.createDisciplinePortalUser({
  name: 'Isolated Portal Admin', email: 'portal-admin@example.invalid', password: 'fixture-admin-password-2026', role: 'ADMIN'
});
await stores.createDisciplinePortalUser({
  name: 'Isolated Portal Faculty', email: 'portal-faculty@example.invalid', password: 'fixture-faculty-password-2026', role: 'FACULTY'
});
const admin = await stores.getDisciplinePortalUserByEmail('portal-admin@example.invalid');
const faculty = await stores.getDisciplinePortalUserByEmail('portal-faculty@example.invalid');
assert.ok(admin && faculty);

await db.createStudent({
  id: 'fixture-assigned-student', registerNo: 'FIXTURE-001', name: 'Assigned Fixture Student',
  email: 'assigned@example.invalid', year: '2nd Year', section: 'A', department: 'AI & DS', batch: '2024-2028'
});
await db.createStudent({
  id: 'fixture-other-student', registerNo: 'FIXTURE-002', name: 'Other Fixture Student',
  email: 'other@example.invalid', year: '2nd Year', section: 'B', department: 'AI & DS', batch: '2024-2028'
});
await stores.assignDisciplineStudents(faculty.id, ['FIXTURE-001'], admin.id);

const app = express();
app.use(express.json(), cookieParser());
app.use('/api/discipline-portal/auth', portalRoutes.disciplinePortalAuthRouter);
app.use('/api/discipline-portal', portalRoutes.disciplinePortalRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const root = `http://127.0.0.1:${server.address().port}/api/discipline-portal`;

async function signIn(email, password, role) {
  const response = await fetch(`${root}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: root.replace(/\/api\/discipline-portal$/, '') },
    body: JSON.stringify({ email, password, role })
  });
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  return { response, cookie };
}

async function request(cookie, route, { method = 'GET', body } = {}) {
  return fetch(`${root}${route}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json', Origin: root.replace(/\/api\/discipline-portal$/, '') } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

after(async () => {
  await new Promise(resolve => server.close(resolve));
  const { sqliteDb } = await import('../server/postgresAdapter.ts');
  sqliteDb?.close();
  for (const suffix of ['', '-shm', '-wal']) {
    if (fs.existsSync(databasePath + suffix)) fs.rmSync(databasePath + suffix);
  }
});

test('standalone portal authentication separates Admin and Faculty accounts', async () => {
  const { response, cookie } = await signIn('portal-faculty@example.invalid', 'fixture-faculty-password-2026', 'FACULTY');
  assert.equal(response.status, 200);
  assert.ok(cookie?.startsWith('discipline_portal_session='));
  assert.equal((await request(cookie, '/auth/me')).status, 200);
  assert.equal((await signIn('portal-faculty@example.invalid', 'fixture-faculty-password-2026', 'ADMIN')).response.status, 401);
});

test('Faculty only sees assigned students and cannot create incidents for others', async () => {
  const { cookie } = await signIn('portal-faculty@example.invalid', 'fixture-faculty-password-2026', 'FACULTY');
  const search = await request(cookie, '/students/search?q=Fixture');
  assert.deepEqual((await search.json()).students.map(student => student.registerNo), ['FIXTURE-001']);
  assert.equal((await (await request(cookie, '/lookup-student/FIXTURE-002')).json()).found, false);
  const denied = await request(cookie, '/records', {
    method: 'POST', body: { registerNo: 'FIXTURE-002', issue: 'Fixture incident' }
  });
  assert.equal(denied.status, 403);
});

test('Admin manages faculty assignments and reads department incidents', async () => {
  const { cookie } = await signIn('portal-admin@example.invalid', 'fixture-admin-password-2026', 'ADMIN');
  const facultyList = await request(cookie, '/faculty');
  assert.equal(facultyList.status, 200);
  assert.equal((await facultyList.json()).faculty.length, 1);
  const created = await request(cookie, '/records', {
    method: 'POST', body: { registerNo: 'FIXTURE-002', issue: 'Department fixture', status: 'OPEN' }
  });
  assert.equal(created.status, 201);
  const search = await request(cookie, '/students/search?q=Fixture');
  assert.equal((await search.json()).students.length, 2);
});

test('Admin workbook preview is read-only and confirmation imports only valid rows', async () => {
  const { cookie } = await signIn('portal-admin@example.invalid', 'fixture-admin-password-2026', 'ADMIN');
  const rows = [
    { Name: 'Imported Fixture Student', 'Register Number': 'FIXTURE-003', 'College Mail ID': 'imported@example.invalid',
      Year: '1st Year', Section: 'A', Department: 'AI & DS' },
    { Name: 'Duplicate Fixture Student', 'Register Number': 'FIXTURE-001', 'College Mail ID': 'duplicate@example.invalid',
      Year: '1st Year', Section: 'A', Department: 'AI & DS' }
  ];
  const previewResponse = await request(cookie, '/students/import-preview', {
    method: 'POST', body: { facultyId: faculty.id, rows }
  });
  const preview = (await previewResponse.json()).preview;
  assert.equal(previewResponse.status, 200);
  assert.equal(preview[0].valid, true);
  assert.equal(preview[1].valid, false);
  assert.equal(await db.getStudentByRegisterNo('FIXTURE-003'), null);

  const confirm = await request(cookie, '/students/import-confirm', {
    method: 'POST', body: { facultyId: faculty.id, rows }
  });
  assert.equal(confirm.status, 200);
  const result = await confirm.json();
  assert.deepEqual(result.imported, ['FIXTURE-003']);
  assert.equal(result.skipped.length, 1);
  const importedStudent = await db.getStudentByRegisterNo('FIXTURE-003');
  assert.equal(importedStudent.department, 'AI & DS');
  assert.equal(await stores.isDisciplineStudentAssigned(faculty.id, importedStudent.id), true);
  const assigned = await stores.listDisciplineFacultyStudents(faculty.id);
  assert.ok(assigned.some(student => student.registerNo === 'FIXTURE-003'));
});

test('incident create, edit, status update, refresh, and logout persist in isolated SQLite', async () => {
  const { cookie } = await signIn('portal-faculty@example.invalid', 'fixture-faculty-password-2026', 'FACULTY');
  const created = await request(cookie, '/records', {
    method: 'POST', body: { registerNo: 'FIXTURE-001', issue: 'Late Arrival', location: 'Main Gate' }
  });
  assert.equal(created.status, 201);
  const record = (await created.json()).record;
  assert.equal(record.location, 'Main Gate');

  const update = await request(cookie, `/records/${encodeURIComponent(record.id)}`, {
    method: 'PUT',
    body: {
      issue: 'Late Arrival', location: 'North Gate', ruleViolated: 'Fixture rule', actionTaken: 'Warning',
      fineAmount: 0, fineDetails: '', remarks: 'Updated fixture', date: record.date,
      time: record.time, status: 'RESOLVED'
    }
  });
  assert.equal(update.status, 200);
  const refreshed = await request(cookie, '/records?registerNo=FIXTURE-001');
  const saved = (await refreshed.json()).records.find(item => item.id === record.id);
  assert.equal(saved.location, 'North Gate');
  assert.equal(saved.status, 'RESOLVED');
  assert.equal(saved.remarks, 'Updated fixture');

  const logout = await request(cookie, '/auth/logout', { method: 'POST', body: {} });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie') || '', /discipline_portal_session=;/);
  assert.equal((await request('', '/auth/me')).status, 401);
});

test('unauthenticated roles cannot access standalone admin or incident APIs', async () => {
  assert.equal((await request('', '/faculty')).status, 401);
  assert.equal((await request('', '/records')).status, 401);
});
