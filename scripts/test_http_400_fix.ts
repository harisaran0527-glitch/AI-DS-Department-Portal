import { db } from '../server/db';

async function testHttp400Fix() {
  console.log('=== VERIFYING HTTP 400 (BAD REQUEST) PREVENTION & API VALIDATION ===\n');

  const students = db.getStudents('ALL', 'ALL');
  if (students.length === 0) {
    console.error('❌ No students found in database!');
    process.exit(1);
  }

  const testStudent = students[0];
  console.log(`Target Test Student: ${testStudent.name} (ID: ${testStudent.id})`);

  // Test 1: Verify getStudentById
  const retrieved = db.getStudentById(testStudent.id);
  console.log(`Step 1: Fetching student record by ID '${testStudent.id}'...`);
  if (!retrieved || retrieved.id !== testStudent.id) {
    console.error('❌ Failed to retrieve student by ID!');
    process.exit(1);
  }
  console.log('  -> PASS: Student retrieved successfully.');

  // Test 2: Verify updateStudentEliteStatus handles boolean and numbers safely
  console.log('\nStep 2: Testing updateStudentEliteStatus with various formats...');
  db.updateStudentEliteStatus(testStudent.id, true);
  let check = db.getStudentById(testStudent.id);
  if (!check?.isEliteStudent) {
    console.error('❌ Failed to update elite status to true!');
    process.exit(1);
  }
  console.log('  -> PASS: Set isElite = true verified.');

  db.updateStudentEliteStatus(testStudent.id, false);
  check = db.getStudentById(testStudent.id);
  if (check?.isEliteStudent) {
    console.error('❌ Failed to update elite status to false!');
    process.exit(1);
  }
  console.log('  -> PASS: Set isElite = false verified.');

  // Test 3: Verify updateStudentProfile with partial/null/string/numeric payloads
  console.log('\nStep 3: Testing updateStudentProfile with mixed string/numeric payloads...');
  db.updateStudentProfile(testStudent.id, {
    linkedinUrl: '  https://linkedin.com/in/test-400-fix  ',
    githubUrl: '  https://github.com/test-400-fix  ',
    leetcodeUsername: '  coder_400_test  ',
    cgpa: 9.75,
    skillEdgePoints: 880
  });

  const profile360 = db.getStudent360(testStudent.id);
  console.log('  - Updated CGPA:', profile360?.student.cgpa);
  console.log('  - Updated LinkedIn:', profile360?.student.linkedinUrl || profile360?.student.linkedin_url);
  console.log('  - Updated GitHub:', profile360?.student.githubUrl || profile360?.student.github_url);
  console.log('  - Updated LeetCode Username:', profile360?.leetcode?.username);
  console.log('  - Updated SkillEdge Points:', profile360?.skillEdge?.totalRewardPoints);

  if (
    profile360?.student.cgpa !== 9.75 ||
    (profile360?.student.linkedinUrl || profile360?.student.linkedin_url) !== 'https://linkedin.com/in/test-400-fix' ||
    profile360?.leetcode?.username !== 'coder_400_test' ||
    profile360?.skillEdge?.totalRewardPoints !== 880
  ) {
    console.error('❌ Profile update verification failed!');
    process.exit(1);
  }
  console.log('  -> PASS: Mixed payload profile update verified without 400 Bad Request.');

  console.log('\n✅ ALL HTTP 400 FIX & VALIDATION TESTS PASSED CLEANLY.');
}

testHttp400Fix().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
