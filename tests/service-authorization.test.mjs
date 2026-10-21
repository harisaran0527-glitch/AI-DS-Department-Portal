import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import express from 'express';
import { isolateServer } from './helpers/isolated-server.mjs';
import { signSessionToken } from '../server/services/sessionTokens.ts';

process.env.JWT_SECRET = 'isolated-service-authorization-secret-not-for-deployment';
const accounts = ['STUDENT', 'FACULTY', 'HOD', 'ADMIN'].map(role => ({ id: role.toLowerCase(), role, identifier: 'memory-student-register', email: `${role.toLowerCase()}@example.invalid`, name: 'Memory-only identity', is_active: 1, password_hash: 'memory-only-existing-hash' }));
const students = [
  { id: 'student', register_no: 'memory-student-register', email: 'student@example.invalid', name: 'Own memory fixture', created_by_faculty_id: 'faculty', year: '2nd Year', section: 'A' },
  { id: 'other-student', register_no: 'other-memory-register', email: 'other@example.invalid', name: 'Unassigned memory fixture', year: '2nd Year', section: 'B' }
];
let syncCalls = 0;
const forbiddenDependency = () => { throw new Error('Unexpected external service or database operation in isolated test'); };
const database = {
  getUserById: async id => accounts.find(account => account.id === id),
  isSessionRevoked: async () => false,
  getStudentById: async id => students.find(student => student.id === id),
  getStudents: async () => students,
  getFacultyAssignment: async () => undefined,
  getCertificateById: async id => ({ student_id: id === 'own' ? 'student' : 'other-student', file_data: Buffer.from('memory-only-proof'), original_file_name: 'fixture.pdf', mime_type: 'application/pdf' }),
  getAttachmentById: async id => ({ id, student_id: id === 'own' ? 'student' : 'other-student', file_data: Buffer.from('memory-only-proof'), original_file_name: 'fixture.pdf', mime_type: 'application/pdf' })
};
isolateServer(database, {}, { namedModules: {
  '../postgresAdapter.js': { executeRun: forbiddenDependency, queryOne: forbiddenDependency, queryAll: forbiddenDependency, isPostgresActive: () => false },
  '../storage.js': { MAX_FILE_SIZE_BYTES: 1024, MSG_FILE_TOO_LARGE: 'fixture limit', DANGEROUS_EXTENSIONS: new Set(), PROOF_ALLOWED_EXTENSIONS: new Set(['.pdf']), PROJECT_ALLOWED_EXTENSIONS: new Set(), validateUploadedFile: forbiddenDependency, uploadFileToStorage: forbiddenDependency, downloadFileFromStorage: forbiddenDependency, deleteFileFromStorage: forbiddenDependency, getMimeFromPath: () => 'application/pdf' },
  '../services/skilledgeSync.js': { syncDepartmentSkillEdge: async () => { syncCalls++; return { isolated: true }; }, syncStudentSkillEdge: forbiddenDependency }
} });
const { default: facultyRoutes } = await import('../server/routes/faculty.ts');
const { default: skilledgeRoutes } = await import('../server/routes/skilledge.ts');
const { default: fileRoutes } = await import('../server/routes/files.ts');
const { getRouteParam } = await import('../server/middleware/auth.ts');
const app = express();
app.use(express.json());
app.use('/api/faculty', facultyRoutes);
app.use('/api/skilledge', skilledgeRoutes);
app.use('/api/files', fileRoutes);
app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
after(() => new Promise(resolve => server.close(resolve)));
const base = `http://127.0.0.1:${server.address().port}`;
const request = (path, role, method = 'GET', extra = {}) => fetch(base + path, {
  method, headers: { ...(role ? { Authorization: `Bearer ${signSessionToken(accounts.find(account => account.role === role))}`, 'X-Portal-Role': role } : {}), ...extra }
});

test('Student sessions cannot list staff rosters or mutate any faculty endpoint', async () => {
  for (const [path, method] of [['/students', 'GET'], ['/students', 'POST'], ['/students/student/360', 'PUT'], ['/students/student', 'DELETE']]) {
    assert.equal((await request('/api/faculty' + path, 'STUDENT', method)).status, 403);
  }
});

test('shared proof readers preserve Student self access and deny other students and unassigned faculty', async () => {
  const ownProof = await request('/api/faculty/certificates/own/view', 'STUDENT');
  assert.equal(ownProof.status, 200);
  assert.match(ownProof.headers.get('cache-control'), /no-store/);
  assert.equal((await request('/api/faculty/certificates/own/download', 'STUDENT')).status, 200);
  assert.equal((await request('/api/faculty/certificates/other/view', 'STUDENT')).status, 403);
  assert.equal((await request('/api/faculty/certificates/other/view', 'FACULTY')).status, 403);
  assert.equal((await request('/api/faculty/certificates/own/view', 'FACULTY')).status, 200);
  assert.equal((await request('/api/faculty/certificates/other/view', 'ADMIN')).status, 200);
});

test('generic attachment readers preserve self/owner access and fail closed for unrelated faculty', async () => {
  const response = await request('/api/files/own', 'STUDENT');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal((await request('/api/files/other-student', 'STUDENT')).status, 403);
  assert.equal((await request('/api/files/other-student', 'FACULTY')).status, 403);
  assert.equal((await request('/api/files/own', 'FACULTY')).status, 200);
  assert.equal((await request('/api/files/other-student', 'HOD')).status, 200);
});

test('department-wide synchronization requires an authenticated HOD or Admin', async () => {
  for (const role of [undefined, 'STUDENT', 'FACULTY']) {
    assert.equal((await request('/api/skilledge/trigger-sync', role, 'POST')).status, role ? 403 : 401);
  }
  assert.equal(syncCalls, 0);
  for (const role of ['HOD', 'ADMIN']) assert.equal((await request('/api/skilledge/trigger-sync', role, 'POST')).status, 200);
  assert.equal(syncCalls, 2); // Stubbed synchronization: no real data or services exist in this worker.
});

test('ingestion has no shared default secret and requires its configured credential in every runtime', async () => {
  const original = process.env.SKILLEDGE_SYNC_TOKEN;
  try {
    delete process.env.SKILLEDGE_SYNC_TOKEN;
    assert.equal((await request('/api/skilledge/sync-ingest', undefined, 'POST')).status, 503);
    process.env.SKILLEDGE_SYNC_TOKEN = 'isolated-sync-ingestion-secret-never-used-for-production';
    assert.equal((await request('/api/skilledge/sync-ingest', undefined, 'POST')).status, 401);
    assert.equal((await request('/api/skilledge/sync-ingest', undefined, 'POST', { 'X-SkillEdge-Sync-Key': 'wrong' })).status, 401);
    assert.equal((await request('/api/skilledge/sync-ingest', undefined, 'POST', { 'X-SkillEdge-Sync-Key': process.env.SKILLEDGE_SYNC_TOKEN })).status, 400);
  } finally {
    if (original === undefined) delete process.env.SKILLEDGE_SYNC_TOKEN;
    else process.env.SKILLEDGE_SYNC_TOKEN = original;
  }
});

test('named route parameters reject wildcard arrays and missing or oversized values', () => {
  for (const value of [undefined, [], ['first', 'second'], '', 'x'.repeat(257)]) assert.throws(() => getRouteParam({ params: { id: value } }, 'id'), { status: 400 });
  assert.equal(getRouteParam({ params: { id: 'memory-only-id' } }, 'id'), 'memory-only-id');
});
