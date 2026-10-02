import app from '../server/index.js';
import { db } from '../server/db.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../server/middleware/auth.js';
import type { Server } from 'http';

async function runSecurityAuditTests() {
  console.log('========================================================================');
  console.log('🔒 ADMIN USER CREATION SECURITY & STRICT ROLE CONTROL AUDIT TEST SUITE');
  console.log('========================================================================\n');

  const TEST_PORT = 5999;
  const server: Server = app.listen(TEST_PORT);
  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

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
    // Session JWT tokens for test personas
    const adminToken = jwt.sign(
      { id: 'admin-sys', email: 'departmentai&ds@gmail.com', name: 'System Administrator', role: 'ADMIN' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const facultyToken = jwt.sign(
      { id: 'fac-sys', email: 'faculty.aids@avsenggcollege.ac.in', name: 'Faculty Member', role: 'FACULTY', assignedYear: '2nd Year', assignedSection: 'A' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const hodToken = jwt.sign(
      { id: 'hod-sys', email: 'hod.aids@avsenggcollege.ac.in', name: 'Head of Department', role: 'HOD' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const studentToken = jwt.sign(
      { id: 'stu-sys', email: 'student.aids@avsenggcollege.ac.in', name: 'Sample Student', role: 'STUDENT', registerNo: '730123243001' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const testFacId = `TEST_FAC_${Date.now()}`;
    const testFacEmail = `test.faculty.${Date.now()}@aids.edu`;
    const testHodId = `TEST_HOD_${Date.now()}`;
    const testHodEmail = `test.hod.${Date.now()}@aids.edu`;

    console.log('--- TEST GROUP 1: AUTHORIZED ADMIN CREATION FLOWS ---');

    // A. Admin login -> create Faculty -> PASS
    const resA = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${adminToken}`
      },
      body: JSON.stringify({
        facultyId: testFacId,
        facultyName: 'Dr. Test Faculty',
        email: testFacEmail,
        year: '3rd Year',
        section: 'B',
        role: 'Class Coordinator',
        password: 'testfaculty123'
      })
    });
    const bodyA: any = await resA.json();

    assert(
      resA.status === 201 && bodyA.faculty && bodyA.faculty.email === testFacEmail,
      'A. Admin login → create Faculty → PASS (201 Created)',
      `Status: ${resA.status}, Message: ${bodyA.message || bodyA.error}`
    );

    // B. Admin login -> create HOD -> PASS
    const resB = await fetch(`${baseUrl}/api/admin/hod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${adminToken}`
      },
      body: JSON.stringify({
        hodId: testHodId,
        hodName: 'Dr. Test HOD',
        email: testHodEmail,
        password: 'testhod123',
        isActive: false
      })
    });
    const bodyB: any = await resB.json();

    assert(
      resB.status === 201 && bodyB.hod && bodyB.hod.email === testHodEmail,
      'B. Admin login → create HOD → PASS (201 Created)',
      `Status: ${resB.status}, Message: ${bodyB.message || bodyB.error}`
    );

    console.log('\n--- TEST GROUP 2: UNAUTHORIZED NON-ADMIN CREATION ATTEMPTS (STRICT 403/401 BLOCKS) ---');

    // C. Faculty login -> create Faculty -> 403
    const resC = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${facultyToken}`
      },
      body: JSON.stringify({
        facultyId: `UNAUTH_FAC_${Date.now()}`,
        facultyName: 'Unauth Faculty',
        email: `unauth.fac.${Date.now()}@aids.edu`,
        year: '2nd Year',
        section: 'A',
        password: 'password123'
      })
    });
    const bodyC: any = await resC.json();

    assert(
      resC.status === 403,
      'C. Faculty login → create Faculty → 403 Forbidden',
      `Status: ${resC.status}, Error: ${bodyC.error}`
    );

    // D. Faculty login -> create HOD -> 403
    const resD = await fetch(`${baseUrl}/api/admin/hod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${facultyToken}`
      },
      body: JSON.stringify({
        hodId: `UNAUTH_HOD_${Date.now()}`,
        hodName: 'Unauth HOD',
        email: `unauth.hod.${Date.now()}@aids.edu`,
        password: 'password123',
        isActive: false
      })
    });
    const bodyD: any = await resD.json();

    assert(
      resD.status === 403,
      'D. Faculty login → create HOD → 403 Forbidden',
      `Status: ${resD.status}, Error: ${bodyD.error}`
    );

    // E. HOD login -> create Faculty -> 403
    const resE = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${hodToken}`
      },
      body: JSON.stringify({
        facultyId: `HOD_FAC_${Date.now()}`,
        facultyName: 'HOD Fac Creation',
        email: `hod.fac.${Date.now()}@aids.edu`,
        year: '2nd Year',
        section: 'A',
        password: 'password123'
      })
    });
    const bodyE: any = await resE.json();

    assert(
      resE.status === 403,
      'E. HOD login → create Faculty → 403 Forbidden',
      `Status: ${resE.status}, Error: ${bodyE.error}`
    );

    // F. HOD login -> create HOD -> 403
    const resF = await fetch(`${baseUrl}/api/admin/hod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${hodToken}`
      },
      body: JSON.stringify({
        hodId: `HOD_HOD_${Date.now()}`,
        hodName: 'HOD HOD Creation',
        email: `hod.hod.${Date.now()}@aids.edu`,
        password: 'password123',
        isActive: false
      })
    });
    const bodyF: any = await resF.json();

    assert(
      resF.status === 403,
      'F. HOD login → create HOD → 403 Forbidden',
      `Status: ${resF.status}, Error: ${bodyF.error}`
    );

    // G. Student login -> create Faculty -> 403
    const resG = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${studentToken}`
      },
      body: JSON.stringify({
        facultyId: `STU_FAC_${Date.now()}`,
        facultyName: 'Student Fac Creation',
        email: `stu.fac.${Date.now()}@aids.edu`,
        year: '2nd Year',
        section: 'A',
        password: 'password123'
      })
    });
    const bodyG: any = await resG.json();

    assert(
      resG.status === 403,
      'G. Student login → create Faculty → 403 Forbidden',
      `Status: ${resG.status}, Error: ${bodyG.error}`
    );

    // H. Student login -> create HOD -> 403
    const resH = await fetch(`${baseUrl}/api/admin/hod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${studentToken}`
      },
      body: JSON.stringify({
        hodId: `STU_HOD_${Date.now()}`,
        hodName: 'Student HOD Creation',
        email: `stu.hod.${Date.now()}@aids.edu`,
        password: 'password123',
        isActive: false
      })
    });
    const bodyH: any = await resH.json();

    assert(
      resH.status === 403,
      'H. Student login → create HOD → 403 Forbidden',
      `Status: ${resH.status}, Error: ${bodyH.error}`
    );

    // I. Unauthenticated request -> create Faculty -> 401/403
    const resI = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facultyId: `NOAUTH_FAC_${Date.now()}`,
        facultyName: 'No Auth Faculty',
        email: `noauth.fac.${Date.now()}@aids.edu`,
        year: '2nd Year',
        section: 'A',
        password: 'password123'
      })
    });
    const bodyI: any = await resI.json();

    assert(
      resI.status === 401 || resI.status === 403,
      'I. Unauthenticated request → create Faculty → 401/403 Blocked',
      `Status: ${resI.status}, Error: ${bodyI.error}`
    );

    // J. Direct API / Postman request with non-admin JWT -> 403
    const resJ = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${facultyToken}`
      },
      body: JSON.stringify({
        facultyId: `POSTMAN_FAC_${Date.now()}`,
        facultyName: 'Postman Direct Request',
        email: `postman.fac.${Date.now()}@aids.edu`,
        year: '2nd Year',
        section: 'A',
        password: 'password123'
      })
    });
    const bodyJ: any = await resJ.json();

    assert(
      resJ.status === 403,
      'J. Direct API/Postman request with non-admin JWT → 403 Forbidden',
      `Status: ${resJ.status}, Error: ${bodyJ.error}`
    );

    console.log('\n--- TEST GROUP 3: ROLE ESCALATION & DUPLICATE PROTECTION ---');

    // K. Attempt role escalation
    const resK = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${adminToken}`
      },
      body: JSON.stringify({
        facultyId: `ESCALATE_${Date.now()}`,
        facultyName: 'Role Escalation Attempt',
        email: `escalate.${Date.now()}@aids.edu`,
        year: '2nd Year',
        section: 'A',
        role: 'ADMIN', // Client trying to pass ADMIN as role
        password: 'password123'
      })
    });
    const bodyK: any = await resK.json();

    let escalateBlocked = false;
    if (resK.status === 201 && bodyK.faculty?.id) {
      const created = await db.getUserById(bodyK.faculty.id);
      escalateBlocked = created?.role === 'FACULTY' && created?.faculty_role !== 'ADMIN';
      await db.deleteFacultyUser(bodyK.faculty.id);
    }

    assert(
      escalateBlocked,
      'K. Attempt role escalation → Role in users table remains strictly FACULTY',
      `Status: ${resK.status}, Role in DB: FACULTY`
    );

    // Test Duplicate Email Protection
    const resDupEmail = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${adminToken}`
      },
      body: JSON.stringify({
        facultyId: `UNIQUE_ID_${Date.now()}`,
        facultyName: 'Duplicate Email Test',
        email: testFacEmail, // Existing email from Test A
        year: '2nd Year',
        section: 'A',
        password: 'password123'
      })
    });
    const bodyDupEmail: any = await resDupEmail.json();

    assert(
      resDupEmail.status === 409,
      'Duplicate Email Protection → 409 Conflict',
      `Status: ${resDupEmail.status}, Error: ${bodyDupEmail.error}`
    );

    // Test Duplicate ID Protection
    const resDupId = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${adminToken}`
      },
      body: JSON.stringify({
        facultyId: testFacId, // Existing ID from Test A
        facultyName: 'Duplicate ID Test',
        email: `unique.email.${Date.now()}@aids.edu`,
        year: '2nd Year',
        section: 'A',
        password: 'password123'
      })
    });
    const bodyDupId: any = await resDupId.json();

    assert(
      resDupId.status === 409,
      'Duplicate Faculty ID Protection → 409 Conflict',
      `Status: ${resDupId.status}, Error: ${bodyDupId.error}`
    );

    console.log('\n--- TEST GROUP 4: EXISTING ACCOUNT LOGINS & CLEANUP ---');

    // L. Existing Admin/Faculty/HOD login still works
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

    const hodLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'hod.aids@avsenggcollege.ac.in', password: 'hod@123', role: 'HOD' })
    });

    // Create a verified Faculty account via Admin to verify Faculty Login capability
    const tempFacEmail = `login.test.fac.${Date.now()}@aids.edu`;
    const tempFacId = `FAC_LOGIN_${Date.now()}`;
    const createFacRes = await fetch(`${baseUrl}/api/admin/faculty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aids_session_token=${adminToken}`
      },
      body: JSON.stringify({
        facultyId: tempFacId,
        facultyName: 'Login Test Faculty',
        email: tempFacEmail,
        year: '2nd Year',
        section: 'A',
        password: 'facultytestpass123'
      })
    });
    const createFacBody: any = await createFacRes.json();

    const facLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: tempFacEmail, password: 'facultytestpass123', role: 'FACULTY' })
    });

    assert(
      adminLoginRes.status === 200 && facLoginRes.status === 200 && hodLoginRes.status === 200,
      'L. Existing Admin, Faculty, and HOD logins still work correctly',
      `Admin: ${adminLoginRes.status}, Faculty: ${facLoginRes.status}, HOD: ${hodLoginRes.status}`
    );

    // Cleanup temp faculty created for Test L
    if (createFacBody.faculty?.id) {
      await db.deleteFacultyUser(createFacBody.faculty.id);
    }

    // Cleanup test accounts created during Test A and B
    if (bodyA.faculty?.id) {
      await db.deleteFacultyUser(bodyA.faculty.id);
    }
    if (bodyB.hod?.id) {
      await db.deleteHODUser(bodyB.hod.id);
    }
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

runSecurityAuditTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
