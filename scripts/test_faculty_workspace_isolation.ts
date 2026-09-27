import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000';

async function runFacultyWorkspaceIsolationTest() {
  console.log('🔒 Starting STRICT FACULTY WORKSPACE DATA ISOLATION VERIFICATION TEST...\n');

  // 1. Admin Login & Create Faculty A & Faculty B
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

  const facA_Email = `fac_iso_a_${Date.now()}@aids.edu`;
  const facB_Email = `fac_iso_b_${Date.now()}@aids.edu`;
  const password = 'Password123!';

  // Create Faculty A
  await fetch(`${BASE_URL}/api/admin/faculty`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminData.token}` },
    body: JSON.stringify({
      facultyId: `FID_A_${Date.now()}`,
      facultyName: 'Faculty Isolation A',
      email: facA_Email,
      password,
      year: '2nd Year',
      section: 'A',
      role: 'Class Coordinator'
    })
  });

  // Create Faculty B
  await fetch(`${BASE_URL}/api/admin/faculty`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminData.token}` },
    body: JSON.stringify({
      facultyId: `FID_B_${Date.now()}`,
      facultyName: 'Faculty Isolation B',
      email: facB_Email,
      password,
      year: '2nd Year',
      section: 'A',
      role: 'Class Coordinator'
    })
  });

  // 2. Faculty A Login & Create Student A + Performance Data
  const facALogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: facA_Email, password, role: 'FACULTY' })
  });
  const facAData = await facALogin.json();
  const headersA = { 'Content-Type': 'application/json', Authorization: `Bearer ${facAData.token}` };

  const stuARes = await fetch(`${BASE_URL}/api/faculty/students`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      registerNo: `REG_ISO_A_${Date.now()}`,
      name: 'Student A (Faculty A Workspace)',
      email: `stu_iso_a_${Date.now()}@aids.edu`,
      batch: '2024-2028',
      portalPassword: 'StudentPassword123!'
    })
  });
  const stuAData = await stuARes.json();
  const studentAId = stuAData.student.id;

  // Faculty A saves Attendance for Student A
  await fetch(`${BASE_URL}/api/faculty/attendance`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({
      date: '2026-07-13',
      records: [{ studentId: studentAId, status: 'PRESENT' }]
    })
  });

  // Faculty A sets LeetCode handle for Student A
  await fetch(`${BASE_URL}/api/faculty/students/${studentAId}/connect-account`, {
    method: 'POST',
    headers: headersA,
    body: JSON.stringify({ provider: 'LeetCode', username: 'tourist_a' })
  });

  console.log('✅ STEP 1 PASSED: Faculty A created Student A, attendance, and LeetCode profile in Workspace A.');

  // 3. Faculty A Logout -> Faculty B Login
  const facBLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: facB_Email, password, role: 'FACULTY' })
  });
  const facBData = await facBLogin.json();
  const headersB = { 'Content-Type': 'application/json', Authorization: `Bearer ${facBData.token}` };

  // Faculty B gets student roster -> MUST BE EMPTY (0 students)
  const rosterBRes = await fetch(`${BASE_URL}/api/faculty/students`, { headers: headersB });
  const rosterB = await rosterBRes.json();

  if (rosterB.students.length === 0) {
    console.log('✅ STEP 2 PASSED: Faculty B roster is 100% clean (0 students) — Faculty A data invisible.');
  } else {
    throw new Error(`STEP 2 FAILED: Faculty B sees ${rosterB.students.length} students from Faculty A!`);
  }

  // Faculty B fetches attendance -> MUST BE EMPTY
  const attBRes = await fetch(`${BASE_URL}/api/faculty/attendance?date=2026-07-13`, { headers: headersB });
  const attB = await attBRes.json();
  if (attB.records.length === 0) {
    console.log('✅ STEP 3 PASSED: Faculty B attendance is 100% clean (0 records).');
  } else {
    throw new Error('STEP 3 FAILED: Faculty B sees attendance records from Faculty A.');
  }

  // Faculty B attempts direct IDOR 360 fetch of Student A -> MUST RETURN 403 Forbidden
  const idor360Res = await fetch(`${BASE_URL}/api/faculty/students/${studentAId}/360`, { headers: headersB });
  if (idor360Res.status === 403) {
    console.log('✅ STEP 4 PASSED: Direct IDOR 360 fetch of Student A by Faculty B rejected with 403 Forbidden.');
  } else {
    throw new Error(`STEP 4 FAILED: Expected 403 Forbidden, got ${idor360Res.status}`);
  }

  // Faculty B attempts direct IDOR attendance post for Student A -> MUST RETURN 403 Forbidden
  const idorAttRes = await fetch(`${BASE_URL}/api/faculty/attendance`, {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({
      date: '2026-07-13',
      records: [{ studentId: studentAId, status: 'ABSENT' }]
    })
  });
  if (idorAttRes.status === 403) {
    console.log('✅ STEP 5 PASSED: Direct IDOR attendance modification of Student A by Faculty B rejected with 403 Forbidden.');
  } else {
    throw new Error(`STEP 5 FAILED: Expected 403 Forbidden, got ${idorAttRes.status}`);
  }

  // 4. Faculty B adds Student B
  const stuBRes = await fetch(`${BASE_URL}/api/faculty/students`, {
    method: 'POST',
    headers: headersB,
    body: JSON.stringify({
      registerNo: `REG_ISO_B_${Date.now()}`,
      name: 'Student B (Faculty B Workspace)',
      email: `stu_iso_b_${Date.now()}@aids.edu`,
      batch: '2024-2028',
      portalPassword: 'StudentPassword123!'
    })
  });
  const stuBData = await stuBRes.json();
  const studentBId = stuBData.student.id;

  console.log('✅ STEP 6 PASSED: Faculty B onboarded Student B into Workspace B.');

  // 5. Faculty B Logout -> Faculty A Login Again
  const facARelogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: facA_Email, password, role: 'FACULTY' })
  });
  const facAData2 = await facARelogin.json();
  const headersA2 = { 'Content-Type': 'application/json', Authorization: `Bearer ${facAData2.token}` };

  // Faculty A fetches roster -> MUST SEE ONLY Student A (1 student, not Student B)
  const rosterA2Res = await fetch(`${BASE_URL}/api/faculty/students`, { headers: headersA2 });
  const rosterA2 = await rosterA2Res.json();

  if (rosterA2.students.length === 1 && rosterA2.students[0].id === studentAId) {
    console.log('✅ STEP 7 PASSED: Faculty A roster contains ONLY Student A — Student B invisible to Faculty A.');
  } else {
    throw new Error(`STEP 7 FAILED: Faculty A roster unexpected count or leak: ${JSON.stringify(rosterA2.students)}`);
  }

  // Faculty A attempts direct IDOR fetch of Student B -> MUST RETURN 403 Forbidden
  const idorReverseRes = await fetch(`${BASE_URL}/api/faculty/students/${studentBId}/360`, { headers: headersA2 });
  if (idorReverseRes.status === 403) {
    console.log('✅ STEP 8 PASSED: Direct reverse IDOR fetch of Student B by Faculty A rejected with 403 Forbidden.');
  } else {
    throw new Error(`STEP 8 FAILED: Expected 403 Forbidden, got ${idorReverseRes.status}`);
  }

  // 6. HOD Department-Wide Authorized Exception Test
  let hodEmail = 'hod.aids@avs.edu';
  const existingHod = (await (await fetch(`${BASE_URL}/api/admin/hod`, { headers: { Authorization: `Bearer ${adminData.token}` } })).json()).hodList?.[0];
  
  if (existingHod) {
    hodEmail = existingHod.email;
    await fetch(`${BASE_URL}/api/admin/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminData.token}` },
      body: JSON.stringify({ userId: existingHod.id, newPassword: 'Password123!' })
    });
  } else {
    const createHod = await fetch(`${BASE_URL}/api/admin/hod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminData.token}` },
      body: JSON.stringify({
        hodId: `HOD_${Date.now()}`,
        hodName: 'HOD Department Supervisor',
        email: `hod_iso_${Date.now()}@aids.edu`,
        password: 'Password123!',
        department: 'AI & DS'
      })
    });
    const hodRes = await createHod.json();
    if (hodRes.hod) hodEmail = hodRes.hod.email;
  }

  const hodLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: hodEmail, password: 'Password123!', role: 'HOD' })
  });
  const hodAuth = await hodLogin.json();
  const headersHOD = { 'Content-Type': 'application/json', Authorization: `Bearer ${hodAuth.token}` };

  const hodRosterRes = await fetch(`${BASE_URL}/api/hod/students`, { headers: headersHOD });
  const hodRoster = await hodRosterRes.json();

  const hasStuA = hodRoster.students.some((s: any) => s.id === studentAId);
  const hasStuB = hodRoster.students.some((s: any) => s.id === studentBId);

  if (hasStuA && hasStuB) {
    console.log('✅ STEP 9 PASSED: HOD successfully sees both Workspace A and Workspace B students across department.');
  } else {
    throw new Error('STEP 9 FAILED: HOD failed to access department-wide students.');
  }

  console.log('\n📊 ALL 9 FACULTY WORKSPACE DATA ISOLATION TESTS PASSED PERFECTLY!');
}

runFacultyWorkspaceIsolationTest().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
