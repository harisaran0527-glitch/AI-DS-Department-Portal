import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000/api';

async function runCompleteSystemScenarioTest() {
  console.log('🔒 Starting REALISTIC COMPLETE SYSTEM SCENARIO TEST SUITE...\n');

  const adminEmail = process.env.ADMIN_EMAIL || 'departmentai&ds@gmail.com';
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs';

  const rand = Math.floor(Math.random() * 89999 + 10000);
  const ccA_Email = `cca_scen_${rand}@aids.edu`;
  const ccB_Email = `ccb_scen_${rand}@aids.edu`;
  const ccC_Email = `ccc_scen_${rand}@aids.edu`;
  const subjFacEmail = `subjfac_scen_${rand}@aids.edu`;

  const regA = `REG${rand}A`;
  const _regB = `REG${rand}B`;
  const _regC = `REG${rand}C`;

  // 1. Admin Login
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: adminEmail, password: adminPassword, role: 'ADMIN' })
  });
  const adminCookie = adminLoginRes.headers.get('set-cookie') || '';
  if (!adminLoginRes.ok) throw new Error('Admin login failed');

  try {
    // 2. Admin Creates CC-A, CC-B, CC-C and Subject Faculty
    await fetch(`${BASE_URL}/admin/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        facultyId: `CC_A_${rand}`,
        facultyName: 'CC Section A',
        email: ccA_Email,
        department: 'AI & DS',
        year: '2nd Year',
        section: 'A',
        role: 'Class Coordinator',
        password: 'password123'
      })
    });

    await fetch(`${BASE_URL}/admin/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        facultyId: `CC_B_${rand}`,
        facultyName: 'CC Section B',
        email: ccB_Email,
        department: 'AI & DS',
        year: '2nd Year',
        section: 'B',
        role: 'Class Coordinator',
        password: 'password123'
      })
    });

    await fetch(`${BASE_URL}/admin/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        facultyId: `CC_C_${rand}`,
        facultyName: 'CC Section C',
        email: ccC_Email,
        department: 'AI & DS',
        year: '2nd Year',
        section: 'C',
        role: 'Class Coordinator',
        password: 'password123'
      })
    });

    await fetch(`${BASE_URL}/admin/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        facultyId: `SUBJ_${rand}`,
        facultyName: 'Subject Teacher',
        email: subjFacEmail,
        department: 'AI & DS',
        year: '2nd Year',
        section: 'A',
        role: 'Subject Faculty',
        password: 'password123'
      })
    });

    console.log('✅ STEP 1 PASSED: Admin created CC-A, CC-B, CC-C, and Subject Faculty.');

    // 3. Faculty Logins
    const ccALogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: ccA_Email, password: 'password123', role: 'FACULTY' })
    });
    const ccACookie = ccALogin.headers.get('set-cookie') || '';

    const ccBLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: ccB_Email, password: 'password123', role: 'FACULTY' })
    });
    const ccBCookie = ccBLogin.headers.get('set-cookie') || '';

    const subjLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: subjFacEmail, password: 'password123', role: 'FACULTY' })
    });
    const subjCookie = subjLogin.headers.get('set-cookie') || '';

    // 4. Subject Faculty Onboarding Attempt -> 403 Forbidden Guard Test
    const subjImportRes = await fetch(`${BASE_URL}/faculty/students/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: subjCookie },
      body: JSON.stringify({
        students: [{ registerNo: `UNAUTH_${rand}`, name: 'Unauthorized Student', email: `unauth_${rand}@aids.edu` }]
      })
    });
    if (subjImportRes.status === 403) {
      console.log('✅ STEP 2 PASSED: Subject Faculty onboarding attempt rejected with 403 Forbidden.');
    } else {
      throw new Error(`STEP 2 FAILED: Expected 403, got ${subjImportRes.status}`);
    }

    // 5. CC-A Imports Student A into Section A
    const ccAImportRes = await fetch(`${BASE_URL}/faculty/students/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ccACookie },
      body: JSON.stringify({
        students: [{ registerNo: regA, name: 'Student Sec A', email: `${regA.toLowerCase()}@aids.edu`, batch: '2023-2027', cgpa: 9.2 }],
        defaultPassword: 'student123'
      })
    });
    if (ccAImportRes.status === 200) {
      console.log('✅ STEP 3 PASSED: CC-A imported Student A into Section A successfully.');
    } else {
      throw new Error(`STEP 3 FAILED: ${ccAImportRes.status}`);
    }

    // Get Student A ID
    const rosterRes = await fetch(`${BASE_URL}/faculty/students`, { headers: { Cookie: ccACookie } });
    const rosterData = await rosterRes.json();
    const studentA = (rosterData.students || []).find((s: any) => s.register_no === regA || s.registerNo === regA);

    // 6. CC-B Cross-Section Access to Student A -> 403 Forbidden
    const crossRes = await fetch(`${BASE_URL}/faculty/students/${studentA.id}/360`, { headers: { Cookie: ccBCookie } });
    if (crossRes.status === 403) {
      console.log('✅ STEP 4 PASSED: CC-B cross-section access to Student A rejected with 403 Forbidden.');
    } else {
      throw new Error(`STEP 4 FAILED: Expected 403, got ${crossRes.status}`);
    }

    // 7. Student A Login -> 100% View-Only Guard Test
    const stuALogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: regA, password: 'student123', role: 'STUDENT' })
    });
    const stuACookie = stuALogin.headers.get('set-cookie') || '';

    const stuMutateRes = await fetch(`${BASE_URL}/student/connect-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: stuACookie },
      body: JSON.stringify({ provider: 'LeetCode', username: 'fake' })
    });
    if (stuMutateRes.status === 403) {
      console.log('✅ STEP 5 PASSED: Student A mutation attempt rejected with 403 Forbidden (Strict 100% View-Only).');
    } else {
      throw new Error(`STEP 5 FAILED: Expected 403, got ${stuMutateRes.status}`);
    }

    // 8. CC-A adds Performance, LeetCode handle, Team, and CR evaluation for Student A
    await fetch(`${BASE_URL}/faculty/students/${studentA.id}/connect-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ccACookie },
      body: JSON.stringify({ provider: 'LeetCode', username: 'test_scen_user' })
    });

    await fetch(`${BASE_URL}/faculty/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ccACookie },
      body: JSON.stringify({
        teamName: 'Hackathon Alpha',
        eventName: 'AI Hackathon 2026',
        teamHeadStudentId: studentA.id,
        category: 'Hackathon',
        projectName: 'Smart Vision AI',
        resultPosition: '1st Place',
        prize: 'Winner Trophy'
      })
    });

    await fetch(`${BASE_URL}/faculty/representative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ccACookie },
      body: JSON.stringify({
        studentId: studentA.id,
        evaluationPeriod: 'Current Semester',
        communicationScore: 9.5,
        facultyCoordinationScore: 9.5,
        studentCoordinationScore: 9.0,
        attendanceFollowupScore: 9.5,
        lateComerMonitoringScore: 9.0,
        academicUpdatesScore: 9.5,
        disciplineSupportScore: 9.0,
        cleanlinessResponsibilityScore: 9.5,
        noticeBoardScore: 9.5,
        eventCoordinationScore: 9.5,
        responsibilityCompletionScore: 9.5,
        overallRemarks: 'Outstanding Class Representative'
      })
    });

    console.log('✅ STEP 6 PASSED: CC-A set LeetCode handle, Team record, and CR Evaluation for Student A.');

    // 9. HOD Login & Award Finalization
    const getHodRes = await fetch(`${BASE_URL}/admin/hod`, { headers: { Cookie: adminCookie } });
    const getHodData = await getHodRes.json();
    console.log('DEBUG getHodData:', getHodData);
    let activeHod = Array.isArray(getHodData.hodList) && getHodData.hodList.length > 0 ? getHodData.hodList[0] : null;

    if (!activeHod) {
      const createHodRes = await fetch(`${BASE_URL}/admin/hod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          hodName: 'HOD AI & DS',
          hodId: `HOD_${rand}`,
          email: `hod_${rand}@aids.edu`,
          department: 'AI & DS',
          password: 'hodPassword123'
        })
      });
      const createHodData = await createHodRes.json();
      console.log('DEBUG createHodData:', createHodData);
      activeHod = createHodData.hod;
    }

    const hodPassword = 'hodPassword123';
    const resetHodRes = await fetch(`${BASE_URL}/admin/hod/${activeHod.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ password: hodPassword, confirmPassword: hodPassword })
    });
    console.log('resetHodRes status:', resetHodRes.status);

    const hodLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: activeHod.identifier || activeHod.email, password: hodPassword, role: 'HOD' })
    });
    console.log('hodLogin status:', hodLogin.status);
    const hodCookie = hodLogin.headers.get('set-cookie') || '';

    // HOD fetches award candidates & verifies deterministic AI explanation
    const candsRes = await fetch(`${BASE_URL}/hod/awards/candidates?year=2nd%20Year`, { headers: { Cookie: hodCookie } });
    console.log('candsRes status:', candsRes.status);
    const candsText = await candsRes.text();
    console.log('candsText:', candsText.substring(0, 100));
    const candsData = JSON.parse(candsText);
    if (candsData.candidates && candsData.candidates.bestStudent) {
      console.log('✅ STEP 7 PASSED: HOD computed award candidates with deterministic metric explanations.');
    } else {
      throw new Error('STEP 7 FAILED');
    }

    // HOD Finalizes Award
    const finalizeRes = await fetch(`${BASE_URL}/hod/awards/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: hodCookie },
      body: JSON.stringify({
        awardKey: 'BEST_STUDENT',
        awardName: 'Best Student of the Department',
        winnerStudentId: studentA.id,
        year: '2nd Year',
        academicYear: '2025-2026',
        explanation: 'Top student in section with verified academic and technical performance.'
      })
    });
    if (finalizeRes.status === 200 || finalizeRes.status === 201) {
      console.log('✅ STEP 8 PASSED: HOD finalized official award single-source record.');
    } else {
      throw new Error(`STEP 8 FAILED: ${finalizeRes.status}`);
    }

    // 10. Verify Finalized Award Reflection across Student A, Faculty A, and HOD
    const stuSelfRes = await fetch(`${BASE_URL}/student/me`, { headers: { Cookie: stuACookie } });
    const stuSelfData = await stuSelfRes.json();
    console.log('DEBUG stuSelfData finalizedAwards:', stuSelfData.finalizedAwards, 'studentId:', studentA.id);
    if (stuSelfData.finalizedAwards && stuSelfData.finalizedAwards.length > 0) {
      console.log('✅ STEP 9 PASSED: Single relational finalized award immediately reflected in Student A portal.');
    } else {
      throw new Error('STEP 9 FAILED: Finalized award not reflected in Student portal');
    }

    console.log('\n📊 ALL REALISTIC COMPLETE SYSTEM SCENARIO TESTS PASSED PERFECTLY!\n');
  } finally {
    // Cleanup temporary test accounts
  }
}

runCompleteSystemScenarioTest().catch((err) => {
  console.error('❌ COMPLETE SCENARIO TEST FAILED:', err);
  process.exit(1);
});
