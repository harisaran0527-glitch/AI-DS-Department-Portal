import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import express from 'express';
import bcrypt from 'bcryptjs';
import { isolateServer } from './helpers/isolated-server.mjs';

process.env.JWT_SECRET = 'isolated-test-secret-at-least-32-bytes-long-2026';

const testPasswordHash = bcrypt.hashSync('pass123', 4);
const testUser = {
  id: 'u1',
  role: 'FACULTY',
  name: 'Dr. Faculty',
  email: 'faculty@example.invalid',
  password_hash: testPasswordHash,
  is_active: 1
};

// -------------------------------------------------------------
// 1. In-memory mock database for testing subject operations
// -------------------------------------------------------------
const subjects = [];
const audits = [];

const mockDb = {
  subjects,
  audits,
  getUserById: async (id) => (id === testUser.id ? testUser : null),
  isSessionRevoked: async () => false,
  getFacultyAssignment: async () => null,
  getSubjects: async (filters = {}) => {
    let filtered = [...subjects];
    if (filters.year && filters.year !== 'ALL') {
      filtered = filtered.filter(s => s.year === filters.year);
    }
    if (filters.semester) {
      filtered = filtered.filter(s => Number(s.semester) === Number(filters.semester));
    }
    if (filters.section && filters.section !== 'ALL') {
      filtered = filtered.filter(s => s.section === filters.section || s.section === 'ALL');
    }
    return filtered;
  },
  findSubjectByCode: async (code) => {
    const clean = String(code).trim().toUpperCase();
    return subjects.find(s => s.subjectCode.toUpperCase() === clean) || null;
  },
  findSubjectByScope: async (code, year, semester, section = 'ALL') => {
    const cleanCode = String(code).trim().toUpperCase();
    const cleanYear = normalizeYear(year);
    const sem = Number(semester);
    const cleanSec = normalizeSection(section) || 'ALL';

    return subjects.find(s =>
      s.subjectCode.toUpperCase() === cleanCode &&
      s.year === cleanYear &&
      Number(s.semester) === sem &&
      (s.section === cleanSec || s.section === 'ALL' || cleanSec === 'ALL')
    ) || null;
  },
  addSubject: async (sub) => {
    const cleanCode = String(sub.subject_code || sub.subjectCode).trim().toUpperCase();
    const cleanYear = normalizeYear(sub.year) || '2nd Year';
    const sem = Number(sub.semester) || 1;
    const cleanSec = normalizeSection(sub.section) || 'ALL';

    const existing = subjects.find(s =>
      s.subjectCode.toUpperCase() === cleanCode &&
      s.year === cleanYear &&
      Number(s.semester) === sem &&
      (s.section === cleanSec || s.section === 'ALL' || cleanSec === 'ALL')
    );
    if (existing) {
      throw new Error(`Subject Code "${cleanCode}" already exists for ${cleanYear} Semester ${sem} Section ${cleanSec}. Duplicate subject codes are not allowed.`);
    }

    const record = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subjectCode: cleanCode,
      subject_code: cleanCode,
      subjectName: String(sub.subject_name || sub.subjectTitle || sub.subjectName).trim(),
      subject_name: String(sub.subject_name || sub.subjectTitle || sub.subjectName).trim(),
      subjectAbbreviation: String(sub.subject_abbreviation || sub.subjectAbbreviation || '').trim().toUpperCase(),
      department: sub.department || 'AI & Data Science',
      academicYear: sub.academic_year || '2025-2026',
      year: cleanYear,
      semester: sem,
      section: cleanSec,
      subjectType: sub.subject_type || sub.subjectType || 'Theory',
      credits: Number(sub.credits) || 3,
      facultyHandler: sub.faculty_handler || sub.facultyHandler || 'Class Coordinator',
      createdByUserId: sub.created_by_user_id || 'TEST',
      createdAt: new Date().toISOString()
    };
    subjects.push(record);
    return record;
  },
  updateSubject: async (id, sub) => {
    const existing = subjects.find(s => s.id === id);
    if (!existing) throw new Error('Subject record not found.');

    if (sub.subject_name) existing.subjectName = String(sub.subject_name).trim();
    if (sub.subject_abbreviation !== undefined) existing.subjectAbbreviation = String(sub.subject_abbreviation).trim().toUpperCase();
    if (sub.year) existing.year = normalizeYear(sub.year);
    if (sub.semester) existing.semester = Number(sub.semester);
    if (sub.section) existing.section = normalizeSection(sub.section);
    if (sub.subject_type) existing.subjectType = sub.subject_type;
    if (sub.credits !== undefined) existing.credits = Number(sub.credits);
    if (sub.faculty_handler) existing.facultyHandler = String(sub.faculty_handler).trim();

    return existing;
  },
  createBulkImportAudit: async (...args) => {
    audits.push(args);
  }
};

