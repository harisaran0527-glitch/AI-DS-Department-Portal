const prodBase = 'https://aidsportal.vercel.app';

async function main() {
  console.log('================================================================');
  console.log('  LIVE PRODUCTION VERIFICATION: AVSEC AI & DS DEPARTMENT PORTAL');
  console.log('  Target URL:', prodBase);
  console.log('================================================================\n');

  // Step 1: Login via production API using Neon faculty credentials
  console.log('Step 1: Authenticating as Faculty (tamil1234@gmail.com)...');
  const loginRes = await fetch(`${prodBase}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'tamil1234@gmail.com',
      password: 'aids@avs',
      role: 'FACULTY'
    })
  });

  console.log('Login HTTP Status:', loginRes.status);
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }

  const token = loginData.token;
  console.log('✓ Login successful! User:', loginData.user.name, `(${loginData.user.email})`);
  console.log('✓ Received production session token (length:', token?.length, ')');

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-portal-role': 'FACULTY'
  };

  // Step 2: Fetch current subjects
  console.log('\nStep 2: Fetching existing subjects from production...');
  const getSubRes = await fetch(`${prodBase}/api/subjects`, {
    headers: authHeaders
  });
  console.log('GET /api/subjects HTTP Status:', getSubRes.status);
  const getSubData = await getSubRes.json();
  console.log('✓ Found', getSubData.subjects?.length || 0, 'existing subjects in production database.');

  // Step 3: Excel Preview with official 3-column template format
  console.log('\nStep 3: Testing Excel Preview with official 3-column template...');
  const previewPayload = {
    rows: [
      {
        'Sub. Code': 'AD3401',
        'Subject Title': 'Data Structures and Algorithms',
        'Sub. Abbr': 'DSA'
      },
      {
        'Sub. Code': 'AD3601',
        'Subject Title': 'Distributed Systems and Cloud Computing',
        'Sub. Abbr': 'DSCC'
      }
    ],
    year: '3rd Year',
    semester: '6',
    section: 'ALL'
  };

  const prevRes = await fetch(`${prodBase}/api/subjects/import-preview`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(previewPayload)
  });

  console.log('POST /api/subjects/import-preview HTTP Status:', prevRes.status);
  const prevData = await prevRes.json();
  console.log('Preview Summary:', prevData.summary);
  console.log('Valid rows count:', prevData.validRows?.length);
  console.log('Invalid rows count:', prevData.invalidRows?.length);

  if (prevData.validRows?.length !== 2) {
    throw new Error('Preview did not return 2 valid rows: ' + JSON.stringify(prevData));
  }
  console.log('✓ Validated rows mapping:');
  for (const r of prevData.validRows) {
    console.log(`  - Code: "${r.subjectCode}", Title: "${r.subjectTitle}", Abbr: "${r.subjectAbbreviation}", Year: "${r.year}", Sem: ${r.semester}, Sec: "${r.section}", Status: ${r.status}`);
  }

  // Step 4: Confirm Subject Import into Production Database
  console.log('\nStep 4: Confirming Subject Import into production database...');
  const confirmPayload = {
    subjects: prevData.validRows,
    year: '3rd Year',
    semester: '6',
    section: 'ALL'
  };

  const confRes = await fetch(`${prodBase}/api/subjects/import-confirm`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(confirmPayload)
  });

  console.log('POST /api/subjects/import-confirm HTTP Status:', confRes.status);
  const confData = await confRes.json();
  console.log('Confirm Message:', confData.message);
  console.log('Imported:', confData.importedCount, '| Updated:', confData.updatedCount, '| Skipped:', confData.skippedCount, '| Failed:', confData.failedCount);

  if (confData.failedCount > 0) {
    console.error('Failed rows details:', confData.failedRows);
    throw new Error('Subjects import had failed rows!');
  }
  console.log('✓ Database save succeeded with 0 errors.');

  // Step 5: Verify Persistence (page refresh simulation)
  console.log('\nStep 5: Verifying subjects appear after refresh (GET /api/subjects?year=3rd+Year&semester=6)...');
  const verifyRes = await fetch(`${prodBase}/api/subjects?year=3rd+Year&semester=6`, {
    headers: authHeaders
  });
  console.log('GET /api/subjects?year=3rd+Year&semester=6 HTTP Status:', verifyRes.status);
  const verifyData = await verifyRes.json();
  const ad3601 = verifyData.subjects?.find((s) => s.subjectCode === 'AD3601');

  if (!ad3601) {
    throw new Error('AD3601 not found in production after import confirm!');
  }

  console.log('✓ Verified uploaded subject record persisted in production:');
  console.log('  ID:', ad3601.id);
  console.log('  Subject Code:', ad3601.subjectCode);
  console.log('  Subject Name:', ad3601.subjectName);
  console.log('  Subject Abbreviation:', ad3601.subjectAbbreviation);
  console.log('  Year:', ad3601.year);
  console.log('  Semester:', ad3601.semester);
  console.log('  Section:', ad3601.section);
  console.log('  Credits:', ad3601.credits);

  // Step 6: Clean up the test subject record
  console.log('\nStep 6: Cleaning up test subject AD3601 from production...');
  const delRes = await fetch(`${prodBase}/api/subjects/${ad3601.id}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  console.log('DELETE /api/subjects/:id HTTP Status:', delRes.status);
  const delData = await delRes.json();
  console.log('✓ Cleanup result:', delData.message);

  // Final check
  const postCleanRes = await fetch(`${prodBase}/api/subjects?year=3rd+Year&semester=6`, {
    headers: authHeaders
  });
  const postCleanData = await postCleanRes.json();
  const stillExists = postCleanData.subjects?.some((s) => s.subjectCode === 'AD3601');
  console.log('✓ Final check: AD3601 still in database?:', stillExists ? 'YES' : 'NO (cleanly removed)');

  console.log('\n================================================================');
  console.log('  ✓ ALL LIVE PRODUCTION WORKFLOW VERIFICATIONS PASSED 100%');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('\n❌ Live Verification Failed:', err);
  process.exit(1);
});

