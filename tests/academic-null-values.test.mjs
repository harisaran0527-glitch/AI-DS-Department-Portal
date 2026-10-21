import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isolateServer } from './helpers/isolated-server.mjs';

// Existing models and explanation code, with no environment files or live database access.
process.env.VERCEL = '1';
process.env.USE_SQLITE = 'false';
process.env.DATABASE_URL = 'postgresql://isolated.invalid/never-connected';
const subject = { id: 'isolated-subject', subject_code: 'CS001', subject_name: 'Memory fixture',
  academic_year: '2026-2027', year: '2nd Year', semester: 3, section: 'A', department: 'AI & DS',
  subject_type: 'Theory', credits: 3, faculty_handler: 'isolated-staff' };
globalThis.__pgPool = { query: async (sql, parameters) => {
  assert.match(sql, /SELECT \* FROM subjects/);
  assert.deepEqual(parameters, ['CS001']);
  return { rows: [subject] };
} };
isolateServer(undefined, {}, { loadRealDatabase: true });
const { db } = await import('../server/db.ts');
const { generateAIExplanation } = await import('../server/scoringEngine.ts');
const student = { name: 'Memory-only fixture', register_no: 'isolated-register', cgpa: null };
const breakdown = { skillEdge: 70, attendance: 90, leetCode: 50, projects: 60 };

test('award explanations handle absent CGPA without crashing or inventing a zero grade', () => {
  for (const award of ['BEST_STUDENT', 'ELITE_STUDENT']) {
    const text = generateAIExplanation(award, student, breakdown, 80);
    assert.match(text, /Not Available/);
    assert.doesNotMatch(text, /0\.00/);
  }
});
test('award explanations preserve numeric CGPA formatting including a recorded zero', () => {
  assert.match(generateAIExplanation('BEST_STUDENT', { ...student, cgpa: 8.25 }, breakdown, 80), /8\.25/);
  assert.match(generateAIExplanation('ELITE_STUDENT', { ...student, cgpa: 0 }, breakdown, 80), /0\.00/);
});
test('subject lookup retains the actual academic year from the repository row', async () => {
  const result = await db.findSubjectByCode('cs001');
  assert.equal(result.academicYear, '2026-2027');
  assert.equal(result.academic_year, '2026-2027');
  assert.equal(subject.academic_year, '2026-2027');
});
