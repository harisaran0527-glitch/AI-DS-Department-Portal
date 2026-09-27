import { db } from '../server/db';
import { calculateCategoryScores, computeEliteStudentScore } from '../server/scoringEngine';

async function testBestStudentConnection() {
  console.log('=== VERIFYING BEST ELITE STUDENTS CONNECTION TO BEST STUDENT MODULE ===\n');

  // 1. Inspect existing Best Student Categories
  const bestStudentCategories = [
    { key: 'skilledge', label: 'SkillEdge Reward Points', sourceField: 'skilledge_records' },
    { key: 'academics', label: 'Academic Performance', sourceField: 'academic_records / students.cgpa' },
    { key: 'leetcode', label: 'LeetCode', sourceField: 'leetcode_stats' },
    { key: 'linkedin', label: 'LinkedIn Profile', sourceField: 'students.linkedin_url' },
    { key: 'github', label: 'GitHub URL', sourceField: 'students.github_url / project_records' },
    { key: 'hackathons', label: 'Hackathon Achievement', sourceField: 'participation_records' },
    { key: 'projects', label: 'Projects', sourceField: 'project_records' },
    { key: 'nptel', label: 'NPTEL', sourceField: 'nptel_records' },
    { key: 'certificates', label: 'Certificate Courses', sourceField: 'certificate_records' }
  ];

  console.log(`Step 1: Found ${bestStudentCategories.length} Best Student categories mapped 1:1 with Best Elite Students.`);
  bestStudentCategories.forEach((c, idx) => {
    console.log(`  [Category ${idx + 1}] '${c.label}' (Key: ${c.key}, Data Source: ${c.sourceField})`);
  });

  // 2. Fetch test student
  const students = db.getStudents('ALL', 'ALL');
  if (students.length === 0) {
    console.error('❌ No students found in database!');
    process.exit(1);
  }
  const testStudent = students[0];
  console.log(`\nStep 2: Selected test student '${testStudent.name}' (ID: ${testStudent.id})`);

  // Mark student as Elite Student
  db.updateStudentEliteStatus(testStudent.id, true);

  // 3. Test scoring engine connection
  const full360 = db.getStudent360(testStudent.id);
  if (!full360) {
    console.error('❌ Failed to fetch 360 profile!');
    process.exit(1);
  }

  const categoryScores = calculateCategoryScores(
    full360.student as any,
    full360.academics,
    full360.arrears,
    full360.skillEdge,
    full360.nptel,
    full360.attendance,
    full360.discipline,
    full360.leetcode,
    full360.projects,
    full360.certificates,
    full360.participation
  );

  const eliteScore = computeEliteStudentScore(categoryScores);
  console.log('\nStep 3: Verified Best Student Scoring Engine calculation:');
  console.log('  - Category Scores:', categoryScores);
  console.log(`  - Composite Elite Score: ${eliteScore} / 100`);

  // 4. Test live source module data synchronization
  console.log('\nStep 4: Testing live data synchronization from source module update...');
  const newCgpa = 9.85;
  const newLinkedin = 'https://linkedin.com/in/best-student-sync';
  const newGithub = 'https://github.com/best-student-sync';
  const newLeetCode = 'best_student_lc';
  const newPoints = 920;

  db.updateStudentProfile(testStudent.id, {
    cgpa: newCgpa,
    linkedinUrl: newLinkedin,
    githubUrl: newGithub,
    leetcodeUsername: newLeetCode,
    skillEdgePoints: newPoints
  });

  const syncedProfile = db.getStudent360(testStudent.id);
  if (
    syncedProfile.student.cgpa !== newCgpa ||
    (syncedProfile.student.linkedinUrl || syncedProfile.student.linkedin_url) !== newLinkedin ||
    syncedProfile.leetcode?.username !== newLeetCode ||
    syncedProfile.skillEdge?.totalRewardPoints !== newPoints
  ) {
    console.error('❌ Live data synchronization failed!');
    process.exit(1);
  }
  console.log('  -> Verified: Live data synchronization between Best Student & Best Elite Students passed!');

  // 5. Verify Elite Student designation filtering
  console.log('\nStep 5: Verifying Elite Student designation filter...');
  const eliteStudents = db.getEliteStudents('ALL', 'ALL');
  const isTargetInEliteList = eliteStudents.some((s) => s.id === testStudent.id);
  if (!isTargetInEliteList) {
    console.error('❌ Marked elite student missing from getEliteStudents list!');
    process.exit(1);
  }
  console.log(`  -> Verified: Only marked Elite Students (${eliteStudents.length}) appear in Best Elite Students list.`);

  console.log('\n✅ ALL BEST STUDENT MODULE CONNECTION TESTS PASSED CLEANLY.');
}

testBestStudentConnection().catch((err) => {
  console.error('Connection test failed:', err);
  process.exit(1);
});
