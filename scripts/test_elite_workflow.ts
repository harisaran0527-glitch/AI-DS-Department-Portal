import { db } from '../server/db';

async function testEliteStudentWorkflow() {
  console.log('=== VERIFYING BEST ELITE STUDENTS AUTOMATIC DATA INTEGRATION & WORKFLOW ===\n');

  // 1. Get initial department students
  const allStudents = db.getStudents('ALL', 'ALL');
  console.log(`Step 1: Found ${allStudents.length} total students in department roster.`);

  if (allStudents.length === 0) {
    console.error('❌ No students found in database!');
    process.exit(1);
  }

  const targetStudent = allStudents[0];
  console.log(`Target Test Student: ${targetStudent.name} (${targetStudent.registerNo}, ID: ${targetStudent.id})`);

  // Reset any existing elite flags for clean test run
  allStudents.forEach((s) => db.updateStudentEliteStatus(s.id, false));

  // 2. Verify non-elite students do NOT appear in elite students list
  let eliteList = db.getEliteStudents('ALL', 'ALL');
  console.log(`\nStep 2: Checking Elite Students list before designation... Count: ${eliteList.length}`);
  if (eliteList.length !== 0) {
    console.error('❌ Expected 0 elite students before marking!');
    process.exit(1);
  }
  console.log('  -> Verified: Non-elite students do NOT appear in the Elite Students list.');

  // 3. Mark target student as an Elite Student
  console.log(`\nStep 3: Marking student '${targetStudent.name}' as Elite Student...`);
  db.updateStudentEliteStatus(targetStudent.id, true);

  eliteList = db.getEliteStudents('ALL', 'ALL');
  console.log(`Checking Elite Students list after designation... Count: ${eliteList.length}`);
  if (eliteList.length !== 1 || eliteList[0].id !== targetStudent.id) {
    console.error('❌ Target student failed to appear in Elite Students list after marking!');
    process.exit(1);
  }
  console.log(`  -> Verified: '${eliteList[0].name}' successfully appears in the Elite Students list.`);

  // 4. Update student profile details (LinkedIn, GitHub, LeetCode handle, CGPA, Points)
  console.log('\nStep 4: Updating student profile details in source modules...');
  const updatedLinkedin = 'https://linkedin.com/in/test-elite-student';
  const updatedGithub = 'https://github.com/test-elite-student';
  const updatedLeetCode = 'elite_coder_test';
  const updatedCgpa = 9.45;
  const updatedPoints = 750;

  db.updateStudentProfile(targetStudent.id, {
    linkedinUrl: updatedLinkedin,
    githubUrl: updatedGithub,
    leetcodeUsername: updatedLeetCode,
    cgpa: updatedCgpa,
    skillEdgePoints: updatedPoints
  });

  // 5. Fetch 360 profile to verify automatic data reflection
  console.log('\nStep 5: Verifying automatic data reflection in Elite Student profile...');
  const updatedProfile = db.getStudent360(targetStudent.id);

  if (!updatedProfile || !updatedProfile.student) {
    console.error('❌ Failed to fetch updated student 360 profile!');
    process.exit(1);
  }

  console.log(`  - Name: ${updatedProfile.student.name}`);
  console.log(`  - CGPA: ${updatedProfile.student.cgpa}`);
  console.log(`  - LinkedIn URL: ${updatedProfile.student.linkedinUrl || updatedProfile.student.linkedin_url}`);
  console.log(`  - GitHub URL: ${updatedProfile.student.githubUrl || updatedProfile.student.github_url}`);
  console.log(`  - LeetCode Handle: ${updatedProfile.leetcode?.username}`);
  console.log(`  - SkillEdge Points: ${updatedProfile.skillEdge?.totalRewardPoints}`);

  if (
    updatedProfile.student.cgpa !== updatedCgpa ||
    (updatedProfile.student.linkedinUrl || updatedProfile.student.linkedin_url) !== updatedLinkedin ||
    (updatedProfile.student.githubUrl || updatedProfile.student.github_url) !== updatedGithub ||
    updatedProfile.leetcode?.username !== updatedLeetCode ||
    updatedProfile.skillEdge?.totalRewardPoints !== updatedPoints
  ) {
    console.error('❌ Data mismatch in updated 360 profile!');
    process.exit(1);
  }
  console.log('  -> Verified: Source module updates automatically reflect in Elite Student profile!');

  // 6. Remove Elite designation and verify underlying data persistence
  console.log(`\nStep 6: Removing Elite designation for '${targetStudent.name}'...`);
  db.updateStudentEliteStatus(targetStudent.id, false);

  eliteList = db.getEliteStudents('ALL', 'ALL');
  console.log(`Elite Students count after removal: ${eliteList.length}`);
  if (eliteList.length !== 0) {
    console.error('❌ Student was not removed from Elite Students list!');
    process.exit(1);
  }

  const postRemovalStudent = db.getStudentById(targetStudent.id);
  if (!postRemovalStudent || postRemovalStudent.cgpa !== updatedCgpa) {
    console.error('❌ Removing Elite designation deleted or corrupted underlying student records!');
    process.exit(1);
  }
  console.log('  -> Verified: Removing Elite designation leaves all underlying academic/source records intact!');

  // Restore designation for test target so test data stays clean
  db.updateStudentEliteStatus(targetStudent.id, true);
  console.log('\n✅ ALL BEST ELITE STUDENTS WORKFLOW TESTS PASSED CLEANLY.');
}

testEliteStudentWorkflow().catch((err) => {
  console.error('Workflow test failed:', err);
  process.exit(1);
});
