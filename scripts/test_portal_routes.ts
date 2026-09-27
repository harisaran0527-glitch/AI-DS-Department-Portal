async function testPortalRoutes() {
  console.log('🌐 Testing Portal Route HTML Responses from Vite Server...\n');
  const routes = ['/student', '/faculty', '/hod', '/admin'];

  for (const route of routes) {
    try {
      const res = await fetch(`http://127.0.0.1:3000${route}`);
      const text = await res.text();
      if (res.status === 200 && text.includes('<div id="root">')) {
        console.log(`✅ 200 OK: http://127.0.0.1:3000${route} | Rendered React root HTML.`);
      } else {
        console.error(`❌ HTTP ${res.status}: http://127.0.0.1:3000${route}`);
      }
    } catch (err: any) {
      console.error(`❌ ERROR testing http://127.0.0.1:3000${route}: ${err.message}`);
    }
  }
}

testPortalRoutes();
