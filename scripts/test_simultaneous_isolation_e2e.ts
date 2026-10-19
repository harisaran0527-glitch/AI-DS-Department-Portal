import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../server/index.js';
import { JWT_SECRET } from '../server/middleware/auth.js';

// Setup identities corresponding to DB users + HOD
const users = {
  ADMIN: {
    id: "admin-sys",
    email: "departmentai&ds@gmail.com",
    name: "Department Administrator",
    role: "ADMIN"
  },
  HOD: {
    id: "hod-auth-executive",
    email: "hod.aids@avsenggcollege.ac.in",
    name: "Dr. AI&DS HOD",
    role: "HOD"
  },
  FACULTY: {
    id: "fac-1788857541164",
    email: "harisaran0527@gmail.com",
    name: "Faculty Coordinator",
    role: "FACULTY",
    assignedYear: "II",
    assignedSection: "A"
  },
  STUDENT: {
    id: "user-stu-1787995836892-8rp1",
    email: "saran.ad25@avsenggcollege.ac.in",
    name: "Saran",
    role: "STUDENT",
    assignedYear: "II",
    assignedSection: "A",
    registerNo: "620125243144",
    studentId: "user-stu-1787995836892-8rp1"
  }
};

const tokens = {
  ADMIN: jwt.sign(users.ADMIN, JWT_SECRET, { expiresIn: '8h' }),
  HOD: jwt.sign(users.HOD, JWT_SECRET, { expiresIn: '8h' }),
  FACULTY: jwt.sign(users.FACULTY, JWT_SECRET, { expiresIn: '8h' }),
  STUDENT: jwt.sign(users.STUDENT, JWT_SECRET, { expiresIn: '8h' })
};

// Simulated browser storage
// localStorage is shared across tabs on the same origin
const localStorageStore: Record<string, string> = {
  aids_token_admin: tokens.ADMIN,
  aids_token_hod: tokens.HOD,
  aids_token_faculty: tokens.FACULTY,
  aids_token_student: tokens.STUDENT
};

// sessionStorage is isolated per tab
const tabSessions: Record<string, Record<string, string>> = {
  tab_admin: {
    aids_active_role: 'ADMIN',
    aids_token_admin: tokens.ADMIN
  },
  tab_hod: {
    aids_active_role: 'HOD',
    aids_token_hod: tokens.HOD
  },
  tab_faculty: {
    aids_active_role: 'FACULTY',
    aids_token_faculty: tokens.FACULTY
  },
  tab_student: {
    aids_active_role: 'STUDENT',
    aids_token_student: tokens.STUDENT
  }
};

// Simulated browser cookie jar: in same-origin browser, all cookies set for origin are included
let cookieJar: Record<string, string> = {
  aids_admin_token: tokens.ADMIN,
  aids_hod_token: tokens.HOD,
  aids_faculty_token: tokens.FACULTY,
  aids_student_token: tokens.STUDENT
};

function getCookieString() {
  return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
}

// Client request simulator following new api.ts logic
async function clientRequest(tabId: string, endpoint: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}, baseUrl: string) {
  const session = tabSessions[tabId] || {};
  const activeRole = session.aids_active_role;

  // Retrieve token following new getValidSessionToken logic:
  // Tab sessionStorage first, then localStorage
  let token: string | null = null;
  if (activeRole) {
    const key = `aids_token_${activeRole.toLowerCase()}`;
    token = session[key] || localStorageStore[key] || null;
  }

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(activeRole ? { 'X-Portal-Role': activeRole } : {}),
    'Cookie': getCookieString(),
    ...(options.headers || {})
  };

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: options.method || 'GET',
    headers: reqHeaders,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}

  // Parse Set-Cookie if any
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const parts = setCookie.split(';');
    const [name, val] = parts[0].split('=');
    if (val) cookieJar[name.trim()] = val.trim();
  }

  return { status: res.status, ok: res.ok, body: json || text };
}

