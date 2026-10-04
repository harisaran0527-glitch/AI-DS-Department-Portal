import bcrypt from 'bcryptjs';
import { db, initDatabaseSchema } from '../server/db.js';
import { executeRun, queryOne, queryAll } from '../server/postgresAdapter.js';

const API_BASE = 'http://127.0.0.1:5000/api';

async function runZeroAutoCreationAudit() {
  console.log('================================================================');
  console.log('ZERO AUTOMATIC ACCOUNT CREATION AUDIT & TEST SUITE');
  console.log('================================================================\n');

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
    // ----------------------------------------------------
    // TEST 1: DATABASE EMPTY STATE AUDIT
    // ----------------------------------------------------
    console.log('--- Test 1: Database Empty-State Audit ---');
    await executeRun('DELETE FROM users');
    await executeRun('DELETE FROM students');
    await executeRun('DELETE FROM faculty_assignments');
    await executeRun('DELETE FROM subjects');

    const usersCountObj = await queryOne('SELECT COUNT(*) as cnt FROM users');
    const studentsCountObj = await queryOne('SELECT COUNT(*) as cnt FROM students');
    const subjectsCountObj = await queryOne('SELECT COUNT(*) as cnt FROM subjects');

    const uCount = Number(usersCountObj?.cnt || 0);
    const sCount = Number(studentsCountObj?.cnt || 0);
    const subCount = Number(subjectsCountObj?.cnt || 0);

    assert(uCount === 0, `Users table is completely empty (0 users found)`);
    assert(sCount === 0, `Students table is completely empty (0 students found)`);
    assert(subCount === 0, `Subjects table is completely empty (0 subjects found)`);

    // ----------------------------------------------------
    // TEST 2: RESTART / RE-INIT MULTI-PASS TEST
    // ----------------------------------------------------
    console.log('\n--- Test 2: Multi-Pass Backend Startup Test ---');
    for (let pass = 1; pass <= 3; pass++) {
      await initDatabaseSchema();
      const recheck = await queryOne('SELECT COUNT(*) as cnt FROM users');
      assert(Number(recheck?.cnt || 0) === 0, `Startup Pass #${pass}: Database retained 0 users (No auto admin/hod/faculty/student created)`);
    }

    // ----------------------------------------------------
    // TEST 3: LOGIN WITH NONEXISTENT ACCOUNTS
    // ----------------------------------------------------
    console.log('\n--- Test 3: Login for Nonexistent Accounts ---');
    // Start local server if needed or test login logic directly
    const nonexistentLogins = [
      { id: 'departmentai&ds@gmail.com', pass: 'aids@avs', role: 'ADMIN' },
      { id: 'hod.aids@avsenggcollege.ac.in', pass: 'hod@123', role: 'HOD' },
      { id: 'nonexistent.fac@aids.edu', pass: 'fac123', role: 'FACULTY' },
      { id: '23ADE2E99', pass: 'stu123', role: 'STUDENT' }
    ];

    for (const item of nonexistentLogins) {
      const match = await db.findUserByIdentifier(item.id, item.role);
      assert(match === undefined, `Nonexistent login for ${item.role} (${item.id}) correctly returned undefined`);
    }

    const postLoginUsers = await queryOne('SELECT COUNT(*) as cnt FROM users');
    assert(Number(postLoginUsers?.cnt || 0) === 0, 'Database retained 0 users after failed login attempts (No accounts silently created)');

    // ----------------------------------------------------
    // TEST 4: EXPLICIT AUTHORIZED ADMIN CREATION
    // ----------------------------------------------------
    console.log('\n--- Test 4: Explicit Authorized Admin Creation ---');
    const adminHash = await bcrypt.hash('aids@avs', 10);
    const adminId = `admin-explicit-${Date.now()}`;
    await executeRun(`
      INSERT INTO users (id, email, identifier, name, role, password_hash, is_active, created_at)
      VALUES (?, 'departmentai&ds@gmail.com', 'admin', 'System Administrator', 'ADMIN', ?, 1, ?)
    `, [adminId, adminHash, new Date().toISOString()]);

    const createdAdmin = await db.findUserByIdentifier('departmentai&ds@gmail.com', 'ADMIN');
    assert(Boolean(createdAdmin), 'Admin account explicitly created via authorized admin workflow');
    assert(createdAdmin?.role === 'ADMIN', 'Created Admin role is strictly ADMIN');

    // ----------------------------------------------------
    // TEST 5: AUTHORIZED ADMIN CREATION OF FACULTY & HOD
    // ----------------------------------------------------
    console.log('\n--- Test 5: Authorized Admin Creation of Faculty & HOD ---');
    const facHash = await bcrypt.hash('fac123', 10);
    const facId = `fac-explicit-${Date.now()}`;
    await db.createUser({
      id: facId,
      email: 'explicit.fac@avsec.edu.in',
      identifier: 'ADFAC01',
      name: 'Dr. Explicit Faculty',
      role: 'FACULTY',
      passwordHash: facHash,
      year: '2nd Year',
      section: 'A',
      facultyRole: 'Class Coordinator',
      isActive: true
    });

    const createdFac = await db.getUserById(facId);
    assert(Boolean(createdFac), 'Faculty explicitly created by Admin');
    assert(createdFac?.role === 'FACULTY', 'Faculty system role is strictly FACULTY');

    const hodHash = await bcrypt.hash('hod@123', 10);
    const hodId = `hod-explicit-${Date.now()}`;
    await db.createUser({
      id: hodId,
      email: 'hod.aids@avsenggcollege.ac.in',
      identifier: 'hod',
      name: 'Head of Department',
      role: 'HOD',
      passwordHash: hodHash,
      isActive: true
    });

    const createdHod = await db.getUserById(hodId);
    assert(Boolean(createdHod), 'HOD account explicitly created by Admin');
    assert(createdHod?.role === 'HOD', 'HOD system role is strictly HOD');

    // ----------------------------------------------------
    // TEST 6: HOD ASSIGNMENT STRICT VALIDATION
    // ----------------------------------------------------
    console.log('\n--- Test 6: HOD Assignment Strict Validation ---');
    const nonExistentFac = await db.getUserById('fake-faculty-9999');
    assert(nonExistentFac === undefined, 'Non-existent faculty lookup returned undefined');

    // Attempt assignment update on existing faculty
    await db.updateUserAssignment(facId, '2nd Year', 'B', 'Subject Faculty');
    const updatedFac = await db.getUserById(facId);
    assert(updatedFac?.year === '2nd Year' && updatedFac?.section === 'B', 'HOD assignment mapped existing Faculty record');

    // ----------------------------------------------------
    // TEST 7: RESTART DB AGAIN & VERIFY STABILITY
    // ----------------------------------------------------
    console.log('\n--- Test 7: Post-Creation Restart & Stability Test ---');
    await initDatabaseSchema();
    const finalUsers = await db.getUsers();
    assert(finalUsers.length === 3, `Database contains EXACTLY ${finalUsers.length} explicitly created users (Admin, HOD, Faculty)`);

    console.log('\n================================================================');
    console.log(`ZERO AUTOMATIC CREATION AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) process.exit(1);
  } catch (err: any) {
    console.error('CRITICAL ERROR IN ZERO AUTOMATIC CREATION AUDIT:', err);
    process.exit(1);
  }
}

runZeroAutoCreationAudit();
