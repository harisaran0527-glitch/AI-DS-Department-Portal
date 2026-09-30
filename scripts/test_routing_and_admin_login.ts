import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'https://aids-department-portal.vercel.app';

async function runRoutingAndAdminLoginTestSuite() {
  console.log(`
==================================================
   PRODUCTION ROUTING & ADMIN LOGIN TEST SUITE
==================================================
  `);

  // 1. HEALTH CHECK
  console.log('1️⃣ Testing Production Health Endpoint...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  console.log(`   Health Status: ${healthRes.status} ${healthRes.statusText}`);
  const healthData = await healthRes.json().catch(() => null);
  console.log('   Health Data:', healthData);
  if (healthRes.status !== 200) throw new Error('Health check failed!');

  // 2. ADMIN LOGIN TEST
  console.log('\n2️⃣ Testing Production Admin Login API...');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'departmentai&ds@gmail.com',
      password: process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs',
      role: 'ADMIN'
    })
  });
  console.log(`   Admin Login Status: ${adminLoginRes.status} ${adminLoginRes.statusText}`);
  const adminData = await adminLoginRes.json().catch(() => null);
  console.log('   Admin Login Result:', adminData);
  if (adminLoginRes.status !== 200 || !adminData?.user) {
    throw new Error('Production Admin Login failed!');
  }
  console.log('✅ [PASS] Production Admin Login Succeeded! Admin User:', adminData.user.email);

  // 3. HOD LOGIN TEST
  console.log('\n3️⃣ Testing Production HOD Login API...');
  const hodLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'hod.aids@avsenggcollege.ac.in',
      password: 'hod@123',
      role: 'HOD'
    })
  });
  console.log(`   HOD Login Status: ${hodLoginRes.status} ${hodLoginRes.statusText}`);
  const hodData = await hodLoginRes.json().catch(() => null);
  if (hodLoginRes.status !== 200 || !hodData?.user) {
    throw new Error('Production HOD Login failed!');
  }
  console.log('✅ [PASS] Production HOD Login Succeeded! HOD User:', hodData.user.email);

  // 4. FACULTY LOGIN TEST
  console.log('\n4️⃣ Testing Production Faculty Login API...');
  const facLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'faculty.aids@avsenggcollege.ac.in',
      password: 'faculty@123',
      role: 'FACULTY'
    })
  });
  console.log(`   Faculty Login Status: ${facLoginRes.status} ${facLoginRes.statusText}`);
  const facData = await facLoginRes.json().catch(() => null);
  if (facLoginRes.status !== 200 || !facData?.user) {
    throw new Error('Production Faculty Login failed!');
  }
  console.log('✅ [PASS] Production Faculty Login Succeeded! Faculty User:', facData.user.email);

  // 5. STUDENT LOGIN TEST
  console.log('\n5️⃣ Testing Production Student Login API...');
  const stuLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'student.aids@avsenggcollege.ac.in',
      password: 'student@123',
      role: 'STUDENT'
    })
  });
  console.log(`   Student Login Status: ${stuLoginRes.status} ${stuLoginRes.statusText}`);
  const stuData = await stuLoginRes.json().catch(() => null);
  if (stuLoginRes.status !== 200 || !stuData?.user) {
    throw new Error('Production Student Login failed!');
  }
  console.log('✅ [PASS] Production Student Login Succeeded! Student User:', stuData.user.email);

  console.log(`
==================================================
🎉 ALL PRODUCTION AUTH & ROUTING TESTS PASSED!
==================================================
  `);
}

runRoutingAndAdminLoginTestSuite().catch((err) => {
  console.error('❌ Test Suite Error:', err.message);
  process.exit(1);
});
