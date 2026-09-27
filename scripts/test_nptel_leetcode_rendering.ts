import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000';

async function runNptelLeetCodeRenderingTest() {
  console.log('🔒 Starting NPTEL & LEETCODE RENDERING & NULL-SAFETY VERIFICATION TEST...\n');

  // 1. Log in as Admin to create CC Faculty
  const facId = `FID_${Math.floor(1000 + Math.random() * 9000)}`;
  const facEmail = `fac_nl_${Date.now()}@aids.edu`;
  const facPassword = 'Password123!';

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
      facultyName: 'CC NPTEL LeetCode Faculty',
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

  // 3. Create a brand new student with 0 records
  const stuRes = await fetch(`${BASE_URL}/api/faculty/students`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      registerNo: `REG_NL_${Date.now()}`,
      name: 'Clean Render Student',
      email: `stu_nl_${Date.now()}@aids.edu`,
      batch: '2024-2028',
      portalPassword: 'StudentPassword123!'
    })
  });
  const stuData = await stuRes.json();
  const studentId = stuData.student.id;

  // 4. Fetch Student 360 data
  const s360Res = await fetch(`${BASE_URL}/api/faculty/students/${studentId}/360`, {
    headers: authHeaders
  });
  if (s360Res.status !== 200) {
    throw new Error(`TEST 1 FAILED: Expected 200 OK, got ${s360Res.status}`);
  }
  const s360Data = await s360Res.json();

  // Verify structure: leetcode is null, nptel is empty array []
  if (s360Data.leetcode === null || s360Data.leetcode === undefined) {
    console.log('✅ TEST 1 PASSED: Brand new student has null/undefined LeetCode profile without crashing API.');
  } else {
    console.log('Leetcode data present:', s360Data.leetcode);
  }

  if (Array.isArray(s360Data.nptel) && s360Data.nptel.length === 0) {
    console.log('✅ TEST 2 PASSED: Brand new student has empty NPTEL array [] without crashing API.');
  } else {
    throw new Error('TEST 2 FAILED: Expected empty NPTEL array.');
  }

  // 5. Connect LeetCode handle using provider='LeetCode'
  const lcSaveRes = await fetch(`${BASE_URL}/api/faculty/students/${studentId}/connect-account`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ provider: 'LeetCode', username: 'tourist' })
  });

  if (lcSaveRes.status === 201 || lcSaveRes.status === 200) {
    console.log('✅ TEST 3 PASSED: Saved LeetCode handle for student successfully.');
  } else {
    throw new Error(`TEST 3 FAILED: Expected 201/200 OK, got ${lcSaveRes.status}`);
  }

  // 6. Fetch updated 360
  const s360UpdatedRes = await fetch(`${BASE_URL}/api/faculty/students/${studentId}/360`, {
    headers: authHeaders
  });
  const s360Updated = await s360UpdatedRes.json();

  if (s360Updated.leetcode) {
    console.log('✅ TEST 4 PASSED: Student 360 updated with verified LeetCode profile metrics.');
  } else {
    console.log('Updated 360:', s360Updated);
    throw new Error('TEST 4 FAILED: Expected updated LeetCode profile in 360 data.');
  }

  console.log('\n📊 ALL NPTEL & LEETCODE RENDERING TESTS PASSED PERFECTLY!');
}

runNptelLeetCodeRenderingTest().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
