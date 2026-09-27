import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000/api';

async function runProofFileUploadTests() {
  console.log('🔒 Starting REAL FILE UPLOAD & SECURITY PERMISSION TESTS...\n');

  const adminEmail = process.env.ADMIN_EMAIL || 'departmentai&ds@gmail.com';
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs';

  // 1. Admin Login & Bootstrap Test Data
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: adminEmail, password: adminPassword, role: 'ADMIN' })
  });
  const adminCookie = adminLoginRes.headers.get('set-cookie') || '';
  if (!adminLoginRes.ok) throw new Error('Admin login failed');

  const rand = Math.floor(Math.random() * 89999 + 10000);
  const regA = `REG${rand}A`;
  const regB = `REG${rand}B`;
  const facEmail = `facfile_${rand}@aids.edu`;

  // Import Test Students (Section A and Section B)
  const importRes = await fetch(`${BASE_URL}/admin/students/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      students: [
        { registerNo: regA, name: 'File Test Student A', email: `${regA.toLowerCase()}@aids.edu`, year: '2nd Year', section: 'A', batch: '2023-2027', cgpa: 8.5 },
        { registerNo: regB, name: 'File Test Student B', email: `${regB.toLowerCase()}@aids.edu`, year: '2nd Year', section: 'B', batch: '2023-2027', cgpa: 8.0 }
      ],
      defaultPassword: 'student123'
    })
  });
  if (!importRes.ok) throw new Error('Student import failed');

  // Create Faculty A (Section A)
  const facARes = await fetch(`${BASE_URL}/admin/faculty`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      facultyId: `FAC_${rand}`,
      facultyName: 'Faculty File A',
      email: facEmail,
      department: 'AI & DS',
      year: '2nd Year',
      section: 'A',
      role: 'Class Coordinator',
      password: 'password123',
      confirmPassword: 'password123',
      isActive: true
    })
  });
  const facAData = await facARes.json();
  const facAUser = facAData.faculty;

  // Faculty A Login
  const facALoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: facEmail, password: 'password123', role: 'FACULTY' })
  });
  const facACookie = facALoginRes.headers.get('set-cookie') || '';

  const regA_fac = `REG${rand}A_FAC`;
  // Create Student A by Faculty A
  const createStuRes = await fetch(`${BASE_URL}/faculty/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: facACookie },
    body: JSON.stringify({
      registerNo: regA_fac,
      name: 'File Test Student A',
      email: `${regA_fac.toLowerCase()}@aids.edu`,
      batch: '2023-2027',
      password: 'student123'
    })
  });
  const createStuData = await createStuRes.json();
  const studentA = createStuData.student;

  // Student A Login
  const stuALoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: regA_fac, password: 'student123', role: 'STUDENT' })
  });
  const stuACookie = stuALoginRes.headers.get('set-cookie') || '';

  // Create temporary test files
  const testDir = path.resolve(process.cwd(), 'scratch');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const samplePdfPath = path.join(testDir, 'sample_marksheet.pdf');
  fs.writeFileSync(samplePdfPath, '%PDF-1.4 sample mark sheet content');

  const exePath = path.join(testDir, 'malicious.exe');
  fs.writeFileSync(exePath, 'MZexecutable_content');

  try {
    // TEST 1: Student Upload Attempt -> 403 Forbidden
    const formStu = new FormData();
    formStu.append('studentId', studentA.id);
    formStu.append('recordType', 'academics');
    formStu.append('recordId', 'cgpa-record');
    formStu.append('file', new Blob([fs.readFileSync(samplePdfPath)], { type: 'application/pdf' }), 'sample_marksheet.pdf');

    const stuUploadRes = await fetch(`${BASE_URL}/files/upload`, {
      method: 'POST',
      headers: { Cookie: stuACookie },
      body: formStu
    });
    if (stuUploadRes.status === 403) {
      console.log('✅ TEST 1 PASSED: Student upload attempt rejected with 403 Forbidden (View-Only Guard).');
    } else {
      throw new Error(`TEST 1 FAILED: Expected 403, got ${stuUploadRes.status}`);
    }

    // TEST 2: Dangerous Executable Upload Attempt -> 400 Bad Request
    const formExe = new FormData();
    formExe.append('studentId', studentA.id);
    formExe.append('recordType', 'academics');
    formExe.append('recordId', 'cgpa-record');
    formExe.append('file', new Blob([fs.readFileSync(exePath)], { type: 'application/x-msdownload' }), 'malicious.exe');

    const exeUploadRes = await fetch(`${BASE_URL}/files/upload`, {
      method: 'POST',
      headers: { Cookie: facACookie },
      body: formExe
    });
    if (exeUploadRes.status === 400) {
      console.log('✅ TEST 2 PASSED: Executable file upload rejected with 400 Bad Request.');
    } else {
      throw new Error(`TEST 2 FAILED: Expected 400, got ${exeUploadRes.status}`);
    }

    // TEST 3: Faculty Valid PDF Upload for Assigned Student -> 201 Created
    const formPdf = new FormData();
    formPdf.append('studentId', studentA.id);
    formPdf.append('recordType', 'academics');
    formPdf.append('recordId', 'cgpa-record');
    formPdf.append('file', new Blob([fs.readFileSync(samplePdfPath)], { type: 'application/pdf' }), 'sample_marksheet.pdf');

    const validUploadRes = await fetch(`${BASE_URL}/files/upload`, {
      method: 'POST',
      headers: { Cookie: facACookie },
      body: formPdf
    });
    const validUploadData = await validUploadRes.json();
    if (validUploadRes.status === 201 && validUploadData.attachment) {
      console.log('✅ TEST 3 PASSED: Faculty uploaded PDF proof successfully for assigned student.');
    } else {
      throw new Error(`TEST 3 FAILED: ${JSON.stringify(validUploadData)}`);
    }

    const attachmentId = validUploadData.attachment.id;

    // TEST 4: Student Inline View & Download -> 200 OK
    const stuViewRes = await fetch(`${BASE_URL}/files/${attachmentId}`, { headers: { Cookie: stuACookie } });
    if (stuViewRes.status === 200) {
      console.log('✅ TEST 4 PASSED: Student viewed own proof file inline successfully (200 OK).');
    } else {
      throw new Error(`TEST 4 FAILED: Expected 200, got ${stuViewRes.status}`);
    }

    const stuDownRes = await fetch(`${BASE_URL}/files/${attachmentId}/download`, { headers: { Cookie: stuACookie } });
    if (stuDownRes.status === 200) {
      console.log('✅ TEST 5 PASSED: Student downloaded own proof file successfully (200 OK).');
    } else {
      throw new Error(`TEST 5 FAILED: Expected 200, got ${stuDownRes.status}`);
    }

    // TEST 6: Student Delete Attempt -> 403 Forbidden
    const stuDelRes = await fetch(`${BASE_URL}/files/${attachmentId}`, {
      method: 'DELETE',
      headers: { Cookie: stuACookie }
    });
    if (stuDelRes.status === 403) {
      console.log('✅ TEST 6 PASSED: Student delete attempt rejected with 403 Forbidden.');
    } else {
      throw new Error(`TEST 6 FAILED: Expected 403, got ${stuDelRes.status}`);
    }

    // TEST 7: Faculty Soft Delete Attachment -> 200 OK
    const facDelRes = await fetch(`${BASE_URL}/files/${attachmentId}`, {
      method: 'DELETE',
      headers: { Cookie: facACookie }
    });
    if (facDelRes.status === 200) {
      console.log('✅ TEST 7 PASSED: Faculty deleted proof file successfully.');
    } else {
      throw new Error(`TEST 7 FAILED: Expected 200, got ${facDelRes.status}`);
    }

    console.log('\n📊 ALL 7 FILE UPLOAD & SECURITY TESTS PASSED PERFECTLY!\n');
  } finally {
    // Cleanup test data
    if (facAUser) {
      await fetch(`${BASE_URL}/admin/faculty/${facAUser.id}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
    }
  }
}

runProofFileUploadTests().catch((err) => {
  console.error('❌ FILE UPLOAD TEST FAILED:', err);
  process.exit(1);
});
