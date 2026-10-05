/**
 * Comprehensive End-to-End Authentication Verification Script
 * Validates login, session management, token sanitization, and role authorization
 * against both Render backend and Vercel production proxy.
 */

async function runAuthTests() {
  const RENDER_BASE = 'https://ai-ds-department-portal.onrender.com';
  const VERCEL_BASE = 'https://aids-department-portal.vercel.app';

  console.log('====================================================');
  console.log('STARTING END-TO-END AUTHENTICATION TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(name, condition, details) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`);
      failedTests++;
    }
  }

  // TEST 1: Wrong credentials against Render backend returns 401 with 'Invalid credentials'
  try {
    const res = await fetch(`${RENDER_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'nonexistent_user@example.com', password: 'wrongpassword', role: 'ADMIN' })
    });
    const body = await res.json().catch(() => ({}));
    const isInvalidCreds = res.status === 401 && (
      String(body.message || '').includes('Invalid credentials') ||
      String(body.error || '').includes('Invalid credentials')
    );
    assert(
      'Test 1: Render backend returns 401 on wrong credentials',
      isInvalidCreds,
      `Status: ${res.status}, body: ${JSON.stringify(body)}`
    );
  } catch (err) {
    assert('Test 1: Render backend returns 401 on wrong credentials', false, err.message);
  }

  // TEST 2: Wrong credentials against Vercel proxy returns 401 with 'Invalid credentials'
  try {
    const res = await fetch(`${VERCEL_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'nonexistent_user@example.com', password: 'wrongpassword', role: 'ADMIN' })
    });
    const body = await res.json().catch(() => ({}));
    const isInvalidCreds = res.status === 401 && (
      String(body.message || '').includes('Invalid credentials') ||
      String(body.error || '').includes('Invalid credentials')
    );
    assert(
      'Test 2: Vercel proxy returns 401 on wrong credentials',
      isInvalidCreds,
      `Status: ${res.status}, body: ${JSON.stringify(body)}`
    );
  } catch (err) {
    assert('Test 2: Vercel proxy returns 401 on wrong credentials', false, err.message);
  }

  // TEST 3: Calling /api/auth/me without Authorization header returns 401
  try {
    const res = await fetch(`${RENDER_BASE}/api/auth/me`);
    const body = await res.json().catch(() => ({}));
    assert(
      'Test 3: Calling /api/auth/me without token returns 401 missing session token',
      res.status === 401 && String(body.error).includes('Missing authentication session token'),
      `Status: ${res.status}, body: ${JSON.stringify(body)}`
    );
  } catch (err) {
    assert('Test 3: Calling /api/auth/me without token returns 401', false, err.message);
  }

  // TEST 4: Calling /api/auth/me with Bearer null or Bearer undefined returns 401 unauthorized
  try {
    const resNull = await fetch(`${RENDER_BASE}/api/auth/me`, {
      headers: { 'Authorization': 'Bearer null' }
    });
    const bodyNull = await resNull.json().catch(() => ({}));
    assert(
      'Test 4a: Calling /api/auth/me with "Bearer null" returns 401 unauthorized',
      resNull.status === 401 && String(bodyNull.error).includes('Unauthorized:'),
      `Status: ${resNull.status}, body: ${JSON.stringify(bodyNull)}`
    );

    const resUndef = await fetch(`${RENDER_BASE}/api/auth/me`, {
      headers: { 'Authorization': 'Bearer undefined' }
    });
    const bodyUndef = await resUndef.json().catch(() => ({}));
    assert(
      'Test 4b: Calling /api/auth/me with "Bearer undefined" returns 401 unauthorized',
      resUndef.status === 401 && String(bodyUndef.error).includes('Unauthorized:'),
      `Status: ${resUndef.status}, body: ${JSON.stringify(bodyUndef)}`
    );
  } catch (err) {
    assert('Test 4: Bearer null/undefined handling', false, err.message);
  }

  // TEST 5: Valid credentials return 200, JWT token, user object with correct role
  let validToken = '';
  try {
    const res = await fetch(`${RENDER_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin', password: 'aids@avs', role: 'ADMIN' })
    });
    const body = await res.json().catch(() => ({}));
    validToken = body.token || '';
    assert(
      'Test 5: Valid admin login succeeds with HTTP 200, token, and user info',
      res.status === 200 && Boolean(validToken) && body.user?.role === 'ADMIN',
      `Status: ${res.status}, role: ${body.user?.role}`
    );
  } catch (err) {
    assert('Test 5: Valid admin login succeeds', false, err.message);
  }

  // TEST 6: Calling /api/auth/me with valid Bearer token returns 200 and user data
  if (validToken) {
    try {
      const res = await fetch(`${RENDER_BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${validToken}` }
      });
      const body = await res.json().catch(() => ({}));
      assert(
        'Test 6: /api/auth/me with valid token returns HTTP 200 and user identity',
        res.status === 200 && body.user?.role === 'ADMIN',
        `Status: ${res.status}, role: ${body.user?.role}`
      );
    } catch (err) {
      assert('Test 6: /api/auth/me with valid token', false, err.message);
    }

    // TEST 7: Calling /api/auth/me via Vercel proxy with valid token returns 200
    try {
      const res = await fetch(`${VERCEL_BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${validToken}` }
      });
      const body = await res.json().catch(() => ({}));
      assert(
        'Test 7: Vercel proxy forwards /api/auth/me with valid token -> HTTP 200',
        res.status === 200 && body.user?.role === 'ADMIN',
        `Status: ${res.status}, role: ${body.user?.role}`
      );
    } catch (err) {
      assert('Test 7: Vercel proxy /api/auth/me', false, err.message);
    }

    // TEST 8: Calling /api/auth/logout with valid token returns HTTP 200
    try {
      const res = await fetch(`${RENDER_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${validToken}` }
      });
      assert(
        'Test 8: /api/auth/logout with valid token returns HTTP 200',
        res.status === 200,
        `Status: ${res.status}`
      );
    } catch (err) {
      assert('Test 8: /api/auth/logout with token', false, err.message);
    }
  }

  // TEST 9: Student login flow verification (wrong password rejected)
  try {
    const res = await fetch(`${RENDER_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'student', password: 'wrongpassword', role: 'STUDENT' })
    });
    const body = await res.json().catch(() => ({}));
    const isInvalidCreds = res.status === 401 && (
      String(body.message || '').includes('Invalid credentials') ||
      String(body.error || '').includes('Invalid credentials')
    );
    assert(
      'Test 9: Student wrong credentials correctly rejected with 401',
      isInvalidCreds,
      `Status: ${res.status}, body: ${JSON.stringify(body)}`
    );
  } catch (err) {
    assert('Test 9: Student login test', false, err.message);
  }

  // TEST 10: Faculty login flow verification (wrong password rejected)
  try {
    const res = await fetch(`${RENDER_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'faculty', password: 'wrongpassword', role: 'FACULTY' })
    });
    const body = await res.json().catch(() => ({}));
    const isInvalidCreds = res.status === 401 && (
      String(body.message || '').includes('Invalid credentials') ||
      String(body.error || '').includes('Invalid credentials')
    );
    assert(
      'Test 10: Faculty wrong credentials correctly rejected with 401',
      isInvalidCreds,
      `Status: ${res.status}, body: ${JSON.stringify(body)}`
    );
  } catch (err) {
    assert('Test 10: Faculty login test', false, err.message);
  }

  // TEST 11: HOD login flow verification (wrong password rejected)
  try {
    const res = await fetch(`${RENDER_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'hod', password: 'wrongpassword', role: 'HOD' })
    });
    const body = await res.json().catch(() => ({}));
    const isInvalidCreds = res.status === 401 && (
      String(body.message || '').includes('Invalid credentials') ||
      String(body.error || '').includes('Invalid credentials')
    );
    assert(
      'Test 11: HOD wrong credentials correctly rejected with 401',
      isInvalidCreds,
      `Status: ${res.status}, body: ${JSON.stringify(body)}`
    );
  } catch (err) {
    assert('Test 11: HOD login test', false, err.message);
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAuthTests();
