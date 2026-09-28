import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import path from 'path';
import cookieParser from 'cookie-parser';

dotenv.config();

import authRouter from '../server/routes/auth';
import studentRouter from '../server/routes/student';
import facultyRouter from '../server/routes/faculty';
import hodRouter from '../server/routes/hod';
import adminRouter from '../server/routes/admin';

const dbPath = path.resolve(process.cwd(), 'server', 'data', 'aids_system.db');
const db = new Database(dbPath, { readonly: true });
const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key';

async function testHttpPortalIntegration() {
  console.log('================================================================');
  console.log('--- REAL AUTHENTICATED HTTP PORTAL INTEGRATION SUITE ---');
  console.log('================================================================');

  let passCount = 0;
  let failCount = 0;

  function report(name: string, pass: boolean, detail: string) {
    if (pass) {
      passCount++;
      console.log(`[PASS] ${name} -> ${detail}`);
    } else {
      failCount++;
      console.log(`[FAIL] ${name} -> ${detail}`);
    }
  }

  // Find active users for each role from SQLite DB
  const adminUser: any = db.prepare("SELECT * FROM users WHERE role = 'ADMIN' LIMIT 1").get();
  const hodUser: any = db.prepare("SELECT * FROM users WHERE role = 'HOD' LIMIT 1").get();
  const facultyUser: any = db.prepare("SELECT * FROM users WHERE role = 'FACULTY' LIMIT 1").get();
  const studentUser: any = db.prepare("SELECT * FROM users WHERE role = 'STUDENT' LIMIT 1").get();

  console.log('Found Test Users in DB:');
  console.log('- Admin:', adminUser ? adminUser.email : 'None');
  console.log('- HOD:', hodUser ? hodUser.email : 'None');
  console.log('- Faculty:', facultyUser ? facultyUser.email : 'None');
  console.log('- Student:', studentUser ? `${studentUser.identifier} (${studentUser.email})` : 'None');

  // Sign JWT tokens for each role
  const adminToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role: 'ADMIN', name: adminUser.name }, JWT_SECRET, { expiresIn: '1h' });
  const hodToken = jwt.sign({ id: hodUser.id, email: hodUser.email, role: 'HOD', name: hodUser.name }, JWT_SECRET, { expiresIn: '1h' });
  const facultyToken = jwt.sign({ id: facultyUser.id, email: facultyUser.email, role: 'FACULTY', name: facultyUser.name, assignedYear: facultyUser.year || '2nd Year', assignedSection: facultyUser.section || 'A' }, JWT_SECRET, { expiresIn: '1h' });
  const studentToken = jwt.sign({ id: studentUser.id, email: studentUser.email, role: 'STUDENT', name: studentUser.name, registerNo: studentUser.identifier, studentId: studentUser.id }, JWT_SECRET, { expiresIn: '1h' });

  // Mount Express App instance
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRouter);
  app.use('/api/student', studentRouter);
  app.use('/api/faculty', facultyRouter);
  app.use('/api/hod', hodRouter);
  app.use('/api/admin', adminRouter);

  let server: any = null;
  try {
    await new Promise((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', () => resolve(true));
      server.on('error', reject);
    });

    const port = server.address().port;

    const makeGetReq = (path: string, token: string): Promise<{ statusCode: number; body: any }> => {
      return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}${path}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cookie': `aids_session_token=${token}`
          },
          timeout: 5000
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve({ statusCode: res.statusCode || 0, body: JSON.parse(data) });
            } catch {
              resolve({ statusCode: res.statusCode || 0, body: data });
            }
          });
        });
        req.on('error', () => resolve({ statusCode: 0, body: null }));
        req.on('timeout', () => { req.destroy(); resolve({ statusCode: 0, body: null }); });
      });
    };

    // 1. STUDENT PORTAL HTTP TESTS
    const studentMeRes = await makeGetReq('/api/student/me', studentToken);
    report('1. HTTP GET /api/student/me', studentMeRes.statusCode === 200, `Returned HTTP ${studentMeRes.statusCode} (${studentMeRes.body?.student?.name || 'Profile Object'})`);

    const studentConnRes = await makeGetReq('/api/student/connected-accounts', studentToken);
    report('2. HTTP GET /api/student/connected-accounts', studentConnRes.statusCode === 200, `Returned HTTP ${studentConnRes.statusCode}`);

    const studentToAdminRes = await makeGetReq('/api/admin/faculty', studentToken);
    report('3. Student Accessing Admin Route (Role Guard)', studentToAdminRes.statusCode === 403, `Student calling /api/admin/faculty correctly DENIED with HTTP ${studentToAdminRes.statusCode} Forbidden.`);

    // 2. FACULTY PORTAL HTTP TESTS
    const facStudentsRes = await makeGetReq('/api/faculty/students', facultyToken);
    report('4. HTTP GET /api/faculty/students', facStudentsRes.statusCode === 200, `Returned HTTP ${facStudentsRes.statusCode} (Roster Count: ${facStudentsRes.body?.count ?? 0})`);

    const facEliteRes = await makeGetReq('/api/faculty/elite-students', facultyToken);
    report('5. HTTP GET /api/faculty/elite-students', facEliteRes.statusCode === 200, `Returned HTTP ${facEliteRes.statusCode} (Elite Count: ${facEliteRes.body?.count ?? 0})`);

    const facTeamsRes = await makeGetReq('/api/faculty/team-heads', facultyToken);
    report('6. HTTP GET /api/faculty/team-heads', facTeamsRes.statusCode === 200, `Returned HTTP ${facTeamsRes.statusCode}`);

    const facToAdminRes = await makeGetReq('/api/admin/faculty', facultyToken);
    report('7. Faculty Accessing Admin Route (Role Guard)', facToAdminRes.statusCode === 403, `Faculty calling /api/admin/faculty correctly DENIED with HTTP ${facToAdminRes.statusCode} Forbidden.`);

    // 3. HOD PORTAL HTTP TESTS
    const hodStudentsRes = await makeGetReq('/api/hod/students', hodToken);
    report('8. HTTP GET /api/hod/students', hodStudentsRes.statusCode === 200, `Returned HTTP ${hodStudentsRes.statusCode} (Total Students: ${hodStudentsRes.body?.count ?? 0})`);

    const hodFacultyRes = await makeGetReq('/api/hod/faculty', hodToken);
    report('9. HTTP GET /api/hod/faculty', hodFacultyRes.statusCode === 200, `Returned HTTP ${hodFacultyRes.statusCode} (Faculty Count: ${hodFacultyRes.body?.faculty?.length ?? 0})`);

    const hodCandidatesRes = await makeGetReq('/api/hod/awards/candidates', hodToken);
    report('10. HTTP GET /api/hod/awards/candidates', hodCandidatesRes.statusCode === 200, `Returned HTTP ${hodCandidatesRes.statusCode} (Best Student: ${hodCandidatesRes.body?.candidates?.bestStudent?.student?.name || 'Candidate Found'})`);

    // 4. ADMIN PORTAL HTTP TESTS
    const adminFacultyRes = await makeGetReq('/api/admin/faculty', adminToken);
    report('11. HTTP GET /api/admin/faculty', adminFacultyRes.statusCode === 200, `Returned HTTP ${adminFacultyRes.statusCode} (Faculty Count: ${adminFacultyRes.body?.faculty?.length ?? 0})`);

    const adminFacultyStudentsRes = await makeGetReq(`/api/admin/faculty/${facultyUser.id}/students`, adminToken);
    report('12. HTTP GET /api/admin/faculty/:id/students', adminFacultyStudentsRes.statusCode === 200, `Returned HTTP ${adminFacultyStudentsRes.statusCode} (Workspace Students: ${adminFacultyStudentsRes.body?.count ?? 0})`);

  } catch (err: any) {
    console.error('❌ HTTP Integration Error:', err);
    failCount++;
  } finally {
    if (server) try { server.close(); } catch (_) {}
    if (db) try { db.close(); } catch (_) {}
  }

  console.log('================================================================');
  console.log(`--- SUMMARY: ${passCount} PASSED, ${failCount} FAILED ---`);
  console.log('================================================================');

  process.exit(failCount > 0 ? 1 : 0);
}

testHttpPortalIntegration().catch(console.error);
