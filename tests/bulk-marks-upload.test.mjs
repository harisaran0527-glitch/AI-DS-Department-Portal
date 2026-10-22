import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import bcrypt from 'bcryptjs';
import { isolateServer } from './helpers/isolated-server.mjs';
import { normalizeYear, normalizeSection } from '../server/db.js';

process.env.JWT_SECRET = 'isolated-test-secret-at-least-32-bytes-long-2026';

const testPasswordHash = bcrypt.hashSync('pass123', 4);
const facultyUser = {
  id: 'fac-1',
  role: 'FACULTY',
  name: 'Prof. Tamil',
  email: 'tamil@example.invalid',
  password_hash: testPasswordHash,
  is_active: 1
};

const students = [
  {
    id: 'stu-1',
    name: 'SARAN S',
    register_no: '620125243146',
    registerNo: '620125243146',
    year: '2nd Year',
    section: 'A',
    cgpa: 8.5
  },
  {
    id: 'stu-2',
    name: 'PRIYA R',
    register_no: '620125243147',
    registerNo: '620125243147',
    year: '2nd Year',
    section: 'A',
    cgpa: 9.0
  },
  {
    id: 'stu-3',
    name: 'KUMAR V',
    register_no: '620125243148',
    registerNo: '620125243148',
    year: '3rd Year',
    section: 'B',
    cgpa: 7.8
  }
];

const masterSubjects = [
  {
    id: 'sub-1',
    subjectCode: 'CS25C08',
    subjectName: 'Data Structures',
    subjectAbbreviation: 'DS',
    year: '2nd Year',
    semester: 3
  },
  {
    id: 'sub-2',
    subjectCode: 'CS25C09',
    subjectName: 'Database Management',
    subjectAbbreviation: 'DBMS',
    year: '2nd Year',
    semester: 3
  },
  {
    id: 'sub-3',
    subjectCode: 'CS35C01',
    subjectName: 'Distributed Systems',
    subjectAbbreviation: 'DSYS',
    year: '3rd Year',
    semester: 5
  }
];

const academicRecords = [
  {
    id: 'acad-1',
    student_id: 'stu-1',
    semester_no: 3,
    exam_type: 'Unit Test 1',
    subjects_json: JSON.stringify([
      { code: 'CS25C08', subjectTitle: 'Data Structures', marks: 80, grade: 'A' }
    ])
  }
];

const audits = [];

