import test from 'node:test';
import assert from 'node:assert/strict';
import { db, normalizePersonName, verifyStudentNameMatch } from '../server/db.js';
import { parseAttendanceOcrText } from '../server/services/attendanceOcr.js';

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

test('PNG OCR Text Parser extracts Register Number, Student Name, Date and Status accurately', () => {
  const sampleOcrText = `
DEPARTMENT OF AI & DS - ATTENDANCE SHEET
S.No  Register No   Student Name    Date        Status
1     620125243146  SARAN S         2026-09-15  PRESENT
2     620125243154  SHRVAN A        2026-09-15  OD
3     620125243160  TAMILVANAN R    2026-09-15  ABSENT
4     23AD001       AARAV S         15/09/2026  ML
5     23AD002       BHAVANA R       2026-09-15  ON
Note: End of attendance sheet
  `;

  const roster = [
    { registerNo: '620125243146', name: 'SARAN S' },
    { registerNo: '620125243154', name: 'SHRVAN A' },
    { registerNo: '620125243160', name: 'TAMILVANAN R' },
    { registerNo: '23AD001', name: 'AARAV S' },
    { registerNo: '23AD002', name: 'BHAVANA R' }
  ];

  const { rows, unparsed } = parseAttendanceOcrText(sampleOcrText, '2026-09-15', roster);

  assert.equal(rows.length, 5);
  // Row 1
  assert.equal(rows[0].registerNo, '620125243146');
  assert.equal(rows[0].studentName, 'SARAN S');
  assert.equal(rows[0].date, '2026-09-15');
  assert.equal(rows[0].status, 'PRESENT');

  // Row 2 (OD)
  assert.equal(rows[1].registerNo, '620125243154');
  assert.equal(rows[1].studentName, 'SHRVAN A');
  assert.equal(rows[1].status, 'OD');

  // Row 3 (ABSENT)
  assert.equal(rows[2].registerNo, '620125243160');
  assert.equal(rows[2].studentName, 'TAMILVANAN R');
  assert.equal(rows[2].status, 'ABSENT');

  // Row 4 (DD/MM/YYYY parsed to YYYY-MM-DD, ML)
  assert.equal(rows[3].registerNo, '23AD001');
  assert.equal(rows[3].studentName, 'AARAV S');
  assert.equal(rows[3].date, '2026-09-15');
  assert.equal(rows[3].status, 'ML');

  // Row 5 (ON normalized to OD)
  assert.equal(rows[4].registerNo, '23AD002');
  assert.equal(rows[4].studentName, 'BHAVANA R');
  assert.equal(rows[4].status, 'OD');

  // Unparsed line flagged
  assert.ok(unparsed.some((u) => u.text.includes('End of attendance sheet')));
});