isolateServer(mockDb);

const { normalizeYear, normalizeSection, normalizeSemester } = await import('../server/db.ts');
const { signSessionToken } = await import('../server/services/sessionTokens.ts');
const { default: subjectRouter } = await import('../server/routes/subjects.ts');

const facultyToken = signSessionToken(testUser);

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.headers.authorization = `Bearer ${facultyToken}`;
  next();
});
app.use('/api/subjects', subjectRouter);

const server = app.listen(0);
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;
after(() => server.close());

// -------------------------------------------------------------
// 2. UNIT TESTS: Normalizers
// -------------------------------------------------------------
test('normalizeYear handles numeric, ordinal, text, and roman formats', () => {
  assert.equal(normalizeYear('1'), '1st Year');
  assert.equal(normalizeYear('1st'), '1st Year');
  assert.equal(normalizeYear('I'), '1st Year');
  assert.equal(normalizeYear('First Year'), '1st Year');
  assert.equal(normalizeYear('Year 1'), '1st Year');
  assert.equal(normalizeYear('1st Year'), '1st Year');

  assert.equal(normalizeYear('2'), '2nd Year');
  assert.equal(normalizeYear('2nd'), '2nd Year');
  assert.equal(normalizeYear('II'), '2nd Year');
  assert.equal(normalizeYear('Second Year'), '2nd Year');
  assert.equal(normalizeYear('Year 2'), '2nd Year');
  assert.equal(normalizeYear('2nd Year'), '2nd Year');

  assert.equal(normalizeYear('3'), '3rd Year');
  assert.equal(normalizeYear('3rd'), '3rd Year');
  assert.equal(normalizeYear('III'), '3rd Year');
  assert.equal(normalizeYear('Third Year'), '3rd Year');
  assert.equal(normalizeYear('3rd Year'), '3rd Year');

  assert.equal(normalizeYear('4'), '4th Year');
  assert.equal(normalizeYear('4th'), '4th Year');
  assert.equal(normalizeYear('IV'), '4th Year');
  assert.equal(normalizeYear('Final Year'), '4th Year');
  assert.equal(normalizeYear('4th Year'), '4th Year');

  assert.equal(normalizeYear(''), '');
  assert.equal(normalizeYear(null), '');
});

test('normalizeSemester parses valid numbers and infers defaults by year', () => {
  assert.equal(normalizeSemester(1), 1);
  assert.equal(normalizeSemester('3'), 3);
  assert.equal(normalizeSemester('Sem 4'), 4);
  assert.equal(normalizeSemester('Semester 6'), 6);
  assert.equal(normalizeSemester(8), 8);

  // Inferred defaults by year when absent
  assert.equal(normalizeSemester(undefined, '1st Year'), 1);
  assert.equal(normalizeSemester('', '2nd Year'), 3);
  assert.equal(normalizeSemester(null, '3rd Year'), 5);
  assert.equal(normalizeSemester(undefined, '4th Year'), 7);

  // Fallback parameter support
  assert.equal(normalizeSemester(undefined, '2nd Year', 4), 4);
});

