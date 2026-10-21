import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { isolateServer } from './helpers/isolated-server.mjs';
import { signSessionToken } from '../server/services/sessionTokens.ts';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'isolated-student-test-secret-never-used-for-production';

const { API, setSessionAuth, clearSessionAuth, getValidSessionToken } = await import('../src/services/api.ts');

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear()
  };
};

globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();
globalThis.window = { location: { pathname: '/student' } };

test('Requirement 1: Fresh unauthenticated visit has no token and returns null', () => {
  localStorage.clear();
  sessionStorage.clear();

  assert.equal(getValidSessionToken('STUDENT'), null);
});

test('Requirement 1 & 2: Expired JWT is detected by isValidToken and automatically purged from storage', () => {
  localStorage.clear();
  sessionStorage.clear();

  // Create an expired JWT token (expired 10 minutes ago)
  const expiredPayload = {
    id: 'user-stu-expired',
    role: 'STUDENT',
    exp: Math.floor(Date.now() / 1000) - 600, // 10 minutes ago
    iat: Math.floor(Date.now() / 1000) - 3600
  };
  const expiredToken = jwt.sign(expiredPayload, process.env.JWT_SECRET);

  // Store in both localStorage and sessionStorage
  localStorage.setItem('aids_token_student', expiredToken);
  sessionStorage.setItem('aids_token_student', expiredToken);

  // getValidSessionToken should detect the expired JWT, purge it, and return null
  const retrieved = getValidSessionToken('STUDENT');
  assert.equal(retrieved, null, 'Expired token must return null');
  assert.equal(localStorage.getItem('aids_token_student'), null, 'Expired token must be purged from localStorage');
  assert.equal(sessionStorage.getItem('aids_token_student'), null, 'Expired token must be purged from sessionStorage');
});

test('Requirement 1: Remember Device policy preserves valid session in localStorage across visits', () => {
  localStorage.clear();
  sessionStorage.clear();

  // Create a valid JWT token (valid for 8 hours)
  const validToken = signSessionToken({
    id: 'user-stu-valid',
    role: 'STUDENT',
    password_hash: 'validhash123'
  });

  // Login WITH Remember Device
  setSessionAuth(validToken, 'STUDENT', true);

  // Valid token should be in localStorage AND sessionStorage
  assert.equal(localStorage.getItem('aids_token_student'), validToken);
  assert.equal(getValidSessionToken('STUDENT'), validToken);

  // Simulate tab close (sessionStorage cleared), but device remembered
  sessionStorage.clear();
  assert.equal(getValidSessionToken('STUDENT'), validToken, 'Remembered session must persist even if sessionStorage is empty');
});

test('Requirement 1: Login WITHOUT Remember Device stores token only in sessionStorage', () => {
  localStorage.clear();
  sessionStorage.clear();

  const validToken = signSessionToken({
    id: 'user-stu-tabonly',
    role: 'STUDENT',
    password_hash: 'validhash123'
  });

  // Login WITHOUT Remember Device
  setSessionAuth(validToken, 'STUDENT', false);

  assert.equal(sessionStorage.getItem('aids_token_student'), validToken);
  assert.equal(localStorage.getItem('aids_token_student'), null, 'Session-only login must not write token to localStorage');
  assert.equal(getValidSessionToken('STUDENT'), validToken);
});

test('Requirement 1: Logout clears BOTH localStorage and sessionStorage unconditionally', () => {
  localStorage.clear();
  sessionStorage.clear();

  const validToken = signSessionToken({
    id: 'user-stu-logout',
    role: 'STUDENT',
    password_hash: 'validhash123'
  });

  // Student had a remembered session
  setSessionAuth(validToken, 'STUDENT', true);
  assert.equal(getValidSessionToken('STUDENT'), validToken);

  // Explicit logout
  clearSessionAuth('STUDENT');

  // Both must be completely empty
  assert.equal(localStorage.getItem('aids_token_student'), null);
  assert.equal(sessionStorage.getItem('aids_token_student'), null);
  assert.equal(getValidSessionToken('STUDENT'), null);
});

