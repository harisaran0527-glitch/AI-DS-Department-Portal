import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { db, initDatabaseSchema } from '../server/db.js';
import adminRoutes from '../server/routes/admin.js';
import authRoutes from '../server/routes/auth.js';
import facultyRoutes from '../server/routes/faculty.js';
import hodRoutes from '../server/routes/hod.js';
import studentRoutes from '../server/routes/student.js';

async function runRequirementAudit() {
  console.log('====================================================');
  console.log('  STUDENT EXCEL IMPORT & FACULTY ISOLATION AUDIT   ');
  console.log('====================================================');

  await initDatabaseSchema();

  // Run column addition on PostgreSQL table students directly if needed
  try {
    const { pgPool } = await import('../server/postgresAdapter.js');
    if (pgPool) {
      await pgPool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS mobile_number TEXT;`);
      await pgPool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT;`);
    }
  } catch {}

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/faculty', facultyRoutes);
  app.use('/api/hod', hodRoutes);
  app.use('/api/student', studentRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    let adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'departmentai&ds@gmail.com', password: 'aids@avs', role: 'ADMIN' })
    });
    if (!adminLoginRes.ok) {
      adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'departmentai&ds@gmail.com', password: 'admin', role: 'ADMIN' })
      });
    }
    const adminLoginData = await adminLoginRes.json();
    if (!adminLoginRes.ok) throw new Error(`Admin login failed: ${adminLoginData.error}`);
    const adminCookie = adminLoginRes.headers.get('set-cookie') || '';
    console.log('✅ Admin Authenticated');

    // 2. Test Excel Import Preview (Validating missing fields, CGPA range, duplicates)
    const testExcelRows = [
      {
        Name: 'Test Saran',
        'Register Number': 'TEST24AD001',
        'Mobile Number': '9876543210',
        'College Mail ID': 'saran.test@college.edu',
        'Personal Mail ID': 'saran.test@gmail.com',
        Address: 'Salem, TN',
        CGPA: 8.75
      },
      {
        Name: 'Invalid Student CGPA',
        'Register Number': 'TEST24AD002',
        'College Mail ID': 'invalid.cgpa@college.edu',
        CGPA: 12.50 // Invalid > 10
      },
      {
        Name: '', // Missing Name
        'Register Number': 'TEST24AD003',
        'College Mail ID': 'missing.name@college.edu',
        CGPA: 9.00
      }
    ];

    const previewRes = await fetch(`${baseUrl}/admin/students/import-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ rows: testExcelRows })
    });
    const previewData = await previewRes.json();
    console.log('Preview Response:', JSON.stringify(previewData));
    console.log(`✅ Excel Preview Endpoint: Total Rows = ${previewData.totalRows}, Valid = ${previewData.validRowsCount}, Errors = ${previewData.errorRowsCount}`);

    if (previewData.errorRowsCount !== 2) {
      throw new Error(`Expected 2 error rows in preview validation, got ${previewData.errorRowsCount}`);
    }

    // 3. Confirm Excel Import for Valid Row
    const confirmRes = await fetch(`${baseUrl}/admin/students/import-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        students: [
          {
            name: 'Test Saran',
            registerNo: 'TEST24AD001',
            mobileNumber: '9876543210',
            collegeEmail: 'saran.test@college.edu',
            personalEmail: 'saran.test@gmail.com',
            address: 'Salem, TN',
            cgpa: 8.75,
            year: '2nd Year',
            section: 'C'
          }
        ]
      })
    });
    const confirmData = await confirmRes.json();
    console.log(`✅ Excel Confirm Endpoint: ${confirmData.message}`);

    // 4. Verify Automatic Login Account Creation (College Email + Register Number password)
    const studentLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'saran.test@college.edu', password: 'TEST24AD001', role: 'STUDENT' })
    });
    const studentLoginData = await studentLoginRes.json();
    if (!studentLoginRes.ok) throw new Error(`Student login failed with initial credentials: ${studentLoginData.error}`);
    const studentCookie = studentLoginRes.headers.get('set-cookie') || '';
    console.log('✅ Student Auto-Created Login Success (Login Email = College Mail ID, Password = Register Number)');

    // 5. Verify Password Security: Password in DB must NOT be plain text
    const userInDb = await db.findUserByIdentifier('saran.test@college.edu');
    if (!userInDb) throw new Error('Student user not found in database');
    if (userInDb.password_hash === 'TEST24AD001') throw new Error('CRITICAL SECURITY VIOLATION: Password stored in plain text!');
    const isPassValid = await bcrypt.compare('TEST24AD001', userInDb.password_hash);
    if (!isPassValid) throw new Error('Password hash comparison failed!');
    console.log('✅ Security Check Passed: Password securely stored as bcrypt hash.');

    // 6. Verify Student Portal Authorization (Access own data only)
    const studentMeRes = await fetch(`${baseUrl}/student/me`, {
      headers: { Cookie: studentCookie }
    });
    if (!studentMeRes.ok) throw new Error('Student me API failed');
    console.log('✅ Student Portal Access Own Data: PASS');

    const unauthorizedAccessRes = await fetch(`${baseUrl}/admin/students`, {
      headers: { Cookie: studentCookie }
    });
    if (unauthorizedAccessRes.status !== 403) throw new Error(`Student accessed Admin API! Expected 403, got ${unauthorizedAccessRes.status}`);
    console.log('✅ Student Portal Isolation Protection: PASS (HTTP 403 Blocked unauthorized admin access)');

    // 7. Test HOD Faculty Assignment
    const createFacultyRes = await fetch(`${baseUrl}/admin/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        facultyId: 'FAC_TEST_AUDIT',
        facultyName: 'Faculty Section C Test',
        email: 'facultyc.test@college.edu',
        year: '2nd Year',
        section: 'C',
        role: 'Class Coordinator',
        password: 'faculty123pass'
      })
    });
    const createFacultyData = await createFacultyRes.json();
    console.log(`✅ Admin Created Faculty: ${createFacultyData.message || 'Success'}`);

    // HOD Login & Assign to 2nd Year Section C
    let hodLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'hod.aids@avsenggcollege.ac.in', password: 'admin', role: 'HOD' })
    });
    if (!hodLoginRes.ok) {
      hodLoginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'hod', password: 'hod@123', role: 'HOD' })
      });
    }
    const hodCookie = hodLoginRes.headers.get('set-cookie') || '';

    const targetFacUser = await db.findUserByIdentifier('facultyc.test@college.edu');
    if (!targetFacUser) throw new Error('Created faculty user not found');

    const assignRes = await fetch(`${baseUrl}/hod/faculty-assignments/${targetFacUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: hodCookie },
      body: JSON.stringify({ year: '2nd Year', section: 'C', role: 'Class Coordinator' })
    });
    if (!assignRes.ok) throw new Error('HOD Faculty assignment failed');
    console.log('✅ HOD -> Faculty Assignment Persisted (2nd Year Section C)');

    // 8. Test Faculty Portal Roster & Workspace Isolation
    const facultyLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'facultyc.test@college.edu', password: 'faculty123pass', role: 'FACULTY' })
    });
    const facultyCookie = facultyLoginRes.headers.get('set-cookie') || '';

    const facultyRosterRes = await fetch(`${baseUrl}/faculty/students`, {
      headers: { Cookie: facultyCookie }
    });
    const facultyRosterData = await facultyRosterRes.json();
    console.log(`✅ Faculty Portal Roster: Assigned Year = ${facultyRosterData.assignedYear}, Section = ${facultyRosterData.assignedSection}, Student Count = ${facultyRosterData.count}`);

    if (facultyRosterData.count < 1) {
      throw new Error(`CRITICAL ROSTER FAILURE: Faculty roster student count is ${facultyRosterData.count}, expected >= 1`);
    }

    const testStudentInRoster = facultyRosterData.students.find((s: any) => (s.registerNo || s.register_no || '').toUpperCase() === 'TEST24AD001');
    if (!testStudentInRoster) {
      throw new Error('CRITICAL ROSTER FAILURE: Imported student TEST24AD001 does not appear in Faculty assigned roster!');
    }
    console.log(`✅ Faculty Portal Roster Verification: PASS (Student "${testStudentInRoster.name}" visible in 2nd Year Section C roster)`);

    const allDbStudents = await db.getStudents('ALL', 'ALL');
    const createdStudentInDb = allDbStudents.find((s) => s.register_no.toUpperCase() === 'TEST24AD001');
    if (!createdStudentInDb) throw new Error('Imported student not found in DB');

    // 9. Faculty View Student Details
    const viewRes = await fetch(`${baseUrl}/faculty/students/${createdStudentInDb.id}`, {
      headers: { Cookie: facultyCookie }
    });
    if (!viewRes.ok) throw new Error('Faculty view student details failed');
    const viewData = await viewRes.json();
    if (viewData.student.name !== 'Test Saran' || viewData.student.cgpa !== 8.75) {
      throw new Error('Faculty view returned mismatched student data');
    }
    console.log(`✅ Faculty View Student Details: PASS (HTTP 200, Name=${viewData.student.name}, CGPA=${viewData.student.cgpa})`);

    // 10. Faculty Edit Student Details & Save
    const editRes = await fetch(`${baseUrl}/faculty/students/${createdStudentInDb.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: facultyCookie },
      body: JSON.stringify({
        name: 'Saran (Updated)',
        mobileNumber: '9998887770',
        collegeEmail: 'saran.updated@college.edu',
        personalEmail: 'saran.personal@gmail.com',
        address: 'Coimbatore, TN',
        cgpa: 9.10
      })
    });
    if (!editRes.ok) throw new Error('Faculty edit student failed');
    const editData = await editRes.json();
    console.log(`✅ Faculty Edit Student Details: PASS (HTTP 200, ${editData.message})`);

    // 11. Create test students in other sections and years to verify isolation
    await db.upsertStudentWithUserLogin({
      registerNo: 'TEST24AD_SECA',
      name: 'Section A Student',
      email: 'secA.student@college.edu',
      year: '2nd Year',
      section: 'A'
    });

    await db.upsertStudentWithUserLogin({
      registerNo: 'TEST1stYEAR_SECC',
      name: '1st Year Student',
      email: 'year1.student@college.edu',
      year: '1st Year',
      section: 'C'
    });

    const secAStudent = (await db.getStudents('ALL', 'ALL')).find((s) => s.register_no === 'TEST24AD_SECA');
    const year1Student = (await db.getStudents('ALL', 'ALL')).find((s) => s.register_no === 'TEST1stYEAR_SECC');

    // 12. Verify Unauthorized Section Access (HTTP 403)
    if (secAStudent) {
      const unauthorizedSecRes = await fetch(`${baseUrl}/faculty/students/${secAStudent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: facultyCookie },
        body: JSON.stringify({ name: 'Unauthorized Mod' })
      });
      if (unauthorizedSecRes.status !== 403) {
        throw new Error(`CRITICAL SECURITY FAILURE: Faculty edited student in another section! Expected 403, got ${unauthorizedSecRes.status}`);
      }
      console.log('✅ Faculty Unauthorized Section Access Blocked: PASS (HTTP 403 Forbidden)');
    }

    // 13. Verify Unauthorized Year Access (HTTP 403)
    if (year1Student) {
      const unauthorizedYearRes = await fetch(`${baseUrl}/faculty/students/${year1Student.id}`, {
        headers: { Cookie: facultyCookie }
      });
      if (unauthorizedYearRes.status !== 403) {
        throw new Error(`CRITICAL SECURITY FAILURE: Faculty accessed student in another year! Expected 403, got ${unauthorizedYearRes.status}`);
      }
      console.log('✅ Faculty Unauthorized Year Access Blocked: PASS (HTTP 403 Forbidden)');
    }

    console.log('\n====================================================');
    console.log('       FINAL SYSTEM AUDIT SUMMARY: ALL PASS         ');
    console.log('  - Faculty Assignment: 2nd Year / Section C        ');
    console.log('  - Faculty Roster Student Count >= 1: PASS          ');
    console.log('  - Faculty View Student Details: PASS (HTTP 200)   ');
    console.log('  - Faculty Edit Student Details: PASS (HTTP 200)   ');
    console.log('  - Unauthorized Section Access: PASS (HTTP 403)    ');
    console.log('  - Unauthorized Year Access: PASS (HTTP 403)       ');
    console.log('  - Student Own Data Access: PASS (HTTP 200)        ');
    console.log('  - Student Cross-Access Protection: PASS (HTTP 403)');
    console.log('====================================================\n');

  } catch (err: any) {
    console.error('❌ REQUIREMENT AUDIT FAILED:', err);
    process.exit(1);
  } finally {
    try {
      const testRegs = ['TEST24AD001', 'TEST24AD_SECA', 'TEST1stYEAR_SECC'];
      const testEmails = [
        'saran.test@college.edu',
        'saran.updated@college.edu',
        'secA.student@college.edu',
        'year1.student@college.edu',
        'facultyc.test@college.edu'
      ];

      for (const reg of testRegs) {
        const s = (await db.getStudents('ALL', 'ALL')).find((x) => x.register_no.trim().toUpperCase() === reg.trim().toUpperCase());
        if (s) {
          await db.deleteStudentUser(s.id);
        }
      }

      for (const email of testEmails) {
        const u = await db.findUserByIdentifier(email);
        if (u) {
          if (u.role === 'FACULTY') {
            await db.deleteFacultyUser(u.id);
          } else if (u.role === 'STUDENT') {
            await db.deleteStudentUser(u.id);
          }
        }
      }

      console.log('🧹 Cleaned up test records from database.');
    } catch (_e) {}
    server.close();
  }
}

runRequirementAudit();
