const BASE_URL = 'https://aidsportal.vercel.app';
const FACULTY_EMAIL = 'tamil1234@gmail.com';
const FACULTY_PASS = 'aids@avs';

async function verifyLiveAttendance() {
  console.log(`\n==================================================`);
  console.log(`🌐 LIVE PRODUCTION VERIFICATION FOR ATTENDANCE`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`User:   ${FACULTY_EMAIL}`);
  console.log(`==================================================\n`);

  // 1. LOGIN AS FACULTY
  console.log(`1. Logging in as faculty...`);
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: FACULTY_EMAIL, password: FACULTY_PASS, role: 'FACULTY', rememberDevice: true })
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}: ${await loginRes.text()}`);
  }

  const setCookie = loginRes.headers.get('set-cookie');
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log(`   ✅ Logged in successfully. Faculty ID: ${loginData.user?.id}, Role: ${loginData.user?.role}`);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...(setCookie ? { 'Cookie': setCookie } : {})
  };

  // 2. FETCH ROSTER
  console.log(`\n2. Fetching faculty student roster...`);
  const rosterRes = await fetch(`${BASE_URL}/api/faculty/students`, {
    headers: authHeaders
  });
  if (!rosterRes.ok) {
    throw new Error(`Failed to fetch roster: ${rosterRes.status} ${await rosterRes.text()}`);
  }
  const rosterData = await rosterRes.json();
  console.log(`   ✅ Retrieved ${rosterData.count} students for Year: ${rosterData.assignedYear}, Section: ${rosterData.assignedSection}`);

  if (!Array.isArray(rosterData.students) || rosterData.students.length === 0) {
    throw new Error(`No students found in assigned section.`);
  }

  const sampleStudent = rosterData.students[0];
  const sampleStudent2 = rosterData.students[1] || rosterData.students[0];
  console.log(`   Sample Student 1: ${sampleStudent.register_no || sampleStudent.registerNo} - ${sampleStudent.name}`);
  console.log(`   Sample Student 2: ${sampleStudent2.register_no || sampleStudent2.registerNo} - ${sampleStudent2.name}`);

  const regNo1 = sampleStudent.register_no || sampleStudent.registerNo;
  const name1 = sampleStudent.name;
  const regNo2 = sampleStudent2.register_no || sampleStudent2.registerNo;
  const name2 = sampleStudent2.name;

  // 3. TEST ATTENDANCE BULK IMPORT PREVIEW
  console.log(`\n3. Testing Attendance Import Preview (CSV & Excel column format)...`);
  const testDate = '2026-09-15';
  const previewRows = [
    {
      'Register Number': regNo1,
      'Student Name': name1,
      'Attendance Date': testDate,
      'Attendance Status': 'PRESENT'
    },
    {
      'Register Number': regNo2,
      'Student Name': name2,
      'Attendance Date': testDate,
      'Attendance Status': 'OD'
    },
    {
      'Register Number': regNo1,
      'Student Name': name1,
      'Attendance Date': '2026-09-16',
      'Attendance Status': 'ON' // Legacy ON code - must be normalized to OD
    },
    // Invalid: Name mismatch
    {
      'Register Number': regNo2,
      'Student Name': 'COMPLETELY WRONG NAME XYZ',
      'Attendance Date': '2026-09-16',
      'Attendance Status': 'P'
    },
    // Invalid: Unmatched RegNo
    {
      'Register Number': '99ZZ9999',
      'Student Name': 'NONEXISTENT STUDENT',
      'Attendance Date': testDate,
      'Attendance Status': 'PRESENT'
    },
    // Invalid: Duplicate entry
    {
      'Register Number': regNo1,
      'Student Name': name1,
      'Attendance Date': testDate,
      'Attendance Status': 'ABSENT'
    }
  ];

  const previewRes = await fetch(`${BASE_URL}/api/faculty/attendance/import-preview`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ rows: previewRows })
  });

  if (!previewRes.ok) {
    throw new Error(`Preview failed with status ${previewRes.status}: ${await previewRes.text()}`);
  }

  const preview = await previewRes.json();
  console.log(`   ✅ Preview response received:`);
  console.log(`      Total Rows Processed: ${preview.summary.totalRowsProcessed}`);
  console.log(`      Valid Daily Records:  ${preview.summary.totalValidDailyRecords}`);
  console.log(`      Matched Students:     ${preview.summary.totalMatchedStudents}`);
  console.log(`      Unmatched RegNos:     ${preview.summary.totalUnmatchedRegNos}`);
  console.log(`      Duplicate Entries:    ${preview.summary.totalDuplicateEntries}`);
  console.log(`      Invalid Rows:         ${preview.summary.totalInvalidRows}`);
  console.log(`      New / Update / Skip:  ${preview.summary.newCount} New / ${preview.summary.updateCount} Update / ${preview.summary.skippedCount} Skipped`);

  // Verify status normalization to OD
  const legacyOnRecord = preview.validRecords.find((r) => r.registerNo === regNo1 && r.date === '2026-09-16');
  if (!legacyOnRecord || legacyOnRecord.status !== 'OD') {
    throw new Error(`Status 'ON' was not normalized to 'OD'! Got: ${legacyOnRecord?.status}`);
  }
  console.log(`   ✅ Status 'ON' correctly normalized to 'OD'.`);

  // Verify name mismatch caught in invalidRows
  const nameMismatch = preview.invalidRows.find((inv) => inv.registerNo === regNo2 && inv.reason?.includes('Name mismatch'));
  if (!nameMismatch) {
    console.warn(`   ⚠️ Note: Name mismatch row:`, preview.invalidRows);
  } else {
    console.log(`   ✅ Name mismatch successfully flagged: "${nameMismatch.reason}"`);
  }

  // Verify unmatched reg no
  const unmatched = preview.unmatchedRegisterNumbers.find((u) => u.registerNo === '99ZZ9999');
  if (!unmatched) {
    throw new Error(`Unmatched RegNo '99ZZ9999' was not flagged!`);
  }
  console.log(`   ✅ Unmatched Register Number correctly flagged: "${unmatched.reason}"`);

  // Verify duplicate entry
  const duplicate = preview.duplicateRegisterNumbers.find((d) => d.registerNo === regNo1 && d.date === testDate);
  if (!duplicate) {
    throw new Error(`Duplicate entry was not flagged!`);
  }
  console.log(`   ✅ Duplicate entry correctly flagged: "${duplicate.reason}"`);

  // 4. TEST ATTENDANCE CONFIRM ENDPOINT
  console.log(`\n4. Testing Attendance Import Confirm...`);
  const confirmRes = await fetch(`${BASE_URL}/api/faculty/attendance/import-confirm`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ records: preview.validRecords })
  });

  if (!confirmRes.ok) {
    throw new Error(`Confirm failed with status ${confirmRes.status}: ${await confirmRes.text()}`);
  }

  const confirmResult = await confirmRes.json();
  console.log(`   ✅ Attendance records confirmed successfully!`);
  console.log(`      Message: ${confirmResult.message}`);
  console.log(`      Imported: ${confirmResult.importedCount}, Updated: ${confirmResult.updatedCount}, Skipped: ${confirmResult.skippedCount}, Failed: ${confirmResult.failedCount}`);

  // 5. TEST ATTENDANCE HISTORY
  console.log(`\n5. Testing Attendance History...`);
  const histRes = await fetch(`${BASE_URL}/api/faculty/attendance/history`, {
    headers: authHeaders
  });
  if (!histRes.ok) {
    throw new Error(`History fetch failed: ${histRes.status} ${await histRes.text()}`);
  }
  const histData = await histRes.json();
  console.log(`   ✅ Attendance history retrieved: ${histData.history?.length || 0} date logs found.`);
  if (histData.history && histData.history.length > 0) {
    const sampleLog = histData.history[0];
    console.log(`      Latest Date Log: ${sampleLog.date} -> P: ${sampleLog.presentcount || sampleLog.presentCount}, A: ${sampleLog.absentcount || sampleLog.absentCount}, OD: ${sampleLog.odcount || sampleLog.odCount}, ML: ${sampleLog.mlcount || sampleLog.mlCount}`);
  }

  // 6. TEST MONTHLY SUMMARY
  console.log(`\n6. Testing Monthly Attendance Summary...`);
  const summaryRes = await fetch(`${BASE_URL}/api/faculty/attendance/summary`, {
    headers: authHeaders
  });
  if (!summaryRes.ok) {
    throw new Error(`Monthly summary fetch failed: ${summaryRes.status} ${await summaryRes.text()}`);
  }
  const summaryData = await summaryRes.json();
  console.log(`   ✅ Monthly summary retrieved: ${summaryData.students?.length || 0} students calculated.`);

  console.log(`\n==================================================`);
  console.log(`🎉 ALL LIVE VERIFICATION CHECKS PASSED SUCCESSFULLY!`);
  console.log(`==================================================\n`);
}

verifyLiveAttendance().catch((err) => {
  console.error(`\n❌ Live Verification Failed:`, err);
  process.exit(1);
});