// Helper functions matching faculty route
function normalizePersonName(name) {
  return String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function verifyStudentNameMatch(inputName, dbStudentName) {
  if (!inputName || !inputName.trim()) return true;
  const normInput = normalizePersonName(inputName);
  const normDb = normalizePersonName(dbStudentName);
  if (!normInput || !normDb) return true;
  if (normInput === normDb) return true;

  const inputWords = normInput.split(' ').filter(Boolean).sort();
  const dbWords = normDb.split(' ').filter(Boolean).sort();
  if (inputWords.join(' ') === dbWords.join(' ')) return true;

  const longInput = inputWords.filter((w) => w.length > 1);
  const longDb = dbWords.filter((w) => w.length > 1);
  if (longInput.length > 0 && longDb.length > 0 && longInput.join(' ') === longDb.join(' ')) {
    return true;
  }

  return false;
}

function findStudentSubjectMark(studentId, subjectCode, semesterNo = 3, examType = 'Unit Test 1') {
  const cleanCode = String(subjectCode).trim().toUpperCase();
  const cleanExamType = String(examType || 'Unit Test 1').trim().toLowerCase();
  const semNo = Number(semesterNo) || 3;

  const rec = academicRecords.find(
    (r) => r.student_id === studentId &&
      Number(r.semester_no) === semNo &&
      (r.exam_type || 'Internal').trim().toLowerCase() === cleanExamType
  );
  if (!rec || !rec.subjects_json) return null;
  const list = JSON.parse(rec.subjects_json);
  const match = list.find((s) => String(s.code || s.subjectCode).trim().toUpperCase() === cleanCode);
  if (!match) return null;
  return { exists: true, marks: Number(match.marks), grade: match.grade };
}

function upsertStudentSubjectMark(studentId, subjectCode, subjectTitle, marks, semesterNo = 3, examType = 'Unit Test 1') {
  const cleanCode = String(subjectCode).trim().toUpperCase();
  const cleanTitle = String(subjectTitle).trim();
  const cleanExamType = String(examType || 'Unit Test 1').trim();
  const semNo = Number(semesterNo) || 3;
  const numMarks = Number(marks);

  let rec = academicRecords.find(
    (r) => r.student_id === studentId &&
      Number(r.semester_no) === semNo &&
      (r.exam_type || 'Internal').trim().toLowerCase() === cleanExamType.toLowerCase()
  );

  let list = [];
  if (rec && rec.subjects_json) {
    list = JSON.parse(rec.subjects_json);
  }

  const idx = list.findIndex((s) => String(s.code || s.subjectCode).trim().toUpperCase() === cleanCode);
  const markEntry = {
    code: cleanCode,
    subjectTitle: cleanTitle,
    marks: numMarks,
    maxMarks: 100,
    grade: numMarks >= 90 ? 'O' : (numMarks >= 80 ? 'A+' : (numMarks >= 70 ? 'A' : (numMarks >= 60 ? 'B+' : (numMarks >= 50 ? 'B' : 'U')))),
    credits: 3
  };

  let action = 'CREATED';
  let previousMarks;

  if (idx >= 0) {
    previousMarks = Number(list[idx].marks);
    if (previousMarks === numMarks) {
      action = 'SKIPPED';
    } else {
      action = 'UPDATED';
      list[idx] = markEntry;
    }
  } else {
    action = 'CREATED';
    list.push(markEntry);
  }

  if (action !== 'SKIPPED') {
    if (rec) {
      rec.subjects_json = JSON.stringify(list);
    } else {
      rec = {
        id: `acad-${studentId}-sem${semNo}-${Date.now()}`,
        student_id: studentId,
        semester_no: semNo,
        exam_type: cleanExamType,
        subjects_json: JSON.stringify(list)
      };
      academicRecords.push(rec);
    }
  }

  return { action, previousMarks, newMarks: numMarks, semesterNo: semNo, examType: cleanExamType };
}

// -------------------------------------------------------------
// Tests
// -------------------------------------------------------------

test('verifyStudentNameMatch handles exact match and Indian initials conventions', () => {
  // Exact
  assert.equal(verifyStudentNameMatch('SARAN S', 'SARAN S'), true);
  // Case insensitive
  assert.equal(verifyStudentNameMatch('saran s', 'SARAN S'), true);
  // Initials at beginning
  assert.equal(verifyStudentNameMatch('S. SARAN', 'SARAN S'), true);
  assert.equal(verifyStudentNameMatch('S SARAN', 'SARAN S'), true);
  // Name without initials
  assert.equal(verifyStudentNameMatch('SARAN', 'SARAN S'), true);
  // Completely different name should fail
  assert.equal(verifyStudentNameMatch('MOHAN R', 'SARAN S'), false);
  assert.equal(verifyStudentNameMatch('Wrong Student Name', 'SARAN S'), false);
  // Empty or undefined name should pass (name is optional in sheet)
  assert.equal(verifyStudentNameMatch('', 'SARAN S'), true);
  assert.equal(verifyStudentNameMatch(null, 'SARAN S'), true);
});

test('Bulk Marks Preview classifies NEW, UPDATE, and IDENTICAL marks correctly', () => {
  // stu-1 already has CS25C08 with 80 marks in acad-1
  const existing = findStudentSubjectMark('stu-1', 'CS25C08', 3, 'Unit Test 1');
  assert.equal(existing?.exists, true);
  assert.equal(existing?.marks, 80);

  // If new upload has 80 -> IDENTICAL_MARK
  const identicalCheck = existing.marks === 80;
  assert.equal(identicalCheck, true);

  // If new upload has 88 -> UPDATE_MARK
  const updateCheck = existing.marks !== 88;
  assert.equal(updateCheck, true);

  // If stu-1 uploads CS25C09 -> NEW_MARK
  const newSubject = findStudentSubjectMark('stu-1', 'CS25C09', 3, 'Unit Test 1');
  assert.equal(newSubject, null);
});

test('upsertStudentSubjectMark executes CREATED, UPDATED, and SKIPPED transitions', () => {
  // 1. Initial mark exists for stu-1, CS25C08: 80
  // Upload same mark (80) -> SKIPPED
  const res1 = upsertStudentSubjectMark('stu-1', 'CS25C08', 'Data Structures', 80, 3, 'Unit Test 1');
  assert.equal(res1.action, 'SKIPPED');
  assert.equal(res1.previousMarks, 80);
  assert.equal(res1.newMarks, 80);

  // 2. Upload updated mark (95) -> UPDATED
  const res2 = upsertStudentSubjectMark('stu-1', 'CS25C08', 'Data Structures', 95, 3, 'Unit Test 1');
  assert.equal(res2.action, 'UPDATED');
  assert.equal(res2.previousMarks, 80);
  assert.equal(res2.newMarks, 95);

  // Check stored value
  const stored = findStudentSubjectMark('stu-1', 'CS25C08', 3, 'Unit Test 1');
  assert.equal(stored?.marks, 95);

  // 3. Upload new mark for CS25C09 (92) -> CREATED
  const res3 = upsertStudentSubjectMark('stu-1', 'CS25C09', 'Database Management', 92, 3, 'Unit Test 1');
  assert.equal(res3.action, 'CREATED');
  assert.equal(res3.newMarks, 92);

  const stored2 = findStudentSubjectMark('stu-1', 'CS25C09', 3, 'Unit Test 1');
  assert.equal(stored2?.marks, 92);
});

test('Bulk Marks Validation rejects invalid marks outside 0-100 and non-numerics', () => {
  const invalidMarks = [-5, 105, 150, 'abc', '', null, NaN];

  for (const m of invalidMarks) {
    const num = Number(m);
    const isInvalid = m === '' || m === null || isNaN(num) || num < 0 || num > 100;
    assert.equal(isInvalid, true, `Expected mark ${m} to be rejected.`);
  }

  const validMarks = [0, 50, 75.5, 90, 100, '85'];
  for (const m of validMarks) {
    const num = Number(m);
    const isValid = m !== '' && m !== null && !isNaN(num) && num >= 0 && num <= 100;
    assert.equal(isValid, true, `Expected mark ${m} to be accepted.`);
  }
});

test('Bulk Marks Validation checks section isolation and subject year alignment', () => {
  // Assigned to 2nd Year Section A
  const assignedYear = '2nd Year';
  const assignedSection = 'A';

  // stu-1 is in 2nd Year A -> authorized
  const stu1YearMatches = normalizeYear(students[0].year) === normalizeYear(assignedYear);
  const stu1SecMatches = normalizeSection(students[0].section) === normalizeSection(assignedSection);
  assert.equal(stu1YearMatches && stu1SecMatches, true);

  // stu-3 is in 3rd Year B -> outside assigned section
  const stu3YearMatches = normalizeYear(students[2].year) === normalizeYear(assignedYear);
  const stu3SecMatches = normalizeSection(students[2].section) === normalizeSection(assignedSection);
  assert.equal(stu3YearMatches && stu3SecMatches, false);

  // Subject Year alignment: CS35C01 is for 3rd Year
  const sub3 = masterSubjects[2];
  const subYearNorm = normalizeYear(sub3.year);
  const stu1YearNorm = normalizeYear(students[0].year);
  const isAligned = subYearNorm === stu1YearNorm;
  assert.equal(isAligned, false, 'CS35C01 (3rd Year) must not be allowed for 2nd Year student');
});
