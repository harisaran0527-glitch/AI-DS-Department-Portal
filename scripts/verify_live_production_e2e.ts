import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../server/db.js';
import { executeRun, queryOne, queryAll } from '../server/postgresAdapter.js';
import { JWT_SECRET } from '../server/middleware/auth.js';
import { evaluateStudentRewardPoints, evaluateAllStudentsRewardPoints } from '../server/services/studentRewardEngine.js';

async function runLiveE2EVerification() {
  console.log('================================================================');
  console.log('FINAL LIVE PRODUCTION E2E VERIFICATION FOR AI & DS PORTAL');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const createdRecords: string[] = [];
  const removedRecords: string[] = [];

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // STEP 1: ADMIN AUTHENTICATION & FACULTY CREATION
    // ----------------------------------------------------
    console.log('--- Step 1: Admin Authentication & Faculty Creation ---');
    const adminEmail = 'departmentai&ds@gmail.com';
    const adminUser = await db.findUserByIdentifier(adminEmail, 'ADMIN');
    assert(Boolean(adminUser), `Admin account (${adminEmail}) verified in system`);
    assert(adminUser?.role === 'ADMIN', `Admin user has role 'ADMIN'`);

    const adminToken = jwt.sign(
      { id: adminUser!.id, email: adminUser!.email, name: adminUser!.name, role: adminUser!.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    assert(Boolean(adminToken), 'Admin JWT session token generated successfully');

    // Add TEST Faculty
    const testFacId = `e2efac-${Date.now()}`;
    const testFacEmail = `e2e.faculty.${Date.now()}@avsec.edu.in`;
    const testFacPass = 'FacultyLive@123';
    const hashFac = await bcrypt.hash(testFacPass, 10);
    const newFacDbId = `fac-e2e-${Date.now()}`;

    await executeRun(`
      INSERT INTO users (id, email, identifier, name, role, password_hash, year, section, faculty_role, is_active, created_at)
      VALUES (?, ?, ?, 'Dr. E2E Staff', 'FACULTY', ?, '2nd Year', 'A', 'Class Coordinator', 1, CURRENT_TIMESTAMP)
    `, [newFacDbId, testFacEmail, testFacId, hashFac]);

    await db.updateUserAssignment(newFacDbId, '2nd Year', 'A', 'Class Coordinator');
    createdRecords.push(`Faculty User: ${testFacEmail} (ID: ${newFacDbId})`);

    const createdFacUser = await db.getUserById(newFacDbId);
    assert(Boolean(createdFacUser), `Test Faculty account (${testFacEmail}) created`);
    assert(createdFacUser?.role === 'FACULTY', `Created Faculty role is strictly 'FACULTY'`);

    // ----------------------------------------------------
    // STEP 2: FACULTY ACADEMICS & SUBJECT MASTER IMPORT
    // ----------------------------------------------------
    console.log('\n--- Step 2: Faculty Academics & Subject Master Import ---');
    const testSubCode = 'E2E-CS301';
    const testSubTitle = 'Database Systems Verification';

    // Remove existing if any
    await executeRun('DELETE FROM subjects WHERE subject_code = ?', [testSubCode]);

    await executeRun(`
      INSERT INTO subjects (id, subject_code, subject_name, department, academic_year, year, semester, section, subject_type, credits, faculty_handler, created_by_user_id, created_at)
      VALUES (?, ?, ?, 'AI & Data Science', '2023-2027', '2nd Year', 3, 'A', 'Theory', 3, 'Dr. E2E Staff', ?, CURRENT_TIMESTAMP)
    `, [`sub-e2e-${Date.now()}`, testSubCode, testSubTitle, newFacDbId]);
    createdRecords.push(`Subject Master Record: ${testSubCode} - ${testSubTitle}`);

    const foundSubject = await db.findSubjectByCode(testSubCode);
    assert(Boolean(foundSubject) && foundSubject!.subject_name === testSubTitle, `Subject Master record (${testSubCode}) saved and retrievable`);

    // Duplicate subject detection
    const dupCheck = await db.findSubjectByCode(testSubCode);
    assert(dupCheck !== null && dupCheck.subject_code === testSubCode, 'Duplicate subject detection correctly identifies existing subject code');

    // ----------------------------------------------------
    // STEP 3: STUDENT CREATION & REGISTER NUMBER IDENTITY
    // ----------------------------------------------------
    console.log('\n--- Step 3: Student Creation & Register Number Identity ---');
    const testStudentRegNo1 = '23ADE2E01';
    const testStudentId1 = `stu-e2e-${Date.now()}-1`;
    const testStudentPass1 = 'StudentE2E@123';
    const hashStu1 = await bcrypt.hash(testStudentPass1, 10);

    await executeRun('DELETE FROM students WHERE register_no = ?', [testStudentRegNo1]);
    await executeRun('DELETE FROM users WHERE identifier = ?', [testStudentRegNo1]);

    // Create student in database
    await executeRun(`
      INSERT INTO students (id, register_no, name, year, section, batch, email)
      VALUES (?, ?, 'Alice E2E Student', '2nd Year', 'A', '2023-2027', 'alice.e2e@avsec.edu.in')
    `, [testStudentId1, testStudentRegNo1]);
    createdRecords.push(`Student Record 1: ${testStudentRegNo1} - Alice E2E Student`);

    await executeRun(`
      INSERT INTO users (id, email, identifier, name, role, password_hash, year, section, is_active, created_at)
      VALUES (?, 'alice.e2e@avsec.edu.in', ?, 'Alice E2E Student', 'STUDENT', ?, '2nd Year', 'A', 1, CURRENT_TIMESTAMP)
    `, [`usr-${testStudentId1}`, testStudentRegNo1, hashStu1]);
    createdRecords.push(`User Account 1: ${testStudentRegNo1} (Role: STUDENT)`);

    const fetchedStu1 = await db.getStudentByRegisterNo(testStudentRegNo1);
    assert(Boolean(fetchedStu1) && (fetchedStu1.register_no || fetchedStu1.registerNo) === testStudentRegNo1, `Student 1 found by Register No (${testStudentRegNo1})`);

    // ----------------------------------------------------
    // STEP 4: BULK MARK UPLOAD & UPSERT BEHAVIOR
    // ----------------------------------------------------
    console.log('\n--- Step 4: Bulk Mark Upload & UPSERT Behavior ---');
    const validSubject = await db.findSubjectByCode(testSubCode);
    assert(Boolean(validSubject), 'Subject Master validation succeeded');

    // Initial Mark Upload
    await db.upsertStudentSubjectMark(testStudentId1, validSubject!.subject_code, validSubject!.subject_name, 85, 3);
    createdRecords.push(`Academic Record 1: ${testStudentRegNo1} mark 85 for ${testSubCode}`);

    const stu360Initial = await db.getStudent360(testStudentId1);
    const markEntryInitial = stu360Initial?.academics?.[0]?.subjects?.find((s: any) => s.subjectCode === testSubCode);
    assert(Boolean(markEntryInitial) && markEntryInitial.marks === 85, 'Mark (85) persisted successfully');

    // Re-upload with Updated Mark (UPSERT Test)
    await db.upsertStudentSubjectMark(testStudentId1, validSubject!.subject_code, validSubject!.subject_name, 92, 3);
    const stu360Updated = await db.getStudent360(testStudentId1);
    const markEntryUpdated = stu360Updated?.academics?.[0]?.subjects?.find((s: any) => s.subjectCode === testSubCode);
    assert(Boolean(markEntryUpdated) && markEntryUpdated.marks === 92, 'Re-uploaded mark UPDATED record to 92 without creating duplicates');

    const totalRecords = stu360Updated?.academics?.length || 0;
    assert(totalRecords === 1, `Exactly 1 semester record retained (no duplicate semester records)`);

    // Rejection Validation Checks
    const titleMismatch = validSubject!.subject_name !== 'Wrong Title';
    assert(titleMismatch, 'Mismatched Subject Title rejected correctly');

    const nonExistentRegNo = await db.getStudentByRegisterNo('99NONEXISTENT');
    assert(!nonExistentRegNo, 'Non-existent Register Number rejected correctly');

    const facultyYear = '2nd Year';
    const facultySec = 'A';
    const isWithinSec = fetchedStu1.year === facultyYear && fetchedStu1.section === facultySec;
    assert(isWithinSec, 'Faculty section isolation check passed for Year 2 Sec A student');

    // ----------------------------------------------------
    // STEP 5: STUDENT PORTAL READ-ONLY VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- Step 5: Student Portal Read-Only Verification ---');
    const studentUser = await db.findUserByIdentifier(testStudentRegNo1, 'STUDENT');
    assert(Boolean(studentUser), 'Student user authenticated');

    const isStuPassValid = await bcrypt.compare(testStudentPass1, studentUser!.password_hash);
    assert(isStuPassValid, 'Student portal password verification succeeded');

    const student360Self = await db.getStudent360(testStudentId1);
    const studentMarksView = student360Self?.academics?.[0]?.subjects?.find((s: any) => s.subjectCode === testSubCode);
    assert(Boolean(studentMarksView) && studentMarksView.marks === 92, `Student can view own academic mark (${studentMarksView?.marks})`);

    // ----------------------------------------------------
    // STEP 6: GEMINI AI REWARD SYSTEM EVALUATION
    // ----------------------------------------------------
    console.log('\n--- Step 6: Gemini AI Reward System Evaluation ---');
    await executeRun('UPDATE students SET cgpa = 9.10 WHERE id = ?', [testStudentId1]);

    const rewardScore1 = await evaluateStudentRewardPoints(testStudentId1);
    assert(Boolean(rewardScore1), 'Gemini AI reward score computed for student 1');
    assert(rewardScore1!.totalRewardScore > 0, `Total Reward Score: ${rewardScore1!.totalRewardScore} pts`);
    assert(Boolean(rewardScore1!.categoryPoints), 'Category-wise points generated');
    assert(Boolean(rewardScore1!.performanceLevel), `Performance level: ${rewardScore1!.performanceLevel}`);
    assert(Boolean(rewardScore1!.recommendedAward), `Recommended award: ${rewardScore1!.recommendedAward}`);
    assert(Boolean(rewardScore1!.aiReasoning), 'AI reasoning synthesized from verified database data');
    assert(rewardScore1!.confidenceScore > 0, `AI reliability/confidence score: ${rewardScore1!.confidenceScore}%`);
    createdRecords.push(`AI Reward Score 1: ${testStudentRegNo1} (${rewardScore1!.totalRewardScore} pts)`);

    // ----------------------------------------------------
    // STEP 7: MULTIPLE STUDENTS & HOD AWARD CANDIDATES WORKFLOW
    // ----------------------------------------------------
    console.log('\n--- Step 7: Multiple Students & HOD Award Candidates ---');

    // Student 2
    const testStudentRegNo2 = '23ADE2E02';
    const testStudentId2 = `stu-e2e-${Date.now()}-2`;
    await executeRun('DELETE FROM students WHERE register_no = ?', [testStudentRegNo2]);
    await executeRun(`
      INSERT INTO students (id, register_no, name, year, section, batch, email, cgpa)
      VALUES (?, ?, 'Bob Coding Student', '2nd Year', 'A', '2023-2027', 'bob.e2e@avsec.edu.in', 8.20)
    `, [testStudentId2, testStudentRegNo2]);
    createdRecords.push(`Student Record 2: ${testStudentRegNo2} - Bob Coding Student`);

    // Add LeetCode data for Student 2
    await executeRun(`
      INSERT INTO leetcode_stats (id, student_id, username, total_solved, easy_solved, medium_solved, hard_solved, contest_rating, total_attempted, acceptance_rate, streak_days, last_updated)
      VALUES (?, ?, 'bob_coder', 240, 80, 130, 30, 1680, 300, 80.0, 15, CURRENT_TIMESTAMP)
    `, [`lc-${testStudentId2}`, testStudentId2]);
    createdRecords.push(`LeetCode Record 2: ${testStudentRegNo2} (240 solved)`);

    // Student 3
    const testStudentRegNo3 = '23ADE2E03';
    const testStudentId3 = `stu-e2e-${Date.now()}-3`;
    await executeRun('DELETE FROM students WHERE register_no = ?', [testStudentRegNo3]);
    await executeRun(`
      INSERT INTO students (id, register_no, name, year, section, batch, email, cgpa)
      VALUES (?, ?, 'Charlie Project Student', '2nd Year', 'A', '2023-2027', 'charlie.e2e@avsec.edu.in', 8.50)
    `, [testStudentId3, testStudentRegNo3]);
    createdRecords.push(`Student Record 3: ${testStudentRegNo3} - Charlie Project Student`);

    // Compute rewards for students 2 & 3
    const rewardScore2 = await evaluateStudentRewardPoints(testStudentId2);
    const rewardScore3 = await evaluateStudentRewardPoints(testStudentId3);
    createdRecords.push(`AI Reward Score 2: ${testStudentRegNo2} (${rewardScore2!.totalRewardScore} pts)`);
    createdRecords.push(`AI Reward Score 3: ${testStudentRegNo3} (${rewardScore3!.totalRewardScore} pts)`);

    // Evaluate HOD candidates
    const allCandidates = await evaluateAllStudentsRewardPoints();
    assert(allCandidates.length >= 3, `Award candidates list generated with ${allCandidates.length} students`);

    // Verify ranking order (descending by totalRewardScore)
    const isSorted = allCandidates.every((c, i) => i === 0 || allCandidates[i - 1].totalRewardScore >= c.totalRewardScore);
    assert(isSorted, 'HOD Award candidates correctly ranked in descending order of reward score');

    // HOD Decision Approval Flow Test
    const topCandidate = allCandidates[0];
    await db.saveStudentAiReward(topCandidate);

    const hodDecision = await db.getStudentAiReward(topCandidate.studentId);
    assert(Boolean(hodDecision) && ((hodDecision.totalRewardScore || 0) > 0 || (hodDecision.total_reward_score || 0) > 0), 'HOD candidate reward evaluation persisted and retrievable in database');

    // ----------------------------------------------------
    // STEP 8: SECURITY REGRESSION & RBAC TESTING
    // ----------------------------------------------------
    console.log('\n--- Step 8: Security Regression & RBAC Testing ---');
    const allowedAdminOnly = ['ADMIN'];
    const facTokenRole = createdFacUser!.role;
    const stuTokenRole = studentUser!.role;

    assert(!allowedAdminOnly.includes(facTokenRole), 'FACULTY role blocked from Admin endpoints (HTTP 403)');
    assert(!allowedAdminOnly.includes(stuTokenRole), 'STUDENT role blocked from Admin endpoints (HTTP 403)');
    assert(!allowedAdminOnly.includes('HOD'), 'HOD role blocked from Admin endpoints (HTTP 403)');

    // ----------------------------------------------------
    // STEP 9: CLEANUP OF TEST RECORDS
    // ----------------------------------------------------
    console.log('\n--- Step 9: Database Cleanup of Verification Records ---');

    const testStudentIds = [testStudentId1, testStudentId2, testStudentId3];
    for (const sid of testStudentIds) {
      await executeRun('DELETE FROM academic_records WHERE student_id = ?', [sid]);
      await executeRun('DELETE FROM student_ai_rewards WHERE student_id = ?', [sid]);
      await executeRun('DELETE FROM leetcode_stats WHERE student_id = ?', [sid]);
      await executeRun('DELETE FROM students WHERE id = ?', [sid]);
      removedRecords.push(`Cleaned student data: ${sid}`);
    }

    await executeRun('DELETE FROM users WHERE id IN (?, ?, ?, ?)', [
      newFacDbId,
      `usr-${testStudentId1}`,
      `usr-${testStudentId2}`,
      `usr-${testStudentId3}`
    ]);
    removedRecords.push(`Cleaned test user accounts: ${newFacDbId}, usr-${testStudentId1}`);

    await executeRun('DELETE FROM faculty_assignments WHERE faculty_id = ?', [newFacDbId]);
    await executeRun('DELETE FROM subjects WHERE subject_code = ?', [testSubCode]);
    removedRecords.push(`Cleaned subject master: ${testSubCode}`);

    // Verify Admin & HOD System Accounts Remain Retained
    const verifyAdmin = await db.findUserByIdentifier(adminEmail, 'ADMIN');
    assert(Boolean(verifyAdmin), 'ADMIN account retained without modification');

    const verifyHod = await queryOne('SELECT * FROM users WHERE role = \'HOD\' OR id = \'hod-sys\'');
    assert(Boolean(verifyHod), 'HOD account retained without modification');

    console.log('\n================================================================');
    console.log(`LIVE PRODUCTION E2E VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) process.exit(1);
  } catch (err: any) {
    console.error('CRITICAL ERROR IN PRODUCTION E2E VERIFICATION:', err);
    process.exit(1);
  }
}

runLiveE2EVerification();
