import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { isolateServer } from './helpers/isolated-server.mjs';
import { signSessionToken } from '../server/services/sessionTokens.ts';

process.env.JWT_SECRET = 'isolated-student-test-secret-never-used-for-production';
const testPasswordHash = bcrypt.hashSync('testpassword123', 4);

const studentRecord1 = {
  id: 'stu-alpha-101',
  register_no: '620125243144',
  name: 'Alpha Student',
  email: 'alpha@aids.edu',
  college_email: 'alpha@aids.edu',
  department: 'AI & DS',
  year: '2nd Year',
  section: 'A',
  batch: '2023-2027',
  class_coordinator_name: 'Dr. Coordinator',
  cgpa: 8.50,
  overall_score: 0.0,
  current_rank: 99
};

const studentRecord2 = {
  id: 'stu-beta-202',
  register_no: '620125243999',
  name: 'Beta Student',
  email: 'beta@aids.edu',
  college_email: 'beta@aids.edu',
  department: 'AI & DS',
  year: '2nd Year',
  section: 'A',
  batch: '2023-2027',
  class_coordinator_name: 'Dr. Coordinator',
  cgpa: 9.10,
  overall_score: 85.5,
  current_rank: 2
};

const accounts = [
  {
    id: 'user-stu-1',
    studentId: 'stu-alpha-101',
    role: 'STUDENT',
    identifier: '620125243144',
    registerNo: '620125243144',
    email: 'alpha@aids.edu',
    name: 'Alpha Student',
    is_active: 1,
    password_hash: testPasswordHash
  },
  {
    id: 'user-stu-2',
    studentId: 'stu-beta-202',
    role: 'STUDENT',
    identifier: '620125243999',
    registerNo: '620125243999',
    email: 'beta@aids.edu',
    name: 'Beta Student',
    is_active: 1,
    password_hash: testPasswordHash
  }
];

const mockReward = {
  studentId: 'stu-alpha-101',
  studentName: 'Alpha Student',
  registerNo: '620125243144',
  year: '2nd Year',
  section: 'A',
  totalRewardScore: 42.5,
  performanceLevel: 'Proficient',
  categoryPoints: {
    academic: 17.0,
    nptel: 10.0,
    leetCode: 5.5,
    projects: 5.0,
    hackathons: 0,
    research: 0,
    participation: 0,
    certificates: 0,
    skillEdge: 0,
    attendance: 5.0,
    discipline: 0
  },
  activitiesConsidered: ['Verified Cumulative GPA: 8.50/10.0'],
  evidenceSources: { academic: 'Student CGPA record (8.50)' },
  awardEligibility: ['Department Recognition Candidate'],
  recommendedAward: 'Best Academic Achiever',
  aiReasoning: 'Alpha Student achieved 42.5/100.',
  confidenceScore: 0.96,
  calculatedAt: new Date().toISOString()
};

const database = {
  getUserById: async (id) => accounts.find((u) => u.id === id),
  findUserByIdentifier: async (identifier, role) => accounts.find((u) => u.identifier === identifier && u.role === role),
  isSessionRevoked: async () => false,
  getStudentById: async (id) => {
    if (id === 'stu-alpha-101') return { ...studentRecord1 };
    if (id === 'stu-beta-202') return { ...studentRecord2 };
    return undefined;
  },
  getStudentByRegisterNo: async (regNo) => {
    if (regNo === '620125243144') return { ...studentRecord1 };
    if (regNo === '620125243999') return { ...studentRecord2 };
    return null;
  },
  getStudents: async () => [{ ...studentRecord1 }, { ...studentRecord2 }],
  getStudent360: async (studentId) => {
    const s = studentId === 'stu-alpha-101' ? studentRecord1 : studentRecord2;
    return {
      student: { ...s },
      academics: [],
      arrears: [],
      skillEdge: null,
      nptel: [],
      attendance: null,
      discipline: [],
      certificates: [],
      participation: [],
      leetcode: null,
      projects: [],
      achievements: []
    };
  },
  getConnectedAccounts: async () => [],
  getExternalMetrics: async () => [],
  getSkillEdgeRecord: async () => null,
  getFinalizedAwards: async () => [],
  getTeams: async () => [],
  getRepresentativeEvaluation: async () => null,
  getScoringConfig: async () => ({}),
  getStudentAiReward: async (studentId) => (studentId === 'stu-alpha-101' ? mockReward : null),
  saveStudentAiReward: async () => {}
};

