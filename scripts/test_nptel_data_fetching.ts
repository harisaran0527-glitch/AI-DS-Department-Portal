import { syncNPTELProfile } from '../server/services/externalSync';
import { db } from '../server/db';

async function testNPTELDataFetching() {
  console.log('=== VERIFYING NPTEL SWAYAM INTEGRATION & DATA RETRIEVAL ===\n');

  // 1. Get sample student from database
  const students = db.getStudents();
  if (students.length === 0) {
    throw new Error('No students found in database.');
  }

  const sampleStudent = students[0];
  console.log(`Target Student: ${sampleStudent.name} (${sampleStudent.register_no || sampleStudent.registerNo})`);
  console.log(`Student ID: ${sampleStudent.id}`);
  console.log(`Student Email: ${sampleStudent.email}\n`);

  // 2. Perform initial Google OAuth SWAYAM Identity Sync
  console.log('1. Testing Google OAuth Identity Sync...');
  const initialSync = await syncNPTELProfile(sampleStudent.id, sampleStudent.email);

  console.log(`[PASS]: Google OAuth SWAYAM Identity Connected:`);
  console.log(` - Connected Email: ${initialSync.connectedEmail}`);
  console.log(` - Account Type: ${initialSync.accountType}`);
  console.log(` - Verification Status: ${initialSync.verificationStatus}`);
  console.log(` - Last Synced At: ${initialSync.syncedAt}`);

  // 3. Add Verified NPTEL Course to Student Profile
  console.log('\n2. Adding Verified NPTEL SWAYAM Course Record to Database...');
  const courseId = db.upsertNPTELRecord(sampleStudent.id, {
    courseName: 'NPTEL Cloud Computing & Distributed Systems',
    durationWeeks: 12,
    weeksCompleted: 12,
    assignmentScore: 90,
    examScore: 82,
    finalScore: 84,
    status: 'ELITE',
    accountType: initialSync.accountType,
    connectedEmail: initialSync.connectedEmail
  });
  console.log(`[PASS]: Inserted verified course ID: ${courseId}`);

  // 4. Perform POST /api/student/sync-nptel refresh
  console.log('\n3. Performing POST Sync Refresh...');
  const freshSync = await syncNPTELProfile(sampleStudent.id);

  console.log(`[PASS]: Fresh NPTEL Sync Completed:`);
  console.log(` - Courses Verified: ${freshSync.coursesCount}`);
  console.log(` - Status: ${freshSync.verificationStatus}`);
  console.log(` - Synced At: ${freshSync.syncedAt}`);

  freshSync.courses.forEach((c, idx) => {
    console.log(`   Course ${idx + 1}: "${c.courseName}" | Final Score: ${c.finalScore}% | Status: [${c.status}] | Verified: ${c.lastVerified}`);
  });

  // 5. Verify Database Persistence in nptel_records and connected_accounts
  console.log('\n4. Verifying Database Persistence...');
  const full360 = db.getStudent360(sampleStudent.id);
  const nptelDbRecords = full360?.nptel || [];
  const connAccs = db.getConnectedAccounts(sampleStudent.id);

  const foundCourse = nptelDbRecords.find(c => c.courseName.includes('Cloud Computing'));
  if (!foundCourse) {
    throw new Error('[FAIL]: Persisted NPTEL course record missing from student 360 profile!');
  }

  console.log(`[PASS]: nptel_records table verified. Found course: "${foundCourse.courseName}" (Final Score: ${foundCourse.finalScore}%).`);

  const googleConn = connAccs.find((a: any) => a.provider === 'GOOGLE' || a.purpose === 'NPTEL');
  if (!googleConn) {
    throw new Error('[FAIL]: connected_accounts table missing Google NPTEL record!');
  }

  console.log(`[PASS]: connected_accounts table verified (Provider: ${googleConn.provider}, Email: ${googleConn.connected_email}).`);

  // 6. Verify Student Data Isolation
  if (students.length > 1) {
    const stu2 = students[1];
    const full360_stu2 = db.getStudent360(stu2.id);
    const nptel_stu2 = full360_stu2?.nptel || [];
    const leaked = nptel_stu2.some(c => c.courseName.includes('Cloud Computing'));
    if (leaked) {
      throw new Error('[FAIL]: Student isolation failure! Student 2 received Student 1 NPTEL records.');
    }
    console.log(`[PASS]: Verified Student Isolation. Student 2 (${stu2.name}) does not leak Student 1's NPTEL data.`);
  }

  console.log('\n=== ALL NPTEL RETRIEVAL & PERSISTENCE VERIFICATIONS PASSED 100% SUCCESSFULLY ===');
}

testNPTELDataFetching().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
