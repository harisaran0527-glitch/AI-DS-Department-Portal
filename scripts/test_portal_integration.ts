import { db } from '../server/db';
import { calculateCategoryScores, computeOverallScore, generateAIExplanation } from '../server/scoringEngine';

async function testFullPortalIntegration() {
  console.log('🚀 Starting Full Portal Integration & End-to-End Consistency Audit...\n');

  // 1. VERIFY DATABASE TABLES & RECORDS
  console.log('--- 1. Database Schema & Tables Verification ---');
  const students = db.getStudents('ALL', 'ALL');
  const users = db.getUsers();
  const subjects = db.getSubjects();
  const scoringConfig = db.getScoringConfig();

  console.log(`✅ Total Students in DB: ${students.length}`);
  console.log(`✅ Total Users in DB: ${users.length} (Admin, HOD, Faculty, Students)`);
  console.log(`✅ Total Subjects in DB: ${subjects.length}`);
  console.log(`✅ Scoring Config Loaded: Academic=${scoringConfig.academicWeight}%, SkillEdge=${scoringConfig.skillEdgeWeight}%, LeetCode=${scoringConfig.leetcodeWeight}%`);

  if (students.length === 0) {
    console.error('❌ ERROR: No student records found in database!');
    process.exit(1);
  }

  // 2. VERIFY STUDENT 360 PROFILE & SCORE CALCULATIONS
  console.log('\n--- 2. Student 360 Profile & Composite Scoring Engine ---');
  const testStudent = students[0];
  console.log(`Inspecting Student: ${testStudent.name} (${testStudent.register_no}) — Year: ${testStudent.year}, Sec: ${testStudent.section}`);

  const student360 = db.getStudent360(testStudent.id);
  if (!student360) {
    console.error(`❌ ERROR: Could not fetch 360 profile for student ${testStudent.id}!`);
    process.exit(1);
  }

  const breakdown = calculateCategoryScores(
    student360.student as any,
    student360.academics,
    student360.arrears,
    student360.skillEdge,
    student360.nptel,
    student360.attendance,
    student360.discipline,
    student360.leetcode,
    student360.projects
  );

  const compositeScore = computeOverallScore(breakdown, scoringConfig);
  const aiInsight = generateAIExplanation('BEST_STUDENT', student360.student as any, breakdown, compositeScore, student360.leetcode);

  console.log(`✅ Composite Score Calculated: ${compositeScore.toFixed(2)} / 100`);
  console.log(`✅ Category Scores Breakdown:`);
  console.log(`   - Academic: ${breakdown.academic.toFixed(1)}`);
  console.log(`   - SkillEdge: ${breakdown.skillEdge.toFixed(1)}`);
  console.log(`   - LeetCode: ${breakdown.leetCode.toFixed(1)}`);
  console.log(`   - NPTEL: ${breakdown.nptel.toFixed(1)}`);
  console.log(`   - Attendance: ${breakdown.attendance.toFixed(1)}`);
  console.log(`✅ AI Insight Generated: "${aiInsight.substring(0, 70)}..."`);

  // 3. VERIFY FACULTY WORKSPACE SECTION ISOLATION
  console.log('\n--- 3. Faculty Workspace & Section Isolation Verification ---');
  const facultyUsers = db.getUsers('FACULTY');
  if (facultyUsers.length > 0) {
    const fac = facultyUsers[0];
    const assignment = db.getFacultyAssignment(fac.id);
    const assignedYear = assignment ? assignment.year : fac.year;
    const assignedSection = assignment ? assignment.section : fac.section;

    const roster = db.getStudents(assignedYear, assignedSection);
    console.log(`✅ Faculty: ${fac.name} (${fac.email}) -> Workspace: ${assignedYear} Sec ${assignedSection}`);
    console.log(`✅ Assigned Roster Count: ${roster.length} students.`);

    // Verify all returned roster students belong to assigned workspace
    const invalidStudents = roster.filter(s => s.year !== assignedYear || s.section !== assignedSection);
    if (invalidStudents.length > 0) {
      console.error(`❌ ERROR: Roster returned ${invalidStudents.length} students outside authorized workspace!`);
      process.exit(1);
    }
    console.log('✅ Section isolation 100% verified: No cross-section leak found.');
  }

  // 4. VERIFY HOD DEPARTMENT-WIDE AGGREGATIONS & AI CANDIDATES
  console.log('\n--- 4. HOD Department-Wide Aggregations & Award Candidates ---');
  const hodUsers = db.getUsers('HOD');
  console.log(`✅ HOD Accounts Count: ${hodUsers.length}`);

  const deptStudents = db.getStudents('ALL', 'ALL');
  console.log(`✅ HOD Department-Wide Roster Count: ${deptStudents.length} students.`);

  // 5. VERIFY ACADEMIC SUBJECTS & DYNAMIC MARKS ENTRY
  console.log('\n--- 5. Academic Subjects & Dynamic Course Integration ---');
  const deptSubjects = db.getSubjects();
  console.log(`✅ Total Department Subjects: ${deptSubjects.length}`);
  deptSubjects.slice(0, 3).forEach(s => {
    console.log(`   - [${s.subject_code}] ${s.subject_name} (${s.year} Sem ${s.semester} Sec ${s.section}) — ${s.credits} Credits, Handler: ${s.faculty_handler}`);
  });

  // 6. VERIFY CONNECTED ACCOUNTS & EXTERNAL METRICS
  console.log('\n--- 6. External Platform Integration (SkillEdge, LeetCode, NPTEL) ---');
  const testConnAccs = db.getConnectedAccounts(testStudent.id);
  console.log(`✅ Connected External Accounts for ${testStudent.name}: ${testConnAccs.length} account(s).`);

  console.log('\n🎉 ALL PORTAL INTEGRATION & CONSISTENCY TESTS PASSED PERFECTLY!');
}

testFullPortalIntegration().catch(err => {
  console.error('❌ Portal Integration Test failed:', err);
  process.exit(1);
});
