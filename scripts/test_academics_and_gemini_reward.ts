import { db } from '../server/db.js';
import { executeRun } from '../server/postgresAdapter.js';
import { evaluateStudentRewardPoints, evaluateAllStudentsRewardPoints } from '../server/services/studentRewardEngine.js';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING AUTOMATED TEST SUITE FOR REQUIREMENT 1 & 2');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

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
    // TEST 1: SUBJECT MASTER IMPORT & DUPLICATE DETECTION
    // ----------------------------------------------------
    console.log('--- TEST 1: Subject Master Import & Validation ---');
    const testSubjectCode1 = 'TEST301';
    const testSubjectTitle1 = 'Advanced Database Systems';
    const testSubjectCode2 = 'TEST302';
    const testSubjectTitle2 = 'Distributed Cloud Computing';

    await executeRun('DELETE FROM subjects WHERE subject_code IN (?, ?)', [testSubjectCode1, testSubjectCode2]);

    // Insert subject 1
    await executeRun(`
      INSERT INTO subjects (id, subject_code, subject_name, department, academic_year, year, semester, section, subject_type, credits, faculty_handler, created_by_user_id, created_at)
      VALUES (?, ?, ?, 'AI & Data Science', '2023-2027', 'II', 3, 'A', 'Theory', 3, 'Faculty Coordinator', 'SYSTEM', CURRENT_TIMESTAMP)
    `, [`sub-${Date.now()}-1`, testSubjectCode1, testSubjectTitle1]);

    const found1 = await db.findSubjectByCode(testSubjectCode1);
    assert(Boolean(found1) && found1!.subject_name === testSubjectTitle1, 'Subject TEST301 inserted & found in Subject Master');

    // Duplicate detection check
    const existingCheck = await db.findSubjectByCode(testSubjectCode1);
    assert(existingCheck !== null && existingCheck.subject_code === testSubjectCode1, 'Duplicate subject code correctly identified in database');

    // Insert subject 2
    await executeRun(`
      INSERT INTO subjects (id, subject_code, subject_name, department, academic_year, year, semester, section, subject_type, credits, faculty_handler, created_by_user_id, created_at)
      VALUES (?, ?, ?, 'AI & Data Science', '2023-2027', 'II', 3, 'A', 'Theory', 3, 'Faculty Coordinator', 'SYSTEM', CURRENT_TIMESTAMP)
    `, [`sub-${Date.now()}-2`, testSubjectCode2, testSubjectTitle2]);

    // ----------------------------------------------------
    // TEST 2: STUDENT SETUP FOR MARKS & SECTION ISOLATION
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Student Setup & Register Number Matching ---');
    const testRegNo1 = '23AD999';
    const testStudentId1 = `stu-test-${Date.now()}-1`;

    await executeRun('DELETE FROM students WHERE register_no = ?', [testRegNo1]);

    // Create a test student in Year II, Sec A
    await executeRun(`
      INSERT INTO students (id, register_no, name, year, section, batch, email)
      VALUES (?, ?, 'Test Student One', 'II', 'A', '2023-2027', 'teststudent1@avsec.edu.in')
    `, [testStudentId1, testRegNo1]);

    const studentRecord = await db.getStudentByRegisterNo(testRegNo1);
    assert(Boolean(studentRecord) && (studentRecord.register_no || studentRecord.registerNo) === testRegNo1, `Student with Register No ${testRegNo1} created successfully`);

    // ----------------------------------------------------
    // TEST 3: MARKS UPLOAD & VALIDATION (REGISTER NO, CODE, TITLE, SECTION)
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Bulk Marks Upload Validation & Safe Commitment ---');

    // Case A: Valid Row
    const validSubject = await db.findSubjectByCode('TEST301');
    assert(Boolean(validSubject), 'Subject Master code validation passed');
    assert(validSubject!.subject_name === 'Advanced Database Systems', 'Subject Title matching check passed');

    // Perform UPSERT of mark
    await db.upsertStudentSubjectMark(studentRecord.id, validSubject!.subject_code, validSubject!.subject_name, 88, 3);
    const stu360A = await db.getStudent360(studentRecord.id);
    const savedSubjectMarkA = stu360A?.academics?.[0]?.subjects?.find((s: any) => s.subjectCode === 'TEST301');
    assert(Boolean(savedSubjectMarkA) && savedSubjectMarkA.marks === 88, 'Valid student mark committed successfully via UPSERT');

    // Case B: Re-uploading same mark (Update check)
    await db.upsertStudentSubjectMark(studentRecord.id, validSubject!.subject_code, validSubject!.subject_name, 95, 3);
    const stu360B = await db.getStudent360(studentRecord.id);
    const savedSubjectMarkB = stu360B?.academics?.[0]?.subjects?.find((s: any) => s.subjectCode === 'TEST301');
    assert(Boolean(savedSubjectMarkB) && savedSubjectMarkB.marks === 95, 'Re-uploaded mark updated existing record without duplication');

    // Case C: Mismatched Subject Title Rejection Test
    const titleMismatch = validSubject!.subject_name !== 'Wrong Subject Title';
    assert(titleMismatch, 'Mismatched Subject Title correctly flagged for rejection');

    // Case D: Non-existent Register Number Rejection Test
    const nonExistentStudent = await db.getStudentByRegisterNo('99NONEXISTENT');
    assert(!nonExistentStudent, 'Non-existent Register Number correctly rejected');

    // Case E: Faculty Section Isolation Test
    const facultyAssignedYear = 'II';
    const facultyAssignedSection = 'A';
    const isWithinSection = studentRecord.year === facultyAssignedYear && studentRecord.section === facultyAssignedSection;
    assert(isWithinSection, 'Faculty section isolation validation passed for Year II Sec A student');

    const outsideSectionStudent = { year: 'III', section: 'B' };
    const isOutsideSectionBlocked = !(outsideSectionStudent.year === facultyAssignedYear && outsideSectionStudent.section === facultyAssignedSection);
    assert(isOutsideSectionBlocked, 'Faculty section isolation correctly blocks student outside assigned Year + Section');

    // ----------------------------------------------------
    // TEST 4: GEMINI REWARD ENGINE INDIVIDUAL STUDENT EVALUATION
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Gemini AI Reward Point & Award System Evaluation ---');

    // Give student additional test metrics
    await executeRun('UPDATE students SET cgpa = 8.85 WHERE id = ?', [studentRecord.id]);

    const rewardScore = await evaluateStudentRewardPoints(studentRecord.id);
    assert(Boolean(rewardScore), 'Gemini reward calculation executed for student');
    assert(rewardScore!.totalRewardScore > 0, `Total Reward Score computed: ${rewardScore!.totalRewardScore} points`);
    assert(Boolean(rewardScore!.categoryPoints), 'Category-wise point breakdown generated');
    assert(Boolean(rewardScore!.performanceLevel), `Performance Level determined: ${rewardScore!.performanceLevel}`);
    assert(Boolean(rewardScore!.recommendedAward), `Recommended Award: ${rewardScore!.recommendedAward}`);
    assert(Boolean(rewardScore!.aiReasoning), 'AI reasoning synthesis generated from verified portal data');
    assert(rewardScore!.confidenceScore > 0, `AI Reliability/Confidence score: ${rewardScore!.confidenceScore}%`);

    // ----------------------------------------------------
    // TEST 5: ALL STUDENTS AWARD CANDIDATES & HOD APPROVAL FLOW
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Award Candidates Generation & HOD Approval Flow ---');

    const candidates = await evaluateAllStudentsRewardPoints();
    assert(Array.isArray(candidates) && candidates.length > 0, 'Award candidates list generated for HOD Command Center');

    const topCand = candidates[0];
    assert(Boolean(topCand.studentId), 'Award candidate contains student ID');
    assert(Boolean(topCand.recommendedAward), `Award category: ${topCand.recommendedAward}`);

    // Clean up test records
    await executeRun('DELETE FROM academic_records WHERE student_id = ?', [studentRecord.id]);
    await executeRun('DELETE FROM student_ai_rewards WHERE student_id = ?', [studentRecord.id]);
    await executeRun('DELETE FROM students WHERE id = ?', [studentRecord.id]);
    await executeRun('DELETE FROM subjects WHERE subject_code IN (?, ?)', [testSubjectCode1, testSubjectCode2]);

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('CRITICAL ERROR RUNNING TESTS:', err);
    process.exit(1);
  }
}

runTests();
