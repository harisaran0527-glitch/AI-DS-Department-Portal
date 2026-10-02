import app from '../server/index.js';
import type { Server } from 'http';

process.env.NODE_ENV = 'production';

async function verifyRoutesAndHealth() {
  console.log('========================================================================');
  console.log('🔍 CLEANUP VERIFICATION — ROUTE & API HEALTH AUDIT');
  console.log('========================================================================\n');

  const PORT = 5998;
  const server: Server = app.listen(PORT);
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // 1. Verify API Health Endpoint
    console.log('1. Checking /api/health endpoint...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData: any = await healthRes.json();
    console.log(`   - Status: ${healthRes.status} ${healthRes.ok ? 'OK' : 'FAIL'}`);
    console.log(`   - Department: ${healthData.department || 'N/A'}`);
    console.log(`   - Health Status: ${healthData.status || 'N/A'}`);

    if (healthRes.status !== 200 || healthData.status !== 'ok') {
      throw new Error('/api/health verification failed.');
    }
    console.log('   ✅ /api/health is 100% operational.\n');

    // 2. Verify Four Portal Login Routes Response Statuses
    const loginRoutes = [
      { path: '/admin', name: 'Admin Portal Login (/admin)' },
      { path: '/student', name: 'Student Portal Login (/student)' },
      { path: '/hod', name: 'HOD Portal Login (/hod)' },
      { path: '/faculty', name: 'Faculty Portal Login (/faculty)' }
    ];

    console.log('2. Checking Portal Login Routes...');
    for (const route of loginRoutes) {
      const res = await fetch(`${baseUrl}${route.path}`);
      // Express server with static/route fallback returns 200 OK for HTML route
      console.log(`   - ${route.name.padEnd(35)}: Status ${res.status}`);
      if (res.status !== 200 && res.status !== 304 && res.status !== 302) {
        throw new Error(`Route ${route.path} returned unexpected status ${res.status}`);
      }
    }
    console.log('   ✅ All 4 portal login routes (/admin, /student, /hod, /faculty) verified successfully.\n');

    console.log('========================================================================');
    console.log('🎉 ALL ROUTE AND HEALTH VERIFICATIONS PASSED CLEANLY!');
    console.log('========================================================================');
  } finally {
    server.close();
  }
}

verifyRoutesAndHealth().catch((err) => {
  console.error('Route verification failed:', err);
  process.exit(1);
});
