async function testVideoUrls() {
  console.log('📹 Testing Video URL HTTP Responses from Vite dev server...\n');
  const urls = [
    'http://127.0.0.1:3000/media/student-login.mp4',
    'http://127.0.0.1:3000/media/student-login-reverse.mp4',
    'http://127.0.0.1:3000/media/faculty-hod-login.mp4',
    'http://127.0.0.1:3000/media/faculty-hod-login-reverse.mp4'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      const contentType = res.headers.get('content-type');
      const contentLength = res.headers.get('content-length');
      if (res.status === 200) {
        console.log(`✅ 200 OK: ${url} | Content-Type: ${contentType} | Size: ${contentLength} bytes`);
      } else {
        console.error(`❌ HTTP ${res.status}: ${url}`);
      }
    } catch (err: any) {
      console.error(`❌ ERROR fetching ${url}: ${err.message}`);
    }
  }
}

testVideoUrls();
