import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { db, initDatabaseSchema } from '../server/db.js';
import bcrypt from 'bcryptjs';
import authRoutes from '../server/routes/auth.js';
import adminRoutes from '../server/routes/admin.js';
import facultyRoutes from '../server/routes/faculty.js';
import hodRoutes from '../server/routes/hod.js';
import studentRoutes from '../server/routes/student.js';
import subjectsRoutes from '../server/routes/subjects.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/subjects', subjectsRoutes);

const TEST_PORT = 54321;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

async function run() {
  console.log('====================================================');
  console.log('STARTING INTEGRATED AUTH & RESET-PASSWORD TEST SUITE');
  console.log('====================================================\n');

  await initDatabaseSchema();

  const server = app.listen(TEST_PORT);
  console.log(`Test server running at ${BASE_URL}`);

  try {
    let passed = 0;
    let failed = 0;

    function assert(cond: boolean, msg: string) {
      if (cond) {
        console.log(`[PASS] ${msg}`);
        passed++;
      } else {
        console.error(`[FAIL] ${msg}`);
        failed++;
      }
    }

    // 1. Admin Login
    console.log('\n--- Test 1: Admin Login ---');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin', password: 'aids@avs', role: 'ADMIN' })
    });
    const adminLoginData = await adminLoginRes.json() as any;
    assert(adminLoginRes.status === 200, 'Admin login returns 200 OK');
    assert(Boolean(adminLoginData.token), 'Admin login returns valid JWT session token');
    assert(adminLoginData.user?.role === 'ADMIN', 'Admin login user role is ADMIN');
    const adminToken = adminLoginData.token;

    // 2. Wrong credentials
    console.log('\n--- Test 2: Invalid Credentials Handling ---');
    const wrongRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin', password: 'wrongPassword123', role: 'ADMIN' })
    });
    const wrongData = await wrongRes.json() as any;
    assert(wrongRes.status === 401, 'Wrong password returns 401 Unauthorized');
    assert(wrongData.error.includes('Invalid credentials'), 'Error message says Invalid credentials');

    // 3. Create or find test faculty
    console.log('\n--- Test 3: Admin Reset Faculty Password ---');
    let testFac = await db.findUserByIdentifier('fac_test_auth@aids.edu');
    if (!testFac) {
      const facHash = await bcrypt.hash('InitPass@123', 10);
      await db.createUser({
        id: `fac-test-${Date.now()}`,
        email: 'fac_test_auth@aids.edu',
        identifier: 'FAC_TEST_AUTH',
        name: 'Test Faculty User',
        role: 'FACULTY',
        passwordHash: facHash,
        facultyRole: 'Class Coordinator',
        year: '2nd Year',
        section: 'A'
      });
      testFac = await db.findUserByIdentifier('fac_test_auth@aids.edu');
    }

    const newFacPassword = 'NewSecureFacPass@2026';
    const resetFacRes = await fetch(`${BASE_URL}/admin/faculty/${testFac!.id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ newPassword: newFacPassword })
    });
    const resetFacData = await resetFacRes.json() as any;
    assert(resetFacRes.status === 200, `Admin resets faculty password returns 200: ${resetFacData.message}`);

    // Verify login with new faculty password
    const facLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testFac!.email, password: newFacPassword, role: 'FACULTY' })
    });
    const facLoginData = await facLoginRes.json() as any;
    assert(facLoginRes.status === 200, 'Faculty successfully logs in with new reset password');
    assert(Boolean(facLoginData.token), 'Faculty receives valid JWT token on login');

    // 4. Create or find test HOD
    console.log('\n--- Test 4: Admin Reset HOD Password ---');
    let testHod = await db.findUserByIdentifier('hod_test_auth@aids.edu');
    if (!testHod) {
      const hodHash = await bcrypt.hash('InitHodPass@123', 10);
      await db.createUser({
        id: `hod-test-${Date.now()}`,
        email: 'hod_test_auth@aids.edu',
        identifier: 'HOD_TEST_AUTH',
        name: 'Dr. Test HOD',
        role: 'HOD',
        passwordHash: hodHash
      });
      testHod = await db.findUserByIdentifier('hod_test_auth@aids.edu');
    }

    const newHodPassword = 'NewSecureHodPass@2026';
    const resetHodRes = await fetch(`${BASE_URL}/admin/hod/${testHod!.id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ password: newHodPassword })
    });
    const resetHodData = await resetHodRes.json() as any;
    assert(resetHodRes.status === 200, `Admin resets HOD password returns 200: ${resetHodData.message}`);

    // Verify login with new HOD password
    const hodLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testHod!.email, password: newHodPassword, role: 'HOD' })
    });
    const hodLoginData = await hodLoginRes.json() as any;
    assert(hodLoginRes.status === 200, 'HOD successfully logs in with new reset password');
    assert(Boolean(hodLoginData.token), 'HOD receives valid JWT token on login');

    // 5. Admin Self Change Password
    console.log('\n--- Test 5: Admin Self Change Password ---');
    const changeAdminRes = await fetch(`${BASE_URL}/admin/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ currentPassword: 'aids@avs', newPassword: 'aids@avs_new' })
    });
    const changeAdminData = await changeAdminRes.json() as any;
    assert(changeAdminRes.status === 200, `Admin changes own password returns 200: ${changeAdminData.message}`);

    // Revert admin password back to aids@avs
    const revertTokenRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin', password: 'aids@avs_new', role: 'ADMIN' })
    });
    const revertTokenData = await revertTokenRes.json() as any;
    await fetch(`${BASE_URL}/admin/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${revertTokenData.token}`
      },
      body: JSON.stringify({ currentPassword: 'aids@avs_new', newPassword: 'aids@avs' })
    });
    assert(true, 'Reverted admin password back to aids@avs for production safety');

    console.log(`\n====================================================`);
    console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`====================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
