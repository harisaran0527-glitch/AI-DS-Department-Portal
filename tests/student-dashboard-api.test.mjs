import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import express from 'express';
import { isolateServer } from './helpers/isolated-server.mjs';

const student = {
  id: 'student-1', register_no: 'AVS2026001', name: 'Fixture Student',
  email: 'student@example.invalid', year: '2nd Year', section: 'A',
  department: 'AI & DS', cgpa: 8.2
};
let profileLookupIds = [];
const full360 = {
  student: { id: student.id, name: student.name },
  academics: [], arrears: [], skillEdge: null, nptel: [], attendance: null,
  discipline: [{ id: 'discipline-1', status: 'OPEN' }], certificates: [],
  participation: [], leetcode: null, projects: [], achievements: []
};
const db = {
  getStudentById: async id => {
    profileLookupIds.push(id);
    return id === student.id ? student : null;
  },
  getStudentByRegisterNo: async () => null,
  getStudents: async () => [student],
  getStudent360: async id => id === student.id ? structuredClone(full360) : null,
  getConnectedAccounts: async () => [],
  getFinalizedAwards: async () => [],
  getTeams: async () => [],
  getRepresentativeEvaluation: async () => null,
  getScoringConfig: async () => ({})
};
const auth = {
  authenticateToken: (req, _res, next) => {
    req.user = { id: 'student-1', studentId: 'student-1', registerNo: 'STALE-SESSION-ID',
      email: 'student@example.invalid', role: 'STUDENT' };
    next();
  },
  requireRole: () => (_req, _res, next) => next()
};
const scoring = {
  calculateCategoryScores: () => ({ academic: 82, skillEdge: 0, nptel: 0, attendance: 0,
    discipline: 90, participation: 0, certificates: 0, leetCode: 0, projects: 0 }),
  computeOverallScore: () => 41,
  generateAIExplanation: () => 'Calculated from current profile records.'
};
const noOpSync = { syncStudentSkillEdge: async () => {} };

isolateServer(db, {}, {
  namedModules: {
    '../middleware/auth.js': auth,
    '../scoringEngine.js': scoring,
    '../services/skilledgeSync.js': noOpSync
  }
});
const { default: studentRouter } = await import('../server/routes/student.ts');
const app = express();
app.use('/api/student', studentRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
after(() => new Promise(resolve => server.close(resolve)));

test('student self profile uses database identity, score breakdown, and private discipline history', async () => {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/student/me?studentId=other-student`);
  assert.equal(response.status, 200);

  const profile = await response.json();
  assert.equal(profile.student.registerNo, 'AVS2026001');
  assert.equal(profile.breakdown.overallScore, 41);
  assert.deepEqual(profile.discipline.map(record => record.id), ['discipline-1']);
  assert.deepEqual(profileLookupIds, ['student-1']);
});

test('student profile hides unsupported score and explanation without academic evidence', async () => {
  student.cgpa = null;
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/student/me`);
    assert.equal(response.status, 200);
    const profile = await response.json();
    assert.equal(profile.breakdown.overallScore, null);
    assert.equal(profile.breakdown.categoryScores.academic, null);
    assert.equal(profile.breakdown.aiExplanation, null);
  } finally {
    student.cgpa = 8.2;
  }
});
