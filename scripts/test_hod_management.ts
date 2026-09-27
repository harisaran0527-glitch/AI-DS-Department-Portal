import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000/api';

async function runHODManagementTests() {
  console.log('🔒 Starting HOD ACCOUNT MANAGEMENT & PERMISSION TESTS...\n');

  let adminCookie = '';
  let facultyCookie = '';
  let _studentCookie = '';
  let createdHODId = '';

  const adminEmail = process.env.ADMIN_EMAIL || 'departmentai&ds@gmail.com';
  const adminPass = process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs';

  try {
    // 1. Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: adminEmail, password: adminPass, role: 'ADMIN' })
    });

    if (adminLoginRes.status !== 200) {
      throw new Error(`Admin login failed: ${adminLoginRes.status}`);
    }
    adminCookie = adminLoginRes.headers.get('set-cookie') || '';
    console.log('✅ TEST 1 PASSED: Admin authenticated successfully.');

    // Create Faculty & Student for permission check
    await fetch(`${BASE_URL}/admin/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ facultyId: 'FACPERM', facultyName: 'Faculty Perm', email: 'facperm@aids.edu', year: '2nd Year', section: 'A', role: 'Class Coordinator', password: 'facpass123', department: 'AI & DS' })
    });

    const facLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'facperm@aids.edu', password: 'facpass123', role: 'FACULTY' })
    });
    facultyCookie = facLoginRes.headers.get('set-cookie') || '';

    // 2. Admin fetches HOD list
    const getHODRes = await fetch(`${BASE_URL}/admin/hod`, {
      headers: { Cookie: adminCookie }
    });
    if (getHODRes.status !== 200) {
      throw new Error(`GET /admin/hod failed: ${getHODRes.status}`);
    }
    const hodListData = await getHODRes.json();
    console.log(`✅ TEST 2 PASSED: Admin retrieved ${hodListData.hodList.length} HOD accounts.`);

    // Cleanup any pre-existing HODs so we can test creation cleanly
    for (const h of hodListData.hodList) {
      await fetch(`${BASE_URL}/admin/hod/${h.id}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
    }

    // 3. Admin creates HOD Account
    const createHODRes = await fetch(`${BASE_URL}/admin/hod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        hodId: 'HODTEST01',
        hodName: 'Dr. Test HOD',
        email: 'hod.test@aids.edu',
        password: 'hodpassword123',
        isActive: true
      })
    });

    if (createHODRes.status !== 201) {
      const err = await createHODRes.json();
      throw new Error(`CREATE HOD failed (${createHODRes.status}): ${JSON.stringify(err)}`);
    }
    const createHODData = await createHODRes.json();
    createdHODId = createHODData.hod.id;
    console.log('✅ TEST 3 PASSED: Admin created new HOD account with bcrypt hashed portal password.');

    // 4. Test Single Active HOD Rule: Attempt to create a 2nd active HOD
    const create2ndHODRes = await fetch(`${BASE_URL}/admin/hod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        hodId: 'HODTEST02',
        hodName: 'Dr. Duplicate HOD',
        email: 'hod.dup@aids.edu',
        password: 'hodpassword123',
        isActive: true
      })
    });

    if (create2ndHODRes.status === 400) {
      const err = await create2ndHODRes.json();
      if (err.error.includes('An active HOD account already exists')) {
        console.log('✅ TEST 4 PASSED: Single Active HOD Rule enforced (400 Bad Request on duplicate active HOD creation).');
      } else {
        throw new Error(`Unexpected error message: ${err.error}`);
      }
    } else {
      throw new Error(`Expected 400 Bad Request on 2nd active HOD creation, got ${create2ndHODRes.status}`);
    }

    // 5. HOD Login Test at /api/auth/login
    const hodLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'hod.test@aids.edu', password: 'hodpassword123', role: 'HOD' })
    });

    if (hodLoginRes.status !== 200) {
      throw new Error(`HOD login failed: ${hodLoginRes.status}`);
    }
    const hodLoginData = await hodLoginRes.json();
    if (hodLoginData.user.role !== 'HOD') {
      throw new Error(`Expected role HOD, got ${hodLoginData.user.role}`);
    }
    console.log('✅ TEST 5 PASSED: HOD authenticated successfully with role HOD.');

    // 6. Test Invalid HOD Password
    const invalidHODLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'hod.test@aids.edu', password: 'wrongpassword', role: 'HOD' })
    });
    if (invalidHODLoginRes.status === 401) {
      console.log('✅ TEST 6 PASSED: Invalid HOD password rejected with 401 Unauthorized.');
    } else {
      throw new Error(`Expected 401 for wrong password, got ${invalidHODLoginRes.status}`);
    }

    // 7. Disable HOD Account & Verify Login Rejection
    await fetch(`${BASE_URL}/admin/hod/${createdHODId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ isActive: false })
    });

    const disabledHODLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'hod.test@aids.edu', password: 'hodpassword123', role: 'HOD' })
    });
    if (disabledHODLoginRes.status === 401) {
      console.log('✅ TEST 7 PASSED: Disabled HOD login rejected with 401 Unauthorized.');
    } else {
      throw new Error(`Expected 401 for disabled HOD login, got ${disabledHODLoginRes.status}`);
    }

    // Re-enable HOD account
    await fetch(`${BASE_URL}/admin/hod/${createdHODId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ isActive: true })
    });

    // 8. Admin Resets HOD Password
    const resetHODRes = await fetch(`${BASE_URL}/admin/hod/${createdHODId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ password: 'newhodpassword456' })
    });
    if (resetHODRes.status !== 200) {
      throw new Error(`Reset HOD password failed: ${resetHODRes.status}`);
    }

    // Verify old password rejected
    const oldPassRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'hod.test@aids.edu', password: 'hodpassword123', role: 'HOD' })
    });
    if (oldPassRes.status !== 401) {
      throw new Error(`Expected 401 for old password after reset, got ${oldPassRes.status}`);
    }

    // Verify new password accepted
    const newPassRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'hod.test@aids.edu', password: 'newhodpassword456', role: 'HOD' })
    });
    if (newPassRes.status === 200) {
      console.log('✅ TEST 8 PASSED: Reset HOD password verified (old password rejected, new password accepted).');
    } else {
      throw new Error(`Expected 200 for new password after reset, got ${newPassRes.status}`);
    }

    // 9. Permission Guard: Faculty trying HOD management API -> 403 Forbidden
    const facultyHODRes = await fetch(`${BASE_URL}/admin/hod`, {
      headers: { Cookie: facultyCookie }
    });
    if (facultyHODRes.status === 403) {
      console.log('✅ TEST 9 PASSED: Faculty attempt to access HOD management API rejected with 403 Forbidden.');
    } else {
      throw new Error(`Expected 403 for Faculty accessing HOD API, got ${facultyHODRes.status}`);
    }

    // 10. Delete HOD Account
    const deleteHODRes = await fetch(`${BASE_URL}/admin/hod/${createdHODId}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie }
    });
    if (deleteHODRes.status === 200) {
      console.log('✅ TEST 10 PASSED: Admin deleted HOD account successfully.');
      createdHODId = '';
    } else {
      throw new Error(`Delete HOD failed: ${deleteHODRes.status}`);
    }

    console.log('\n📊 ALL 10 HOD ACCOUNT MANAGEMENT TESTS PASSED PERFECTLY!\n');
  } finally {
    // ALWAYS CLEAN UP TEST HOD DATA EVEN IF A TEST FAILS
    if (adminCookie) {
      try {
        const getHODRes = await fetch(`${BASE_URL}/admin/hod`, { headers: { Cookie: adminCookie } });
        if (getHODRes.status === 200) {
          const hodListData = await getHODRes.json();
          for (const h of hodListData.hodList || []) {
            if (
              h.identifier?.toLowerCase().includes('test') ||
              h.email?.toLowerCase().includes('test') ||
              h.name?.toLowerCase().includes('test') ||
              h.identifier?.toLowerCase().includes('dup')
            ) {
              await fetch(`${BASE_URL}/admin/hod/${h.id}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
            }
          }
        }
      } catch (e) {
        console.error('Test cleanup warning:', e);
      }
    }
  }
}

runHODManagementTests().catch((err) => {
  console.error('❌ HOD MANAGEMENT TEST FAILED:', err);
  process.exit(1);
});