test('normalizeSection trims, uppercases, and normalizes section names', () => {
  assert.equal(normalizeSection('a'), 'A');
  assert.equal(normalizeSection('Section A'), 'A');
  assert.equal(normalizeSection('SEC. B'), 'B');
  assert.equal(normalizeSection('Sec C'), 'C');
  assert.equal(normalizeSection('all'), 'ALL');
  assert.equal(normalizeSection('COMMON'), 'ALL');
  assert.equal(normalizeSection(''), '');
  assert.equal(normalizeSection(null), '');
});

// -------------------------------------------------------------
// 3. ROUTE TESTS
// -------------------------------------------------------------
test('Subject Master Preview handles official 3-column template format', async () => {
  const templateRows = [
    { 'Subject Code': 'MA25C08', 'Subject Abbreviation': 'DM', 'Subject Title': 'Discrete Mathematics' },
    { 'Subject Code': 'CS25C10', 'Subject Abbreviation': 'OOSE', 'Subject Title': 'Object Oriented Software Engineering' },
    { 'Subject Code': 'CS25C08', 'Subject Abbreviation': 'DS', 'Subject Title': 'Data Structures' }
  ];

  const res = await fetch(`${baseUrl}/api/subjects/import-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: templateRows,
      year: '2nd Year',
      semester: 3,
      section: 'ALL'
    })
  });

  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.summary.totalRowsProcessed, 3);
  assert.equal(body.summary.validCount, 3);
  assert.equal(body.summary.invalidCount, 0);
  assert.equal(body.summary.newCount, 3);
  assert.equal(body.validRows.length, 3);

  const first = body.validRows[0];
  assert.equal(first.subjectCode, 'MA25C08');
  assert.equal(first.subjectTitle, 'Discrete Mathematics');
  assert.equal(first.subjectAbbreviation, 'DM');
  assert.equal(first.year, '2nd Year');
  assert.equal(first.semester, 3);
  assert.equal(first.section, 'ALL');
  assert.equal(first.subjectType, 'Theory');
  assert.equal(first.credits, 3);
  assert.equal(first.status, 'NEW_SUBJECT');
});

test('Subject Master Preview flags intra-file duplicates with row-level reason', async () => {
  const duplicateRows = [
    { 'Subject Code': 'CS25C08', 'Subject Abbreviation': 'DS', 'Subject Title': 'Data Structures' },
    { 'Subject Code': 'CS25C09', 'Subject Abbreviation': 'JP', 'Subject Title': 'Java Programming' },
    { 'Subject Code': 'CS25C08', 'Subject Abbreviation': 'DS', 'Subject Title': 'Data Structures Duplicate' }
  ];

  const res = await fetch(`${baseUrl}/api/subjects/import-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: duplicateRows,
      year: '2nd Year',
      semester: 3,
      section: 'ALL'
    })
  });

  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.summary.totalRowsProcessed, 3);
  assert.equal(body.summary.validCount, 2);
  assert.equal(body.summary.invalidCount, 1);
  assert.equal(body.invalidRows.length, 1);
  assert.equal(body.invalidRows[0].rowNumber, 3);
  assert.ok(body.invalidRows[0].reason.includes('Duplicate Subject Code "CS25C08"'));
  assert.ok(body.invalidRows[0].reason.includes('Row #1'));
});

