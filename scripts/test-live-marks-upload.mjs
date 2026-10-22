const prodBase = 'https://aidsportal.vercel.app';

async function testLiveMarksUpload() {
  console.log('Testing live Bulk Marks Upload on', prodBase);

  // 1. Authenticate as faculty
  console.log('Step 1: Authenticating as Faculty...');
  const loginRes = await fetch(`${prodBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'tamil1234@gmail.com',
      password: 'aids@avs',
      role: 'FACULTY'
    })
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.token;
  console.log('✓ Logged in as:', loginData.user.name, '| Year:', loginData.user.assignedYear, '| Section:', loginData.user.assignedSection);

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-portal-role': 'FACULTY'
  };

  // 2. Fetch existing subjects on production to see what subjects exist
  const subjectsRes = await fetch(`${prodBase}/api/subjects`, { headers: authHeaders });
  const subjectsData = await subjectsRes.json();
  console.log('Available subjects on production:', subjectsData.subjects?.map(s => ({ code: s.subjectCode, name: s.subjectName, year: s.year, sem: s.semester, sec: s.section })));

  // 3. Test Preview with sample rows
  console.log('\nStep 2: Calling POST /api/faculty/academics/import-preview...');
  const testRows = [
    {
      'Register Number': '620125243146',
      'Student Name': 'SARAN S',
      'Subject Code': 'CS25C08',
      'Marks': 88
    },
    {
      'Register Number': '620125243146',
      'Student Name': 'SARAN S',
      'Subject Code': 'MA25C08',
      'Marks': 92
    }
  ];

  const prevRes = await fetch(`${prodBase}/api/faculty/academics/import-preview`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      rows: testRows,
      examType: 'Unit Test 1',
      year: '2nd Year',
      section: 'A'
    })
  });

  console.log('Preview HTTP Status:', prevRes.status);
  const prevData = await prevRes.json();
  console.log('Preview Response:', JSON.stringify(prevData, null, 2));

  if (!prevRes.ok || !prevData.validRows || prevData.validRows.length === 0) {
    console.error('❌ Preview failed or returned 0 valid rows.');
    return;
  }

  // 4. Test Confirm
  console.log('\nStep 3: Calling POST /api/faculty/academics/import-confirm...');
  const confRes = await fetch(`${prodBase}/api/faculty/academics/import-confirm`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      marks: prevData.validRows,
      examType: 'Unit Test 1',
      year: '2nd Year',
      section: 'A'
    })
  });

  console.log('Confirm HTTP Status:', confRes.status);
  const confData = await confRes.json();
  console.log('Confirm Response:', JSON.stringify(confData, null, 2));

  // 5. Test Saved Records retrieval
  console.log('\nStep 4: Calling GET /api/faculty/academics/records...');
  const recRes = await fetch(`${prodBase}/api/faculty/academics/records?year=2nd+Year&section=A&examType=Unit+Test+1`, {
    headers: authHeaders
  });
  console.log('Records HTTP Status:', recRes.status);
  const recData = await recRes.json();
  console.log('Records count:', recData.records?.length);
  console.log('Records sample:', JSON.stringify(recData.records?.[0], null, 2));
}

testLiveMarksUpload().catch(err => {
  console.error('Test error:', err);
});
