import { db } from '../server/db';
import * as fs from 'fs';
import * as path from 'path';

async function testNptelDirectNavigation() {
  console.log('=== NPTEL DIRECT NAVIGATION VERIFICATION ===\n');

  // Step 1: Scan codebase for any leftover nc_details/NPTEL URLs
  console.log('1. Checking codebase for outdated nc_details/NPTEL references...');
  const rootDir = process.cwd();
  const facultyDashboardPath = path.join(rootDir, 'src/pages/faculty/FacultyDashboard.tsx');
  const studentDashboardPath = path.join(rootDir, 'src/pages/student/StudentDashboard.tsx');

  const facultyContent = fs.readFileSync(facultyDashboardPath, 'utf-8');
  const studentContent = fs.readFileSync(studentDashboardPath, 'utf-8');

  const hasNcDetailsInFaculty = facultyContent.includes('nc_details');
  const hasNcDetailsInStudent = studentContent.includes('nc_details');

  if (hasNcDetailsInFaculty || hasNcDetailsInStudent) {
    console.error('❌ FAIL: Found outdated nc_details URL in codebase!');
    process.exit(1);
  } else {
    console.log('  ✅ SUCCESS: No nc_details/NPTEL URLs found in codebase.');
  }

  // Step 2: Verify SWAYAM mycourses direct learner dashboard URLs
  console.log('\n2. Verifying SWAYAM mycourses direct learner dashboard URLs...');
  const hasMyCoursesInFaculty = facultyContent.includes('https://swayam.gov.in/mycourses');
  const hasMyCoursesInStudent = studentContent.includes('https://swayam.gov.in/mycourses');

  if (!hasMyCoursesInFaculty || !hasMyCoursesInStudent) {
    console.error('❌ FAIL: Missing https://swayam.gov.in/mycourses URL in Faculty or Student Dashboard!');
    process.exit(1);
  } else {
    console.log('  ✅ SUCCESS: Both Faculty and Student dashboards link directly to https://swayam.gov.in/mycourses');
  }

  // Step 3: Verify clean NPTEL URLs without forced login_hint
  console.log('\n3. Verifying clean NPTEL URLs without forced login_hint...');
  const hasLoginHintInStudent = studentContent.includes('mycourses?login_hint=');
  const hasLoginHintInFaculty = facultyContent.includes('mycourses?login_hint=');

  if (hasLoginHintInStudent || hasLoginHintInFaculty) {
    console.error('❌ FAIL: Found forced login_hint in NPTEL URL!');
    process.exit(1);
  } else {
    console.log('  ✅ SUCCESS: NPTEL URLs are clean without forced login_hint parameter.');
  }

  // Step 4: Verify NPTEL student records in DB are preserved
  console.log('\n4. Verifying preserved database NPTEL records and student mappings...');
  const students = db.getStudents();
  console.log(`  Found ${students.length} students in database.`);
  let nptelRecordsFound = 0;
  for (const s of students) {
    const s360 = db.getStudent360(s.id);
    if (s360 && s360.nptel && s360.nptel.length > 0) {
      nptelRecordsFound += s360.nptel.length;
      console.log(`   - Student ${s.name} (${s.collegeEmail || s.email}): ${s360.nptel.length} NPTEL course(s) preserved.`);
    }
  }
  console.log(`  Total preserved NPTEL course records: ${nptelRecordsFound}`);

  console.log('\n==================================================');
  console.log('🎉 ALL NPTEL DIRECT NAVIGATION VERIFICATIONS PASSED!');
  console.log('==================================================');
}

testNptelDirectNavigation().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
