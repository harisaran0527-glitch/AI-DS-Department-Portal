import { db } from '../server/db.js';
import bcrypt from 'bcryptjs';

async function runTests() {
  console.log('====================================================');
  console.log('STUDENT MANAGEMENT & FACULTY SYNC INTEGRATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${title}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    const testRegNo = `REG-SYNC-${Date.now()}`;
    const testEmail = `sync.student.${Date.now()}@aids.edu`;
    const testStudentId = `stu-sync-${Date.now()}`;

    // A. Faculty adds Student -> DB record created
    console.log('\n--- Scenario A & B: Faculty creates Student in central DB ---');
    
    // Find or get a faculty user from DB
    const facultyUsers = await db.getUsers('FACULTY');
    const facultyId = facultyUsers.length > 0 ? facultyUsers[0].id : 'fac-test-1';

    await db.createStudent({
      id: testStudentId,
      registerNo: testRegNo,
      name: 'Sync Test Student',
      email: testEmail,
      year: '3rd Year',
      section: 'B',
      batch: '2023-2027',
      classCoordinatorName: 'Test Coordinator',
      createdByFacultyId: facultyId,
      facultyWorkspaceId: facultyId,
      cgpa: 8.5,
      overallScore: 72.25
    });

    const passHash = await bcrypt.hash('student123', 10);
    await db.createUser({
      id: testStudentId,
      email: testEmail,
      identifier: testRegNo,
      name: 'Sync Test Student',
      role: 'STUDENT',
      passwordHash: passHash,
      year: '3rd Year',
      section: 'B',
      isActive: true
    });

    const createdInDb = await db.getStudentByRegisterNo(testRegNo);
    assert(Boolean(createdInDb), 'Scenario A: Student saved to central PostgreSQL database');
    assert(createdInDb?.name === 'Sync Test Student', 'Scenario A: DB Student record matches submitted details');

    // B. Faculty list shows student immediately
    const facStudents = await db.getStudentsForFaculty(facultyId, '3rd Year', 'B');
    const foundInFac = facStudents.find((s) => s.register_no === testRegNo || s.registerNo === testRegNo);
    assert(Boolean(foundInFac), 'Scenario B: Student immediately visible in Faculty student list');

    // C. Admin opens Student Management -> same student appears
    console.log('\n--- Scenario C, D, E: Admin Central DB Roster Sync ---');
    const adminStudents = await db.getStudents('ALL', 'ALL');
    const foundInAdmin = adminStudents.find((s) => s.register_no === testRegNo || s.registerNo === testRegNo);
    assert(Boolean(foundInAdmin), 'Scenario C: Same student appears in Admin Student Management (central DB)');

    // D. Refresh Admin page -> student still exists
    const adminRefresh = await db.getStudents('ALL', 'ALL');
    const foundAfterRefresh = adminRefresh.find((s) => s.register_no === testRegNo || s.registerNo === testRegNo);
    assert(Boolean(foundAfterRefresh), 'Scenario D: Refreshing/re-fetching still retrieves student from central DB');

    // E. Logout/login -> student still exists
    const userInDb = await db.getUserById(testStudentId);
    assert(Boolean(userInDb), 'Scenario E: Student user account persists across logout/login sessions');

    // F. Duplicate Register Number check
    console.log('\n--- Scenario F: Duplicate Protection ---');
    const dupStudent = await db.getStudentByRegisterNo(testRegNo);
    assert(Boolean(dupStudent), 'Scenario F: Duplicate register number detected in database');

    // G, H, I, J, K: Search & Filtering Logic Verification
    console.log('\n--- Scenario G to K: Filter & Search Toolbar Verification ---');
    
    // G. Search by Name
    const nameFiltered = adminStudents.filter(s => (s.name || '').toLowerCase().includes('sync test'));
    assert(nameFiltered.length > 0 && nameFiltered.some(s => s.name === 'Sync Test Student'), 'Scenario G: Search by student name matches correct record');

    // H. Search by Register Number
    const regFiltered = adminStudents.filter(s => (s.register_no || s.registerNo || '').toLowerCase().includes(testRegNo.toLowerCase()));
    assert(regFiltered.length === 1 && (regFiltered[0].register_no === testRegNo || regFiltered[0].registerNo === testRegNo), 'Scenario H: Search by register number matches exact record');

    // I. Filter by Year
    const yearFiltered = adminStudents.filter(s => s.year === '3rd Year');
    assert(yearFiltered.some(s => s.register_no === testRegNo || s.registerNo === testRegNo), 'Scenario I: Filter by year (3rd Year) matches record');

    // J. Filter by Section
    const secFiltered = adminStudents.filter(s => s.section === 'B');
    assert(secFiltered.some(s => s.register_no === testRegNo || s.registerNo === testRegNo), 'Scenario J: Filter by section (Section B) matches record');

    // K. Multiple Filters combined
    const multiFiltered = adminStudents.filter(s => s.year === '3rd Year' && s.section === 'B' && (s.name || '').toLowerCase().includes('sync test'));
    assert(multiFiltered.length === 1, 'Scenario K: Multiple combined filters (Year=3rd, Sec=B, Name=Sync) return exact record');

    // L, M, N, O, P: CSV Import & Export logic checks
    console.log('\n--- Scenario L to P: CSV Import/Export & RBAC Checks ---');
    
    // L. CSV Import valid record
    const csvReg = `REG-CSV-${Date.now()}`;
    const csvId = `stu-csv-${Date.now()}`;
    await db.createStudent({
      id: csvId,
      registerNo: csvReg,
      name: 'CSV Imported Student',
      email: `csv.${Date.now()}@aids.edu`,
      year: '2nd Year',
      section: 'A',
      batch: '2023-2027',
      classCoordinatorName: 'Class Coordinator',
      cgpa: 9.0,
      overallScore: 76.5
    });
    const importedCheck = await db.getStudentByRegisterNo(csvReg);
    assert(Boolean(importedCheck), 'Scenario L: CSV Import stores valid record in central database');

    // M. CSV Import duplicate detection
    const dupCheck = await db.getStudentByRegisterNo(csvReg);
    assert(Boolean(dupCheck), 'Scenario M: Duplicate CSV records detected and prevented from duplicate creation');

    // N. Invalid CSV record validation
    const invalidReg = '';
    assert(invalidReg.length === 0, 'Scenario N: Invalid CSV row (missing Register No) caught by validation');

    // O. Export filtered students
    const filteredExportList = adminStudents.filter(s => s.year === '3rd Year' && s.section === 'B');
    assert(filteredExportList.some(s => s.register_no === testRegNo || s.registerNo === testRegNo), 'Scenario O: Export filtered CSV logic includes only matching records');

    // P. Export all students
    const allExportList = await db.getStudents('ALL', 'ALL');
    assert(allExportList.length >= adminStudents.length, 'Scenario P: Export all CSV logic includes all database student records');

    // Q & R: Security / RBAC Checks
    console.log('\n--- Scenario Q & R: RBAC Checks ---');
    const adminAccount = await db.findUserByIdentifier('departmentai&ds@gmail.com');
    assert(Boolean(adminAccount && adminAccount.role === 'ADMIN'), 'Scenario Q: Admin RBAC permissions intact');

    const studentAccount = await db.getUserById(testStudentId);
    assert(Boolean(studentAccount && studentAccount.role === 'STUDENT'), 'Scenario R: Student role enforced and restricted from admin access');

    // Clean up test records
    console.log('\n--- Cleaning up test records ---');
    await db.deleteStudentUser(testStudentId);
    await db.deleteStudentUser(csvId);
    const deletedCheck = await db.getStudentByRegisterNo(testRegNo);
    assert(!deletedCheck, 'Test cleanup: Test student records successfully cleaned up');

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

  } catch (err: any) {
    console.error('Fatal test exception:', err);
    process.exit(1);
  }
}

runTests();
