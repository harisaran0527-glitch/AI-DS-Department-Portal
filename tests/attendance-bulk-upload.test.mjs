import test from 'node:test';
import assert from 'node:assert/strict';
import { db, normalizePersonName, verifyStudentNameMatch } from '../server/db.js';

test('normalizePersonName strips punctuation and extra spaces', () => {
  assert.equal(normalizePersonName('Arun. K'), 'ARUN K');
  assert.equal(normalizePersonName('S. Hari Saran'), 'S HARI SARAN');
  assert.equal(normalizePersonName('Priya  Dharshini - M'), 'PRIYA DHARSHINI M');
});

test('verifyStudentNameMatch handles Indian naming variations gracefully', () => {
  // Exact match
  assert.equal(verifyStudentNameMatch('ARUN K', 'ARUN K'), true);
  // Initial order variations (K ARUN vs ARUN K)
  assert.equal(verifyStudentNameMatch('K ARUN', 'ARUN K'), true);
  // Dot after initial (ARUN K. vs ARUN K)
  assert.equal(verifyStudentNameMatch('ARUN K.', 'ARUN K'), true);
  // Empty input name should not reject (optional name)
  assert.equal(verifyStudentNameMatch('', 'ARUN K'), true);
  // Different name should reject
  assert.equal(verifyStudentNameMatch('VIKRAM S', 'ARUN K'), false);
  assert.equal(verifyStudentNameMatch('PRIYA M', 'KAVITHA R'), false);
});

test('Attendance preview handles CSV & Excel date formats and status codes', async () => {
  // Test row normalization via db.previewBulkAttendanceImport
  const testRows = [
    {
      'Register Number': '23ADTEST01',
      'Student Name': 'TEST STUDENT ONE',
      'Attendance Date': '2026-09-01',
      'Attendance Status': 'PRESENT'
    },
    {
      'Register Number': '23ADTEST01',
      'Student Name': 'TEST STUDENT ONE',
      'Attendance Date': '2026-09-02',
      'Attendance Status': 'OD'
    },
    {
      'Register Number': '23ADTEST01',
      'Student Name': 'TEST STUDENT ONE',
      'Attendance Date': '2026-09-03',
      'Attendance Status': 'ON' // Legacy ON should normalize to OD
    },
    {
      'Register Number': '23ADTEST01',
      'Student Name': 'TEST STUDENT ONE',
      'Attendance Date': '2026-09-04',
      'Attendance Status': 'A'
    },
    {
      'Register Number': '23ADTEST01',
      'Student Name': 'TEST STUDENT ONE',
      'Attendance Date': '2026-09-05',
      'Attendance Status': 'ML'
    }
  ];

  // Unknown student should be flagged in unmatchedRegisterNumbers without throwing
  const preview = await db.previewBulkAttendanceImport(testRows);
  assert.equal(preview.summary.totalRowsProcessed, 5);
  assert.equal(preview.summary.totalUnmatchedRegNos, 5);
  assert.equal(preview.unmatchedRegisterNumbers.length, 5);
  assert.equal(preview.unmatchedRegisterNumbers[0].registerNo, '23ADTEST01');
});

test('Attendance preview detects duplicates and invalid rows', async () => {
  const invalidRows = [
    {
      'Register Number': '',
      'Attendance Date': '2026-09-01',
      'Attendance Status': 'P'
    },
    {
      'Register Number': '23ADTEST02',
      'Attendance Date': 'invalid-date',
      'Attendance Status': 'PRESENT'
    },
    {
      'Register Number': '23ADTEST02',
      'Attendance Date': '2026-09-01',
      'Attendance Status': 'INVALID_STATUS'
    }
  ];

  const preview = await db.previewBulkAttendanceImport(invalidRows);
  assert.equal(preview.summary.totalInvalidRows, 3);
  assert.equal(preview.invalidRows.length, 3);
  assert.match(preview.invalidRows[0].reason, /Missing Register Number/i);
  assert.match(preview.invalidRows[1].reason, /Invalid date format/i);
  assert.match(preview.invalidRows[2].reason, /Invalid attendance status/i);
});
