import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000/api';

async function testHodFacultyWorkspaceWorkflow() {
  console.log('🎓 Starting ADMIN → HOD FACULTY SYNCHRONIZATION & WORKSPACE ISOLATION TEST...\n');

  // 1. Admin Login
  const adminEmail = process.env.ADMIN_EMAIL || 'departmentai&ds@gmail.com';
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs';
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: adminEmail, password: adminPassword, role: 'ADMIN' })
  });

  if (!adminLoginRes.ok) throw new Error(`Admin login failed with status ${adminLoginRes.status}`);
  const adminCookie = adminLoginRes.headers.get('set-cookie') || '';
  console.log('✅ Step 1: Admin Login Successful.');

  // 2. Admin Creates New Faculty Member
  const rand = Math.floor(Math.random() * 89999 + 10000);
  const facId = `FID_SYNC_${rand}`;
  const facEmail = `fac_sync_${rand}@aids.edu`;
  const facName = `Faculty Sync Test ${rand}`;

  const createFacRes = await fetch(`${BASE_URL}/admin/faculty`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      facultyId: facId,
      facultyName: facName,
      email: facEmail,
      year: '2nd Year',
      section: 'A',
      role: 'Class Coordinator',
      password: 'password123',
      department: 'AI & DS'
    })
  });

  const createFacData = await createFacRes.json();
  if (!createFacRes.ok || !createFacData.faculty) {
    throw new Error(`Failed to create faculty member: ${JSON.stringify(createFacData)}`);
  }
  const createdFaculty = createFacData.faculty;
  console.log(`✅ Step 2: Admin Created Faculty "${createdFaculty.name}" (ID: ${createdFaculty.id}, Identifier: ${createdFaculty.identifier})`);

  let hodCookie = '';

  try {
    // 3. HOD Login
    const hodLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'hod.aids@avsenggcollege.ac.in', password: 'hod@123', role: 'HOD' })
    });
    if (!hodLoginRes.ok) throw new Error(`HOD login failed with status ${hodLoginRes.status}`);
    hodCookie = hodLoginRes.headers.get('set-cookie') || '';
    console.log('✅ Step 3: HOD Login Successful.');

    // 4. HOD Fetches Faculty List
    console.log('\nStep 4: HOD fetching synchronized faculty list (GET /api/hod/faculty)...');
    const hodFacListRes = await fetch(`${BASE_URL}/hod/faculty`, {
      headers: { Cookie: hodCookie }
    });
    const hodFacListData = await hodFacListRes.json();
    if (!hodFacListRes.ok || !hodFacListData.faculty) {
      throw new Error(`Failed to fetch HOD faculty list: ${JSON.stringify(hodFacListData)}`);
    }

    const foundFac = hodFacListData.faculty.find((f: any) => f.id === createdFaculty.id || f.identifier === facId);
    if (foundFac) {
      console.log(`  -> PASS: Newly created faculty "${foundFac.name}" automatically synchronized in HOD list!`);
      console.log(`     Assigned Class: ${foundFac.year} Sec ${foundFac.section} | Assigned Students Count: ${foundFac.assignedStudentsCount}`);
    } else {
      throw new Error(`Created faculty member ${facId} not found in HOD faculty list!`);
    }

    // 5. HOD Opens Individual Faculty Workspace
    console.log(`\nStep 5: HOD inspecting individual workspace for faculty ID ${createdFaculty.id}...`);
    const workspaceRes = await fetch(`${BASE_URL}/hod/faculty/${createdFaculty.id}`, {
      headers: { Cookie: hodCookie }
    });
    const workspaceData = await workspaceRes.json();
    if (!workspaceRes.ok || !workspaceData.faculty) {
      throw new Error(`Failed to fetch faculty workspace: ${JSON.stringify(workspaceData)}`);
    }

    console.log(`  -> PASS: Workspace loaded for ${workspaceData.faculty.name}`);
    console.log(`     Role: ${workspaceData.faculty.facultyRole} | Department: ${workspaceData.faculty.department}`);
    console.log(`     Assigned Roster Count: ${workspaceData.students.length} students`);
    console.log(`     Class Summary: Avg CGPA: ${workspaceData.summary.avgCgpa} | Avg SkillEdge: ${workspaceData.summary.avgSkillEdge} pts`);

    // 6. Faculty Unauthorized Access Guard Check
    console.log('\nStep 6: Testing unauthorized faculty access guard to HOD workspace endpoint (Expect 403)...');
    const facLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: facEmail, password: 'password123', role: 'FACULTY' })
    });
    const facCookie = facLoginRes.headers.get('set-cookie') || '';

    const unauthorizedRes = await fetch(`${BASE_URL}/hod/faculty/${createdFaculty.id}`, {
      headers: { Cookie: facCookie }
    });
    if (unauthorizedRes.status === 403) {
      console.log('  -> PASS: Faculty user request to HOD workspace endpoint rejected with 403 Forbidden!');
    } else {
      throw new Error(`Expected 403 Forbidden, got ${unauthorizedRes.status}`);
    }

  } finally {
    // 7. Cleanup Test Faculty Record
    console.log('\nStep 7: Cleaning up test faculty record created by Admin...');
    const delRes = await fetch(`${BASE_URL}/admin/faculty/${createdFaculty.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie }
    });
    if (delRes.status === 200) {
      console.log('  -> PASS: Test faculty record deleted cleanly.');
    } else {
      console.warn(`  ⚠️ Cleanup warning status ${delRes.status}`);
    }
  }

  console.log('\n🎉 ALL ADMIN → HOD FACULTY SYNCHRONIZATION & WORKSPACE TESTS PASSED PERFECTLY!\n');
}

testHodFacultyWorkspaceWorkflow().catch((err) => {
  console.error('❌ HOD Faculty Workspace Workflow Test Failed:', err);
  process.exit(1);
});
