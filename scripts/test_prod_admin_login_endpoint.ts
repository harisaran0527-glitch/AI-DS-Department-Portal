import dotenv from 'dotenv';
dotenv.config();

async function testProdAdminLoginEndpoint() {
  console.log('🔍 Testing Production Admin Login API Endpoint...');
  const prodUrl = 'https://aids-department-portal.vercel.app/api/auth/login';

  try {
    const res = await fetch(prodUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'departmentai&ds@gmail.com',
        password: 'wrongpasswordfortest',
        role: 'ADMIN'
      })
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    const data = await res.json().catch(() => null);
    console.log('Response Payload:', data);
  } catch (err: any) {
    console.error('❌ Request Failed:', err.message);
  }
}

testProdAdminLoginEndpoint();
