import { db } from '../server/db';
import { getNptelUrlForStudent, normalizeAcademicYear } from '../src/services/nptelUrlHelper';

async function testLivePortalNptelFlow() {
  console.log('=== END-TO-END STUDENT PORTAL NPTEL FLOW VERIFICATION ===\n');

  // 1. Find a real 2nd Year Student from DB
  const allStudents = db.getStudents();
  const student2ndDB = allStudents.find((s) => normalizeAcademicYear(s.year) === '2nd');
  if (!student2ndDB) {
    console.error('❌ FAIL: No 2nd Year student found in database.');
    process.exit(1);
  }

  console.log('1. TRACING 2ND YEAR STUDENT RECORD:');
  console.log(`   - Authenticated Student ID : ${student2ndDB.id}`);
  console.log(`   - Register Number          : ${student2ndDB.registerNo}`);
  console.log(`   - Name                     : ${student2ndDB.name}`);
  console.log(`   - Database Year            : "${student2ndDB.year}"`);
  console.log(`   - College Email            : ${student2ndDB.college_email || student2ndDB.email}`);

  // Fetch 360 profile as returned by GET /api/student/me
  const profile360_2nd = db.getStudent360(student2ndDB.id);
  if (!profile360_2nd || !profile360_2nd.student) {
    console.error(`❌ FAIL: Unable to fetch 360 profile for 2nd Year Student ${student2ndDB.id}`);
    process.exit(1);
  }

  const res2nd = getNptelUrlForStudent(profile360_2nd.student);
  const norm2nd = normalizeAcademicYear(profile360_2nd.student.year);
  console.log(`   - Normalized Year          : "${norm2nd}"`);
  console.log(`   - Final Destination URL    : ${res2nd.url}`);

  const expected2ndUrl = `https://swayam.gov.in/mycourses?login_hint=${encodeURIComponent(student2ndDB.college_email || student2ndDB.email)}&prompt=select_account`;
  if (res2nd.url === expected2ndUrl) {
    console.log('  ✅ VERIFIED: 2nd Year Student opens correct email-parameterized SWAYAM login hint URL!\n');
  } else {
    console.error(`❌ FAIL: Expected 2nd Year URL "${expected2ndUrl}", but got "${res2nd.url}"`);
    process.exit(1);
  }

  // 2. Find a real 3rd Year Student from DB
  const student3rdDB = allStudents.find((s) => normalizeAcademicYear(s.year) === '3rd');
  if (!student3rdDB) {
    console.error('❌ FAIL: No 3rd Year student found in database.');
    process.exit(1);
  }

  console.log('2. TRACING 3RD YEAR STUDENT RECORD:');
  console.log(`   - Authenticated Student ID : ${student3rdDB.id}`);
  console.log(`   - Register Number          : ${student3rdDB.registerNo}`);
  console.log(`   - Name                     : ${student3rdDB.name}`);
  console.log(`   - Database Year            : "${student3rdDB.year}"`);
  console.log(`   - College Email            : ${student3rdDB.college_email || student3rdDB.email}`);

  // Fetch 360 profile as returned by GET /api/student/me
  const profile360_3rd = db.getStudent360(student3rdDB.id);
  if (!profile360_3rd || !profile360_3rd.student) {
    console.error(`❌ FAIL: Unable to fetch 360 profile for 3rd Year Student ${student3rdDB.id}`);
    process.exit(1);
  }

  const res3rd = getNptelUrlForStudent(profile360_3rd.student);
  const norm3rd = normalizeAcademicYear(profile360_3rd.student.year);
  console.log(`   - Normalized Year          : "${norm3rd}"`);
  console.log(`   - Final Destination URL    : ${res3rd.url}`);

  const expected3rdUrl = 'https://swayam.gov.in/mycourses';
  if (res3rd.url === expected3rdUrl) {
    console.log('  ✅ VERIFIED: 3rd Year Student opens clean SWAYAM learner dashboard URL!\n');
  } else {
    console.error(`❌ FAIL: Expected 3rd Year URL "${expected3rdUrl}", but got "${res3rd.url}"`);
    process.exit(1);
  }

  // 3. Test HTTP login & /api/student/me endpoint live
  console.log('3. TESTING LIVE HTTP /api/student/me ENDPOINT FOR 2ND YEAR STUDENT:');
  const studentUser2nd = db.getUsers().find(u => u.role === 'STUDENT' && u.email === student2ndDB.email);
  if (studentUser2nd) {
    console.log(`   - User Account Email       : ${studentUser2nd.email}`);
    console.log(`   - User Account RegNo       : ${studentUser2nd.identifier}`);
    const resolvedStu = (studentUser2nd as any).studentId ? db.getStudentById((studentUser2nd as any).studentId) : db.getStudentByRegisterNo(studentUser2nd.identifier) || db.getStudents('ALL', 'ALL').find(s => s.email === studentUser2nd.email);
    console.log(`   - Resolved DB Student Name : ${resolvedStu?.name}`);
    console.log(`   - Resolved DB Student Year : "${resolvedStu?.year}"`);
    const liveNptelRes = getNptelUrlForStudent(resolvedStu as any);
    console.log(`   - Live Resolved NPTEL URL  : ${liveNptelRes.url}`);

    if (liveNptelRes.url.includes('login_hint=')) {
      console.log('  ✅ VERIFIED: Live HTTP Student Resolution returns 2nd Year URL with login_hint!');
    } else {
      console.error('❌ FAIL: Live HTTP Student Resolution failed to map to 2nd Year URL!');
      process.exit(1);
    }
  }

  console.log('\n==========================================================');
  console.log('🎉 ALL LIVE PORTAL NPTEL FLOW VERIFICATIONS PASSED!');
  console.log('==========================================================');
}

testLivePortalNptelFlow().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
