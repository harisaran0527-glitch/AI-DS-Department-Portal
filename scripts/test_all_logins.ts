import { SQLiteDB } from '../server/db';

async function testAllRoleLogins() {
  console.log('=== INITIALIZING SYSTEM ACCOUNTS FOR ALL 4 ROLES ===\n');
  await SQLiteDB.initSystemAccounts();

  console.log('\n=== TESTING LOGIN FOR ALL 4 ROLES VIA PROXY (http://localhost:3000/api/auth/login) ===\n');

  const testAccounts = [
    { role: 'ADMIN', identifier: 'departmentai&ds@gmail.com', pass: 'aids@avs' },
    { role: 'ADMIN', identifier: 'admin', pass: 'aids@avs' },
    { role: 'HOD', identifier: 'hod.aids@avsenggcollege.ac.in', pass: 'hod@123' },
    { role: 'HOD', identifier: 'hod', pass: 'hod@123' },
    { role: 'FACULTY', identifier: 'faculty.aids@avsenggcollege.ac.in', pass: 'faculty@123' },
    { role: 'FACULTY', identifier: 'AD620125243146', pass: 'faculty@123' },
    { role: 'FACULTY', identifier: 'FACPERM', pass: 'faculty@123' },
    { role: 'STUDENT', identifier: 'student.aids@avsenggcollege.ac.in', pass: 'student@123' },
    { role: 'STUDENT', identifier: '730123243001', pass: 'student@123' },
    { role: 'STUDENT', identifier: 'REG56276C', pass: 'student@123' }
  ];

  let passCount = 0;
  let failCount = 0;

  for (const acc of testAccounts) {
    try {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: acc.identifier,
          password: acc.pass,
          role: acc.role
        })
      });

      const body = await res.json();
      if (res.status === 200 && body.token) {
        passCount++;
        console.log(`[SUCCESS] Role: ${acc.role.padEnd(8)} | Identifier: "${acc.identifier.padEnd(32)}" | Status: 200 | User: ${body.user?.name}`);
      } else {
        failCount++;
        console.log(`[FAIL]    Role: ${acc.role.padEnd(8)} | Identifier: "${acc.identifier.padEnd(32)}" | Status: ${res.status} | Error: ${body.error}`);
      }
    } catch (err: any) {
      failCount++;
      console.error(`[ERROR]   Role: ${acc.role} | Connection Error:`, err.message);
    }
  }

  // TEST INVALID CREDENTIALS SECURITY CHECK
  console.log('\n=== TESTING INVALID CREDENTIALS SECURITY CHECK ===');
  const invalidRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'nonexistent_user',
      password: 'wrong_password',
      role: 'STUDENT'
    })
  });

  const invalidBody = await invalidRes.json();
  if (invalidRes.status === 401 && invalidBody.error) {
    console.log(`[PASS]: Invalid credentials returned 401 Unauthorized cleanly: "${invalidBody.error}"`);
  } else {
    console.error(`[FAIL]: Expected 401 for invalid credentials, got ${invalidRes.status}`);
  }

  console.log(`\nFinal Test Results: ${passCount} Successful Logins across all 4 roles!`);
}

testAllRoleLogins().catch(console.error);
