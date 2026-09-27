import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000/api';

async function runCertificateEndpointTests() {
  console.log('📜 Starting CERTIFICATE MODULE FILE UPLOAD & MANAGEMENT API TESTS...\n');

  // 1. Faculty Login
  const facEmail = 'faculty.aids@avsenggcollege.ac.in';
  const facPass = 'faculty@123';
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: facEmail, password: facPass, role: 'FACULTY' })
  });

  if (!loginRes.ok) {
    throw new Error(`Faculty login failed with status ${loginRes.status}`);
  }
  const cookie = loginRes.headers.get('set-cookie') || '';
  console.log('✅ Faculty Login Successful.');

  // 2. Create Controlled Test Student for Certificate Testing
  const rand = Math.floor(Math.random() * 89999 + 10000);
  const testRegNo = `CERT_TEST_${rand}`;
  const createStuRes = await fetch(`${BASE_URL}/faculty/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      registerNo: testRegNo,
      name: 'Cert Test Student',
      email: `cert_test_${rand}@aids.edu`,
      batch: '2023-2027',
      password: 'student123'
    })
  });
  const createStuData = await createStuRes.json();
  if (!createStuRes.ok || !createStuData.student) {
    throw new Error(`Failed to create test student: ${JSON.stringify(createStuData)}`);
  }
  const student = createStuData.student;
  console.log(`✅ Test Student Created: ${student.name} (ID: ${student.id}, Reg: ${student.registerNo || student.register_no})`);

  // Create temporary test files
  const testDir = path.resolve(process.cwd(), 'scratch');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const sampleCertPdf = path.join(testDir, 'test_certificate.pdf');
  fs.writeFileSync(sampleCertPdf, '%PDF-1.4 Fake Certificate PDF Content for Testing');

  const invalidFile = path.join(testDir, 'test_script.sh');
  fs.writeFileSync(invalidFile, '#!/bin/bash\necho "invalid"');

  let createdCertId: string | null = null;

  try {
    // TEST 1: Missing Required Fields -> 400 Bad Request
    console.log('\nStep 1: Testing missing courseName/platform validation (Expect 400)...');
    const formBad = new FormData();
    formBad.append('courseName', '');
    formBad.append('platform', 'Coursera');
    formBad.append('file', new Blob([fs.readFileSync(sampleCertPdf)], { type: 'application/pdf' }), 'test_certificate.pdf');

    const badRes = await fetch(`${BASE_URL}/faculty/students/${student.id}/certificates/upload`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: formBad
    });
    const badData = await badRes.json();
    if (badRes.status === 400 && badData.error) {
      console.log(`  -> PASS: Rejected missing fields with HTTP 400 ("${badData.error}")`);
    } else {
      throw new Error(`Expected 400, got ${badRes.status}: ${JSON.stringify(badData)}`);
    }

    // TEST 2: Invalid File Extension -> 400 Bad Request
    console.log('\nStep 2: Testing invalid file extension validation (Expect 400)...');
    const formInvalidExt = new FormData();
    formInvalidExt.append('courseName', 'Test Shell Script Course');
    formInvalidExt.append('platform', 'Coursera');
    formInvalidExt.append('category', 'Technical Certification');
    formInvalidExt.append('file', new Blob([fs.readFileSync(invalidFile)], { type: 'text/x-shellscript' }), 'test_script.sh');

    const invalidRes = await fetch(`${BASE_URL}/faculty/students/${student.id}/certificates/upload`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: formInvalidExt
    });
    const invalidData = await invalidRes.json();
    if (invalidRes.status === 400 && invalidData.error) {
      console.log(`  -> PASS: Rejected invalid file extension with HTTP 400 ("${invalidData.error}")`);
    } else {
      throw new Error(`Expected 400, got ${invalidRes.status}: ${JSON.stringify(invalidData)}`);
    }

    // TEST 3: Valid Certificate Upload -> 201 Created
    console.log('\nStep 3: Uploading valid PDF Certificate via FormData...');
    const formValid = new FormData();
    formValid.append('courseName', 'AWS Certified Cloud Practitioner - AUDIT TEST');
    formValid.append('platform', 'AWS / Coursera');
    formValid.append('category', 'Cloud / AWS');
    formValid.append('issueDate', '2026-05-15');
    formValid.append('file', new Blob([fs.readFileSync(sampleCertPdf)], { type: 'application/pdf' }), 'test_certificate.pdf');

    const validRes = await fetch(`${BASE_URL}/faculty/students/${student.id}/certificates/upload`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: formValid
    });
    const validData = await validRes.json();
    if (validRes.status === 201 && validData.certId) {
      createdCertId = validData.certId;
      console.log(`  -> PASS: Certificate Uploaded Successfully! (Cert ID: ${createdCertId})`);
    } else {
      throw new Error(`Upload Failed: ${validRes.status} - ${JSON.stringify(validData)}`);
    }

    // TEST 4: Fetch Student 360 and verify certificate persistence
    console.log('\nStep 4: Verifying Certificate persistence in Student 360 profile...');
    const s360Res = await fetch(`${BASE_URL}/faculty/students/${student.id}/360`, {
      headers: { Cookie: cookie }
    });
    const s360Data = await s360Res.json();
    const certFound = (s360Data.certificates || []).find((c: any) => c.id === createdCertId);
    if (certFound && certFound.courseName === 'AWS Certified Cloud Practitioner - AUDIT TEST') {
      console.log(`  -> PASS: Certificate record persisted in database with title "${certFound.courseName}"`);
    } else {
      throw new Error('Uploaded certificate not found in student 360 response!');
    }

    // TEST 5: Update Certificate Metadata -> 200 OK
    console.log('\nStep 5: Updating Certificate Details...');
    const formUpdate = new FormData();
    formUpdate.append('courseName', 'AWS Certified Solutions Architect - UPDATED TEST');
    formUpdate.append('platform', 'Amazon Web Services');
    formUpdate.append('category', 'Cloud Architecture');
    formUpdate.append('issueDate', '2026-06-01');

    const updateRes = await fetch(`${BASE_URL}/faculty/students/${student.id}/certificates/${createdCertId}`, {
      method: 'PUT',
      headers: { Cookie: cookie },
      body: formUpdate
    });
    const updateData = await updateRes.json();
    if (updateRes.status === 200) {
      console.log(`  -> PASS: Certificate updated successfully! ("${updateData.message}")`);
    } else {
      throw new Error(`Update failed: ${updateRes.status} - ${JSON.stringify(updateData)}`);
    }

    // TEST 6: Verify Certificate Delete -> 200 OK
    console.log('\nStep 6: Testing Certificate Deletion...');
    const delRes = await fetch(`${BASE_URL}/faculty/students/${student.id}/certificates/${createdCertId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    const delData = await delRes.json();
    if (delRes.status === 200) {
      console.log('  -> PASS: Certificate deleted successfully!');
      createdCertId = null;
    } else {
      throw new Error(`Delete failed: ${delRes.status} - ${JSON.stringify(delData)}`);
    }

  } finally {
    // Cleanup Test Student
    console.log('\nStep 7: Cleaning up test student record...');
    const delStuRes = await fetch(`${BASE_URL}/faculty/students/${student.id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    if (delStuRes.status === 200) {
      console.log('  -> PASS: Test student record deleted cleanly.');
    } else {
      console.warn(`  ⚠️ Cleanup warning: status ${delStuRes.status}`);
    }
  }

  console.log('\n🎉 CERTIFICATE UPLOAD & MANAGEMENT API TESTS PASSED ALL VERIFICATIONS!\n');
}

runCertificateEndpointTests().catch((err) => {
  console.error('❌ Certificate Endpoint Test Failed:', err);
  process.exit(1);
});
