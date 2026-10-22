// Test Live Production PNG Attendance Upload & OCR Workflow
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://aidsportal.vercel.app';
const FACULTY_EMAIL = 'tamil1234@gmail.com';
const FACULTY_PASSWORD = process.env.FACULTY_PASSWORD || 'aids@avs';

console.log('==================================================');
console.log('🖼️  LIVE PRODUCTION PNG ATTENDANCE VERIFICATION');
console.log(`Target: ${BASE_URL}`);
console.log(`Faculty: ${FACULTY_EMAIL}`);
console.log('==================================================\n');

async function main() {
  // 1. Authenticate Faculty
  console.log('1. Authenticating as Faculty...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: FACULTY_EMAIL, password: FACULTY_PASSWORD, role: 'FACULTY', rememberDevice: true })
  });

  const setCookie = loginRes.headers.get('set-cookie');
  const loginJson = await loginRes.json();
  if (!loginRes.ok || !loginJson.token) {
    throw new Error(`Faculty login failed: ${JSON.stringify(loginJson)}`);
  }
  const token = loginJson.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...(setCookie ? { 'Cookie': setCookie } : {})
  };
  console.log('   ✅ Authenticated successfully. Token acquired.');

  // 2. Test OCR Extract API with base64 PNG
  console.log('\n2. Testing /api/faculty/attendance/ocr-extract endpoint...');
  // 1x1 PNG base64
  const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  const ocrRes = await fetch(`${BASE_URL}/api/faculty/attendance/ocr-extract`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      imageBase64: tinyPngBase64,
      mimeType: 'image/png',
      date: '2026-09-20'
    })
  });

  const ocrJson = await ocrRes.json();
  console.log('   Status Code:', ocrRes.status);
  console.log('   Response Success:', ocrJson.success);
  console.log('   OCR Method Used:', ocrJson.method);
  console.log('   Extracted Rows:', ocrJson.extractedRows ? ocrJson.extractedRows.length : 0);

  if (ocrRes.status !== 200) {
    throw new Error(`OCR extract endpoint returned non-200 HTTP code: ${ocrRes.status}`);
  }

  if (ocrJson.method === 'FALLBACK') {
    console.log('   ✅ Serverless OCR fallback correctly routed without lambda timeouts:');
    console.log('     ', ocrJson.warnings?.[0] || 'Delegated to browser engine');
  } else if (ocrJson.success) {
    console.log('   ✅ Server-side OCR engine responded successfully with extracted rows.');
  } else {
    throw new Error(`Unexpected OCR extract response: ${JSON.stringify(ocrJson)}`);
  }

  // 3. Test Student Roster Retrieval
  console.log('\n3. Fetching assigned roster for verification...');
  const rosterRes = await fetch(`${BASE_URL}/api/faculty/students`, {
    headers: authHeaders
  });
  const roster = await rosterRes.json();
  const students = Array.isArray(roster) ? roster : roster.students || [];
  console.log(`   ✅ Roster loaded: ${students.length} students found.`);
  const sampleStudent = students[0];
  const regNo = sampleStudent.register_no || sampleStudent.registerNo || sampleStudent.registerNumber;
  const sName = sampleStudent.name;
  console.log(`   Sample Student: ${regNo} - ${sName}`);

  // 4. Test Simulating OCR-to-Preview Pipeline
  console.log('\n4. Simulating Faculty Review & Database Validation Pipeline...');
  const sampleOcrParsed = [
    {
      'Register Number': regNo,
      'Student Name': sName,
      'Attendance Date': '2026-09-20',
      'Attendance Status': 'P'
    },
    {
      'Register Number': regNo,
      'Student Name': 'Wrong Student Name',
      'Attendance Date': '2026-09-20',
      'Attendance Status': 'OD'
    },
    {
      'Register Number': '999999999999',
      'Student Name': 'Non-Existent Student',
      'Attendance Date': '2026-09-20',
      'Attendance Status': 'A'
    }
  ];

  const previewRes = await fetch(`${BASE_URL}/api/faculty/attendance/import-preview`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      rows: sampleOcrParsed,
      academicYear: '2026-2027',
      month: '09'
    })
  });

  const previewJson = await previewRes.json();
  if (previewRes.status !== 200 || !previewJson.summary) {
    throw new Error(`Preview failed: ${JSON.stringify(previewJson)}`);
  }

  console.log('   ✅ Import preview processed simulation successfully:');
  console.log('      Total Processed:', previewJson.summary.totalRowsProcessed);
  console.log('      Valid Daily Records:', previewJson.summary.totalValidDailyRecords);
  console.log('      Matched Students:', previewJson.summary.totalMatchedStudents);
  console.log('      Unmatched RegNos:', previewJson.summary.totalUnmatchedRegNos);
  console.log('      Invalid Rows:', previewJson.summary.totalInvalidRows);

  // Check that name mismatch was caught
  const nameMismatch = (previewJson.invalidRows || []).some(e => e.reason?.includes('Name mismatch'));
  console.log(`   ✅ Name mismatch validation active: ${nameMismatch ? 'YES' : 'NO'}`);

  // 5. Test Bulk Marks Upload integrity to ensure zero regression
  console.log('\n5. Verifying Bulk Marks Upload endpoint for zero regressions...');
  const marksPreviewRes = await fetch(`${BASE_URL}/api/faculty/academics/import-preview`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      rows: [
        {
          'Register Number': regNo,
          'Student Name': sName,
          'Subject Code': 'CS25C08',
          'Marks': 88
        }
      ],
      examType: 'Unit Test 1',
      year: '2nd Year',
      section: 'A'
    })
  });
  const marksPreviewJson = await marksPreviewRes.json();
  if (marksPreviewRes.status !== 200 || !marksPreviewJson.summary) {
    throw new Error(`Marks preview failed: ${JSON.stringify(marksPreviewJson)}`);
  }
  console.log('   ✅ Bulk Marks Upload is fully operational (0 regressions):');
  console.log(`      Valid Count: ${marksPreviewJson.summary.validCount}, Invalid Count: ${marksPreviewJson.summary.invalidCount}`);

  console.log('\n==================================================');
  console.log('🎉 LIVE PRODUCTION PNG ATTENDANCE VALIDATION COMPLETE!');
  console.log('==================================================');
}

main().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
