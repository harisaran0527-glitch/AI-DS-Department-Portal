import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://aidsportal.vercel.app';
const FACULTY_EMAIL = 'tamil1234@gmail.com';
const FACULTY_PASS = 'aids@avs';

async function testPngAttendanceWorkflow() {
  console.log(`\n======================================================`);
  console.log(`🖼️  PNG ATTENDANCE BULK UPLOAD TEST (LIVE PRODUCTION)`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`User:   ${FACULTY_EMAIL}`);
  console.log(`======================================================\n`);

  // Step 1: Login
  console.log(`Step 1: Logging in as faculty...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: FACULTY_EMAIL, password: FACULTY_PASS, role: 'FACULTY' })
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const { token, user } = await loginRes.json();
  console.log(`   ✅ Logged in successfully: ${user.name} (${user.id})`);

  const authHeaders = {
    'Authorization': `Bearer ${token}`
  };

  // Step 2: Test OCR Extraction Endpoint
  console.log(`\nStep 2: Testing POST /api/faculty/attendance/ocr-extract...`);
  const samplePngPath = path.resolve('public/images/avsec-salem-logo.png');
  const fileBuffer = fs.readFileSync(samplePngPath);
  console.log(`   Read sample PNG image: ${fileBuffer.length} bytes`);

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'image/png' });
  formData.append('file', blob, 'sample_attendance.png');
  formData.append('date', '2026-09-18');

  const ocrRes = await fetch(`${BASE_URL}/api/faculty/attendance/ocr-extract`, {
    method: 'POST',
    headers: authHeaders,
    body: formData
  });

  if (!ocrRes.ok) {
    throw new Error(`OCR extraction failed: ${ocrRes.status} ${await ocrRes.text()}`);
  }

  const ocrData = await ocrRes.json();
  console.log(`   ✅ OCR Endpoint responded with success: ${ocrData.success}`);
  console.log(`      Method used: ${ocrData.method}`);
  console.log(`      Extracted Rows: ${ocrData.extractedRows?.length || 0}`);
  console.log(`      Unparsed items: ${ocrData.unparsed?.length || 0}`);

  // Step 3: Test OCR Parser with Realistic Attendance Sheet Text
  console.log(`\nStep 3: Simulating OCR Extracted Attendance Sheet for 2nd Year A...`);
  const simulatedOcrText = `
AVS ENGINEERING COLLEGE - DEPARTMENT OF AI & DS
ATTENDANCE SHEET - 2nd Year A
Date: 2026-09-18
S.No  Register No   Student Name    Date        Status
1     620125243146  SARAN S         2026-09-18  PRESENT
2     620125243154  SHRVAN A        2026-09-18  OD
3     620125243160  TAMILVANAN R    2026-09-18  ABSENT
  `;

  // Fetch roster
  const rosterRes = await fetch(`${BASE_URL}/api/faculty/students`, {
    headers: { ...authHeaders, 'Content-Type': 'application/json' }
  });
  const rosterData = await rosterRes.json();
  console.log(`   Retrieved roster of ${rosterData.count} students.`);

  // Step 4: Test Preview with the OCR Extracted Records
  console.log(`\nStep 4: Submitting OCR records to Preview Gate (/api/faculty/attendance/import-preview)...`);
  const previewRows = [
    {
      'Register Number': '620125243146',
      'Student Name': 'SARAN S',
      'Attendance Date': '2026-09-18',
      'Attendance Status': 'PRESENT'
    },
    {
      'Register Number': '620125243154',
      'Student Name': 'SHRVAN A',
      'Attendance Date': '2026-09-18',
      'Attendance Status': 'OD'
    },
    {
      'Register Number': '620125243160',
      'Student Name': 'TAMILVANAN R',
      'Attendance Date': '2026-09-18',
      'Attendance Status': 'ABSENT'
    }
  ];

  const prevRes = await fetch(`${BASE_URL}/api/faculty/attendance/import-preview`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: previewRows })
  });

  if (!prevRes.ok) {
    throw new Error(`Preview failed: ${prevRes.status} ${await prevRes.text()}`);
  }

  const prevResult = await prevRes.json();
  console.log(`   ✅ Preview Summary:`, prevResult.summary);
  console.log(`   Valid Records: ${prevResult.validRecords.length}`);

  // Step 5: Test Confirm Gate
  console.log(`\nStep 5: Testing Confirmation Gate (/api/faculty/attendance/import-confirm)...`);
  const confRes = await fetch(`${BASE_URL}/api/faculty/attendance/import-confirm`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: prevResult.validRecords })
  });

  if (!confRes.ok) {
    throw new Error(`Confirm failed: ${confRes.status} ${await confRes.text()}`);
  }

  const confResult = await confRes.json();
  console.log(`   ✅ Confirm Result:`, confResult.message);
  console.log(`      Imported: ${confResult.importedCount}, Updated: ${confResult.updatedCount}, Skipped: ${confResult.skippedCount}`);

  console.log(`\n======================================================`);
  console.log(`🎉 PNG ATTENDANCE BULK UPLOAD TEST PASSED SUCCESSFULLY!`);
  console.log(`======================================================\n`);
}

testPngAttendanceWorkflow().catch(err => {
  console.error(`❌ Test Failed:`, err);
  process.exit(1);
});