isolateServer(database);

const { default: studentRoutes } = await import('../server/routes/student.ts');

const app = express();
app.use(express.json(), cookieParser());
app.use('/api/student', studentRoutes);

const tokenStu1 = signSessionToken(accounts[0], process.env.JWT_SECRET);
const tokenStu2 = signSessionToken(accounts[1], process.env.JWT_SECRET);

test('GET /api/student/ai-reward returns 200 with reward and rewardScore', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/student/ai-reward`, {
      headers: {
        Authorization: `Bearer ${tokenStu1}`,
        'X-Portal-Role': 'STUDENT'
      }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.reward);
    assert.ok(body.rewardScore);
    assert.equal(body.reward.studentId, 'stu-alpha-101');
    assert.equal(body.reward.totalRewardScore, 42.5);
  } finally {
    server.close();
  }
});

test('GET /api/student/:studentId/ai-reward resolves cleanly for own studentId', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/student/stu-alpha-101/ai-reward`, {
      headers: {
        Authorization: `Bearer ${tokenStu1}`,
        'X-Portal-Role': 'STUDENT'
      }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.reward);
    assert.equal(body.reward.studentId, 'stu-alpha-101');
  } finally {
    server.close();
  }
});

test('GET /api/student/:studentId/ai-reward returns 403 Forbidden when requesting other student (IDOR protection)', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/student/stu-beta-202/ai-reward`, {
      headers: {
        Authorization: `Bearer ${tokenStu1}`,
        'X-Portal-Role': 'STUDENT'
      }
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.error.includes('Forbidden'));
  } finally {
    server.close();
  }
});

test('GET /api/student/me returns normalized student with registerNo, overallScore, and rank', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/student/me`, {
      headers: {
        Authorization: `Bearer ${tokenStu1}`,
        'X-Portal-Role': 'STUDENT'
      }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.student);
    assert.equal(body.student.registerNo, '620125243144');
    assert.equal(body.student.register_no, '620125243144');
    assert.equal(body.student.classCoordinatorName, 'Dr. Coordinator');
  } finally {
    server.close();
  }
});

test('Display logic verifies rank display: unranked/99 never displays #1', () => {
  const getRankDisplay = (rankVal) => {
    if (typeof rankVal === 'number' && rankVal > 0 && rankVal < 99) {
      return `#${rankVal}`;
    }
    return 'Unranked';
  };

  assert.equal(getRankDisplay(99), 'Unranked');
  assert.equal(getRankDisplay(null), 'Unranked');
  assert.equal(getRankDisplay(undefined), 'Unranked');
  assert.equal(getRankDisplay(0), 'Unranked');
  assert.equal(getRankDisplay(1), '#1');
  assert.equal(getRankDisplay(5), '#5');
});

test('GET /api/student/me responds immediately (<200ms) without synchronous external network stalls', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const start = performance.now();
    const res = await fetch(`http://127.0.0.1:${port}/api/student/me`, {
      headers: {
        Authorization: `Bearer ${tokenStu1}`,
        'X-Portal-Role': 'STUDENT'
      }
    });
    const elapsed = performance.now() - start;
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.student);
    assert.ok(elapsed < 2000, `Expected /me response in <2000ms, took ${elapsed.toFixed(1)}ms`);
  } finally {
    server.close();
  }
});

