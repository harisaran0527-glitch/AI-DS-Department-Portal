import { initDatabaseSchema, db } from '../server/db.js';

async function runDisciplineE2ETests() {
  console.log('🧪 Starting End-to-End Discipline Issue Module Verification...');

  // 1. Initialize Database Schema
  await initDatabaseSchema();
  console.log('✅ Database schema initialized successfully.');

  // 2. Fetch existing student for testing or create seed student
  const allStudents = await db.getAllStudents();
  if (allStudents.length === 0) {
    console.error('❌ Error: No students found in database to run discipline test.');
    process.exit(1);
  }

  const targetStudent = allStudents[0];
  console.log(`📌 Selected test student: ${targetStudent.name} (${targetStudent.registerNo}) - ${targetStudent.year} Sec ${targetStudent.section}`);

  // 3. Test Student Lookup by Register Number (Req 2, 4)
  const regNo = targetStudent.registerNo || targetStudent.register_no || '';
  const lookupResult = await db.getStudentByRegisterNo(regNo);
  if (!lookupResult) {
    console.error(`❌ Error: Failed to lookup student by register number ${targetStudent.registerNo}`);
    process.exit(1);
  }
  if (
    lookupResult.name !== targetStudent.name ||
    lookupResult.year !== targetStudent.year ||
    lookupResult.section !== targetStudent.section
  ) {
    console.error('❌ Error: Auto-fetched student details do not match database record.');
    process.exit(1);
  }
  console.log(`✅ Req 4 Passed: Auto-fetched student details (Name: "${lookupResult.name}", Email: "${lookupResult.email}", Year: "${lookupResult.year}", Section: "${lookupResult.section}")`);

  // 4. Test Invalid Register Number Lookup (Req 8)
  const invalidLookup = await db.getStudentByRegisterNo('INVALID_999999999');
  if (invalidLookup !== null) {
    console.error('❌ Error: Invalid register number returned a match when it should be null.');
    process.exit(1);
  }
  console.log('✅ Req 8 Passed: Invalid Register Number properly returned no match.');

  // 5. Test Creating a Discipline Record (Req 3, 5, 7, 9)
  const now = new Date();
  const testDate = now.toISOString().split('T')[0];
  const testTime = now.toTimeString().split(' ')[0];

  const created = await db.addDisciplineIssue({
    studentId: targetStudent.id,
    date: testDate,
    time: testTime,
    category: 'Dress Code / ID Card Violation',
    ruleViolated: 'Rule 1: Mandatory Formal Dress Code & ID Card Display',
    actionTaken: 'Verbal warning issued and parent notified',
    fineAmount: 100,
    fineDetails: 'Fine receipt #DISC-1001 paid to department office',
    remark: 'Student promised compliance for future lab sessions',
    recordedBy: 'Discipline Coordinator (test.faculty@aids.edu)'
  });

  if (!created || !created.id) {
    console.error('❌ Error: Failed to create discipline issue record.');
    process.exit(1);
  }
  console.log(`✅ Req 9 Passed: Discipline issue created with ID "${created.id}" and securely attached to student "${targetStudent.registerNo}".`);

  // 6. Test Fetching & Searching Discipline Records (Req 10, 11)
  const records = await db.getAllDisciplineIssues({ registerNo: targetStudent.registerNo });
  const matched = records.find((r) => r.id === created.id);
  if (!matched) {
    console.error('❌ Error: Created discipline record not found in query results.');
    process.exit(1);
  }
  if (matched.fineAmount !== 100 || matched.ruleViolated !== 'Rule 1: Mandatory Formal Dress Code & ID Card Display') {
    console.error('❌ Error: Record fields do not match inserted values.');
    process.exit(1);
  }
  console.log('✅ Req 10 & 11 Passed: Discipline records queried successfully with full student details.');

  // 7. Clean up test record
  await db.deleteDisciplineIssue(created.id);
  console.log('✅ Test record cleaned up successfully.');

  console.log('\n🎉 ALL DISCIPLINE ISSUE MODULE E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runDisciplineE2ETests().catch((err) => {
  console.error('❌ E2E Test Exception:', err);
  process.exit(1);
});
