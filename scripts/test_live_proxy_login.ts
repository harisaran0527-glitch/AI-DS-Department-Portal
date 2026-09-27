async function testLiveProxyLogin() {
  console.log('🌐 TESTING LIVE PROXY LOGIN AT http://127.0.0.1:3000/api/auth/login...\n');

  const accounts = [
    { role: 'ADMIN', identifier: 'departmentai&ds@gmail.com', pass: 'aids@avs' },
    { role: 'ADMIN', identifier: 'admin', pass: 'aids@avs' },
    { role: 'HOD', identifier: 'hod.aids@avsenggcollege.ac.in', pass: 'hod@123' },
    { role: 'HOD', identifier: 'hod', pass: 'hod@123' },
    { role: 'FACULTY', identifier: 'faculty.aids@avsenggcollege.ac.in', pass: 'faculty@123' },
    { role: 'FACULTY', identifier: 'AD620125243146', pass: 'faculty@123' },
    { role: 'STUDENT', identifier: 'student.aids@avsenggcollege.ac.in', pass: 'student@123' },
    { role: 'STUDENT', identifier: '730123243001', pass: 'student@123' },
    { role: 'STUDENT', identifier: '620125243144', pass: 'Password123!' },
    { role: 'STUDENT', identifier: 'REG56276C', pass: 'student@123' }
  ];

  for (const acc of accounts) {
    try {
      const res = await fetch('http://127.0.0.1:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: acc.identifier, password: acc.pass, role: acc.role })
      });
      const data = await res.json();
      console.log(`[${acc.role.padEnd(7)}] ID: "${acc.identifier.padEnd(32)}" -> Status ${res.status}: ${data.message || data.error}`);
    } catch (err: any) {
      console.error(`[${acc.role.padEnd(7)}] ID: "${acc.identifier}" -> FETCH ERROR:`, err.message);
    }
  }
}

testLiveProxyLogin().catch(console.error);
