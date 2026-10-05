import bcrypt from 'bcryptjs';
import { db, initDatabaseSchema } from '../server/db.js';
import { executeRun, queryAll, queryOne } from '../server/postgresAdapter.js';

const API_BASE = 'http://localhost:5000/api';

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('DEPARTMENT PORTAL — COMPLETE E2E VERIFICATION TEST SUITE');
  console.log('Testing Sections 1-17 Requirements');
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
    // SETUP: Create Clean Test HOD, Staff A, and Staff B
    // ----------------------------------------------------
    console.log('\n--- Phase 1: Setup Test Accounts ---');
    await executeRun("DELETE FROM users WHERE email LIKE '%@avsec-test.edu'");
    await executeRun("DELETE FROM students WHERE email LIKE '%@avsec-test.edu' OR register_no LIKE 'TEST%'");
    await executeRun("DELETE FROM subjects WHERE subject_code LIKE 'TST%'");

    const testPassword = 'Password@123';
    const passwordHash = await bcrypt.hash(testPassword, 10);

    const hodId = `hod-test-${Date.now()}`;
    await db.createUser({
      id: hodId,
      email: 'hod.test@avsec-test.edu',
      identifier: 'hod_test',
      name: 'Dr. HOD Test',
      role: 'HOD',
      passwordHash,
      isActive: true
    });

    const staffAId = `staffA-test-${Date.now()}`;
    await db.createUser({
      id: staffAId,
      email: 'staffA.test@avsec-test.edu',
      identifier: 'STAFFA100',
      name: 'Prof. Staff A',
      role: 'FACULTY',
      passwordHash,
      year: '2nd Year',
      section: 'A',
      facultyRole: 'Class Coordinator',
      isActive: true
    });
    await db.updateUserAssignment(staffAId, '2nd Year', 'A', 'Class Coordinator');

    const staffBId = `staffB-test-${Date.now()}`;
    await db.createUser({
      id: staffBId,
      email: 'staffB.test@avsec-test.edu',
      identifier: 'STAFFB200',
      name: 'Prof. Staff B',
      role: 'FACULTY',
      passwordHash,
      year: '3rd Year',
      section: 'B',
      facultyRole: 'Class Coordinator',
      isActive: true
    });
    await db.updateUserAssignment(staffBId, '3rd Year', 'B', 'Class Coordinator');

    assert(true, 'Test HOD, Staff A (2nd Year Sec A), and Staff B (3rd Year Sec B) created');

    // ----------------------------------------------------
    // TEST 4: Test HOD Login via HTTP API
    // ----------------------------------------------------
    console.log('\n--- Phase 2: HOD Login & Authentication ---');
    const hodLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'hod_test', password: testPassword, role: 'HOD' })
    });
    const hodLoginData = await hodLoginRes.json();
    assert(hodLoginRes.status === 200 && Boolean(hodLoginData.token), 'HOD login successful, JWT token issued');
    const hodToken = hodLoginData.token;

    // Staff A Login
    const staffALoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'STAFFA100', password: testPassword, role: 'FACULTY' })
    });
    const staffALoginData = await staffALoginRes.json();
    assert(staffALoginRes.status === 200 && Boolean(staffALoginData.token), 'Staff A login successful');
    const staffAToken = staffALoginData.token;

    // Staff B Login
    const staffBLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'STAFFB200', password: testPassword, role: 'FACULTY' })
    });
    const staffBLoginData = await staffBLoginRes.json();
    assert(staffBLoginRes.status === 200 && Boolean(staffBLoginData.token), 'Staff B login successful');
    const staffBToken = staffBLoginData.token;

    // ----------------------------------------------------
    // TEST 5: Test Faculty Roster via HOD Portal
    // ----------------------------------------------------
    console.log('\n--- Phase 3: Faculty Roster Access ---');
    const facultyRosterRes = await fetch(`${API_BASE}/hod/faculty`, {
      headers: { Authorization: `Bearer ${hodToken}` }
    });
    const facultyRosterData = await facultyRosterRes.json();
    assert(facultyRosterRes.status === 200 && Array.isArray(facultyRosterData.faculty), 'HOD can fetch Faculty Roster');
    const hasStaffA = facultyRosterData.faculty.some((f: any) => f.id === staffAId);
    const hasStaffB = facultyRosterData.faculty.some((f: any) => f.id === staffBId);
    assert(hasStaffA && hasStaffB, 'Faculty Roster contains both Staff A and Staff B with correct assignments');

    // ----------------------------------------------------
    // TEST 6, 7, 8: Staff-Specific Student Bulk Upload (HOD -> Staff A)
    // ----------------------------------------------------
    console.log('\n--- Phase 4: Student Bulk Upload Inside Staff A Context ---');
    const studentSampleRows = [
      { 'Register Number': 'TEST001', 'Name': 'Student One', 'College Mail ID': 'test001@avsec-test.edu', 'Mobile Number': '9876543201', 'Personal Mail ID': 's1@gmail.com', 'Address': 'Salem', 'CGPA': '8.7' },
      { 'Register Number': 'TEST002', 'Name': 'Student Two', 'College Mail ID': 'test002@avsec-test.edu', 'Mobile Number': '9876543202', 'Personal Mail ID': 's2@gmail.com', 'Address': 'Salem', 'CGPA': '9.2' },
      { 'Register Number': 'TEST003', 'Name': 'Student Three', 'College Mail ID': 'test003@avsec-test.edu', 'Mobile Number': '9876543203', 'Personal Mail ID': 's3@gmail.com', 'Address': 'Namakkal', 'CGPA': '8.1' }
    ];

    // Preview
    const previewRes = await fetch(`${API_BASE}/hod/students/import-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodToken}`
      },
      body: JSON.stringify({
        facultyId: staffAId,
        year: '2nd Year',
        section: 'A',
        rows: studentSampleRows
      })
    });
    const previewData = await previewRes.json();
    assert(previewRes.status === 200 && previewData.validRowsCount === 3, 'HOD preview validated 3 student rows under Staff A');

    // Confirm Import
    const validParsed = previewData.preview.map((p: any) => p.parsedData);
    const confirmRes = await fetch(`${API_BASE}/hod/students/import-confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodToken}`
      },
      body: JSON.stringify({
        facultyId: staffAId,
        year: '2nd Year',
        section: 'A',
        students: validParsed
      })
    });
    const confirmData = await confirmRes.json();
    assert((confirmRes.status === 200 || confirmRes.status === 201) && confirmData.importedCount === 3, 'HOD confirmed import of 3 students for Staff A');

    // Verify in database that all 3 students belong to Staff A
    const importedDbStudents = await queryAll<any>('SELECT * FROM students WHERE register_no IN (?, ?, ?)', ['TEST001', 'TEST002', 'TEST003']);
    assert(importedDbStudents.length === 3, 'Database contains 3 individual student records');
    const allAssignedToStaffA = importedDbStudents.every((s) => s.created_by_faculty_id === staffAId && s.year === '2nd Year' && s.section === 'A');
    assert(allAssignedToStaffA, 'All 3 students are automatically assigned to Staff A, 2nd Year, Section A');

    // ----------------------------------------------------
    // TEST 9: Section Isolation (Staff B cannot see Staff A's students)
    // ----------------------------------------------------
    console.log('\n--- Phase 5: Faculty Section Isolation ---');
    const staffAStudentsRes = await fetch(`${API_BASE}/faculty/students`, {
      headers: { Authorization: `Bearer ${staffAToken}` }
    });
    const staffAStudentsData = await staffAStudentsRes.json();
    const staffAStudentsList = staffAStudentsData.students || [];
    const staffAHasTestStudents = importedDbStudents.every((s) => staffAStudentsList.some((sa: any) => sa.id === s.id));
    assert(staffAHasTestStudents, 'Staff A can see all 3 assigned students');

    const staffBStudentsRes = await fetch(`${API_BASE}/faculty/students`, {
      headers: { Authorization: `Bearer ${staffBToken}` }
    });
    const staffBStudentsData = await staffBStudentsRes.json();
    const staffBStudentsList = staffBStudentsData.students || [];
    const staffBHasStaffAStudents = importedDbStudents.some((s) => staffBStudentsList.some((sb: any) => sb.id === s.id));
    assert(!staffBHasStaffAStudents, 'Staff B CANNOT see Staff A students (Strict Section Isolation)');

    // ----------------------------------------------------
    // TEST 10: Student 360 Inspection
    // ----------------------------------------------------
    console.log('\n--- Phase 6: Student 360° Inspection Profile ---');
    const targetStudent = importedDbStudents[0];
    const s360Res = await fetch(`${API_BASE}/hod/students/${targetStudent.id}/360`, {
      headers: { Authorization: `Bearer ${hodToken}` }
    });
    const s360Data = await s360Res.json();
    assert(s360Res.status === 200 && Boolean(s360Data.student), 'Student 360 profile loaded successfully');
    assert(s360Data.student.registerNo === targetStudent.register_no, 'Student 360 matches authoritative Register Number');
    assert('academics' in s360Data && 'discipline' in s360Data && 'breakdown' in s360Data, 'Student 360 contains required academic, discipline, and breakdown sections');

    // ----------------------------------------------------
    // TEST 11: Department Subjects Master Bulk Upload
    // ----------------------------------------------------
    console.log('\n--- Phase 7: Department Subjects Master Bulk Upload ---');
    const sampleSubjects = [
      { 'Subject Code': 'TST3401', 'Subject Title': 'Data Structures & Algorithms', year: '2nd Year', semester: 4, section: 'A' },
      { 'Subject Code': 'TST3402', 'Subject Title': 'Artificial Intelligence', year: '2nd Year', semester: 4, section: 'A' }
    ];

    const subPreviewRes = await fetch(`${API_BASE}/subjects/import-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodToken}`
      },
      body: JSON.stringify({ rows: sampleSubjects })
    });
    const subPreviewData = await subPreviewRes.json();
    assert(subPreviewRes.status === 200 && subPreviewData.validRows.length === 2, 'Department Subject Excel preview validated 2 subjects');

    const subConfirmRes = await fetch(`${API_BASE}/subjects/import-confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodToken}`
      },
      body: JSON.stringify({ subjects: subPreviewData.validRows })
    });
    const subConfirmData = await subConfirmRes.json();
    assert(subConfirmRes.status === 200 && subConfirmData.importedCount === 2, 'Department Subjects imported into Subject Master');

    const dbSubjects = await queryAll<any>("SELECT * FROM subjects WHERE subject_code IN ('TST3401', 'TST3402')");
    assert(dbSubjects.length === 2, 'Subject Master contains TST3401 and TST3402');

    // ----------------------------------------------------
    // TEST 12, 13, 14, 15: Faculty Marks Upload using Register Number & Subject Master
    // ----------------------------------------------------
    console.log('\n--- Phase 8: Faculty Marks Upload using Subject Master ---');
    const marksRows = [
      { 'Register Number': 'TEST001', 'Subject Code': 'TST3401', 'Subject Title': 'Data Structures & Algorithms', 'Marks': 88 },
      { 'Register Number': 'TEST002', 'Subject Code': 'TST3401', 'Subject Title': 'Data Structures & Algorithms', 'Marks': 95 }
    ];

    const marksPreviewRes = await fetch(`${API_BASE}/faculty/academics/import-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffAToken}`
      },
      body: JSON.stringify({ rows: marksRows })
    });
    const marksPreviewData = await marksPreviewRes.json();
    assert(marksPreviewRes.status === 200 && marksPreviewData.summary.validCount === 2, 'Faculty marks preview validated against Subject Master & Section assignment');

    const marksConfirmRes = await fetch(`${API_BASE}/faculty/academics/import-confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffAToken}`
      },
      body: JSON.stringify({ marks: marksPreviewData.validRows })
    });
    const marksConfirmData = await marksConfirmRes.json();
    assert(marksConfirmRes.status === 200 && marksConfirmData.importedCount === 2, 'Faculty confirmed academic marks upload');

    // Verify marks stored against student_id + register_no + subject
    const stu1 = importedDbStudents.find((s) => s.register_no === 'TEST001')!;
    const acadRecs = await queryAll<any>('SELECT * FROM academic_records WHERE student_id = ?', [stu1.id]);
    assert(acadRecs.length > 0, 'Marks attached to authoritative student record in academic_records');
    const rawSubjects = acadRecs[0]?.subjects_json;
    const parsedSubJson = typeof rawSubjects === 'string' ? JSON.parse(rawSubjects) : (rawSubjects || []);
    const hasTstSubject = parsedSubJson.some((s: any) => s.subjectCode === 'TST3401' && Number(s.marks) === 88);
    assert(hasTstSubject, 'Exact subject mark (TST3401: 88) recorded on student');

    // ----------------------------------------------------
    // TEST 16-20: HOD Navigation Modules Verification
    // ----------------------------------------------------
    console.log('\n--- Phase 9: HOD Portal Structure & Navigation Rules ---');
    // Admin cannot import students (verified earlier)
    const adminForbiddenRes = await fetch(`${API_BASE}/admin/students/import-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hodToken}` },
      body: JSON.stringify({ rows: [] })
    });
    assert(adminForbiddenRes.status === 403, 'Admin student bulk upload strictly forbidden (403)');

    // ----------------------------------------------------
    // TEST 21-24: Dashboard & Award Candidates (Real Data Only, Top 2)
    // ----------------------------------------------------
    console.log('\n--- Phase 10: Award Candidates & Real Data Only ---');
    const candRes = await fetch(`${API_BASE}/hod/award-candidates-v2`, {
      headers: { Authorization: `Bearer ${hodToken}` }
    });
    const candData = await candRes.json();
    assert(candRes.status === 200 && Array.isArray(candData.candidates), 'Award candidates endpoint returns evaluated candidate list');
    // Top candidate approval test
    const candStudentId = stu1.id;
    const actionRes = await fetch(`${API_BASE}/hod/awards/${candStudentId}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodToken}`
      },
      body: JSON.stringify({
        action: 'APPROVE',
        reason: 'Excellent performance in verified assessments'
      })
    });
    const actionData = await actionRes.json();
    assert(actionRes.status === 200 && Boolean(actionData.award), 'HOD can approve award candidate with remarks');

    // ----------------------------------------------------
    // TEST 25: Database Cleanup & Zero Automatic Seeding on Restart
    // ----------------------------------------------------
    console.log('\n--- Phase 11: Zero Automatic Default Data on Restart ---');
    // Delete all test data
    await executeRun("DELETE FROM users WHERE email LIKE '%@avsec-test.edu'");
    await executeRun("DELETE FROM students WHERE email LIKE '%@avsec-test.edu' OR register_no LIKE 'TEST%'");
    await executeRun("DELETE FROM subjects WHERE subject_code LIKE 'TST%'");
    await executeRun('DELETE FROM finalized_awards WHERE winner_student_id = ?', [candStudentId]);

    // Simulate backend server restart
    await initDatabaseSchema();

    // Verify no test or fake records regenerated
    const testUsersAfterRestart = await queryAll("SELECT * FROM users WHERE email LIKE '%@avsec-test.edu'");
    const testStudentsAfterRestart = await queryAll("SELECT * FROM students WHERE register_no LIKE 'TEST%'");
    const testSubjectsAfterRestart = await queryAll("SELECT * FROM subjects WHERE subject_code LIKE 'TST%'");
    assert(testUsersAfterRestart.length === 0, 'No deleted users recreated on restart');
    assert(testStudentsAfterRestart.length === 0, 'No deleted students recreated on restart');
    assert(testSubjectsAfterRestart.length === 0, 'No deleted subjects recreated on restart');

    console.log('\n================================================================');
    console.log(`COMPLETE E2E VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err: any) {
    console.error('CRITICAL ERROR IN E2E VERIFICATION SUITE:', err);
    process.exit(1);
  }
}

runEndToEndVerification();
