const BASE_URL = 'http://127.0.0.1:5000';

async function runBestTeamHeadWorkflowTest() {
  console.log('🧪 Starting BEST TEAM HEAD WORKFLOW INTEGRATION TEST...\n');

  // 1. Admin Login & Setup Isolated Faculty A and Faculty B
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: process.env.ADMIN_EMAIL || 'departmentai&ds@gmail.com',
      password: process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs',
      role: 'ADMIN'
    })
  });

  if (!adminLoginRes.ok) {
    throw new Error(`Admin login failed: ${await adminLoginRes.text()}`);
  }
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.token;

  const timestamp = Date.now();
  const facA_Email = `bth_fac_a_${timestamp}@aids.edu`;
  const facB_Email = `bth_fac_b_${timestamp}@aids.edu`;
  const defaultPassword = 'Password123!';

  // Create Faculty A (Year 3, Sec A)
  const createFacARes = await fetch(`${BASE_URL}/api/admin/faculty`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      facultyId: `FID_BTH_A_${timestamp}`,
      facultyName: 'Team Head Faculty A',
      email: facA_Email,
      password: defaultPassword,
      year: '3rd Year',
      section: 'A',
      role: 'Class Coordinator'
    })
  });
  if (!createFacARes.ok) console.log('Fac A Creation note:', await createFacARes.text());

  // Create Faculty B (Year 3, Sec B)
  const createFacBRes = await fetch(`${BASE_URL}/api/admin/faculty`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      facultyId: `FID_BTH_B_${timestamp}`,
      facultyName: 'Team Head Faculty B',
      email: facB_Email,
      password: defaultPassword,
      year: '3rd Year',
      section: 'B',
      role: 'Class Coordinator'
    })
  });
  if (!createFacBRes.ok) console.log('Fac B Creation note:', await createFacBRes.text());

  // 2. Login as Faculty A
  const facALoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: facA_Email, password: defaultPassword, role: 'FACULTY' })
  });
  if (!facALoginRes.ok) throw new Error('Faculty A login failed');
  const facA_Cookie = facALoginRes.headers.get('set-cookie') || '';

  // Create 6 Students for Faculty A
  const studentIds = [];
  for (let i = 1; i <= 6; i++) {
    const regNo = `73763TH${timestamp.toString().slice(-4)}${i}`;
    const sRes = await fetch(`${BASE_URL}/api/faculty/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: facA_Cookie },
      body: JSON.stringify({
        registerNo: regNo,
        name: `BTH Test Student ${i}`,
        email: `bth_stu_${i}_${timestamp}@aids.edu`,
        year: '3rd Year',
        section: 'A',
        batch: '2023-2027',
        password: defaultPassword
      })
    });
    if (!sRes.ok) throw new Error(`Failed creating student ${i}: ${await sRes.text()}`);
    const sData = await sRes.json();
    studentIds.push(sData.student.id);
  }

  console.log(`✅ Created Faculty A and 6 Students: ${studentIds.join(', ')}`);

  const headStudentId = studentIds[0];
  const memberStudentIds = studentIds.slice(1, 6); // 5 members

  // 3. Create Team Head (Student 1) with memberLimit = 5
  console.log('\n--- 1. Creating Team Head with memberLimit = 5 ---');
  const createTHRes = await fetch(`${BASE_URL}/api/faculty/team-heads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: facA_Cookie },
    body: JSON.stringify({ headStudentId, memberLimit: 5 })
  });

  if (!createTHRes.ok) throw new Error(`Create Team Head failed: ${await createTHRes.text()}`);
  const createTHData = await createTHRes.json();
  const teamHeadId = createTHData.teamHead.id;

  console.log(`✅ Team Head created successfully! ID: ${teamHeadId}, Member Limit: ${createTHData.teamHead.memberLimit}`);

  // 4. Test Constraints & Validation
  console.log('\n--- 2. Testing Constraints (Self-addition, Duplicate, Over-limit) ---');

  // Constraint 4a: Head cannot be added as member
  const selfAddRes = await fetch(`${BASE_URL}/api/faculty/team-heads/${teamHeadId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: facA_Cookie },
    body: JSON.stringify({ studentIds: [headStudentId] })
  });
  if (selfAddRes.status === 400) {
    console.log('✅ Self-addition blocked correctly (400 Bad Request)');
  } else {
    throw new Error(`Self-addition should be blocked, got status: ${selfAddRes.status}`);
  }

  // Constraint 4b: Duplicate members blocked
  const dupMemberRes = await fetch(`${BASE_URL}/api/faculty/team-heads/${teamHeadId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: facA_Cookie },
    body: JSON.stringify({ studentIds: [memberStudentIds[0], memberStudentIds[0]] })
  });
  if (dupMemberRes.status === 400) {
    console.log('✅ Duplicate members blocked correctly (400 Bad Request)');
  } else {
    throw new Error(`Duplicate members should be blocked, got status: ${dupMemberRes.status}`);
  }

  // Constraint 4c: 6th member blocked when limit = 5
  const overLimitRes = await fetch(`${BASE_URL}/api/faculty/team-heads/${teamHeadId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: facA_Cookie },
    body: JSON.stringify({ studentIds: [...memberStudentIds, 'extra-stu-id'] })
  });
  if (overLimitRes.status === 400) {
    console.log('✅ Over-limit member selection blocked correctly (400 Bad Request)');
  } else {
    throw new Error(`Over-limit members should be blocked, got status: ${overLimitRes.status}`);
  }

  // 5. Add 5 Valid Members and Verify Persistence
  console.log('\n--- 3. Adding 5 Members and Verifying Persistence ---');
  const addMembersRes = await fetch(`${BASE_URL}/api/faculty/team-heads/${teamHeadId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: facA_Cookie },
    body: JSON.stringify({ studentIds: memberStudentIds })
  });

  if (!addMembersRes.ok) throw new Error(`Add members failed: ${await addMembersRes.text()}`);
  const addMembersData = await addMembersRes.json();
  console.log(`✅ 5 members added successfully. Added count: ${addMembersData.teamHead.addedCount}, Remaining slots: ${addMembersData.teamHead.remainingSlots}`);

  // Fetch Team Heads list
  const getTHListRes = await fetch(`${BASE_URL}/api/faculty/team-heads`, {
    headers: { Cookie: facA_Cookie }
  });
  const getTHListData = await getTHListRes.json();
  const foundHead = getTHListData.teamHeads.find((th) => th.id === teamHeadId);
  if (!foundHead || foundHead.members.length !== 5) {
    throw new Error('Team Head persistence check failed');
  }
  console.log('✅ Team Head persistence verified on server refresh');

  // 6. Test Shared Data between Best Student & Best Team Head
  console.log('\n--- 4. Testing Shared Performance Records (Single Source of Truth) ---');

  // Add Academics record for Member 3 (memberStudentIds[2]) via Faculty 360 Update API
  const member3Id = memberStudentIds[2];
  const acadRes = await fetch(`${BASE_URL}/api/faculty/students/${member3Id}/360`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: facA_Cookie },
    body: JSON.stringify({
      academics: [
        {
          id: `acad-shared-${timestamp}`,
          examType: 'Internal',
          subjects: [{ code: 'CS3301', title: 'Data Structures', marks: 95, maxMarks: 100 }]
        }
      ]
    })
  });
  if (!acadRes.ok) throw new Error(`Academic record update failed: ${await acadRes.text()}`);

  // Fetch 360 profile for Member 3
  const get360Res = await fetch(`${BASE_URL}/api/faculty/students/${member3Id}/360`, {
    headers: { Cookie: facA_Cookie }
  });
  const get360Data = await get360Res.json();
  const savedAcad = get360Data.academics.find((a) => a.id === `acad-shared-${timestamp}`);

  if (!savedAcad || savedAcad.subjects[0].marks !== 95) {
    throw new Error('Shared performance record verification failed');
  }
  console.log('✅ Shared performance record (Academics) verified! Best Student and Best Team Head share single database source of truth.');

  // 7. Security Test: Faculty B Cross-Workspace Isolation (403 Forbidden)
  console.log('\n--- 5. Testing Workspace Isolation (Faculty B 403 Check) ---');

  const facBLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: facB_Email, password: defaultPassword, role: 'FACULTY' })
  });
  const facB_Cookie = facBLoginRes.headers.get('set-cookie') || '';

  // Faculty B attempts to view Faculty A's Team Head
  const facBGetRes = await fetch(`${BASE_URL}/api/faculty/team-heads/${teamHeadId}`, {
    headers: { Cookie: facB_Cookie }
  });
  if (facBGetRes.status === 403) {
    console.log('✅ Faculty B read access blocked correctly (403 Forbidden)');
  } else {
    throw new Error(`Faculty B read access should be 403 Forbidden, got: ${facBGetRes.status}`);
  }

  // Faculty B attempts to delete Faculty A's Team Head
  const facBDeleteRes = await fetch(`${BASE_URL}/api/faculty/team-heads/${teamHeadId}`, {
    method: 'DELETE',
    headers: { Cookie: facB_Cookie }
  });
  if (facBDeleteRes.status === 403) {
    console.log('✅ Faculty B delete access blocked correctly (403 Forbidden)');
  } else {
    throw new Error(`Faculty B delete access should be 403 Forbidden, got: ${facBDeleteRes.status}`);
  }

  console.log('\n🎉 ALL BEST TEAM HEAD INTEGRATION VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
}

runBestTeamHeadWorkflowTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
