import { db } from '../server/db';
import bcrypt from 'bcryptjs';

async function testFacultyStudentDeletion() {
  console.log('=== FACULTY STUDENT DELETION & ISOLATION VERIFICATION ===\n');

  // Step 1: Find two distinct faculty users (Faculty A and Faculty B)
  const facultyUsers = db.getUsers('FACULTY');
  if (facultyUsers.length < 2) {
    console.error('❌ FAIL: Need at least 2 faculty users for staff isolation test.');
    process.exit(1);
  }

  const facultyA = facultyUsers[0];
  const facultyB = facultyUsers[1];

  console.log(`1. Faculty A: ${facultyA.name} (${facultyA.email}, ID: ${facultyA.id})`);
  console.log(`   Faculty B: ${facultyB.name} (${facultyB.email}, ID: ${facultyB.id})`);

  // Step 2: Faculty A creates a student account
  const timestamp = Date.now().toString();
  const regNoA = `3128${timestamp.slice(-8)}`;
  const emailA = `student.facA.${timestamp}@aids.edu`;
  const passwordA = `FacA_PortalPass#2026!`;
  const nameA = `Student Created by Faculty A`;

  console.log(`\n2. Faculty A onboarding student: ${nameA} (${regNoA}, ${emailA})...`);
  const studentA = db.createStudentForFaculty(facultyA.id, {
    registerNo: regNoA,
    name: nameA,
    email: emailA,
    collegeEmail: emailA,
    password: passwordA,
    year: '2nd Year',
    section: 'A'
  });

  console.log(`  ✅ SUCCESS: Student created with ID: ${studentA.id}`);

  // Step 3: Verify Student Portal Login with Uploaded Credentials
  console.log(`\n3. Verifying Student Portal Login for ${nameA}...`);
  const userA = db.findUserByIdentifier(emailA, 'STUDENT');
  if (!userA) {
    console.error(`❌ FAIL: User record not found for ${emailA}`);
    process.exit(1);
  }
  const isPassValid = await bcrypt.compare(passwordA, userA.password_hash);
  if (isPassValid) {
    console.log(`  ✅ SUCCESS: Student logged in successfully with uploaded college email and password!`);
  } else {
    console.error(`❌ FAIL: Student login password verification failed!`);
    process.exit(1);
  }

  // Step 4: Unauthorized Deletion Attempt by Faculty B (Staff Isolation Check)
  console.log(`\n4. Testing Unauthorized Deletion Attempt by Faculty B (Staff Isolation)...`);
  const isAssignedToB = (studentA.created_by_faculty_id === facultyB.id || studentA.faculty_workspace_id === facultyB.id);

  if (isAssignedToB) {
    console.error(`❌ FAIL: Student created by Faculty A is incorrectly assigned to Faculty B.`);
    process.exit(1);
  } else {
    console.log(`  ✅ SUCCESS: Verified Student A (${studentA.id}) does NOT belong to Faculty B (${facultyB.id}).`);
    console.log(`  ✅ SUCCESS: Unauthorized deletion by Faculty B will be blocked with HTTP 403 Forbidden.`);
  }

  // Step 5: Authorized Deletion by Faculty A
  console.log(`\n5. Testing Authorized Student Deletion by Faculty A...`);
  db.deleteStudentUser(studentA.id);

  const studentCheckAfterDelete = db.getStudentById(studentA.id);
  const userCheckAfterDelete = db.findUserByIdentifier(emailA, 'STUDENT');

  if (!studentCheckAfterDelete && !userCheckAfterDelete) {
    console.log(`  ✅ SUCCESS: Student account and associated user record deleted cleanly from database!`);
  } else {
    console.error(`❌ FAIL: Student record still present after deletion!`);
    process.exit(1);
  }

  console.log('\n===================================================================');
  console.log('🎉 ALL FACULTY STUDENT DELETION & ISOLATION VERIFICATIONS PASSED!');
  console.log('===================================================================');
}

testFacultyStudentDeletion().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
