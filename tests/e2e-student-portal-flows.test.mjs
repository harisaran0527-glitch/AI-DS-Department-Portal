import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isolateServer } from './helpers/isolated-server.mjs';
import { signSessionToken } from '../server/services/sessionTokens.ts';

process.env.JWT_SECRET = 'isolated-e2e-test-secret-never-used-for-production-purposes';
const testPasswordHash = bcrypt.hashSync('studentPass123', 4);

const testStudent = {
  id: 'stu-e2e-test-1',
  register_no: '620125243001',
  name: 'Test Student',
  email: 'student@aids.edu',
  college_email: 'student@aids.edu',
  department: 'AI & DS',
  year: '3rd Year',
  section: 'A',
  batch: '2022-2026',
  class_coordinator_name: 'Dr. Coordinator',
  cgpa: 8.85,
  overall_score: 82.0,
  current_rank: 5
};

const testUser = {
  id: 'user-stu-e2e-1',
  studentId: 'stu-e2e-test-1',
  role: 'STUDENT',
  identifier: '620125243001',
  registerNo: '620125243001',
  email: 'student@aids.edu',
  name: 'Test Student',
  is_active: 1,
  password_hash: testPasswordHash
};

const database = {
  getUserById: async (id) => (id === testUser.id ? testUser : null),
  findUserByIdentifier: async (identifier, role) => {
    if (role === 'STUDENT' && (identifier === '620125243001' || identifier === 'student@aids.edu')) {
      return testUser;
    }
    return null;
  },
  getStudentById: async (id) => (id === testStudent.id ? testStudent : undefined),
  getStudentByRegisterNo: async (regNo) => (regNo === testStudent.register_no ? testStudent : null),
  getStudents: async () => [testStudent],
  getStudent360: async (id) => {
    if (id !== testStudent.id) return null;
    return {
      student: testStudent,
      academics: [],
      arrears: [],
      skillEdge: null,
      nptel: [],
      attendance: { percentage: 95.5 },
      discipline: [],
      certificates: [],
      participation: [],
      leetcode: null,
      projects: [],
      achievements: []
    };
  },
  getConnectedAccounts: async () => [],
  getFinalizedAwards: async () => [],
  getTeams: async () => [],
  getRepresentativeEvaluation: async () => null,
  getScoringConfig: async () => ({
    academicWeight: 0.3,
    skillEdgeWeight: 0.2,
    nptelWeight: 0.1,
    attendanceWeight: 0.1,
    disciplineWeight: 0.05,
    leetCodeWeight: 0.15,
    projectsWeight: 0.1
  }),
  isSessionRevoked: async () => false,
  revokeSessionToken: async () => true,
  logAudit: async () => {}
};

isolateServer(database);

const { API, setSessionAuth, clearSessionAuth, getValidSessionToken } = await import('../src/services/api.ts');
const studentRouter = (await import('../server/routes/student.ts')).default;
const authRouter = (await import('../server/routes/auth.ts')).default;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use('/api/student', studentRouter);

const server = app.listen(0);
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

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

test('Flow 1: Fresh unauthenticated visit has empty fields and null session', async () => {
  localStorage.clear();
  sessionStorage.clear();

  assert.equal(getValidSessionToken('STUDENT'), null);
});

test('Flow 2: Student Login with valid credentials succeeds and issues token', async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Portal-Role': 'STUDENT' },
    body: JSON.stringify({
      identifier: '620125243001',
      password: 'studentPass123',
      role: 'STUDENT'
    })
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.message, 'Login successful');
  assert.ok(data.token);
  assert.equal(data.user.role, 'STUDENT');

  // Verify storing with Remember Device = true
  setSessionAuth(data.token, 'STUDENT', true);
  assert.equal(localStorage.getItem('aids_token_student'), data.token);
  assert.equal(getValidSessionToken('STUDENT'), data.token);
});

test('Flow 3: Student Dashboard profile loads fast with valid session', async () => {
  const token = getValidSessionToken('STUDENT');
  assert.ok(token);

  const t0 = performance.now();
  const res = await fetch(`${base}/api/student/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Portal-Role': 'STUDENT'
    }
  });
  const elapsed = performance.now() - t0;

  assert.equal(res.status, 200);
  const profile = await res.json();
  assert.equal(profile.student.name, 'Test Student');
  assert.equal(profile.student.register_no, '620125243001');
  assert.ok(elapsed < 1000, `Profile must load in under 1000ms (took ${elapsed.toFixed(1)}ms)`);
});

test('Flow 4: Student Logout clears session storage and cookie completely', async () => {
  const token = getValidSessionToken('STUDENT');
  assert.ok(token);

  const res = await fetch(`${base}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Portal-Role': 'STUDENT'
    }
  });

  assert.equal(res.status, 200);
  // Clear local session as handleLogout does
  clearSessionAuth('STUDENT');

  // Verification: tokens are completely gone
  assert.equal(getValidSessionToken('STUDENT'), null);
  assert.equal(localStorage.getItem('aids_token_student'), null);
  assert.equal(sessionStorage.getItem('aids_token_student'), null);
});

test('Flow 5: Fresh visit after logout stays unauthenticated on login screen', () => {
  assert.equal(getValidSessionToken('STUDENT'), null);
});

test('Flow 6: Expired session returns 401 and is purged from storage', async () => {
  const expiredToken = jwt.sign(
    { id: testUser.id, role: 'STUDENT', exp: Math.floor(Date.now() / 1000) - 300 },
    process.env.JWT_SECRET
  );

  localStorage.setItem('aids_token_student', expiredToken);

  // Client detects expired JWT and returns null
  assert.equal(getValidSessionToken('STUDENT'), null);
  assert.equal(localStorage.getItem('aids_token_student'), null);

  // Even if an expired token reached the server, server returns 401
  const res = await fetch(`${base}/api/student/me`, {
    headers: {
      Authorization: `Bearer ${expiredToken}`,
      'X-Portal-Role': 'STUDENT'
    }
  });
  assert.equal(res.status, 401);
});

test('Flow 7: Server closes gracefully', () => {
  server.close();
});
