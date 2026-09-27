import bcrypt from 'bcryptjs';
import { db } from '../server/db';

const API_BASE = 'http://localhost:3000/api';

async function testStaffIsolation() {
  console.log('=== STARTING STAFF-WISE DATA ISOLATION VERIFICATION ===\n');

  const passHash = await bcrypt.hash('staff123', 10);
  const now = new Date().toISOString();

  // 1. SETUP TWO STAFF ACCOUNTS IN DATABASE
  const staffA_Id = 'fac-test-staff-a';
  const staffB_Id = 'fac-test-staff-b';

  // Cleanup old test accounts if exist
  db.deleteFacultyUser(staffA_Id);
  db.deleteFacultyUser(staffB_Id);

  db.createUser({
    id: staffA_Id,
    email: 'staff_a_test@aids.edu',
    identifier: 'STAFF_A_001',
    name: 'Dr. Staff A',
    role: 'FACULTY',
    passwordHash: passHash,
    year: '2nd Year',
    section: 'A',
    facultyRole: 'Class Coordinator',
    isActive: true
  });
  db.updateUserAssignment(staffA_Id, '2nd Year', 'A', 'Class Coordinator');

  db.createUser({
    id: staffB_Id,
    email: 'staff_b_test@aids.edu',
    identifier: 'STAFF_B_002',
    name: 'Prof. Staff B',
    role: 'FACULTY',
    passwordHash: passHash,
    year: '2nd Year',
    section: 'B',
    facultyRole: 'Class Coordinator',
    isActive: true
  });
  db.updateUserAssignment(staffB_Id, '2nd Year', 'B', 'Class Coordinator');

  console.log('[PASS]: Created Staff A (STAFF_A_001) and Staff B (STAFF_B_002).');

  // 2. SETUP DISINCT ASSIGNED STUDENTS FOR STAFF A & STAFF B
  const stuA_Id = 'stu-test-isolation-a';
  const stuB_Id = 'stu-test-isolation-b';

  db.deleteStudentUser(stuA_Id);
  db.deleteStudentUser(stuB_Id);

  db.createStudent({
    id: stuA_Id,
    registerNo: 'REG_ISO_A',
    name: 'Student Assigned to Staff A',
    email: 'stu_iso_a@aids.edu',
    year: '2nd Year',
    section: 'A',
    batch: '2023-2027',
    cgpa: 8.8,
    createdByFacultyId: staffA_Id,
    facultyWorkspaceId: staffA_Id
  });

  db.createStudent({
    id: stuB_Id,
    registerNo: 'REG_ISO_B',
    name: 'Student Assigned to Staff B',
    email: 'stu_iso_b@aids.edu',
    year: '2nd Year',
    section: 'B',
    batch: '2023-2027',
    cgpa: 9.1,
    createdByFacultyId: staffB_Id,
    facultyWorkspaceId: staffB_Id
  });

  console.log('[PASS]: Created Student ISO_A (owned by Staff A) and Student ISO_B (owned by Staff B).\n');

  // 3. LOGIN AS STAFF A
  console.log('--- Logging in as Staff A (STAFF_A_001) ---');
  const loginARes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'STAFF_A_001', password: 'staff123', role: 'FACULTY' })
  });
  const loginAData = await loginARes.json();
  const tokenA = loginAData.token;

  // Staff A Roster Check
  const rosterARes = await fetch(`${API_BASE}/faculty/students`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const rosterAData = await rosterARes.json();
  const hasStuA_In_A = rosterAData.students.some((s: any) => s.id === stuA_Id);
  const hasStuB_In_A = rosterAData.students.some((s: any) => s.id === stuB_Id);

  if (hasStuA_In_A && !hasStuB_In_A) {
    console.log(`[PASS]: Staff A workspace roster contains ONLY Student ISO_A (Count: ${rosterAData.count}). Student ISO_B is isolated.`);
  } else {
    throw new Error(`[FAIL]: Staff A roster contamination! hasStuA=${hasStuA_In_A}, hasStuB=${hasStuB_In_A}`);
  }

  // Staff A attempts cross-staff access to Staff B's student 360 profile
  const cross360Res = await fetch(`${API_BASE}/faculty/students/${stuB_Id}/360`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  if (cross360Res.status === 403) {
    const errData = await cross360Res.json();
    console.log(`[PASS]: Staff A access to Staff B's student 360 profile correctly rejected with 403 Forbidden: "${errData.error}"`);
  } else {
    throw new Error(`[FAIL]: Expected 403 Forbidden for cross-staff access attempt, got ${cross360Res.status}`);
  }

  // Staff A attempts cross-staff profile update on Staff B's student
  const crossUpdateRes = await fetch(`${API_BASE}/faculty/students/${stuB_Id}/update-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ cgpa: 5.0 })
  });
  if (crossUpdateRes.status === 403) {
    console.log(`[PASS]: Staff A profile update mutation on Staff B's student correctly rejected with 403 Forbidden.`);
  } else {
    throw new Error(`[FAIL]: Expected 403 Forbidden for cross-staff update attempt, got ${crossUpdateRes.status}`);
  }

  // 4. LOGIN AS STAFF B
  console.log('\n--- Logging in as Staff B (STAFF_B_002) ---');
  const loginBRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'STAFF_B_002', password: 'staff123', role: 'FACULTY' })
  });
  const loginBData = await loginBRes.json();
  const tokenB = loginBData.token;

  // Staff B Roster Check
  const rosterBRes = await fetch(`${API_BASE}/faculty/students`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const rosterBData = await rosterBRes.json();
  const hasStuB_In_B = rosterBData.students.some((s: any) => s.id === stuB_Id);
  const hasStuA_In_B = rosterBData.students.some((s: any) => s.id === stuA_Id);

  if (hasStuB_In_B && !hasStuA_In_B) {
    console.log(`[PASS]: Staff B workspace roster contains ONLY Student ISO_B (Count: ${rosterBData.count}). Student ISO_A is isolated.`);
  } else {
    throw new Error(`[FAIL]: Staff B roster contamination! hasStuB=${hasStuB_In_B}, hasStuA=${hasStuA_In_B}`);
  }

  // Staff B attempts cross-staff access to Staff A's student
  const crossB360Res = await fetch(`${API_BASE}/faculty/students/${stuA_Id}/360`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  if (crossB360Res.status === 403) {
    console.log(`[PASS]: Staff B access to Staff A's student profile correctly rejected with 403 Forbidden.`);
  } else {
    throw new Error(`[FAIL]: Expected 403 Forbidden for Staff B cross-staff access attempt, got ${crossB360Res.status}`);
  }

  // 5. VERIFY ADMIN AND HOD ACCESS
  console.log('\n--- Verifying HOD & Admin Department-Wide Access ---');
  const loginHodRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'hod', password: 'hod@123', role: 'HOD' })
  });
  const tokenHod = (await loginHodRes.json()).token;

  const hod360ARes = await fetch(`${API_BASE}/hod/students/${stuA_Id}/360`, {
    headers: { Authorization: `Bearer ${tokenHod}` }
  });
  const hod360BRes = await fetch(`${API_BASE}/hod/students/${stuB_Id}/360`, {
    headers: { Authorization: `Bearer ${tokenHod}` }
  });

  if (hod360ARes.status === 200 && hod360BRes.status === 200) {
    console.log('[PASS]: HOD successfully accesses both Student ISO_A and Student ISO_B profiles (Department-wide view).');
  } else {
    throw new Error(`[FAIL]: HOD access error: A=${hod360ARes.status}, B=${hod360BRes.status}`);
  }

  console.log('\n=== ALL STAFF-WISE DATA ISOLATION TESTS PASSED 100% SUCCESSFULLY ===');
}

testStaffIsolation().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
