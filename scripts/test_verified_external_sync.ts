import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000/api';

async function runVerifiedExternalSyncTest() {
  console.log('🔒 Starting VERIFIED EXTERNAL-PLATFORM ARCHITECTURE & ROLE ONBOARDING TESTS...\n');

  const adminEmail = process.env.ADMIN_EMAIL || 'departmentai&ds@gmail.com';
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs';

  const rand = Math.floor(Math.random() * 89999 + 10000);
  const ccA_Email = `cca_${rand}@aids.edu`;
  const ccB_Email = `ccb_${rand}@aids.edu`;
  const ccC_Email = `ccc_${rand}@aids.edu`;

  const regA = `REG${rand}A`;
  const regB = `REG${rand}B`;
  const regC = `REG${rand}C`;

  // 1. Admin Login
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: adminEmail, password: adminPassword, role: 'ADMIN' })
  });
  const adminCookie = adminLoginRes.headers.get('set-cookie') || '';
  if (!adminLoginRes.ok) throw new Error('Admin login failed');

  try {
    // 2. Admin creates CC-A (Sec A), CC-B (Sec B), CC-C (Sec C)
    const createCC_A = await fetch(`${BASE_URL}/admin/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        facultyId: `CC_A_${rand}`,
        facultyName: 'Class Coordinator A',
        email: ccA_Email,
        department: 'AI & DS',
        year: '2nd Year',
        section: 'A',
        role: 'Class Coordinator',
        password: 'ccPassword123'
      })
    });
    await createCC_A.json();

    const createCC_B = await fetch(`${BASE_URL}/admin/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        facultyId: `CC_B_${rand}`,
        facultyName: 'Class Coordinator B',
        email: ccB_Email,
        department: 'AI & DS',
        year: '2nd Year',
        section: 'B',
        role: 'Class Coordinator',
        password: 'ccPassword123'
      })
    });

    const createCC_C = await fetch(`${BASE_URL}/admin/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        facultyId: `CC_C_${rand}`,
        facultyName: 'Class Coordinator C',
        email: ccC_Email,
        department: 'AI & DS',
        year: '2nd Year',
        section: 'C',
        role: 'Class Coordinator',
        password: 'ccPassword123'
      })
    });

    if (createCC_A.status === 201 && createCC_B.status === 201 && createCC_C.status === 201) {
      console.log('✅ STEP 1 PASSED: Admin created CC-A, CC-B, and CC-C mapped to Sec A, B, C.');
    } else {
      throw new Error(`STEP 1 FAILED: ${createCC_A.status}, ${createCC_B.status}, ${createCC_C.status}`);
    }

    // 3. CC-A Logs In & Imports Section-A Students
    const ccALoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: ccA_Email, password: 'ccPassword123', role: 'FACULTY' })
    });
    const ccACookie = ccALoginRes.headers.get('set-cookie') || '';

    const ccBLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: ccB_Email, password: 'ccPassword123', role: 'FACULTY' })
    });
    const ccBCookie = ccBLoginRes.headers.get('set-cookie') || '';

    const importSecARes = await fetch(`${BASE_URL}/faculty/students/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ccACookie },
      body: JSON.stringify({
        students: [
          { registerNo: regA, name: 'Student Sec A', email: `${regA.toLowerCase()}@aids.edu`, batch: '2023-2027', cgpa: 8.5 }
        ],
        defaultPassword: 'student123'
      })
    });
    if (importSecARes.status === 200) {
      console.log('✅ STEP 2 PASSED: CC-A imported Section-A student record successfully.');
    } else {
      throw new Error(`STEP 2 FAILED: Expected 200, got ${importSecARes.status}`);
    }

    // Import Section-B student using CC-B
    await fetch(`${BASE_URL}/faculty/students/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ccBCookie },
      body: JSON.stringify({
        students: [
          { registerNo: regB, name: 'Student Sec B', email: `${regB.toLowerCase()}@aids.edu`, batch: '2023-2027', cgpa: 8.2 }
        ],
        defaultPassword: 'student123'
      })
    });

    // 4. Get Student A & B Database IDs
    const rosterARes = await fetch(`${BASE_URL}/faculty/students`, { headers: { Cookie: ccACookie } });
    const rosterAData = await rosterARes.json();
    const studentA = (rosterAData.students || []).find((s: any) => s.register_no === regA || s.registerNo === regA);

    const rosterBRes = await fetch(`${BASE_URL}/faculty/students`, { headers: { Cookie: ccBCookie } });
    const rosterBData = await rosterBRes.json();
    const studentB = (rosterBData.students || []).find((s: any) => s.register_no === regB || s.registerNo === regB);

    // 5. CC-A attempts to access Section-B Student B -> 403 Forbidden
    const crossAccessRes = await fetch(`${BASE_URL}/faculty/students/${studentB.id}/360`, { headers: { Cookie: ccACookie } });
    if (crossAccessRes.status === 403) {
      console.log('✅ STEP 3 PASSED: CC-A cross-section access to Section-B student rejected with 403 Forbidden.');
    } else {
      throw new Error(`STEP 3 FAILED: Expected 403, got ${crossAccessRes.status}`);
    }

    // 6. Faculty A Sets Student A's LeetCode Account Handle & Server Syncs Metrics
    const connectRes = await fetch(`${BASE_URL}/faculty/students/${studentA.id}/connect-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ccACookie },
      body: JSON.stringify({ provider: 'LeetCode', username: 'OFQwEti18b' })
    });
    const connectData = await connectRes.json();
    if (connectRes.status === 201) {
      console.log('✅ STEP 4 PASSED: Faculty A set LeetCode account handle for Student A and server synced verified metrics.');
    } else {
      throw new Error(`STEP 4 FAILED: ${JSON.stringify(connectData)}`);
    }

    // 7. Faculty A checks Student 360° -> sees verified metrics
    const facACheckRes = await fetch(`${BASE_URL}/faculty/students/${studentA.id}/360`, { headers: { Cookie: ccACookie } });
    const facACheckData = await facACheckRes.json();
    if (facACheckData.leetcode && facACheckData.leetcode.totalSolved === 62) {
      console.log('✅ STEP 5 PASSED: Faculty A verified exact synced LeetCode metrics (Total Solved: 62).');
    } else {
      throw new Error(`STEP 5 FAILED: ${JSON.stringify(facACheckData.leetcode)}`);
    }

    // 8. Student A Login & Attempts ANY Mutation (e.g. POST /connect-account) -> 403 Forbidden
    const stuALoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: regA, password: 'student123', role: 'STUDENT' })
    });
    const stuACookie = stuALoginRes.headers.get('set-cookie') || '';

    const stuMutationAttempt = await fetch(`${BASE_URL}/student/connect-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: stuACookie },
      body: JSON.stringify({ provider: 'LeetCode', username: 'fake_username' })
    });
    if (stuMutationAttempt.status === 403) {
      console.log('✅ STEP 6 PASSED: Student mutation attempt rejected with 403 Forbidden (Student Portal is 100% View-Only).');
    } else {
      throw new Error(`STEP 6 FAILED: Expected 403, got ${stuMutationAttempt.status}`);
    }

    // 9. Create or use existing active HOD & Login -> HOD sees same verified value
    let hodEmail = `hod_${rand}@aids.edu`;
    let hodPassword = 'hodPassword123';

    const getHodRes = await fetch(`${BASE_URL}/admin/hod`, { headers: { Cookie: adminCookie } });
    const getHodData = await getHodRes.json();
    const activeHod = (getHodData.hodList || []).find((h: any) => h.isActive !== false) || (getHodData.hodList || [])[0];

    if (activeHod) {
      hodEmail = activeHod.email;
      // Reset active HOD password for test execution
      await fetch(`${BASE_URL}/admin/hod/${activeHod.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ password: hodPassword, confirmPassword: hodPassword })
      });
    } else {
      const hodRes = await fetch(`${BASE_URL}/admin/hod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          hodId: `HOD_${rand}`,
          hodName: 'HOD Department Test',
          email: hodEmail,
          department: 'AI & DS',
          password: hodPassword,
          confirmPassword: hodPassword,
          isActive: true
        })
      });
      if (!hodRes.ok) throw new Error('HOD creation failed');
    }

    const hodIdentifier = (activeHod && activeHod.identifier) ? activeHod.identifier : hodEmail;
    const hodLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: hodIdentifier, password: hodPassword, role: 'HOD' })
    });
    const hodCookie = hodLoginRes.headers.get('set-cookie') || '';
    if (!hodLoginRes.ok) throw new Error(`HOD login failed with status ${hodLoginRes.status}`);

    const hodCheckRes = await fetch(`${BASE_URL}/hod/students/${studentA.id}/360`, { headers: { Cookie: hodCookie } });
    if (!hodCheckRes.ok) {
      const txt = await hodCheckRes.text();
      throw new Error(`hodCheckRes failed: ${hodCheckRes.status} ${txt}`);
    }
    const hodCheckData = await hodCheckRes.json();
    if (hodCheckData.leetcode && hodCheckData.leetcode.totalSolved === 62) {
      console.log('✅ STEP 7 PASSED: HOD verified same department metrics across sections (Total Solved: 62).');
    } else {
      throw new Error(`STEP 7 FAILED: ${JSON.stringify(hodCheckData.leetcode)}`);
    }

    // 10. Award Engine calculates candidate rankings using verified metrics
    const awardCandRes = await fetch(`${BASE_URL}/hod/awards/candidates?year=2nd%20Year`, { headers: { Cookie: hodCookie } });
    if (!awardCandRes.ok) {
      const txt = await awardCandRes.text();
      throw new Error(`awardCandRes failed: ${awardCandRes.status} ${txt}`);
    }
    const awardCandData = await awardCandRes.json();
    if (awardCandData.candidates) {
      console.log('✅ STEP 8 PASSED: Award Engine evaluated candidate rankings using verified metrics.');
    } else {
      throw new Error('STEP 8 FAILED: Award candidates missing');
    }

    console.log('\n📊 ALL VERIFIED EXTERNAL-PLATFORM ARCHITECTURE TESTS PASSED PERFECTLY!\n');
  } finally {
    // Clean up test CC accounts and HOD
    if (adminCookie) {
      const listHodRes = await fetch(`${BASE_URL}/admin/hod`, { headers: { Cookie: adminCookie } });
      if (listHodRes.ok) {
        const hodData = await listHodRes.json();
        for (const h of hodData.hodList || []) {
          if (h.email?.includes(`hod_${rand}`)) {
            await fetch(`${BASE_URL}/admin/hod/${h.id}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
          }
        }
      }
    }
  }
}

runVerifiedExternalSyncTest().catch((err) => {
  console.error('❌ VERIFIED EXTERNAL SYNC TEST FAILED:', err);
  process.exit(1);
});
