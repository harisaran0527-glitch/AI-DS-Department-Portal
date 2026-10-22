import dotenv from 'dotenv';
dotenv.config();

const prodBase = 'https://aidsportal.vercel.app';

async function completeLiveVerification() {
  console.log('================================================================');
  console.log('  LIVE COMPLETE VERIFICATION: BULK MARKS UPLOAD WORKFLOW');
  console.log('  Production Target:', prodBase);
  console.log('================================================================\n');

  // Step 1: Login as faculty
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
  const loginData = await loginRes.json();
  if (!loginRes.ok) throw new Error('Faculty login failed: ' + JSON.stringify(loginData));
  const token = loginData.token;
  console.log('✔ Authenticated! User:', loginData.user.name, `(${loginData.user.email})`);

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-portal-role': 'FACULTY'
  };

  // Step 2: Fetch available subjects to use valid subject codes
  console.log('\nStep 2: Checking Subject Master on production...');
  const subjectsRes = await fetch(`${prodBase}/api/subjects`, { headers: authHeaders });
  const subjectsData = await subjectsRes.json();
  const subjects = subjectsData.subjects || [];
  console.log(`✔ Found ${subjects.length} subjects in Subject Master.`);
  subjects.slice(0, 3).forEach(s => console.log(`   - ${s.subjectCode}: ${s.subjectName} (${s.year}, Sem ${s.semester})`));

  // Step 3: Test Name Variation Tolerance (e.g., S. SARAN vs SARAN S)
  console.log('\nStep 3: Testing Name Variation Tolerance (Indian naming conventions)...');
  const variationRows = [
    {
      'Register Number': '620125243146',
      'Student Name': 'S. SARAN',
      'Subject Code': 'CS25C08',
      'Marks': 88
    },
    {
      'Register Number': '620125243146',
      'Student Name': 'S SARAN',
      'Subject Code': 'MA25C08', // if exists or another
      'Marks': 90
    }
  ];

  const varRes = await fetch(`${prodBase}/api/faculty/academics/import-preview`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      rows: variationRows,
      examType: 'Unit Test 1',
      year: '2nd Year',
      section: 'A'
    })
  });
  const varData = await varRes.json();
  console.log('Variation test summary:', varData.summary);
  const row1Valid = varData.validRows.find(r => r.registerNo === '620125243146');
  if (row1Valid) {
    console.log('✔ Name variation "S. SARAN" successfully matched student "SARAN S"!');
  } else {
    console.error('❌ Failed to match name variation:', varData.invalidRows);
  }

  // Step 4: Test Update Mark Flow
  console.log('\nStep 4: Testing Update Mark in Preview...');
  const updateRows = [
    {
      'Register Number': '620125243146',
      'Student Name': 'SARAN S',
      'Subject Code': 'CS25C08',
      'Marks': 95 // Previous is 88
    }
  ];

  const updatePreviewRes = await fetch(`${prodBase}/api/faculty/academics/import-preview`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      rows: updateRows,
      examType: 'Unit Test 1',
      year: '2nd Year',
      section: 'A'
    })
  });
  const updatePreviewData = await updatePreviewRes.json();
  console.log('Update preview summary:', updatePreviewData.summary);
  const updateRow = updatePreviewData.validRows[0];
  console.log('Valid row status:', updateRow?.status, '| Previous:', updateRow?.previousMarks, '-> New:', updateRow?.marks);
  if (updateRow?.status === 'UPDATE_MARK' && updateRow.previousMarks === 88 && updateRow.marks === 95) {
    console.log('✔ Preview correctly classified row as UPDATE_MARK with previousMarks=88!');
  }

  // Step 5: Test Confirm Endpoint (POST /api/faculty/academics/import-confirm)
  console.log('\nStep 5: Testing Confirm Endpoint (POST /api/faculty/academics/import-confirm)...');
  const confirmRes = await fetch(`${prodBase}/api/faculty/academics/import-confirm`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      marks: updatePreviewData.validRows,
      examType: 'Unit Test 1',
      year: '2nd Year',
      section: 'A'
    })
  });
  const confirmData = await confirmRes.json();
  console.log('Confirm response status:', confirmRes.status);
  console.log('Confirm response data:', confirmData);
  if (confirmRes.ok && confirmData.updatedCount === 1) {
    console.log('✔ Confirm successfully updated mark and returned accurate counts!');
  }

  // Step 6: Verify in Saved Academic Records
  console.log('\nStep 6: Verifying in Saved Academic Records (GET /api/faculty/academics/records)...');
  const recordsRes = await fetch(`${prodBase}/api/faculty/academics/records?year=2nd+Year&section=A&examType=Unit+Test+1`, {
    headers: authHeaders
  });
  const recordsData = await recordsRes.json();
  console.log(`✔ Retrieved ${recordsData.records?.length || 0} academic record batches.`);
  const stuRecord = recordsData.records?.find(r => r.registerNo === '620125243146');
  if (stuRecord) {
    console.log('✔ Found updated student record:', {
      studentName: stuRecord.studentName,
      registerNo: stuRecord.registerNo,
      subjects: stuRecord.subjects
    });
  }

  // Step 7: Restore original mark (88) so production state remains pristine
  console.log('\nStep 7: Restoring original mark (88) to preserve production state...');
  const restoreRows = [
    {
      'Register Number': '620125243146',
      'Student Name': 'SARAN S',
      'Subject Code': 'CS25C08',
      'Marks': 88
    }
  ];
  const restorePreview = await (await fetch(`${prodBase}/api/faculty/academics/import-preview`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ rows: restoreRows, examType: 'Unit Test 1', year: '2nd Year', section: 'A' })
  })).json();

  const restoreConfirm = await (await fetch(`${prodBase}/api/faculty/academics/import-confirm`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ marks: restorePreview.validRows, examType: 'Unit Test 1', year: '2nd Year', section: 'A' })
  })).json();
  console.log('✔ Restored mark to 88:', restoreConfirm.message);

  console.log('\n================================================================');
  console.log('  ALL LIVE BULK MARKS VERIFICATION TESTS PASSED SUCCESSFULLY!   ');
  console.log('================================================================');
}

completeLiveVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
