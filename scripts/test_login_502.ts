import { db } from '../server/db';

async function testLoginFlow() {
  console.log('=== TESTING LOGIN FLOW & API ENDPOINTS ===\n');

  // 1. Direct DB user inspection
  const users = db.getAllUsers ? db.getAllUsers() : [];
  console.log(`[DB USERS]: Total ${users.length} users registered.`);

  // Test admin user lookup
  const admin = db.findUserByIdentifier('departmentai&ds@gmail.com', 'ADMIN');
  console.log(`[ADMIN USER]:`, admin ? { id: admin.id, email: admin.email, role: admin.role, is_active: admin.is_active } : 'NOT FOUND');

  // Test HTTP login request directly to backend 5000
  console.log('\n--- Testing HTTP POST http://127.0.0.1:5000/api/auth/login ---');
  try {
    const res = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'departmentai&ds@gmail.com',
        password: 'aids@avs',
        role: 'ADMIN'
      })
    });
    console.log(`Direct Server Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`Direct Server Response:`, data);
  } catch (err: any) {
    console.error('Direct Login Error:', err.message);
  }

  // Test HTTP login request via Vite Proxy on 3000
  console.log('\n--- Testing HTTP POST http://localhost:3000/api/auth/login (Vite Proxy) ---');
  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'departmentai&ds@gmail.com',
        password: 'aids@avs',
        role: 'ADMIN'
      })
    });
    console.log(`Proxy Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`Proxy Response:`, data);
  } catch (err: any) {
    console.error('Proxy Login Error:', err.message);
  }

  // Test invalid credentials via Proxy
  console.log('\n--- Testing Invalid Credentials via Proxy ---');
  try {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'invalid@example.com',
        password: 'wrongpassword',
        role: 'STUDENT'
      })
    });
    console.log(`Invalid Cred Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`Invalid Cred Response:`, data);
  } catch (err: any) {
    console.error('Invalid Cred Error:', err.message);
  }
}

testLoginFlow();
