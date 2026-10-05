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

    // 1. Admin Login & Authentication Check (Read-Only)
    console.log('\n--- Test 1: Admin Authentication Verification ---');
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

    // 2. Invalid Credentials Handling (Read-Only)
    console.log('\n--- Test 2: Invalid Credentials Handling ---');
    const wrongRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin', password: 'wrongPassword123', role: 'ADMIN' })
    });
    const wrongData = await wrongRes.json() as any;
    assert(wrongRes.status === 401, 'Wrong password returns 401 Unauthorized');
    assert(wrongData.error.includes('Invalid credentials'), 'Error message says Invalid credentials');

    // 3. Read-Only Query Verification for Registered Users
    console.log('\n--- Test 3: Read-Only Database User Verification ---');
    const adminRecord = await db.findUserByIdentifier('admin', 'ADMIN');
    assert(Boolean(adminRecord && adminRecord.role === 'ADMIN'), 'Admin record verified directly in database');

    console.log('\n--- Test 4: Check Optional Registered Roles (Read-Only) ---');
    const facultyRecord = await db.findUserByIdentifier('faculty', 'FACULTY');
    if (facultyRecord) {
      assert(facultyRecord.role === 'FACULTY', 'Registered faculty account verified');
    } else {
      console.log('[SKIP] No faculty account provisioned yet (strictly read-only mode).');
    }

    const hodRecord = await db.findUserByIdentifier('hod', 'HOD');
    if (hodRecord) {
      assert(hodRecord.role === 'HOD', 'Registered HOD account verified');
    } else {
      console.log('[SKIP] No HOD account provisioned yet (strictly read-only mode).');
    }

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
