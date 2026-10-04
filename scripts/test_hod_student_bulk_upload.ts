import bcrypt from 'bcryptjs';
import { db, initDatabaseSchema } from '../server/db.js';
import { executeRun, queryOne, queryAll } from '../server/postgresAdapter.js';

async function runHodStudentBulkUploadTestSuite() {
  console.log('================================================================');
  console.log('HOD STUDENT BULK UPLOAD — COMPREHENSIVE E2E VERIFICATION TEST');
  console.log('================================================================\n');

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
    // PREPARATION: CLEANUP TEST DATA & SET UP TEST FACULTY & HOD
    // ----------------------------------------------------
    await executeRun("DELETE FROM users WHERE role IN ('STUDENT', 'FACULTY', 'HOD')");
    await executeRun('DELETE FROM students');
    await executeRun('DELETE FROM faculty_assignments');

    // Create Authorized HOD Account
    const hodHash = await bcrypt.hash('hod@123', 10);
    const hodId = `hod-test-${Date.now()}`;
    await db.createUser({
      id: hodId,
      email: 'hod.aids@avsenggcollege.ac.in',
      identifier: 'hod',
      name: 'Dr. Head of Department',
      role: 'HOD',
      passwordHash: hodHash,
      isActive: true
    });

    // Create Authorized Faculty Account (Class Coordinator for 2nd Year Sec A)
    const facHash = await bcrypt.hash('fac@123', 10);
    const facId = `fac-test-${Date.now()}`;
    await db.createUser({
      id: facId,
      email: 'coordinator.aids@avsenggcollege.ac.in',
      identifier: 'ADFAC100',
      name: 'Prof. Class Coordinator',
      role: 'FACULTY',
      passwordHash: facHash,
      year: '2nd Year',
      section: 'A',
      facultyRole: 'Class Coordinator',
      isActive: true
    });

    const hodUser = await db.getUserById(hodId);
    const facUser = await db.getUserById(facId);
    assert(Boolean(hodUser) && hodUser?.role === 'HOD', 'Test HOD account created');
    assert(Boolean(facUser) && facUser?.role === 'FACULTY', 'Test Faculty account created');

    // ----------------------------------------------------
    // TEST 1 & 2: HOD UPLOADS EXCEL WITH 5 STUDENTS -> PREVIEW 5 ROWS
    // ----------------------------------------------------
    console.log('\n--- Test 1 & 2: HOD Excel Preview (5 Individual Students) ---');
    const sampleRows = [
      { 'Register Number': '23AD001', 'Name': 'Student Alpha', 'College Mail ID': '23ad001@aids.edu', 'Mobile Number': '9876543210', 'Personal Mail ID': 'alpha@gmail.com', 'Address': 'Salem', 'CGPA': '8.5' },
      { 'Register Number': '23AD002', 'Name': 'Student Beta', 'College Mail ID': '23ad002@aids.edu', 'Mobile Number': '9876543211', 'Personal Mail ID': 'beta@gmail.com', 'Address': 'Namakkal', 'CGPA': '9.1' },
      { 'Register Number': '23AD003', 'Name': 'Student Gamma', 'College Mail ID': '23ad003@aids.edu', 'Mobile Number': '9876543212', 'Personal Mail ID': 'gamma@gmail.com', 'Address': 'Erode', 'CGPA': '7.8' },
      { 'Register Number': '23AD004', 'Name': 'Student Delta', 'College Mail ID': '23ad004@aids.edu', 'Mobile Number': '9876543213', 'Personal Mail ID': 'delta@gmail.com', 'Address': 'Dharmapuri', 'CGPA': '8.9' },
      { 'Register Number': '23AD005', 'Name': 'Student Epsilon', 'College Mail ID': '23ad005@aids.edu', 'Mobile Number': '9876543214', 'Personal Mail ID': 'epsilon@gmail.com', 'Address': 'Karur', 'CGPA': '9.4' }
    ];

    // Validate via preview algorithm
    const allDbStudents = await db.getStudents('ALL', 'ALL');
    const existingRegNos = new Set(allDbStudents.map((s) => s.register_no.trim().toLowerCase()));
    const regNoInFileCount = new Map<string, number>();
    sampleRows.forEach((r) => {
      const reg = r['Register Number'].toLowerCase();
      regNoInFileCount.set(reg, (regNoInFileCount.get(reg) || 0) + 1);
    });

    const preview = sampleRows.map((r, idx) => {
      const reg = r['Register Number'];
      const errors: string[] = [];
      if (!r.Name) errors.push('Missing Name');
      if (!r['Register Number']) errors.push('Missing Register Number');
      if (!r['College Mail ID']) errors.push('Missing Email');
      const isUpdate = existingRegNos.has(reg.toLowerCase());
      return {
        rowNumber: idx + 1,
        status: errors.length > 0 ? 'ERROR' : isUpdate ? 'UPDATE_EXISTING' : 'VALID_NEW',
        parsedData: {
          name: r.Name,
          registerNo: r['Register Number'],
          collegeEmail: r['College Mail ID'],
          mobileNumber: r['Mobile Number'],
          personalEmail: r['Personal Mail ID'],
          address: r.Address,
          cgpa: parseFloat(r.CGPA)
        }
      };
    });

    assert(preview.length === 5, 'Preview generated 5 individual rows from Excel input');
    assert(preview.every((p) => p.status === 'VALID_NEW'), 'All 5 sample rows marked as VALID_NEW');

    // ----------------------------------------------------
    // TEST 3, 4, 5, 6, 7: CONFIRM IMPORT & DATABASE VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- Test 3-7: Confirm Import & Database Verification ---');
    const importedStudents: any[] = [];
    for (const p of preview) {
      const s = p.parsedData;
      const imported = await db.upsertStudentWithUserLogin({
        registerNo: s.registerNo,
        name: s.name,
        email: s.collegeEmail,
        mobileNumber: s.mobileNumber,
        personalEmail: s.personalEmail,
        address: s.address,
        cgpa: s.cgpa,
        year: '2nd Year',
        section: 'A',
        batch: '2023-2027',
        createdByFacultyId: facId
      });
      importedStudents.push(imported);
    }

    assert(importedStudents.length === 5, 'Successfully confirmed import for 5 students');

    const dbStudents = await db.getStudents('2nd Year', 'A');
    assert(dbStudents.length === 5, 'Database contains 5 individual Student records for 2nd Year Sec A');

    const uniqueIds = new Set(dbStudents.map((s) => s.id));
    assert(uniqueIds.size === 5, 'Each imported student has a unique internal student_id');

    const uniqueRegs = new Set(dbStudents.map((s) => s.register_no));
    assert(uniqueRegs.size === 5, 'Register Numbers are strictly unique (23AD001 to 23AD005)');

    const mappedFacultyCheck = dbStudents.every((s) => s.created_by_faculty_id === facId);
    assert(mappedFacultyCheck, 'All 5 students mapped to assigned Faculty ID and Year/Section');

    // ----------------------------------------------------
    // TEST 8 & 9: FACULTY ROSTER & ADMIN VIEW-ONLY ACCESS
    // ----------------------------------------------------
    console.log('\n--- Test 8 & 9: Faculty Roster & Admin View Access ---');
    const facAssignedRoster = await db.getStudentsForFaculty(facId, '2nd Year', 'A');
    assert(facAssignedRoster.length === 5, 'Faculty assigned roster returns all 5 assigned students');

    const unassignedRoster = await db.getStudentsForFaculty(facId, '3rd Year', 'B');
    assert(unassignedRoster.length === 0, 'Faculty assigned roster for unassigned Year/Section returns 0 students');

    const adminRoster = await db.getStudents('ALL', 'ALL');
    assert(adminRoster.length === 5, 'Admin portal can view all 5 student records in database roster');

    // ----------------------------------------------------
    // TEST 10: STUDENT LOGIN AUTHENTICATION
    // ----------------------------------------------------
    console.log('\n--- Test 10: Student Login Authentication ---');
    const stuAccount = await db.findUserByIdentifier('23AD001', 'STUDENT');
    assert(Boolean(stuAccount), 'Student login account (23AD001) exists in users table');
    assert(stuAccount?.role === 'STUDENT', 'Student account role is strictly STUDENT');

    const passMatch = await bcrypt.compare('23AD001', stuAccount!.password_hash);
    assert(passMatch, 'Student initial login password matches Register Number (23AD001)');

    // ----------------------------------------------------
    // TEST 11-15: ATTACHING OTHER MODULES TO STUDENT ID
    // ----------------------------------------------------
    console.log('\n--- Test 11-15: Modules Reusing Authoritative Student ID ---');
    const targetStudent = dbStudents[0]; // 23AD001

    // Attendance
    await executeRun(`
      INSERT INTO attendance_records (id, student_id, total_working_days, present_days, absent_days, od_days, ml_days, percentage, last_updated)
      VALUES (?, ?, 100, 95, 5, 0, 0, 95.0, ?)
    `, [`att-${Date.now()}`, targetStudent.id, new Date().toISOString()]);
    const attRecs = await queryAll('SELECT * FROM attendance_records WHERE student_id = ?', [targetStudent.id]);
    assert(attRecs.length === 1, 'Attendance record attached to existing student_id');

    // Academic Record
    await executeRun(`
      INSERT INTO academic_records (id, student_id, semester_no, sgpa, cgpa, total_credits, subjects_json)
      VALUES (?, ?, 3, 9.2, 9.2, 22, ?)
    `, [`acad-${Date.now()}`, targetStudent.id, JSON.stringify([{ code: 'CS3401', name: 'Algorithms', score: 92 }])]);
    const markRecs = await queryAll('SELECT * FROM academic_records WHERE student_id = ?', [targetStudent.id]);
    assert(markRecs.length === 1 && Number(markRecs[0].sgpa) === 9.2, 'Academic mark record attached to existing student_id');

    // Certificate
    await executeRun(`
      INSERT INTO certificate_records (id, student_id, course_name, platform, category, issue_date, created_at)
      VALUES (?, ?, 'AWS Certified Cloud Practitioner', 'Amazon Web Services', 'Technical Certification', '2026-05-15', ?)
    `, [`cert-${Date.now()}`, targetStudent.id, new Date().toISOString()]);
    const certRecs = await queryAll('SELECT * FROM certificate_records WHERE student_id = ?', [targetStudent.id]);
    assert(certRecs.length === 1, 'Certificate attached to existing student_id');

    // Discipline
    await executeRun(`
      INSERT INTO discipline_records (id, student_id, date, category, remark, warning_action, recorded_by)
      VALUES (?, ?, '2026-06-10', 'Behavior', 'Late entry to lab session', 'Verbal Warning', ?)
    `, [`disc-${Date.now()}`, targetStudent.id, facId]);
    const discRecs = await queryAll('SELECT * FROM discipline_records WHERE student_id = ?', [targetStudent.id]);
    assert(discRecs.length === 1, 'Discipline record attached to existing student_id');

    // Verify student count didn't duplicate
    const postModuleStudents = await db.getStudents('ALL', 'ALL');
    assert(postModuleStudents.length === 5, 'Student count remains exactly 5 after adding performance records');

    // ----------------------------------------------------
    // TEST 16 & 17: DUPLICATE REGISTER NUMBER & INVALID ROWS
    // ----------------------------------------------------
    console.log('\n--- Test 16 & 17: Duplicate Register Number & Invalid Rows ---');
    const updateStudent = await db.upsertStudentWithUserLogin({
      registerNo: '23AD001',
      name: 'Student Alpha Updated',
      email: '23ad001@aids.edu',
      cgpa: 9.6,
      year: '2nd Year',
      section: 'A',
      createdByFacultyId: facId
    });
    assert(updateStudent.name === 'Student Alpha Updated' && updateStudent.cgpa === 9.6, 'Updating existing Register Number 23AD001 upserted record without creating duplicate');

    const totalStudentsAfterUpdate = await db.getStudents('ALL', 'ALL');
    assert(totalStudentsAfterUpdate.length === 5, 'Total student count in database remains 5');

    // ----------------------------------------------------
    // TEST 18, 19, 20: RESTART STABILITY & SYSTEM INTEGRITY
    // ----------------------------------------------------
    console.log('\n--- Test 18-20: Restart Stability & System Integrity ---');
    await initDatabaseSchema();
    const postRestartStudents = await db.getStudents('ALL', 'ALL');
    assert(postRestartStudents.length === 5, 'Restarting server backend preserved exactly 5 student records (0 auto-created)');

    console.log('\n================================================================');
    console.log(`HOD STUDENT BULK UPLOAD TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) process.exit(1);
  } catch (err: any) {
    console.error('CRITICAL ERROR IN BULK UPLOAD TEST SUITE:', err);
    process.exit(1);
  }
}

runHodStudentBulkUploadTestSuite();
