import { db } from '../server/db';
import path from 'path';
import fs from 'fs';

async function runTests() {
  console.log('🧪 Running Mandatory Faculty Portal Integration Tests...');

  // 1. Verify Database Connection and Schema
  const testFacId = 'fac-test-id-1234';
  const testStudentRegNo = `REG${Date.now()}`;
  const collegeMail = `${testStudentRegNo.toLowerCase()}@aids.edu`;
  const personalMail = `${testStudentRegNo.toLowerCase()}.personal@gmail.com`;

  console.log('1. Creating test student with College Mail ID and Personal Mail ID...');
  const newStudent = db.createStudentForFaculty(testFacId, {
    registerNo: testStudentRegNo,
    name: 'Saran Test Student',
    email: collegeMail,
    collegeEmail: collegeMail,
    personalEmail: personalMail,
    entryType: 'Regular',
    batch: '2023-2027',
    password: 'password123'
  });

  console.log('   Student created with ID:', newStudent.id);

  // 2. Verify Student Normalization and Dual Email Fields
  console.log('2. Verifying Student Normalization & Email Fields...');
  const fetchedStudent = db.getStudentById(newStudent.id);
  if (!fetchedStudent) {
    throw new Error('FAILED: Created student not found by getStudentById.');
  }

  if (fetchedStudent.register_no !== testStudentRegNo || fetchedStudent.registerNo !== testStudentRegNo) {
    throw new Error(`FAILED: Register Number mismatch. Expected ${testStudentRegNo}, got register_no:${fetchedStudent.register_no}, registerNo:${fetchedStudent.registerNo}`);
  }

  if (fetchedStudent.email !== collegeMail || fetchedStudent.collegeEmail !== collegeMail) {
    throw new Error(`FAILED: College Email mismatch. Expected ${collegeMail}, got email:${fetchedStudent.email}, collegeEmail:${fetchedStudent.collegeEmail}`);
  }

  if (fetchedStudent.personal_email !== personalMail || fetchedStudent.personalEmail !== personalMail) {
    throw new Error(`FAILED: Personal Email mismatch. Expected ${personalMail}, got personal_email:${fetchedStudent.personal_email}, personalEmail:${fetchedStudent.personalEmail}`);
  }
  console.log('   ✅ Register Number & Dual Email IDs verified successfully!');

  // 3. Verify NPTEL Proof Workflow Database Methods
  console.log('3. Testing NPTEL Proof DB Persistence...');
  const dummyFile = 'dummy-nptel-proof.png';
  const proofRecord = db.addNptelProof(newStudent.id, 1, dummyFile, 'Screenshot_Week1.png');

  if (!proofRecord || proofRecord.week_no !== 1) {
    throw new Error('FAILED: NPTEL Proof record creation failed.');
  }
  console.log('   Proof Record inserted:', proofRecord.id);

  const proofList = db.getNptelProofs(newStudent.id);
  if (proofList.length === 0 || proofList[0].id !== proofRecord.id) {
    throw new Error('FAILED: NPTEL Proof list retrieval failed.');
  }
  console.log('   ✅ NPTEL Proof list retrieval verified!');

  db.deleteNptelProof(proofRecord.id, newStudent.id);
  const proofListAfterDelete = db.getNptelProofs(newStudent.id);
  if (proofListAfterDelete.length !== 0) {
    throw new Error('FAILED: NPTEL Proof deletion failed.');
  }
  console.log('   ✅ NPTEL Proof deletion verified!');

  // Clean up test student
  const sqlite = (db as any).sqlite || (db as any).db;
  if (sqlite) {
    try {
      sqlite.prepare('DELETE FROM students WHERE id = ?').run(newStudent.id);
      sqlite.prepare('DELETE FROM users WHERE identifier = ?').run(testStudentRegNo);
    } catch {}
  }

  console.log('🎉 ALL FACULTY PORTAL INTEGRATION TESTS PASSED CLEANLY!');
}

runTests().catch((err) => {
  console.error('❌ TEST FAILURE:', err);
  process.exit(1);
});
