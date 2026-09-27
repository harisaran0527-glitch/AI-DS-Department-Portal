async function testDashboardRoutes() {
  console.log('🌐 Testing Dashboard Route HTML Responses...\n');
  const routes = ['/student/dashboard', '/faculty/dashboard', '/hod/dashboard', '/admin/dashboard'];

  for (const route of routes) {
    try {
      const res = await fetch(`http://127.0.0.1:3000${route}`);
      const text = await res.text();
      if (res.status === 200 && text.includes('<div id="root">')) {
        console.log(`✅ 200 OK: http://127.0.0.1:3000${route} | Rendered React Dashboard root.`);
      } else {
        console.error(`❌ HTTP ${res.status}: http://127.0.0.1:3000${route}`);
      }
    } catch (err: any) {
      console.error(`❌ ERROR testing http://127.0.0.1:3000${route}: ${err.message}`);
    }
  }
}

testDashboardRoutes();
