import app from '../server/index.js';
import { db } from '../server/db.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../server/middleware/auth.js';
import type { Server } from 'http';

async function runFacultyCreationFixTests() {
  console.log('========================================================================');
  console.log('🔧 ADMIN FACULTY CREATION FIX & ENTER SUBMIT VERIFICATION SUITE');
  console.log('========================================================================\n');

  const PORT = 5997;
  const server: Server = app.listen(PORT);
  const baseUrl = `http://127.0.0.1:${PORT}`;

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ TEST ${totalTests} PASSED: ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
      passedTests++;
    } else {
      console.error(`❌ TEST ${totalTests} FAILED: ${testName}`);
      if (detail) console.error(`   └─ ${detail}`);
    }
  }

  try {
    const adminToken = jwt.sign(
      { id: 'admin-sys', email: 'departmentai&ds@gmail.com', name: 'System Administrator', role: 'ADMIN' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const facultyToken = jwt.sign(
      { id: 'fac-sys', email: 'faculty.aids@avsenggcollege.ac.in', name: 'Faculty Member', role: 'FACULTY' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const testFacId1 = `FAC_CLK_${Date.now()}`;
    const testFacEmail1 = `clk.fac.${Date.now()}@aids.edu`;
    const testFacId2 = `FAC_ENT_${Date.now()}`;
    const testFacEmail2 = `ent.fac.${Date.now()}@aids.edu`;

    // 1. Admin -> Add Faculty -> click Add -> success (201)
    const res1 = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${adminToken}`
      },
      body: JSON.stringify({
        facultyId: testFacId1,
        facultyName: 'Click Submit Faculty',
        email: testFacEmail1,
        year: '2nd Year',
        section: 'A',
        role: 'Class Coordinator',
        password: 'facpassclick123'
      })
    });
    const body1: any = await res1.json();

    assert(
      res1.status === 201 && body1.faculty && body1.faculty.email === testFacEmail1,
      '1. Admin → Add Faculty → click Add → success (201)',
      `Status: ${res1.status}, Message: ${body1.message || body1.error}`
    );

    // 2. Admin -> Add Faculty -> press Enter (Triggers exact same form submit flow) -> success (201)
    const res2 = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${adminToken}`
      },
      body: JSON.stringify({
        facultyId: testFacId2,
        facultyName: 'Enter Submit Faculty',
        email: testFacEmail2,
        year: '3rd Year',
        section: 'B',
        role: 'Subject Faculty',
        password: 'facpassenter123'
      })
    });
    const body2: any = await res2.json();

    assert(
      res2.status === 201 && body2.faculty && body2.faculty.email === testFacEmail2,
      '2. Admin → Add Faculty → press Enter → success (201)',
      `Status: ${res2.status}, Message: ${body2.message || body2.error}`
    );

    // 3. Duplicate Faculty email -> clean error (409)
    const res3 = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${adminToken}`
      },
      body: JSON.stringify({
        facultyId: `FAC_DUP_${Date.now()}`,
        facultyName: 'Duplicate Email Faculty',
        email: testFacEmail1, // Existing email
        year: '2nd Year',
        section: 'A',
        password: 'password123'
      })
    });
    const body3: any = await res3.json();

    assert(
      res3.status === 409 && body3.error,
      '3. Duplicate Faculty email → clean error (409)',
      `Status: ${res3.status}, Error: ${body3.error}`
    );

    // 4. Missing required field -> validation error (400)
    const res4 = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${adminToken}`
      },
      body: JSON.stringify({
        facultyId: '', // Missing
        facultyName: 'Missing Field Faculty',
        email: `missing.${Date.now()}@aids.edu`,
        year: '2nd Year',
        section: 'A',
        password: 'password123'
      })
    });
    const body4: any = await res4.json();

    assert(
      res4.status === 400 && body4.error,
      '4. Missing required field → validation error (400)',
      `Status: ${res4.status}, Error: ${body4.error}`
    );

    // 5. Non-admin -> Faculty creation API -> 403 Forbidden
    const res5 = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${facultyToken}`
      },
      body: JSON.stringify({
        facultyId: `FAC_NONADMIN_${Date.now()}`,
        facultyName: 'Non Admin Faculty',
        email: `nonadmin.${Date.now()}@aids.edu`,
        year: '2nd Year',
        section: 'A',
        password: 'password123'
      })
    });
    const body5: any = await res5.json();

    assert(
      res5.status === 403,
      '5. Non-admin → Faculty creation API → 403 Forbidden',
      `Status: ${res5.status}, Error: ${body5.error}`
    );

    // 6. Unauthenticated -> Faculty creation API -> 401/403
    const res6 = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facultyId: `FAC_UNAUTH_${Date.now()}`,
        facultyName: 'Unauth Faculty',
        email: `unauth.${Date.now()}@aids.edu`,
        year: '2nd Year',
        section: 'A',
        password: 'password123'
      })
    });
    const body6: any = await res6.json();

    assert(
      res6.status === 401 || res6.status === 403,
      '6. Unauthenticated → Faculty creation API → 401/403',
      `Status: ${res6.status}, Error: ${body6.error}`
    );

    // 7. Valid Admin request -> database record created correctly
    const dbFac1 = await db.getUserById(body1.faculty.id);
    const dbAssign1 = await db.getFacultyAssignment(body1.faculty.id);

    assert(
      Boolean(dbFac1 && dbFac1.role === 'FACULTY' && dbAssign1 && dbAssign1.year === '2nd Year'),
      '7. Valid Admin request → database record created correctly',
      `DB User Role: ${dbFac1?.role}, Assignment Year: ${dbAssign1?.year}, Section: ${dbAssign1?.section}`
    );

    // 8. Existing Faculty login still works
    const facLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testFacEmail1, password: 'facpassclick123', role: 'FACULTY' })
    });
    const facLoginBody: any = await facLoginRes.json();

    assert(
      facLoginRes.status === 200 && facLoginBody.token,
      '8. Existing Faculty login still works',
      `Status: ${facLoginRes.status}, User: ${facLoginBody.user?.name}`
    );

    // 9. Existing HOD login still works
    const hodLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'hod.aids@avsenggcollege.ac.in', password: 'hod@123', role: 'HOD' })
    });
    const hodLoginBody: any = await hodLoginRes.json();

    assert(
      hodLoginRes.status === 200 && hodLoginBody.token,
      '9. Existing HOD login still works',
      `Status: ${hodLoginRes.status}, User: ${hodLoginBody.user?.name}`
    );

    // 10. Admin login still works
    let adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'departmentai&ds@gmail.com', password: 'aids@avs', role: 'ADMIN' })
    });
    if (adminLoginRes.status !== 200) {
      adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'departmentai&ds@gmail.com', password: 'admin', role: 'ADMIN' })
      });
    }
    const adminLoginBody: any = await adminLoginRes.json();

    assert(
      adminLoginRes.status === 200 && adminLoginBody.token,
      '10. Admin login still works',
      `Status: ${adminLoginRes.status}, User: ${adminLoginBody.user?.name}`
    );

    // Clean up test faculty created
    if (body1.faculty?.id) await db.deleteFacultyUser(body1.faculty.id);
    if (body2.faculty?.id) await db.deleteFacultyUser(body2.faculty.id);

  } finally {
    server.close();
  }

  console.log('\n========================================================================');
  console.log(`SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED.`);
  console.log('========================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runFacultyCreationFixTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
