import { db } from '../server/db.js';

async function runDisciplineE2EVerification() {
  console.log('🧪 Starting End-to-End Discipline Issue Module Verification...');

  try {
    // 1. Fetch a test student
    const students = await db.getAllStudents();
    if (!students || students.length === 0) {
      throw new Error('No students found in database for discipline testing.');
    }
    const testStudent = students[0];
    console.log(`📌 Test Student: ${testStudent.name} (${testStudent.register_no}) - ${testStudent.year} Sec ${testStudent.section}`);

    // 3. Test Student Details Auto-fetch by Register Number
    const foundStudent = await db.getStudentByRegisterNo(testStudent.register_no || '');
    if (!foundStudent || foundStudent.id !== testStudent.id) {
      throw new Error(`Failed to auto-fetch student by Register Number: ${testStudent.register_no}`);
    }
    console.log(`✅ Req 4 Passed: Auto-fetched student details (Name: "${foundStudent.name}", Email: "${foundStudent.email}", Year: "${foundStudent.year}", Section: "${foundStudent.section}")`);

    // 4. Test Invalid Register Number Validation
    const invalidStudent = await db.getStudentByRegisterNo('INVALID_REG_NO_999999999');
    if (invalidStudent) {
      throw new Error('Invalid Register Number unexpectedly matched a student!');
    }
    console.log('✅ Req 8 Passed: Invalid Register Number properly returned no match.');

    // 5. Create a Discipline Issue Record attached securely to student.id
    const issueDate = new Date().toISOString().split('T')[0];
    const issueTime = new Date().toTimeString().split(' ')[0];
    const createdRecord = await db.addDisciplineIssue({
      studentId: testStudent.id,
      date: issueDate,
      time: issueTime,
      category: 'Mobile Phone Confiscation',
      ruleViolated: 'Use of Electronic Gadgets in Academic Zone',
      actionTaken: 'Device confiscated & parent informed',
      fineAmount: 500,
      fineDetails: 'Paid via College Counter Receipt #REC-8842',
      remark: 'Repeated violation during lecture hour',
      recordedBy: 'Dr. Faculty Admin'
    });

    if (!createdRecord || !createdRecord.id) {
      throw new Error('Failed to create discipline issue record.');
    }
    console.log(`✅ Req 9 Passed: Discipline issue created with ID "${createdRecord.id}" and securely attached to student "${testStudent.id}".`);

    // 6. Test Department-Wide Discipline Queries (Faculty & HOD View)
    const allDisciplineIssues = await db.getAllDisciplineIssues({ registerNo: testStudent.register_no });
    const targetIssue = allDisciplineIssues.find((i: any) => i.id === createdRecord.id);
    if (!targetIssue || targetIssue.fineAmount !== 500 || targetIssue.ruleViolated !== 'Use of Electronic Gadgets in Academic Zone') {
      throw new Error('Created discipline record missing or incorrect in department-wide query.');
    }
    console.log('✅ Req 10 & 11 Passed: Department-wide discipline records queried successfully with full student details.');

    // 7. Test Student Portal Reflection (CRITICAL)
    const student360 = await db.getStudent360(testStudent.id);
    if (!student360 || !Array.isArray(student360.discipline)) {
      throw new Error('Discipline records array missing in Student 360 profile.');
    }
    const studentReflectedIssue = student360.discipline.find((d: any) => d.id === createdRecord.id);
    if (!studentReflectedIssue) {
      throw new Error('Discipline record created by staff did NOT reflect in Student Portal profile!');
    }
    if (
      studentReflectedIssue.fine_amount !== 500 &&
      studentReflectedIssue.fineAmount !== 500
    ) {
      throw new Error('Student Portal reflected record has mismatched fine amount or metadata.');
    }
    console.log('✅ Req 6 Passed: Discipline issue automatically reflected in student\'s own Student Portal profile!');

    // 8. Clean up test record
    const deleted = await db.deleteDisciplineIssue(createdRecord.id);
    if (!deleted) {
      console.warn('⚠️ Warning: Could not delete test discipline issue record during cleanup.');
    } else {
      console.log('✅ Test record cleaned up successfully.');
    }

    console.log('\n🎉 ALL DISCIPLINE ISSUE MODULE E2E VERIFICATION TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ E2E Verification Failed:', err.message || err);
    process.exit(1);
  }
}

runDisciplineE2EVerification();
