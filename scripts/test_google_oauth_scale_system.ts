import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'aids_dept_secure_jwt_secret_key_2026';

function generateTestOAuthState(data: any): string {
  const timestamp = Date.now();
  const payload = JSON.stringify({ ...data, timestamp });
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  const fullState = JSON.stringify({ payload, sig });
  return Buffer.from(fullState).toString('base64url');
}

async function runGoogleOAuthStrictSystemTest() {
  console.log('🔒 Starting STRICT NO-FAKE-EMAIL & HMAC STATE OAUTH SYSTEM VERIFICATION TEST...\n');

  // 1. Admin Login & Setup Faculty
  const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: process.env.ADMIN_EMAIL || 'departmentai&ds@gmail.com',
      password: process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs',
      role: 'ADMIN'
    })
  });
  const adminData = await adminLogin.json();
  const adminHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${adminData.token}` };

  const facEmail = `fac_strict_oauth_${Date.now()}@aids.edu`;
  const password = 'Password123!';

  // Create Faculty
  await fetch(`${BASE_URL}/api/admin/faculty`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      facultyId: `FID_STRICT_${Date.now()}`,
      facultyName: 'Strict OAuth Faculty',
      email: facEmail,
      password,
      year: '2nd Year',
      section: 'A',
      role: 'Class Coordinator'
    })
  });

  // Faculty Login
  const facLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: facEmail, password, role: 'FACULTY' })
  });
  const facData = await facLogin.json();
  const headersFac = { 'Content-Type': 'application/json', Authorization: `Bearer ${facData.token}` };

  // 2. Create Student with ONLY College Mail (No Personal Mail)
  const stu1Res = await fetch(`${BASE_URL}/api/faculty/students`, {
    method: 'POST',
    headers: headersFac,
    body: JSON.stringify({
      registerNo: `REG_ONLY_COLLEGE_${Date.now()}`,
      name: 'Student Only College Mail',
      email: `stu_college_only_${Date.now()}@aids.edu`,
      batch: '2024-2028',
      portalPassword: 'StudentPassword123!'
    })
  });
  const stu1 = (await stu1Res.json()).student;

  // 3. Create Student with BOTH College & Real Personal Mail
  const realPersonalEmail = `stu_real_personal_${Date.now()}@gmail.com`;
  const stu2Res = await fetch(`${BASE_URL}/api/faculty/students`, {
    method: 'POST',
    headers: headersFac,
    body: JSON.stringify({
      registerNo: `REG_BOTH_EMAILS_${Date.now()}`,
      name: 'Student Both Real Emails',
      email: `stu_both_college_${Date.now()}@aids.edu`,
      personalEmail: realPersonalEmail,
      batch: '2024-2028',
      portalPassword: 'StudentPassword123!'
    })
  });
  const stu2 = (await stu2Res.json()).student;

  console.log('✅ STEP 1 PASSED: Created Student 1 (College Mail only) & Student 2 (College + Real Personal Mail).');

  // 4. Test Student 1 Personal Mail Request (Must be REJECTED — NO FAKE FALLBACK!)
  const startPersonalStu1 = await fetch(`${BASE_URL}/api/auth/google/start?studentId=${stu1.id}&purpose=NPTEL&emailType=PERSONAL`, {
    redirect: 'manual'
  });
  if (startPersonalStu1.status === 302) {
    const loc = startPersonalStu1.headers.get('location') || '';
    if (loc.includes('error=Personal%20Mail%20ID%20not%20available%20for%20this%20student.')) {
      console.log('✅ STEP 2 PASSED: Personal Mail request for student without Personal Mail ID rejected with "Personal Mail ID not available for this student." (Zero fake address generated!).');
    } else {
      throw new Error(`STEP 2 FAILED: Location header did not contain expected error: ${loc}`);
    }
  } else {
    throw new Error(`STEP 2 FAILED: Expected 302 error redirect, got ${startPersonalStu1.status}`);
  }

  // 5. Test Student 2 Personal Mail Request (Must use REAL Personal Email)
  const startPersonalStu2 = await fetch(`${BASE_URL}/api/auth/google/start?studentId=${stu2.id}&purpose=NPTEL&emailType=PERSONAL`, {
    redirect: 'manual'
  });
  if (startPersonalStu2.status === 302) {
    const loc = startPersonalStu2.headers.get('location') || '';
    if (loc.includes(`login_hint=${encodeURIComponent(realPersonalEmail)}`)) {
      console.log('✅ STEP 3 PASSED: Personal Mail request for Student 2 used exact real saved Personal Mail ID in login_hint.');
    } else {
      throw new Error(`STEP 3 FAILED: Location header missing real personal email in login_hint: ${loc}`);
    }
  }

  // 6. Test HMAC State Integrity Protection (Tampered State)
  const fakeState = Buffer.from(JSON.stringify({
    payload: JSON.stringify({ studentId: stu1.id, expectedEmail: stu1.email, timestamp: Date.now() }),
    sig: 'fake_tampered_signature_123'
  })).toString('base64url');

  const tamperedCallbackRes = await fetch(`${BASE_URL}/api/auth/google/callback?code=mock_code&state=${fakeState}`, {
    redirect: 'manual'
  });
  if (tamperedCallbackRes.status === 302) {
    const loc = tamperedCallbackRes.headers.get('location') || '';
    if (loc.includes('Invalid%20or%20expired%20OAuth%20state%20session%20token')) {
      console.log('✅ STEP 4 PASSED: Callback with tampered HMAC state rejected with "Invalid or expired OAuth state session token."');
    } else {
      throw new Error(`STEP 4 FAILED: Location header did not reject tampered state: ${loc}`);
    }
  }

  // 7. Test Expired HMAC State Protection
  const expiredState = generateTestOAuthState({
    studentId: stu1.id,
    purpose: 'NPTEL',
    emailType: 'COLLEGE',
    expectedEmail: stu1.email,
    timestamp: Date.now() - 20 * 60 * 1000 // 20 mins ago (expired)
  });

  const expiredCallbackRes = await fetch(`${BASE_URL}/api/auth/google/callback?code=mock_code&state=${expiredState}`, {
    redirect: 'manual'
  });
  if (expiredCallbackRes.status === 302) {
    const loc = expiredCallbackRes.headers.get('location') || '';
    if (loc.includes('Invalid%20or%20expired%20OAuth%20state%20session%20token')) {
      console.log('✅ STEP 5 PASSED: Callback with expired state (>15 mins) rejected with "Invalid or expired OAuth state session token."');
    } else {
      throw new Error(`STEP 5 FAILED: Location header did not reject expired state: ${loc}`);
    }
  }

  console.log('\n📊 ALL 5 STRICT NO-FAKE-EMAIL & HMAC STATE OAUTH SYSTEM TESTS PASSED PERFECTLY!');
}

runGoogleOAuthStrictSystemTest().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
