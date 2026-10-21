import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isolateServer } from './helpers/isolated-server.mjs';
import { requiresPrimaryDatabase } from '../server/databasePolicy.ts';

// Real auth routes/middleware; all identities, hashes, and audit writes exist only in this worker.
process.env.JWT_SECRET = 'isolated-auth-test-secret-never-used-for-production';
const password = 'isolated-test-password';
const accounts = ['STUDENT', 'FACULTY', 'HOD', 'ADMIN'].map(role => ({
  id: role.toLowerCase(), role, identifier: `${role.toLowerCase()}@example.invalid`,
  email: `${role.toLowerCase()}@example.invalid`, name: `Isolated ${role}`,
  is_active: 1, password_hash: bcrypt.hashSync(password, 4)
}));
let databaseFails = false;
let auditFails = false;
const database = {
  findUserByIdentifier: async (identifier, role) => {
    assert.equal(requiresPrimaryDatabase(), true);
    if (databaseFails) throw new Error('private connection detail');
    return accounts.find(user => user.identifier === identifier && user.role === role);
  },
  getUserById: async id => accounts.find(user => user.id === id),
  logAudit: async () => { if (auditFails) throw new Error('isolated audit outage'); },
  getAllDisciplineIssues: async () => [],
  getAllStudents: async () => []
};
isolateServer(database);
const { default: authRoutes } = await import('../server/routes/auth.ts');
const { default: disciplineRoutes } = await import('../server/routes/discipline.ts');
const app = express();
app.use(express.json(), cookieParser());
app.use('/api/auth', authRoutes);
app.use('/api/discipline', disciplineRoutes);
app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
after(() => new Promise(resolve => server.close(resolve)));
const base = `http://127.0.0.1:${server.address().port}`;
const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('all four roles authenticate through real handlers with role-specific cookies and isolated sessions', async () => {
  for (const account of accounts) {
    const login = await post('/api/auth/login', { identifier: account.identifier, password, role: account.role });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, new RegExp(`aids_${account.role.toLowerCase()}_token=`));
    assert.match(cookie, /HttpOnly/i);
    const body = await login.json();
    assert.equal(body.user.role, account.role);
    assert.equal(jwt.verify(body.token, process.env.JWT_SECRET).id, account.id);
    assert.doesNotMatch(JSON.stringify(body), /password_hash/);
    const session = await fetch(base + '/api/auth/me', { headers: {
      Cookie: cookie.split(';')[0], 'X-Portal-Role': account.role
    } });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).user.id, account.id);
    const wrongRole = await fetch(base + '/api/auth/me', { headers: {
      Authorization: `Bearer ${body.token}`, 'X-Portal-Role': account.role === 'ADMIN' ? 'FACULTY' : 'ADMIN'
    } });
    assert.equal(wrongRole.status, 401);
    const logout = await post('/api/auth/logout', {}, { Authorization: `Bearer ${body.token}`, 'X-Portal-Role': account.role });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), new RegExp(`aids_${account.role.toLowerCase()}_token=;`));
  }
});
test('real cookie authentication handles discipline student search as a shared staff route', async () => {
  for (const role of ['FACULTY', 'HOD', 'ADMIN']) {
    const account = accounts.find(a => a.role === role);
    const signed = jwt.sign({ id: account.id, role, name: account.name, email: account.email }, process.env.JWT_SECRET);
    const response = await fetch(base + '/api/discipline/students/search?q=absent', {
      headers: { Cookie: `aids_${role.toLowerCase()}_token=${signed}` }
    });
    assert.equal(response.status, 200);
  }
});
test('real middleware denies anonymous, tampered, expired and student access to Discipline', async () => {
  for (const signed of [undefined, 'tampered', jwt.sign({ id: 'faculty', role: 'FACULTY' }, process.env.JWT_SECRET, { expiresIn: -1 })]) {
    const response = await fetch(base + '/api/discipline/records', { headers: signed ? { Authorization: `Bearer ${signed}` } : {} });
    assert.equal(response.status, 401);
  }
  const student = jwt.sign({ id: 'student', role: 'STUDENT' }, process.env.JWT_SECRET);
  assert.equal((await fetch(base + '/api/discipline/records', { headers: { Authorization: `Bearer ${student}` } })).status, 403);
});
test('incorrect credentials and inactive accounts are rejected', async () => {
  const user = accounts[1];
  assert.equal((await post('/api/auth/login', { identifier: user.identifier, password: 'wrong', role: user.role })).status, 401);
  user.is_active = 0;
  try { assert.equal((await post('/api/auth/login', { identifier: user.identifier, password, role: user.role })).status, 401); }
  finally { user.is_active = 1; }
});
test('malformed credentials return validation errors instead of HTTP 500', async () => {
  for (const payload of [{}, { identifier: {}, password, role: 'FACULTY' },
    { identifier: accounts[1].identifier, password: {}, role: 'FACULTY' },
    { identifier: accounts[1].identifier, password, role: 'UNKNOWN' }]) {
    assert.equal((await post('/api/auth/login', payload)).status, 400);
  }
});
test('authentication database outage fails closed with generic JSON', async () => {
  databaseFails = true;
  try {
    const response = await post('/api/auth/login', { identifier: accounts[1].identifier, password, role: 'FACULTY' });
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(await response.json()), /private connection/);
  } finally { databaseFails = false; }
});
test('production authentication refuses a missing signing secret without generating or changing one', async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalMode = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  delete process.env.JWT_SECRET;
  try {
    const response = await post('/api/auth/login', { identifier: accounts[1].identifier, password, role: 'FACULTY' });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await fetch(base + '/api/auth/me')).status, 503);
    assert.equal(process.env.JWT_SECRET, undefined);
  } finally {
    process.env.JWT_SECRET = originalSecret;
    if (originalMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalMode;
  }
});
test('a failed login audit never issues an authentication cookie', async () => {
  auditFails = true;
  try {
    const response = await post('/api/auth/login', { identifier: accounts[1].identifier, password, role: 'FACULTY' });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await response.json()).token, undefined);
  } finally { auditFails = false; }
});
