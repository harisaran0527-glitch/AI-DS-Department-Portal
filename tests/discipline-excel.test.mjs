import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as XLSX from 'xlsx';
import { isolateServer } from './helpers/isolated-server.mjs';

isolateServer({});
const { createDisciplineExportWorkbook, createDisciplineReportSvg } = await import('../src/components/discipline/disciplineExcel.ts');

test('Discipline Excel export round-trips incident fields and keeps user text as text', () => {
  const workbook = createDisciplineExportWorkbook([{
    date: '2026-10-20',
    time: '09:30:00',
    location: 'Gate',
    registerNo: 'AVS001',
    studentName: 'Isolated Fixture Student',
    collegeEmail: 'fixture@example.invalid',
    year: '2nd Year',
    section: 'A',
    issue: '=HYPERLINK("https://example.invalid","Open")',
    ruleViolated: 'Fixture rule',
    actionTaken: 'Warning',
    fineAmount: 25,
    fineDetails: 'Fixture fine',
    remarks: '+SUM(1,1)',
    recordedBy: 'Fixture faculty',
    status: 'RESOLVED'
  }]);

  const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const readBack = XLSX.read(output, { type: 'buffer' });
  const sheet = readBack.Sheets['Discipline Records'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  assert.deepEqual(rows[0], [
    'S.No', 'Date', 'Time', 'Register No', 'Student Name', 'College Mail ID', 'Department', 'Year',
    'Section', 'Issue Category', 'Location / Block', 'Rule Violated', 'Staff Action Taken', 'Fine Amount (INR)',
    'Fine Details', 'Additional Remarks', 'Reported By Staff', 'Status'
  ]);
  assert.equal(rows[1][3], 'AVS001');
  assert.equal(rows[1][9], '=HYPERLINK("https://example.invalid","Open")');
  assert.equal(rows[1][10], 'Gate');
  assert.equal(rows[1][13], '25');
  assert.equal(rows[1][15], '+SUM(1,1)');
  assert.equal(rows[1][17], 'RESOLVED');
  assert.equal(sheet['J2'].f, undefined);
  assert.equal(sheet['P2'].f, undefined);
});

test('image report includes required fields and escapes untrusted text', () => {
  const svg = createDisciplineReportSvg([{
    date: '2026-10-20', time: '09:30', studentName: '<Fixture Student>',
    registerNo: 'AVS001', department: 'AI & DS', year: '2nd Year', section: 'A',
    issue: 'Late Arrival', location: 'Gate', actionTaken: 'Warning', fineAmount: 0,
    remarks: '& reviewed', recordedBy: 'Fixture faculty', status: 'OPEN'
  }]);
  for (const text of ['2026-10-20', 'AVS001', 'AI &amp; DS', 'Late Arrival', 'Location / Block',
    'Warning', 'Fine Amount (INR)', 'OPEN']) assert.ok(svg.includes(text));
  assert.ok(svg.includes('&lt;Fixture Student&gt;'));
  assert.ok(svg.includes('&amp; reviewed'));
});
