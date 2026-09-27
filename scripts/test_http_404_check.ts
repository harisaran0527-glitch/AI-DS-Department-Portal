async function checkEndpoints() {
  console.log('=== TESTING RANKING API FOR FACULTY / HOD / STUDENT ===\n');

  // Test 1: Faculty Login (Class Coordinator 2nd Year Sec A)
  const facLoginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'cca_90555@aids.edu',
      password: 'Password123!',
      role: 'FACULTY'
    })
  });

  console.log(`Faculty Login Status: ${facLoginRes.status}`);
  const facCookie = facLoginRes.headers.get('set-cookie');

  // Request ranking via Vite proxy port 3000
  const facViteRes = await fetch('http://127.0.0.1:3000/api/rankings/top-recognition?year=2nd%20Year&section=A', {
    headers: { cookie: facCookie || '' }
  });
  console.log(`Faculty Vite Proxy /api/rankings/top-recognition Status: ${facViteRes.status}`);
  if (facViteRes.status === 200) {
    const data = await facViteRes.json();
    console.log(`   Calculated At: ${data.calculatedAt}`);
    console.log(`   Best Student 1st Place: ${data.bestStudent?.firstPlace?.studentName} (${data.bestStudent?.firstPlace?.score} pts)`);
    console.log(`   Best Student 2nd Place: ${data.bestStudent?.secondPlace?.studentName} (${data.bestStudent?.secondPlace?.score} pts)`);
    console.log(`   Gemini AI Status Pill: ${data.geminiApiStatus?.statusMessage}`);
  } else {
    console.log(`   Error: ${await facViteRes.text()}`);
  }

  // Test 2: Student Login
  const stuLoginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: '620125243144',
      password: 'Password123!',
      role: 'STUDENT'
    })
  });
  console.log(`\nStudent Login Status: ${stuLoginRes.status}`);
  const stuCookie = stuLoginRes.headers.get('set-cookie');

  const stuViteRes = await fetch('http://127.0.0.1:3000/api/rankings/top-recognition', {
    headers: { cookie: stuCookie || '' }
  });
  console.log(`Student Vite Proxy /api/rankings/top-recognition Status: ${stuViteRes.status}`);
  if (stuViteRes.status === 200) {
    const data = await stuViteRes.json();
    console.log(`   Student View Best Student 1st: ${data.bestStudent?.firstPlace?.studentName}`);
  }
}

checkEndpoints().catch(console.error);
