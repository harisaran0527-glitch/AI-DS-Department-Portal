import { getNptelUrlForStudent, normalizeAcademicYear } from '../src/services/nptelUrlHelper';
import { db } from '../server/db';

async function testYearBasedNptelMapping() {
  console.log('=== YEAR-BASED NPTEL URL MAPPING VERIFICATION ===\n');

  const testEmail = 'student.test@aids.edu';
  const expected2ndUrl = `https://swayam.gov.in/mycourses?login_hint=${encodeURIComponent(testEmail)}&prompt=select_account`;
  const expected3rdUrl = 'https://swayam.gov.in/mycourses';

  // Requirement 4: Test 2nd Year variations ('2nd Year', 'II', '2', '2nd', 'Second')
  console.log('1. Testing 2nd Year Academic Year Formats...');
  const year2ndVariants = ['2nd Year', 'II', '2', '2nd', 'Second', '2nd Yr'];
  for (const yearVar of year2ndVariants) {
    const norm = normalizeAcademicYear(yearVar);
    const res = getNptelUrlForStudent({ year: yearVar, collegeEmail: testEmail });
    if (norm === '2nd' && res.url === expected2ndUrl) {
      console.log(`  ✅ SUCCESS: Variant "${yearVar}" correctly normalized to 2nd Year and returned URL with login_hint!`);
    } else {
      console.error(`❌ FAIL: Variant "${yearVar}" expected 2nd Year URL but got: ${res.url} (normalized: ${norm})`);
      process.exit(1);
    }
  }

  // Requirement 4: Test 3rd Year variations ('3rd Year', 'III', '3', '3rd', 'Third')
  console.log('\n2. Testing 3rd Year Academic Year Formats...');
  const year3rdVariants = ['3rd Year', 'III', '3', '3rd', 'Third', '3rd Yr'];
  for (const yearVar of year3rdVariants) {
    const norm = normalizeAcademicYear(yearVar);
    const res = getNptelUrlForStudent({ year: yearVar, collegeEmail: testEmail });
    if (norm === '3rd' && res.url === expected3rdUrl) {
      console.log(`  ✅ SUCCESS: Variant "${yearVar}" correctly normalized to 3rd Year and returned clean URL!`);
    } else {
      console.error(`❌ FAIL: Variant "${yearVar}" expected 3rd Year clean URL but got: ${res.url} (normalized: ${norm})`);
      process.exit(1);
    }
  }

  // Substring Collision Regression Check ('III' must NEVER match 'II')
  console.log('\n3. Testing Substring Collision Regression Check ("III" vs "II")...');
  const resIII = getNptelUrlForStudent({ year: 'III', collegeEmail: testEmail });
  if (resIII.url === expected3rdUrl) {
    console.log('  ✅ SUCCESS: Roman numeral "III" correctly maps to 3rd Year clean URL and does NOT collide with "II"!');
  } else {
    console.error(`❌ FAIL: Roman numeral "III" mapped to wrong URL: ${resIII.url}`);
    process.exit(1);
  }

  // Test Case 4: Missing Email for 2nd Year Student
  console.log('\n4. Testing 2nd Year Student with Missing Email (Error Case)...');
  const resNoEmail = getNptelUrlForStudent({ year: '2nd Year', collegeEmail: '', email: '' });
  if (resNoEmail.error && !resNoEmail.url) {
    console.log(`  ✅ SUCCESS: Missing email for 2nd Year student triggers clear error: "${resNoEmail.error}"`);
  } else {
    console.error(`❌ FAIL: Expected error for missing email, but got URL: ${resNoEmail.url}`);
    process.exit(1);
  }

  // Test Case 5: Verify Actual Database Students
  console.log('\n5. Verifying Actual Database Student Records...');
  const students = db.getStudents();
  console.log(`   - Total DB Students: ${students.length}`);

  let count2nd = 0;
  let count3rd = 0;

  for (const student of students) {
    const email = student.college_email || student.email;
    const res = getNptelUrlForStudent({ year: student.year, collegeEmail: email, email });
    const norm = normalizeAcademicYear(student.year);

    if (norm === '2nd') {
      count2nd++;
      if (!res.url.includes('login_hint=')) {
        console.error(`❌ FAIL: DB 2nd Year Student ${student.name} did not get login_hint URL!`);
        process.exit(1);
      }
    } else if (norm === '3rd') {
      count3rd++;
      if (res.url !== expected3rdUrl) {
        console.error(`❌ FAIL: DB 3rd Year Student ${student.name} got non-clean URL: ${res.url}`);
        process.exit(1);
      }
    }
  }

  console.log(`   - Verified ${count2nd} 2nd Year DB Students (All mapped to 2nd Year SSO URL)`);
  console.log(`   - Verified ${count3rd} 3rd Year DB Students (All mapped to 3rd Year Clean URL)`);

  console.log('\n==========================================================');
  console.log('🎉 ALL YEAR-BASED NPTEL MAPPING VERIFICATIONS PASSED!');
  console.log('==========================================================');
}

testYearBasedNptelMapping().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