// Client logout simulator following new api.ts logic
async function clientLogout(tabId: string, baseUrl: string) {
  const session = tabSessions[tabId] || {};
  const activeRole = session.aids_active_role;

  await clientRequest(tabId, '/api/auth/logout', { method: 'POST' }, baseUrl);

  if (activeRole) {
    const key = `aids_token_${activeRole.toLowerCase()}`;
    const cookieKey = `aids_${activeRole.toLowerCase()}_token`;
    delete session[key];
    delete localStorageStore[key];
    delete cookieJar[cookieKey];
  }
}

async function runTests() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const BASE = `http://127.0.0.1:${port}`;

  console.log(`=======================================================`);
  console.log(`TEST SUITE: 4-PORTAL SIMULTANEOUS SESSION ISOLATION`);
  console.log(`Server URL: ${BASE}`);
  console.log(`=======================================================\n`);

  let allPassed = true;

  // TEST 1: Simultaneous Authenticated Calls from all 4 portals
  console.log(`[TEST 1] Parallel Authenticated API Requests across all 4 portals:`);
  const [adminRes, hodRes, facRes, stuRes] = await Promise.all([
    clientRequest('tab_admin', '/api/admin/faculty', {}, BASE),
    clientRequest('tab_hod', '/api/hod/faculty', {}, BASE),
    clientRequest('tab_faculty', '/api/faculty/students', {}, BASE),
    clientRequest('tab_student', '/api/student/me', {}, BASE)
  ]);

  console.log(`  Admin /api/admin/faculty -> HTTP ${adminRes.status} (Expected 200)`);
  console.log(`  HOD /api/hod/faculty -> HTTP ${hodRes.status} (Expected 200)`);
  console.log(`  Faculty /api/faculty/students -> HTTP ${facRes.status} (Expected 200)`);
  console.log(`  Student /api/student/me -> HTTP ${stuRes.status} (Expected 200)`);

  if (adminRes.status !== 200 || hodRes.status !== 200 || facRes.status !== 200 || stuRes.status !== 200) {
    console.error(`FAILED: Test 1 failed`);
    allPassed = false;
  } else {
    console.log(`  PASS: All 4 portals retrieved their data simultaneously without collision!\n`);
  }

  // TEST 2: /api/auth/me validation for each portal concurrently
  console.log(`[TEST 2] Verify /api/auth/me returns the EXACT role for each tab:`);
  const [meAdmin, meHod, meFac, meStu] = await Promise.all([
    clientRequest('tab_admin', '/api/auth/me', {}, BASE),
    clientRequest('tab_hod', '/api/auth/me', {}, BASE),
    clientRequest('tab_faculty', '/api/auth/me', {}, BASE),
    clientRequest('tab_student', '/api/auth/me', {}, BASE)
  ]);

  console.log(`  Admin /auth/me user.role: ${meAdmin.body?.user?.role} (Expected ADMIN)`);
  console.log(`  HOD /auth/me user.role: ${meHod.body?.user?.role} (Expected HOD)`);
  console.log(`  Faculty /auth/me user.role: ${meFac.body?.user?.role} (Expected FACULTY)`);
  console.log(`  Student /auth/me user.role: ${meStu.body?.user?.role} (Expected STUDENT)`);

  if (
    meAdmin.body?.user?.role !== 'ADMIN' ||
    meHod.body?.user?.role !== 'HOD' ||
    meFac.body?.user?.role !== 'FACULTY' ||
    meStu.body?.user?.role !== 'STUDENT'
  ) {
    console.error(`FAILED: Test 2 failed`);
    allPassed = false;
  } else {
    console.log(`  PASS: Every portal resolves strictly to its own user identity!\n`);
  }

  // TEST 3: Shared generic endpoints (/api/subjects) called from all portals
  console.log(`[TEST 3] Generic shared endpoint /api/subjects from all 4 portals simultaneously:`);
  const [subAdmin, subHod, subFac, subStu] = await Promise.all([
    clientRequest('tab_admin', '/api/subjects', {}, BASE),
    clientRequest('tab_hod', '/api/subjects', {}, BASE),
    clientRequest('tab_faculty', '/api/subjects', {}, BASE),
    clientRequest('tab_student', '/api/subjects', {}, BASE)
  ]);
  console.log(`  Statuses: Admin=${subAdmin.status}, HOD=${subHod.status}, Faculty=${subFac.status}, Student=${subStu.status}`);
  if (subAdmin.status !== 200 || subHod.status !== 200 || subFac.status !== 200 || subStu.status !== 200) {
    console.error(`FAILED: Test 3 failed`);
    allPassed = false;
  } else {
    console.log(`  PASS: Generic endpoints function concurrently for all roles!\n`);
  }

  // TEST 4: Logout Isolation: Log out ADMIN, verify HOD, Faculty, Student remain active
  console.log(`[TEST 4] Logout from ADMIN portal. Verify remaining 3 portals stay authenticated:`);
  await clientLogout('tab_admin', BASE);
  console.log(`  Admin logged out.`);

  const [afterAdmin, afterHod, afterFac, afterStu] = await Promise.all([
    clientRequest('tab_admin', '/api/admin/faculty', {}, BASE),
    clientRequest('tab_hod', '/api/hod/faculty', {}, BASE),
    clientRequest('tab_faculty', '/api/faculty/students', {}, BASE),
    clientRequest('tab_student', '/api/student/me', {}, BASE)
  ]);

  console.log(`  Admin /api/admin/faculty after logout -> HTTP ${afterAdmin.status} (Expected 401 Unauthorized)`);
  console.log(`  HOD /api/hod/faculty after admin logout -> HTTP ${afterHod.status} (Expected 200 OK)`);
  console.log(`  Faculty /api/faculty/students after admin logout -> HTTP ${afterFac.status} (Expected 200 OK)`);
  console.log(`  Student /api/student/me after admin logout -> HTTP ${afterStu.status} (Expected 200 OK)`);

  if (afterAdmin.status !== 401 || afterHod.status !== 200 || afterFac.status !== 200 || afterStu.status !== 200) {
    console.error(`FAILED: Test 4 failed`);
    allPassed = false;
  } else {
    console.log(`  PASS: Admin logout did NOT invalidate HOD, Faculty, or Student sessions!\n`);
  }

  // TEST 5: Cross-Role Security Violation: Student attempts to access Admin endpoint
  console.log(`[TEST 5] Genuine Forbidden Access: Student token sent to /api/admin/faculty:`);
  const forbiddenRes = await clientRequest('tab_student', '/api/admin/faculty', {}, BASE);
  console.log(`  Student accessing /api/admin/faculty -> HTTP ${forbiddenRes.status} (Expected 401 or 403 Forbidden)`);
  console.log(`  Response: ${JSON.stringify(forbiddenRes.body)}`);
  if (forbiddenRes.status !== 401 && forbiddenRes.status !== 403) {
    console.error(`FAILED: Security violated`);
    allPassed = false;
  } else {
    console.log(`  PASS: Genuine unauthorized/forbidden access is strictly blocked!\n`);
  }

  // TEST 6: Expired Token
  console.log(`[TEST 6] Expired Token Handling:`);
  const expiredToken = jwt.sign(users.STUDENT, JWT_SECRET, { expiresIn: '0s' });
  const expiredRes = await fetch(`${BASE}/api/student/me`, {
    headers: {
      Authorization: `Bearer ${expiredToken}`,
      'X-Portal-Role': 'STUDENT'
    }
  });
  console.log(`  Expired token -> HTTP ${expiredRes.status} (Expected 401 Unauthorized)`);
  if (expiredRes.status !== 401) {
    console.error(`FAILED: Expired token test failed`);
    allPassed = false;
  } else {
    console.log(`  PASS: Expired tokens are rejected with 401 Unauthorized!\n`);
  }

  console.log(`=======================================================`);
  if (allPassed) {
    console.log(`ALL 6 TESTS PASSED PERFECTLY! MULTI-PORTAL SESSION ISOLATION VERIFIED.`);
  } else {
    console.log(`SOME TESTS FAILED! Review output above.`);
  }
  console.log(`=======================================================`);

  server.close();
  process.exit(allPassed ? 0 : 1);
}

runTests();
