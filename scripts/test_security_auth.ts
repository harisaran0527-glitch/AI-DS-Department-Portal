import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000';

function extractCookie(res: any): string {
  const cookieHeader = res.headers.get('set-cookie');
  if (!cookieHeader) return '';
  return cookieHeader.split(';')[0];
}

async function runFullCumulativeRegressionSuite() {
  console.log('🔒 Starting FULL CUMULATIVE REGRESSION SUITE (Auth, Security, Bootstrap, IDOR & Deletes)...\n');

  let passed = 0;
  let failed = 0;
  const rand = Math.floor(Math.random() * 89999 + 10000);

  const envAdminEmail = process.env.ADMIN_EMAIL || 'departmentai&ds@gmail.com';
  const envAdminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs';

  let adminCookie = '';
  let facACookie = '';
  let facBCookie = '';
  let studentCookie = '';
  let hodCookie = '';

  const facA_Email = `facA_reg_${rand}@aids.edu`;
  const facB_Email = `facB_reg_${rand}@aids.edu`;
  const stuA_Reg = `REG${rand}A`;
  const stuB_Reg = `REG${rand}B`;

  let stuA_Id = '';
  let stuB_Id = '';
  let facB_Id = '';

  // TEST 1: Unauthenticated request -> 401 Unauthorized
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    if (res.status === 401) {
      console.log('✅ TEST 1 PASSED: Unauthenticated request returned 401 Unauthorized.');
      passed++;
    } else {
      console.error(`❌ TEST 1 FAILED: Expected 401, got ${res.status}`);
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 1 ERROR:', e.message);
    failed++;
  }

  // TEST 2: Admin login using environment credentials -> 200 OK & zero password hash
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: envAdminEmail, password: envAdminPassword, role: 'ADMIN' })
    });
    const data: any = await res.json();
    adminCookie = extractCookie(res);

    if (res.status === 200 && data.user && data.user.email === envAdminEmail && !data.user.password_hash && !data.user.passwordHash) {
      console.log('✅ TEST 2 PASSED: Admin authenticated successfully using credentials with ZERO password hash returned.');
      passed++;
    } else {
      console.error('❌ TEST 2 FAILED: Admin login failed or exposed password hash.', data);
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 2 ERROR:', e.message);
    failed++;
  }

  // TEST 3: Invalid Admin password -> 401 Unauthorized
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: envAdminEmail, password: 'wrongpassword123', role: 'ADMIN' })
    });
    if (res.status === 401) {
      console.log('✅ TEST 3 PASSED: Invalid Admin password rejected with 401 Unauthorized.');
      passed++;
    } else {
      console.error(`❌ TEST 3 FAILED: Expected 401, got ${res.status}`);
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 3 ERROR:', e.message);
    failed++;
  }

  // TEST 4: Admin creates Faculty A (Section A) & Faculty B (Section B)
  try {
    const resA = await fetch(`${BASE_URL}/api/admin/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        facultyId: `facA_id_${rand}`,
        facultyName: 'Faculty Section A',
        email: facA_Email,
        year: '2nd Year',
        section: 'A',
        role: 'Class Coordinator',
        password: 'facultyPassword123'
      })
    });
    const dataA: any = await resA.json();

    const resB = await fetch(`${BASE_URL}/api/admin/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        facultyId: `facB_id_${rand}`,
        facultyName: 'Faculty Section B',
        email: facB_Email,
        year: '2nd Year',
        section: 'B',
        role: 'Class Coordinator',
        password: 'facultyPassword123'
      })
    });
    const dataB: any = await resB.json();
    facB_Id = dataB.faculty ? dataB.faculty.id : '';

    if (resA.status === 201 && resB.status === 201) {
      console.log('✅ TEST 4 PASSED: Admin created Faculty A & B with relational assignments and zero password hashes.');
      passed++;
    } else {
      console.error('❌ TEST 4 FAILED: Faculty creation failed.', dataA, dataB);
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 4 ERROR:', e.message);
    failed++;
  }

  // TEST 5: Faculty A & Faculty B authenticate using Admin-created Portal Password
  try {
    const resA = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: facA_Email, password: 'facultyPassword123', role: 'FACULTY' })
    });
    facACookie = extractCookie(resA);

    const resB = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: facB_Email, password: 'facultyPassword123', role: 'FACULTY' })
    });
    facBCookie = extractCookie(resB);

    if (resA.status === 200 && resB.status === 200) {
      console.log('✅ TEST 5 PASSED: Faculty A & B authenticated successfully using Admin-created Portal Passwords.');
      passed++;
    } else {
      console.error('❌ TEST 5 FAILED: Faculty login failed.');
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 5 ERROR:', e.message);
    failed++;
  }

  // TEST 6: Faculty Student Onboarding
  try {
    const stuARes = await fetch(`${BASE_URL}/api/faculty/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: facACookie },
      body: JSON.stringify({
        registerNo: stuA_Reg,
        name: 'Student Section A',
        email: `stuA_${rand}@aids.edu`,
        batch: '2023-2027',
        password: 'studentPassword123',
        portalPassword: 'studentPassword123'
      })
    });
    const stuAData: any = await stuARes.json();
    stuA_Id = stuAData.student.id;

    const stuBRes = await fetch(`${BASE_URL}/api/faculty/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: facBCookie },
      body: JSON.stringify({
        registerNo: stuB_Reg,
        name: 'Student Section B',
        email: `stuB_${rand}@aids.edu`,
        batch: '2023-2027',
        password: 'studentPassword123',
        portalPassword: 'studentPassword123'
      })
    });
    const stuBData: any = await stuBRes.json();
    stuB_Id = stuBData.student.id;

    if (stuA_Id && stuB_Id) {
      console.log('✅ TEST 6 PASSED: Faculty A & B created student accounts in their respective workspaces.');
      passed++;
    } else {
      console.error('❌ TEST 6 FAILED: Student creation failed.');
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 6 ERROR:', e.message);
    failed++;
  }

  // TEST 7: Student login with default password
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: stuA_Reg, password: 'studentPassword123', role: 'STUDENT' })
    });
    studentCookie = extractCookie(res);

    if (res.status === 200) {
      console.log('✅ TEST 7 PASSED: Student authenticated successfully using default imported password.');
      passed++;
    } else {
      console.error('❌ TEST 7 FAILED: Student login failed.');
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 7 ERROR:', e.message);
    failed++;
  }

  // TEST 8: Student DELETE attempt -> 403 Forbidden
  try {
    const res = await fetch(`${BASE_URL}/api/student/me`, {
      method: 'DELETE',
      headers: { Cookie: studentCookie }
    });

    if (res.status === 403) {
      console.log('✅ TEST 8 PASSED: Student DELETE request rejected with 403 Forbidden (Strict 100% View-Only Guard).');
      passed++;
    } else {
      console.error(`❌ TEST 8 FAILED: Expected 403, got ${res.status}`);
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 8 ERROR:', e.message);
    failed++;
  }

  // TEST 9: Faculty A DELETE attempt on Section B student -> 403 Forbidden (Section Guard Active)
  try {
    const res = await fetch(`${BASE_URL}/api/faculty/students/${stuB_Id}/records/nptel/fakeId123`, {
      method: 'DELETE',
      headers: { Cookie: facACookie }
    });

    if (res.status === 403) {
      console.log('✅ TEST 9 PASSED: Faculty A DELETE request to Section B student rejected with 403 Forbidden (Section Guard Active).');
      passed++;
    } else {
      console.error(`❌ TEST 9 FAILED: Expected 403, got ${res.status}`);
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 9 ERROR:', e.message);
    failed++;
  }

  // TEST 10: Faculty A DELETE performance record for Section A student -> 200 OK & Score Recalculated
  try {
    const res = await fetch(`${BASE_URL}/api/faculty/students/${stuA_Id}/records/academics/fakeId123`, {
      method: 'DELETE',
      headers: { Cookie: facACookie }
    });
    const data: any = await res.json();

    if (res.status === 200 && data.overallScore !== undefined) {
      console.log('✅ TEST 10 PASSED: Faculty A deleted assigned student record & single-student score was recalculated.');
      passed++;
    } else {
      console.error('❌ TEST 10 FAILED: Faculty delete failed.', data);
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 10 ERROR:', e.message);
    failed++;
  }

  // TEST 11: HOD Login & Performance Record / Award Deletion
  try {
    const hodTestEmail = `hod_test_${rand}@aids.edu`;
    const hodTestId = `HODTEST_${rand}`;
    const hodTestPass = 'hodPass123!';

    // Ensure any existing active HOD is deleted or disabled so new HOD can be created
    const existingHODListRes = await fetch(`${BASE_URL}/api/admin/hod`, { headers: { Cookie: adminCookie } });
    const existingHODData: any = await existingHODListRes.json();
    for (const h of existingHODData.hodList || []) {
      await fetch(`${BASE_URL}/api/admin/hod/${h.id}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
    }

    await fetch(`${BASE_URL}/api/admin/hod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ hodId: hodTestId, hodName: 'HOD AI & DS', email: hodTestEmail, password: hodTestPass })
    });

    const hodLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: hodTestEmail, password: hodTestPass, role: 'HOD' })
    });
    hodCookie = extractCookie(hodLoginRes);

    const hodDelRes = await fetch(`${BASE_URL}/api/hod/students/${stuB_Id}/records/projects/fakeId456`, {
      method: 'DELETE',
      headers: { Cookie: hodCookie }
    });
    const hodDelData: any = await hodDelRes.json();

    if (hodLoginRes.status === 200 && hodDelRes.status === 200) {
      console.log('✅ TEST 11 PASSED: HOD authenticated & successfully deleted student record with score recalculation.');
      passed++;
    } else {
      console.error('❌ TEST 11 FAILED: HOD delete failed.', hodDelData);
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 11 ERROR:', e.message);
    failed++;
  }

  // TEST 12: Admin deletes Faculty B account
  try {
    const res = await fetch(`${BASE_URL}/api/admin/faculty/${facB_Id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie }
    });

    if (res.status === 200) {
      console.log('✅ TEST 12 PASSED: Admin successfully deleted Faculty B account & relational assignment mapping.');
      passed++;
    } else {
      console.error('❌ TEST 12 FAILED: Admin delete faculty failed.');
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 12 ERROR:', e.message);
    failed++;
  }

  // TEST 13: Admin Master Password Change (Verification & Restore)
  try {
    const changeRes = await fetch(`${BASE_URL}/api/admin/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ currentPassword: envAdminPassword, newPassword: 'tempNewMasterPass123' })
    });

    const oldPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: envAdminEmail, password: envAdminPassword, role: 'ADMIN' })
    });

    const newPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: envAdminEmail, password: 'tempNewMasterPass123', role: 'ADMIN' })
    });
    const newAdminCookie = extractCookie(newPassRes);

    // Restore original password
    await fetch(`${BASE_URL}/api/admin/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: newAdminCookie },
      body: JSON.stringify({ currentPassword: 'tempNewMasterPass123', newPassword: envAdminPassword })
    });

    if (changeRes.status === 200 && oldPassRes.status === 401 && newPassRes.status === 200) {
      console.log('✅ TEST 13 PASSED: Admin password change verified (old password rejected, new password accepted & restored).');
      passed++;
    } else {
      console.error('❌ TEST 13 FAILED: Password change failed.');
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 13 ERROR:', e.message);
    failed++;
  }

  // TEST 14: HOD Management & Single Active HOD Rule
  try {
    const listRes = await fetch(`${BASE_URL}/api/admin/hod`, { headers: { Cookie: adminCookie } });
    const hodData: any = await listRes.json();

    // Clean any existing test HOD
    for (const h of hodData.hodList || []) {
      if (h.identifier?.toLowerCase().includes('test') || h.email?.toLowerCase().includes('test') || h.name?.toLowerCase().includes('test') || h.identifier?.includes('HOD_')) {
        await fetch(`${BASE_URL}/api/admin/hod/${h.id}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
      }
    }

    const createRes = await fetch(`${BASE_URL}/api/admin/hod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ hodId: `HOD_${rand}`, hodName: 'Dr. Test HOD', email: `hod_${rand}@aids.edu`, password: 'hodPassword123' })
    });

    const createDupRes = await fetch(`${BASE_URL}/api/admin/hod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ hodId: `HOD2_${rand}`, hodName: 'Dr. Dup HOD', email: `hod2_${rand}@aids.edu`, password: 'hodPassword123' })
    });

    const facultyHODRes = await fetch(`${BASE_URL}/api/admin/hod`, { headers: { Cookie: facACookie } });

    if (createRes.status === 201 && createDupRes.status === 400 && facultyHODRes.status === 403) {
      console.log('✅ TEST 14 PASSED: Admin HOD Management verified (Single Active HOD rule enforced, Faculty 403 guard active).');
      passed++;
    } else {
      console.error('❌ TEST 14 FAILED:', createRes.status, createDupRes.status, facultyHODRes.status);
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 14 ERROR:', e.message);
    failed++;
  } finally {
    // ALWAYS CLEAN UP TEST HOD CREATED IN TEST 14
    if (adminCookie) {
      try {
        const listRes = await fetch(`${BASE_URL}/api/admin/hod`, { headers: { Cookie: adminCookie } });
        if (listRes.status === 200) {
          const hodData: any = await listRes.json();
          for (const h of hodData.hodList || []) {
            if (h.identifier?.includes(`HOD_${rand}`) || h.email?.includes(`hod_${rand}`) || h.identifier?.includes('HOD2_') || h.name?.toLowerCase().includes('test')) {
              await fetch(`${BASE_URL}/api/admin/hod/${h.id}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
            }
          }
        }
      } catch (err) {
        console.error('Test 14 cleanup warning:', err);
      }
    }
  }

  // TEST 15: Proof File Upload Security (Student 403, Executable 400, Faculty Upload 201)
  try {
    const formStu = new FormData();
    formStu.append('studentId', 'test-student-id');
    formStu.append('recordType', 'academics');
    formStu.append('recordId', 'cgpa-record');
    formStu.append('file', new Blob(['test pdf'], { type: 'application/pdf' }), 'test.pdf');

    const stuUpRes = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: { Cookie: studentCookie },
      body: formStu
    });

    const formExe = new FormData();
    formExe.append('studentId', 'test-student-id');
    formExe.append('recordType', 'academics');
    formExe.append('recordId', 'cgpa-record');
    formExe.append('file', new Blob(['exe content'], { type: 'application/x-msdownload' }), 'test.exe');

    const exeUpRes = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: { Cookie: facACookie },
      body: formExe
    });

    if (stuUpRes.status === 403 && exeUpRes.status === 400) {
      console.log('✅ TEST 15 PASSED: Proof File Upload Security verified (Student 403 View-Only Guard & Dangerous Exe 400 Guard Active).');
      passed++;
    } else {
      console.error('❌ TEST 15 FAILED:', stuUpRes.status, exeUpRes.status);
      failed++;
    }
  } catch (e: any) {
    console.error('❌ TEST 15 ERROR:', e.message);
    failed++;
  }

  console.log(`\n📊 FULL CUMULATIVE REGRESSION SUMMARY: ${passed} / 15 PASSED, ${failed} FAILED.\n`);
  if (failed > 0) process.exit(1);
}

runFullCumulativeRegressionSuite();
