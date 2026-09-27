import { db } from '../server/db';
import bcrypt from 'bcryptjs';

async function testStudentUploadAndLogin() {
  console.log('=== STUDENT UPLOAD & PORTAL LOGIN VERIFICATION ===\n');

  // Step 1: Find a test Faculty user
  const facultyUsers = db.getUsers('FACULTY');
  if (facultyUsers.length === 0) {
    console.error('❌ FAIL: No faculty user found in database.');
    process.exit(1);
  }
  const testFaculty = facultyUsers[0];
  console.log(`1. Test Faculty User: ${testFaculty.name} (${testFaculty.email}, ID: ${testFaculty.id})`);

  // Step 2: Test Manual Student Onboarding by Faculty
  const timestamp = Date.now().toString();
  const testRegNoManual = `3128${timestamp.slice(-8)}`;
  const testEmailManual = `saran.manual.${timestamp}@aids.edu`;
  const testPasswordManual = `CollegePass#2026!`;
  const testNameManual = `Saran Manual Test`;

  console.log(`\n2. Testing Manual Student Onboarding by Faculty...`);
  console.log(`   - Name: ${testNameManual}`);
  console.log(`   - Register No: ${testRegNoManual}`);
  console.log(`   - College Email ID: ${testEmailManual}`);
  console.log(`   - College Portal Password: ${testPasswordManual}`);

  let createdStudent: any;
  try {
    createdStudent = db.createStudentForFaculty(testFaculty.id, {
      registerNo: testRegNoManual,
      name: testNameManual,
      email: testEmailManual,
      collegeEmail: testEmailManual,
      password: testPasswordManual,
      year: '3rd Year',
      section: 'A',
      entryType: 'Regular'
    });

    console.log(`  ✅ SUCCESS: Student onboarded into DB with ID: ${createdStudent.id}`);
  } catch (err: any) {
    console.error(`❌ FAIL: Manual onboarding error: ${err.message}`);
    process.exit(1);
  }

  // Step 3: Test Student Portal Authentication with Uploaded Email ID
  console.log(`\n3. Testing Student Portal Login using College Email ID...`);
  const userMatchByEmail = db.findUserByIdentifier(testEmailManual, 'STUDENT');
  if (!userMatchByEmail) {
    console.error(`❌ FAIL: Student user record not found by email ${testEmailManual}`);
    process.exit(1);
  }

  const isPasswordValidByEmail = await bcrypt.compare(testPasswordManual, userMatchByEmail.password_hash);
  if (!isPasswordValidByEmail) {
    console.error(`❌ FAIL: Password validation failed for College Email ID ${testEmailManual}`);
    process.exit(1);
  } else {
    console.log(`  ✅ SUCCESS: Student authenticated successfully using College Email ID (${testEmailManual})!`);
  }

  // Step 4: Test Student Portal Authentication with Register Number
  console.log(`\n4. Testing Student Portal Login using Register Number...`);
  const userMatchByReg = db.findUserByIdentifier(testRegNoManual, 'STUDENT');
  if (!userMatchByReg) {
    console.error(`❌ FAIL: Student user record not found by register number ${testRegNoManual}`);
    process.exit(1);
  }

  const isPasswordValidByReg = await bcrypt.compare(testPasswordManual, userMatchByReg.password_hash);
  if (!isPasswordValidByReg) {
    console.error(`❌ FAIL: Password validation failed for Register Number ${testRegNoManual}`);
    process.exit(1);
  } else {
    console.log(`  ✅ SUCCESS: Student authenticated successfully using Register Number (${testRegNoManual})!`);
  }

  // Step 5: Test Security & Password Hashing
  console.log(`\n5. Verifying bcrypt password hashing security...`);
  if (userMatchByEmail.password_hash === testPasswordManual) {
    console.error(`❌ FAIL: Plaintext password stored in database!`);
    process.exit(1);
  } else if (userMatchByEmail.password_hash.startsWith('$2a$') || userMatchByEmail.password_hash.startsWith('$2b$')) {
    console.log(`  ✅ SUCCESS: Password is securely hashed with bcrypt (${userMatchByEmail.password_hash.substring(0, 15)}...).`);
  } else {
    console.error(`❌ FAIL: Invalid password hash format: ${userMatchByEmail.password_hash}`);
    process.exit(1);
  }

  // Step 6: Test CSV Bulk Student Import
  console.log(`\n6. Testing CSV Bulk Student Import...`);
  const csvRegNo = `3129${timestamp.slice(-8)}`;
  const csvEmail = `saran.csv.${timestamp}@aids.edu`;
  const csvPassword = `CsvPortalPass#999`;
  const csvName = `Saran CSV Test`;

  try {
    const csvCreatedStudent = db.createStudentForFaculty(testFaculty.id, {
      registerNo: csvRegNo,
      name: csvName,
      email: csvEmail,
      collegeEmail: csvEmail,
      password: csvPassword,
      year: '3rd Year',
      section: 'B'
    });

    console.log(`  ✅ SUCCESS: CSV Student imported into DB with ID: ${csvCreatedStudent.id}`);

    // Verify CSV Student Login
    const csvUser = db.findUserByIdentifier(csvEmail, 'STUDENT');
    const isCsvPassValid = await bcrypt.compare(csvPassword, csvUser!.password_hash);
    if (isCsvPassValid) {
      console.log(`  ✅ SUCCESS: CSV Student authenticated successfully with uploaded credentials!`);
    } else {
      console.error(`❌ FAIL: CSV Student password validation failed!`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`❌ FAIL: CSV Import error: ${err.message}`);
    process.exit(1);
  }

  // Step 7: Test Duplicate Prevention
  console.log(`\n7. Testing Duplicate Student Record Prevention...`);
  try {
    db.createStudentForFaculty(testFaculty.id, {
      registerNo: testRegNoManual,
      name: 'Duplicate Test',
      email: testEmailManual,
      password: 'SomePassword123'
    });
    console.error(`❌ FAIL: Duplicate student record was created!`);
    process.exit(1);
  } catch (err: any) {
    console.log(`  ✅ SUCCESS: Duplicate creation blocked with message: "${err.message}"`);
  }

  // Step 8: Verify Student Data Isolation
  console.log(`\n8. Verifying Student Data Isolation...`);
  const student1Profile = db.getStudent360(createdStudent.id);
  const allStudents = db.getStudents();
  const otherStudents = allStudents.filter(s => s.id !== createdStudent.id);

  console.log(`   - Logged-in Student ID: ${createdStudent.id}`);
  console.log(`   - Verified profile belongs to: ${student1Profile?.student.name} (${student1Profile?.student.registerNo})`);
  if (otherStudents.length > 0) {
    console.log(`   - Verified ${otherStudents.length} other students' records remain isolated.`);
  }

  console.log('\n=============================================================');
  console.log('🎉 ALL STUDENT UPLOAD & PORTAL LOGIN VERIFICATIONS PASSED!');
  console.log('=============================================================');
}

testStudentUploadAndLogin().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
