import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isolateServer } from './helpers/isolated-server.mjs';
import { requiresPrimaryDatabase } from '../server/databasePolicy.ts';
import { signSessionToken } from '../server/services/sessionTokens.ts';

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
let revocationFails = false;
const revoked = new Set();
const database = {
  findUserByIdentifier: async (identifier, role) => {
    assert.equal(requiresPrimaryDatabase(), true);
    if (databaseFails) throw new Error('private connection detail');
    return accounts.find(user => user.identifier === identifier && user.role === role);
  },
  getUserById: async id => {
    assert.equal(requiresPrimaryDatabase(), true);
    if (databaseFails) throw new Error('private connection detail');
    return accounts.find(user => user.id === id);
  },
  isSessionRevoked: async digest => revoked.has(digest),
  revokeSessionToken: async digest => {
    if (revocationFails) throw new Error('isolated revocation outage');
    revoked.add(digest);
  },
  updateUserPassword: async (id, hash) => { accounts.find(user => user.id === id).password_hash = hash; },
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
process.env.FRONTEND_URL = base;
const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('all four roles authenticate through real handlers with role-specific cookies and isolated sessions', async () => {
  for (const account of accounts) {
    const login = await post('/api/auth/login', { identifier: account.identifier, password, role: account.role });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, new RegExp(`aids_${account.role.toLowerCase()}_token=`));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
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
    const signed = signSessionToken(account);
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
  const student = signSessionToken(accounts[0]);
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

const session = (token, extra = {}) => fetch(base + '/api/auth/me', { headers: { Authorization: `Bearer ${token}`, ...extra } });

test('logout revokes the exact token while other sessions and roles remain active', async () => {
  const first = signSessionToken(accounts[1]);
  const other = signSessionToken(accounts[1]);
  const admin = signSessionToken(accounts[3]);
  assert.notEqual(jwt.decode(first).jti, jwt.decode(other).jti);
  assert.equal((await post('/api/auth/logout', {}, { Authorization: `Bearer ${first}`, 'X-Portal-Role': 'FACULTY' })).status, 200);
  assert.equal((await session(first)).status, 401);
  assert.equal((await session(other)).status, 200);
  assert.equal((await session(admin)).status, 200);
});

test('revocation outage returns 503 instead of claiming a successful logout', async () => {
  const token = signSessionToken(accounts[1]);
  revocationFails = true;
  try {
    const response = await post('/api/auth/logout', {}, { Authorization: `Bearer ${token}` });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.doesNotMatch(JSON.stringify(await response.json()), /isolated revocation/);
  } finally { revocationFails = false; }
  assert.equal((await session(token)).status, 200);
});

test('active sessions fail closed after account removal, deactivation, role change or password reset', async () => {
  const account = accounts[1];
  const token = signSessionToken(account);
  const snapshot = { ...account };
  try {
    for (const updates of [{ is_active: 0 }, { role: 'STUDENT' }, { password_hash: bcrypt.hashSync('memory-reset-password', 4) }, { id: 'removed-from-memory' }]) {
      Object.assign(account, snapshot, updates);
      assert.equal((await session(token)).status, 401);
    }
  } finally { Object.assign(account, snapshot); }
});

test('authenticated requests require an authoritative database even when the signature is valid', async () => {
  const token = signSessionToken(accounts[1]);
  databaseFails = true;
  try {
    const response = await session(token);
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(await response.json()), /private connection/);
  } finally { databaseFails = false; }
});

test('JWT verification pins algorithm, issuer, audience, subject, expiry and session identity', async () => {
  const payload = jwt.decode(signSessionToken(accounts[1]));
  const cases = [
    { algorithm: 'HS512' }, { claims: { iss: 'different-app' } }, { claims: { aud: 'different-audience' } },
    { claims: { sub: 'another-id' } }, { claims: { role: 'UNKNOWN' } }, { claims: { jti: undefined } },
    { claims: { id: undefined } }, { claims: { credentialVersion: 'invalid' } },
    { claims: { exp: undefined } }, { claims: { exp: payload.iat - 1 } },
    { claims: { exp: payload.iat + 9 * 3600 } }
  ];
  for (const item of cases) {
    const claims = Object.fromEntries(Object.entries({ ...payload, ...item.claims }).filter(([, value]) => value !== undefined));
    const token = jwt.sign(claims, process.env.JWT_SECRET, { algorithm: item.algorithm || 'HS256' });
    assert.equal((await session(token)).status, 401, JSON.stringify(item));
  }
});

test('missing, weak and placeholder signing keys fail closed in every runtime without generating keys', async () => {
  const original = process.env.JWT_SECRET;
  const originalMode = process.env.NODE_ENV;
  try {
    for (const mode of ['development', 'production']) {
      process.env.NODE_ENV = mode;
      for (const value of ['', 'short-test-value', 'your_jwt_secret_key_here_change_in_production', 'aids_system_secure_jwt_secret_token_key_2026']) {
        process.env.JWT_SECRET = value;
        const response = await post('/api/auth/login', { identifier: accounts[1].identifier, password, role: 'FACULTY' });
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('set-cookie'), null);
        assert.equal(process.env.JWT_SECRET, value);
      }
    }
  } finally {
    process.env.JWT_SECRET = original;
    if (originalMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalMode;
  }
});

test('URL tokens and legacy cookies are rejected; a malformed Bearer header cannot fall back to a valid cookie', async () => {
  const token = signSessionToken(accounts[1]);
  assert.equal((await fetch(base + '/api/auth/me?token=' + encodeURIComponent(token))).status, 401);
  assert.equal((await fetch(base + '/api/auth/me', { headers: { Cookie: `aids_session_token=${token}` } })).status, 401);
  assert.equal((await fetch(base + '/api/auth/me', { headers: { Cookie: `aids_faculty_token=${token}`, Authorization: 'invalid', 'X-Portal-Role': 'FACULTY' } })).status, 401);
  assert.equal((await session(token, { 'X-Portal-Role': 'invalid' })).status, 401);
});

test('shared requests with multiple portal cookies require an explicit role', async () => {
  const faculty = signSessionToken(accounts[1]);
  const admin = signSessionToken(accounts[3]);
  const Cookie = `aids_faculty_token=${faculty}; aids_admin_token=${admin}`;
  assert.equal((await fetch(base + '/api/auth/me', { headers: { Cookie } })).status, 401);
  const response = await fetch(base + '/api/auth/me', { headers: { Cookie, 'X-Portal-Role': 'FACULTY' } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.role, 'FACULTY');
});

test('cookie-authenticated mutations reject foreign origins and allow the application origin', async () => {
  const token = signSessionToken(accounts[1]);
  const Cookie = `aids_faculty_token=${token}`;
  for (const Origin of [undefined, 'http://attacker.invalid']) {
    assert.equal((await post('/api/auth/logout', {}, { Cookie, ...(Origin ? { Origin } : {}) })).status, 403);
  }
  assert.equal((await post('/api/auth/logout', {}, { Cookie, Origin: base })).status, 200);
  assert.equal((await session(token)).status, 401);
});

test('session responses use current account metadata and never expose hashes or credential versions', async () => {
  const account = accounts[1];
  const token = signSessionToken(account);
  const oldName = account.name;
  account.name = 'Updated memory-only name';
  try {
    const response = await session(token);
    const body = await response.json();
    assert.equal(body.user.name, account.name);
    assert.doesNotMatch(JSON.stringify(body), /password_hash|credentialVersion/);
  } finally { account.name = oldName; }
});

test('password changes validate inputs and invalidate all previous sessions without affecting other users', async () => {
  const account = accounts[1];
  const oldHash = account.password_hash;
  const first = signSessionToken(account);
  const second = signSessionToken(account);
  const other = signSessionToken(accounts[3]);
  try {
    const headers = { Authorization: `Bearer ${first}` };
    assert.equal((await post('/api/auth/change-password', { currentPassword: {}, newPassword: 'valid-memory-password' }, headers)).status, 400);
    const response = await post('/api/auth/change-password', { currentPassword: password, newPassword: 'new-memory-only-password' }, headers);
    assert.equal(response.status, 200);
    assert.equal(bcrypt.compareSync('new-memory-only-password', account.password_hash), true);
    assert.equal((await session(first)).status, 401);
    assert.equal((await session(second)).status, 401);
    assert.equal((await session(other)).status, 200);
    assert.equal((await session(signSessionToken(account))).status, 200);
  } finally { account.password_hash = oldHash; }
});

test('production cookies are Secure and authentication responses cannot be cached', async () => {
  const originalMode = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const response = await post('/api/auth/login', { identifier: accounts[1].identifier, password, role: 'FACULTY' });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /; Secure/i);
    assert.match(response.headers.get('set-cookie'), /; HttpOnly/i);
    assert.match(response.headers.get('cache-control'), /no-store/);
  } finally {
    if (originalMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalMode;
  }
});
