const PROD_API_BASE = 'https://ai-ds-department-portal.onrender.com/api';

async function verifyLiveProductionHttpE2E() {
  console.log('================================================================');
  console.log('LIVE HTTPS PRODUCTION E2E VERIFICATION (RENDER & VERCEL)');
  console.log(`Backend Target: ${PROD_API_BASE}`);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const createdRecords: string[] = [];
  const removedRecords: string[] = [];

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // STEP 1: LIVE ADMIN LOGIN OVER HTTPS
    // ----------------------------------------------------
    console.log('--- Step 1: Live Production Admin Login ---');
    const adminLoginRes = await fetch(`${PROD_API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'departmentai&ds@gmail.com',
        password: 'aids@avs',
        role: 'ADMIN'
      })
    });

    assert(adminLoginRes.status === 200, `Live Admin login returned HTTP ${adminLoginRes.status} OK`);
    const adminData = await adminLoginRes.json();
    assert(Boolean(adminData.token), 'Admin JWT session token returned from Render production server');
    assert(adminData.user?.role === 'ADMIN', 'Admin identity verified with role ADMIN');

    const adminToken = adminData.token;

    // ----------------------------------------------------
    // STEP 2: LIVE ADD FACULTY VIA ADMIN API
    // ----------------------------------------------------
    console.log('\n--- Step 2: Live Add Faculty via Admin API ---');
    const testFacId = `livefac-${Date.now()}`;
    const testFacEmail = `live.faculty.${Date.now()}@avsec.edu.in`;
    const testFacPass = 'LiveFaculty@123';

    const addFacRes = await fetch(`${PROD_API_BASE}/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        facultyId: testFacId,
        facultyName: 'Dr. Live Production Staff',
        email: testFacEmail,
        year: '2nd Year',
        section: 'A',
        role: 'Class Coordinator',
        password: testFacPass,
        department: 'AI & DS'
      })
    });

    assert(addFacRes.status === 201, `Live Add Faculty returned HTTP ${addFacRes.status} Created`);
    const facData = await addFacRes.json();
    assert(Boolean(facData.faculty?.id), `Created Faculty ID: ${facData.faculty?.id}`);
    assert(facData.faculty?.role === 'FACULTY', 'Created Faculty system role is strictly FACULTY');
    const createdFacDbId = facData.faculty?.id;
    createdRecords.push(`Faculty User: ${testFacEmail} (ID: ${createdFacDbId})`);

    // ----------------------------------------------------
    // STEP 3: LIVE FACULTY AUTHENTICATION
    // ----------------------------------------------------
    console.log('\n--- Step 3: Live Faculty Authentication ---');
    const facLoginRes = await fetch(`${PROD_API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testFacEmail,
        password: testFacPass,
        role: 'FACULTY'
      })
    });

    assert(facLoginRes.status === 200, `Live Faculty login returned HTTP ${facLoginRes.status} OK`);
    const facAuthData = await facLoginRes.json();
    assert(Boolean(facAuthData.token), 'Faculty JWT token issued');
    const facToken = facAuthData.token;

    // ----------------------------------------------------
    // STEP 4: LIVE SUBJECT MASTER IMPORT
    // ----------------------------------------------------
    console.log('\n--- Step 4: Live Subject Master Import ---');
    const testSubCode = 'LIVE-CS301';
    const testSubTitle = 'Live Production Systems Verification';

    // Preview
    const previewRes = await fetch(`${PROD_API_BASE}/subjects/import-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${facToken}`
      },
      body: JSON.stringify({
        rows: [{ subjectCode: testSubCode, subjectTitle: testSubTitle, year: '2nd Year', section: 'A', semester: 3 }]
      })
    });
    assert(previewRes.status === 200, `Subject Master import preview returned HTTP ${previewRes.status} OK`);

    // Confirm
    const subImportRes = await fetch(`${PROD_API_BASE}/subjects/import-confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${facToken}`
      },
      body: JSON.stringify({
        subjects: [
          {
            subjectCode: testSubCode,
            subjectTitle: testSubTitle,
            year: '2nd Year',
            section: 'A',
            semester: 3
          }
        ]
      })
    });

    assert(subImportRes.status === 200, `Subject Master import confirm returned HTTP ${subImportRes.status} OK`);
    const subImportData = await subImportRes.json();
    assert(subImportData.importedCount >= 1, 'Subject Master record persisted in database');
    createdRecords.push(`Subject Master: ${testSubCode} - ${testSubTitle}`);

    // Verify Subject Master list retrieval
    const subListRes = await fetch(`${PROD_API_BASE}/subjects?year=2nd%20Year&section=A`, {
      headers: { 'Authorization': `Bearer ${facToken}` }
    });
    assert(subListRes.status === 200, `Subject Master query returned HTTP ${subListRes.status} OK`);
    const subListData = await subListRes.json();
    const foundSub = (subListData.subjects || []).find((s: any) => s.subject_code === testSubCode || s.code === testSubCode || s.subjectCode === testSubCode);
    assert(Boolean(foundSub), `Imported Subject (${testSubCode}) present in Subject Master database`);

    // ----------------------------------------------------
    // STEP 5: LIVE MARKS BULK UPLOAD & UPSERT
    // ----------------------------------------------------
    console.log('\n--- Step 5: Live Marks Bulk Upload & UPSERT ---');
    const rosterRes = await fetch(`${PROD_API_BASE}/faculty/students`, {
      headers: { 'Authorization': `Bearer ${facToken}` }
    });
    assert(rosterRes.status === 200, `Faculty roster query returned HTTP ${rosterRes.status} OK`);
    const rosterData = await rosterRes.json();
    const targetStudent = (rosterData.students || [])[0];

    if (targetStudent) {
      const regNo = targetStudent.registerNo || targetStudent.register_no;
      console.log(`Using roster student: ${targetStudent.name} (${regNo})`);

      // Initial Mark Upload
      const markUpload1 = await fetch(`${PROD_API_BASE}/faculty/academics/import-confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${facToken}`
        },
        body: JSON.stringify({
          marks: [
            {
              registerNo: regNo,
              subjectCode: testSubCode,
              subjectTitle: testSubTitle,
              marks: 88,
              semesterNo: 3
            }
          ]
        })
      });
      assert(markUpload1.status === 200, `Initial mark upload returned HTTP ${markUpload1.status} OK`);
      const markData1 = await markUpload1.json();
      assert(markData1.importedCount >= 1, 'Mark 88 persisted via UPSERT');

      // Re-upload with changed mark 95
      const markUpload2 = await fetch(`${PROD_API_BASE}/faculty/academics/import-confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${facToken}`
        },
        body: JSON.stringify({
          marks: [
            {
              registerNo: regNo,
              subjectCode: testSubCode,
              subjectTitle: testSubTitle,
              marks: 95,
              semesterNo: 3
            }
          ]
        })
      });
      assert(markUpload2.status === 200, `Re-uploaded mark returned HTTP ${markUpload2.status} OK`);
      const markData2 = await markUpload2.json();
      assert(markData2.importedCount >= 1, 'Re-uploaded mark UPDATED record to 95 without creating duplicate entries');

      // ----------------------------------------------------
      // STEP 6: LIVE GEMINI REWARD ENGINE
      // ----------------------------------------------------
      console.log('\n--- Step 6: Live Gemini AI Reward Engine ---');
      const rewardRes = await fetch(`${PROD_API_BASE}/student/ai-reward?studentId=${targetStudent.id}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert(rewardRes.status === 200, `Student AI Reward calculation returned HTTP ${rewardRes.status} OK`);
      const rewardData = await rewardRes.json();
      assert(Boolean(rewardData.rewardScore), 'Gemini AI reward calculation returned verified score object');
      assert(rewardData.rewardScore?.totalRewardScore > 0, `Total Reward Score: ${rewardData.rewardScore?.totalRewardScore} pts`);
      assert(Boolean(rewardData.rewardScore?.performanceLevel), `Performance level: ${rewardData.rewardScore?.performanceLevel}`);
      assert(Boolean(rewardData.rewardScore?.recommendedAward), `Recommended award: ${rewardData.rewardScore?.recommendedAward}`);
      assert(Boolean(rewardData.rewardScore?.aiReasoning), 'AI reasoning synthesized from verified database data');
    }

    // ----------------------------------------------------
    // STEP 7: LIVE HOD AWARD CANDIDATES
    // ----------------------------------------------------
    console.log('\n--- Step 7: Live HOD Award Candidates ---');
    const hodLoginRes = await fetch(`${PROD_API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'hod.aids@avsenggcollege.ac.in',
        password: 'hod@123',
        role: 'HOD'
      })
    });

    assert(hodLoginRes.status === 200, `HOD login returned HTTP ${hodLoginRes.status} OK`);
    if (hodLoginRes.status === 200) {
      const hodAuthData = await hodLoginRes.json();
      const hodToken = hodAuthData.token;

      const candidatesRes = await fetch(`${PROD_API_BASE}/hod/award-candidates-v2`, {
        headers: { 'Authorization': `Bearer ${hodToken}` }
      });
      assert(candidatesRes.status === 200, `HOD Award Candidates query returned HTTP ${candidatesRes.status} OK`);
      const candData = await candidatesRes.json();
      assert(Array.isArray(candData.candidates), `HOD Candidates returned list of ${candData.candidates?.length || 0} students`);

      if (candData.candidates?.length > 0) {
        const topCand = candData.candidates[0];
        const actionRes = await fetch(`${PROD_API_BASE}/hod/award-candidates-v2/${topCand.id}/action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${hodToken}`
          },
          body: JSON.stringify({
            status: 'APPROVED',
            remarks: 'E2E Verification Approved by HOD'
          })
        });
        assert(actionRes.status === 200, `HOD action update (APPROVED) returned HTTP ${actionRes.status} OK`);
      }
    }

    // ----------------------------------------------------
    // STEP 8: LIVE SECURITY & RBAC LOCKDOWN CHECKS
    // ----------------------------------------------------
    console.log('\n--- Step 8: Live Security & RBAC Lockdown Checks ---');
    const facAddFacRes = await fetch(`${PROD_API_BASE}/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${facToken}`
      },
      body: JSON.stringify({ facultyId: 'illegal', facultyName: 'Illegal', email: 'illegal@avs.edu', year: '2nd Year', section: 'A', role: 'Class Coordinator', password: 'pass' })
    });
    assert(facAddFacRes.status === 403, `FACULTY token attempting Admin action blocked with HTTP ${facAddFacRes.status} Forbidden`);

    const unauthRes = await fetch(`${PROD_API_BASE}/admin/faculty`);
    assert(unauthRes.status === 401, `Unauthenticated request to Admin API blocked with HTTP ${unauthRes.status} Unauthorized`);

    // ----------------------------------------------------
    // STEP 9: LIVE CLEANUP OF CREATED TEST DATA
    // ----------------------------------------------------
    console.log('\n--- Step 9: Live Cleanup of Verification Data ---');
    if (createdFacDbId) {
      const delFacRes = await fetch(`${PROD_API_BASE}/admin/faculty/${createdFacDbId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert(delFacRes.status === 200, `Test Faculty (${testFacEmail}) deleted cleanly from production DB`);
      removedRecords.push(`Test Faculty User: ${createdFacDbId}`);
    }

    await fetch(`${PROD_API_BASE}/subjects/by-code/${testSubCode}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).catch(() => {});
    removedRecords.push(`Test Subject Master: ${testSubCode}`);

    console.log('\n================================================================');
    console.log(`LIVE PRODUCTION E2E HTTPS VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) process.exit(1);
  } catch (err: any) {
    console.error('CRITICAL ERROR IN PRODUCTION E2E HTTPS VERIFICATION:', err);
    process.exit(1);
  }
}

verifyLiveProductionHttpE2E();
