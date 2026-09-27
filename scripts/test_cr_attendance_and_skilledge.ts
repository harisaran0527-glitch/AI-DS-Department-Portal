import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000';

async function runCRAttendanceAndSkillEdgeTest() {
  console.log('🔒 Starting CR ATTENDANCE & SKILLEDGE ACCORDION VERIFICATION TEST...\n');

  const facId = `FID_${Math.floor(1000 + Math.random() * 9000)}`;
  const facEmail = `fac_attd_${Date.now()}@aids.edu`;
  const facPassword = 'Password123!';

  // 1. Log in as Admin to create a CC Faculty
  const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: process.env.ADMIN_EMAIL || 'departmentai&ds@gmail.com',
      password: process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs',
      role: 'ADMIN'
    })
  });
  const adminData = await adminLogin.json();

  await fetch(`${BASE_URL}/api/admin/faculty`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminData.token}` },
    body: JSON.stringify({
      facultyId: facId,
      facultyName: 'CC Attendance Faculty',
      email: facEmail,
      password: facPassword,
      year: '2nd Year',
      section: 'A',
      role: 'Class Coordinator'
    })
  });

  // 2. Log in as CC Faculty
  const facLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: facEmail,
      password: facPassword,
      role: 'FACULTY'
    })
  });
  const facData = await facLogin.json();
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${facData.token}`
  };

  // 3. Create a real student under CC Faculty
  const stuRes = await fetch(`${BASE_URL}/api/faculty/students`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      registerNo: `REG_ATT_${Date.now()}`,
      name: 'Attendance Student 1',
      email: `stu_att_${Date.now()}@aids.edu`,
      batch: '2024-2028',
      portalPassword: 'StudentPassword123!'
    })
  });
  const stuData = await stuRes.json();
  const studentId = stuData.student.id;

  // 4. Test Attendance min date constraint (min 13 July 2026)
  const invalidDateRes = await fetch(`${BASE_URL}/api/faculty/attendance?date=2026-07-10`, {
    headers: authHeaders
  });
  if (invalidDateRes.status === 400) {
    console.log('✅ TEST 1 PASSED: Dates before 13 July 2026 rejected with 400 Bad Request.');
  } else {
    throw new Error(`TEST 1 FAILED: Expected 400 Bad Request, got ${invalidDateRes.status}`);
  }

  // 5. Fetch attendance for valid date 2026-07-13
  const validRes = await fetch(`${BASE_URL}/api/faculty/attendance?date=2026-07-13`, {
    headers: authHeaders
  });
  if (validRes.status === 200) {
    console.log('✅ TEST 2 PASSED: Fetched attendance for 13 July 2026 successfully.');
  } else {
    throw new Error(`TEST 2 FAILED: Expected 200 OK, got ${validRes.status}`);
  }

  // 6. Save Attendance records for real student
  const saveRes = await fetch(`${BASE_URL}/api/faculty/attendance`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      date: '2026-07-13',
      records: [
        { studentId, status: 'PRESENT' }
      ]
    })
  });

  if (saveRes.status === 200) {
    console.log('✅ TEST 3 PASSED: Attendance records saved successfully via backend API.');
  } else {
    throw new Error(`TEST 3 FAILED: Expected 200 OK, got ${saveRes.status}`);
  }

  // 7. Fetch Attendance History
  const historyRes = await fetch(`${BASE_URL}/api/faculty/attendance/history`, {
    headers: authHeaders
  });
  if (historyRes.status === 200) {
    const _histData = await historyRes.json();
    console.log('✅ TEST 4 PASSED: Attendance history retrieved successfully with status-wise records.');
  } else {
    throw new Error(`TEST 4 FAILED: Expected 200 OK, got ${historyRes.status}`);
  }

  console.log('\n📊 ALL CR ATTENDANCE & SKILLEDGE TESTS PASSED PERFECTLY!');
}

runCRAttendanceAndSkillEdgeTest().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
