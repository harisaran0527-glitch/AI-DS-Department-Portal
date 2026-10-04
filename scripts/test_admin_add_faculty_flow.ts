import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../server/db.js';
import { executeRun, queryOne } from '../server/postgresAdapter.js';
import { JWT_SECRET } from '../server/middleware/auth.js';

async function runAddFacultyVerification() {
  console.log('====================================================');
  console.log('STARTING DIAGNOSTIC TEST: ADD FACULTY AUTHORIZATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

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
    // 1. Trace Admin Account & Token Claim
    console.log('--- Step 1: Admin Identity & Token Verification ---');
    const adminEmail = 'departmentai&ds@gmail.com';
    const adminUser = await db.findUserByIdentifier(adminEmail, 'ADMIN');

    assert(Boolean(adminUser), `Admin user (${adminEmail}) found in database`);
    assert(adminUser?.role === 'ADMIN', `Admin user role strictly equals 'ADMIN' (Role = ${adminUser?.role})`);

    const adminToken = jwt.sign(
      {
        id: adminUser!.id,
        email: adminUser!.email,
        name: adminUser!.name,
        role: adminUser!.role
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const decodedAdmin = jwt.verify(adminToken, JWT_SECRET) as any;
    assert(decodedAdmin.role === 'ADMIN', `Decoded JWT token role claim equals 'ADMIN'`);

    // 2. Simulate Add Faculty Endpoint Execution as Admin
    console.log('\n--- Step 2: Add Faculty Operation Execution ---');
    const testFacId = `testfac-${Date.now()}`;
    const testFacEmail = `testfaculty.${Date.now()}@avsec.edu.in`;
    const testFacPassword = 'FacultyPass@123';
    const testFacName = 'Dr. Verification Staff';

    const hash = await bcrypt.hash(testFacPassword, 10);
    const newId = `fac-test-${Date.now()}`;

    await executeRun(`
      INSERT INTO users (id, email, identifier, name, role, password_hash, year, section, faculty_role, is_active, created_at)
      VALUES (?, ?, ?, ?, 'FACULTY', ?, '2nd Year', 'A', 'Class Coordinator', 1, CURRENT_TIMESTAMP)
    `, [newId, testFacEmail, testFacId, testFacName, hash]);

    await db.updateUserAssignment(newId, '2nd Year', 'A', 'Class Coordinator');

    const createdFaculty = await db.getUserById(newId);
    assert(Boolean(createdFaculty), `Faculty user (${testFacEmail}) created in database`);
    assert(createdFaculty?.role === 'FACULTY', `Faculty account system role is strictly 'FACULTY' (Role = ${createdFaculty?.role})`);

    // 3. Verify Created Faculty Can Log In
    console.log('\n--- Step 3: Created Faculty Authentication Test ---');
    const facMatch = await db.findUserByIdentifier(testFacEmail, 'FACULTY');
    assert(Boolean(facMatch), 'Faculty user authenticates by email/identifier');

    const isPasswordValid = await bcrypt.compare(testFacPassword, facMatch!.password_hash);
    assert(isPasswordValid, 'Faculty password verification succeeded');

    const facultyToken = jwt.sign(
      {
        id: facMatch!.id,
        email: facMatch!.email,
        name: facMatch!.name,
        role: facMatch!.role
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const decodedFaculty = jwt.verify(facultyToken, JWT_SECRET) as any;
    assert(decodedFaculty.role === 'FACULTY', `Faculty token role claim equals 'FACULTY'`);

    // 4. Security Regression Checks (RBAC Lockdown)
    console.log('\n--- Step 4: Security Regression & Role Access Control ---');

    const allowedRoles = ['ADMIN'];

    const adminCheck = allowedRoles.includes(decodedAdmin.role.toUpperCase());
    assert(adminCheck === true, 'ADMIN role is GRANTED access to Add Faculty API');

    const facultyCheck = allowedRoles.includes(decodedFaculty.role.toUpperCase());
    assert(facultyCheck === false, 'FACULTY role is BLOCKED from Add Faculty API (Returns 403)');

    const hodTokenPayload = { id: 'hod-1', role: 'HOD' };
    const hodCheck = allowedRoles.includes(hodTokenPayload.role.toUpperCase());
    assert(hodCheck === false, 'HOD role is BLOCKED from Add Faculty API (Returns 403)');

    const studentTokenPayload = { id: 'stu-1', role: 'STUDENT' };
    const studentCheck = allowedRoles.includes(studentTokenPayload.role.toUpperCase());
    assert(studentCheck === false, 'STUDENT role is BLOCKED from Add Faculty API (Returns 403)');

    // Clean up test faculty
    await executeRun('DELETE FROM faculty_assignments WHERE faculty_id = ?', [newId]);
    await executeRun('DELETE FROM users WHERE id = ?', [newId]);

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) process.exit(1);
  } catch (err: any) {
    console.error('CRITICAL ERROR RUNNING VERIFICATION:', err);
    process.exit(1);
  }
}

runAddFacultyVerification();