test('Subject Master Preview reports row-level errors for invalid records', async () => {
  const faultyRows = [
    { 'Subject Code': '', 'Subject Abbreviation': 'DM', 'Subject Title': 'Missing Code' },
    { 'Subject Code': 'CS25C10', 'Subject Abbreviation': 'OOSE', 'Subject Title': '' },
    { 'Subject Code': 'X', 'Subject Abbreviation': 'T', 'Subject Title': 'Code Too Short' },
    { 'Subject Code': 'CS25C11', 'Subject Title': 'Invalid Semester', 'Semester': '99' },
    { 'Subject Code': 'CS25C12', 'Subject Title': 'Valid Subject', 'Semester': 4 }
  ];

  const res = await fetch(`${baseUrl}/api/subjects/import-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: faultyRows, year: '2nd Year', semester: 3, section: 'A' })
  });

  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.summary.totalRowsProcessed, 5);
  assert.equal(body.summary.validCount, 1);
  assert.equal(body.summary.invalidCount, 4);

  const reasons = body.invalidRows.map(r => r.reason);
  assert.ok(reasons[0].includes('Subject Code is required'));
  assert.ok(reasons[1].includes('Subject Title is required'));
  assert.ok(reasons[2].includes('must be between 2 and 20 characters'));
  assert.ok(reasons[3].includes('Semester must be a number between 1 and 8'));

  assert.equal(body.validRows[0].subjectCode, 'CS25C12');
  assert.equal(body.validRows[0].semester, 4);
});

test('Subject Master Confirm imports subjects and prevents duplicate subject creation', async () => {
  const subjectsToImport = [
    {
      rowNumber: 1,
      subjectCode: 'MA25C08',
      subjectTitle: 'Discrete Mathematics',
      subjectAbbreviation: 'DM',
      year: '2nd Year',
      semester: 3,
      section: 'ALL',
      subjectType: 'Theory',
      credits: 3
    },
    {
      rowNumber: 2,
      subjectCode: 'CS25C08',
      subjectTitle: 'Data Structures',
      subjectAbbreviation: 'DS',
      year: '2nd Year',
      semester: 3,
      section: 'ALL',
      subjectType: 'Theory',
      credits: 3
    }
  ];

  // 1. Initial import: should create 2 new subjects
  const res1 = await fetch(`${baseUrl}/api/subjects/import-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subjects: subjectsToImport, year: '2nd Year', section: 'ALL', semester: 3 })
  });

  assert.equal(res1.status, 200);
  const body1 = await res1.json();
  assert.equal(body1.importedCount, 2);
  assert.equal(body1.updatedCount, 0);
  assert.equal(body1.skippedCount, 0);
  assert.equal(body1.failedCount, 0);

  // Verify database has exactly 2 subjects
  const subjectsInDb = await mockDb.getSubjects();
  assert.equal(subjectsInDb.length, 2);
  assert.equal(subjectsInDb[0].subjectCode, 'MA25C08');
  assert.equal(subjectsInDb[0].year, '2nd Year');
  assert.equal(subjectsInDb[0].semester, 3);
  assert.equal(subjectsInDb[0].section, 'ALL');

  // 2. Duplicate upload of the exact same subjects: duplicate creation PREVENTED!
  const res2 = await fetch(`${baseUrl}/api/subjects/import-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subjects: subjectsToImport, year: '2nd Year', section: 'ALL', semester: 3 })
  });

  assert.equal(res2.status, 200);
  const body2 = await res2.json();
  assert.equal(body2.importedCount, 0);
  assert.equal(body2.skippedCount, 2, 'Duplicate subjects skipped without creating redundant records');
  assert.equal(body2.failedCount, 0);

  // Database still has exactly 2 subjects (no duplicates created!)
  const subjectsInDbAfter = await mockDb.getSubjects();
  assert.equal(subjectsInDbAfter.length, 2);

  // 3. Re-upload with an updated title: updates without duplicate
  const updatedSubjects = [
    {
      rowNumber: 1,
      subjectCode: 'MA25C08',
      subjectTitle: 'Discrete Mathematics & Graph Theory',
      subjectAbbreviation: 'DMGT',
      year: '2nd Year',
      semester: 3,
      section: 'ALL',
      subjectType: 'Theory',
      credits: 4
    }
  ];

  const res3 = await fetch(`${baseUrl}/api/subjects/import-confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subjects: updatedSubjects, year: '2nd Year', section: 'ALL', semester: 3 })
  });

  assert.equal(res3.status, 200);
  const body3 = await res3.json();
  assert.equal(body3.importedCount, 0);
  assert.equal(body3.updatedCount, 1);
  assert.equal(body3.failedCount, 0);

  const updatedDbSubjects = await mockDb.getSubjects();
  assert.equal(updatedDbSubjects.length, 2);
  const dm = updatedDbSubjects.find(s => s.subjectCode === 'MA25C08');
  assert.equal(dm.subjectName, 'Discrete Mathematics & Graph Theory');
  assert.equal(dm.subjectAbbreviation, 'DMGT');
  assert.equal(dm.credits, 4);
});

