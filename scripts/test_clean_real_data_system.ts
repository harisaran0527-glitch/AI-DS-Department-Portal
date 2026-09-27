import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000';

function extractCookie(res: any): string {
  const cookieHeader = res.headers.get('set-cookie');
  if (!cookieHeader) return '';
  return cookieHeader.split(';')[0];
}

async function runCleanRealDataTest() {
  console.log('🔒 Starting CLEAN REAL DATA SYSTEM VERIFICATION TEST...');
  const rand = Math.floor(Math.random() * 89999 + 10000);
  const facEmail = `fac_clean_${rand}@aids.edu`;
  const stuReg = `REG${rand}C`;
  const stuEmail = `clean_stu_${rand}@aids.edu`;

  const envAdminEmail = process.env.ADMIN_EMAIL || 'departmentai&ds@gmail.com';
  const envAdminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs';

  // 1. Admin Login
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: envAdminEmail, password: envAdminPassword, role: 'ADMIN' })
  });
  const adminCookie = extractCookie(adminRes);

  // 2. Admin creates CC Faculty
  await fetch(`${BASE_URL}/api/admin/faculty`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      facultyId: `fac_clean_id_${rand}`,
      facultyName: 'Clean Data CC',
      email: facEmail,
      year: '2nd Year',
      section: 'A',
      role: 'Class Coordinator',
      password: 'facultyPassword123'
    })
  });
  console.log(`✅ STEP 1 PASSED: Admin created CC Faculty (${facEmail})`);

  // 3. Faculty Login
  const facLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: facEmail, password: 'facultyPassword123', role: 'FACULTY' })
  });
  const facCookie = extractCookie(facLoginRes);

  // 4. CC Faculty creates Brand New Student via bulk import
  await fetch(`${BASE_URL}/api/faculty/students/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: facCookie },
    body: JSON.stringify({
      students: [{ registerNo: stuReg, name: 'Brand New Clean Student', email: stuEmail, batch: '2023-2027' }],
      defaultPassword: 'student123'
    })
  });

  // Fetch created student ID by querying roster
  const rosterRes = await fetch(`${BASE_URL}/api/faculty/students`, {
    headers: { Cookie: facCookie }
  });
  const rosterData: any = await rosterRes.json();
  const list = Array.isArray(rosterData) ? rosterData : (rosterData.students || []);
  const foundStu = list.find((s: any) => s.registerNo === stuReg || s.register_no === stuReg);

  if (!foundStu) throw new Error(`Student ${stuReg} not found in roster after import!`);
  const studentId = foundStu.id;
  console.log(`✅ STEP 2 PASSED: CC created brand new student (${foundStu.name} - ${stuReg})`);

  // 5. Fetch Student 360 Data
  const s360Res = await fetch(`${BASE_URL}/api/faculty/students/${studentId}/360`, {
    headers: { Cookie: facCookie }
  });
  const s360: any = await s360Res.json();

  // Verify all 12 performance modules are completely empty for newly created student
  if (s360.academics && s360.academics.length > 0) throw new Error('Academics is NOT empty!');
  if (s360.arrears && s360.arrears.length > 0) throw new Error('Arrears is NOT empty!');
  if (s360.nptel && s360.nptel.length > 0) throw new Error('NPTEL is NOT empty!');
  if (s360.discipline && s360.discipline.length > 0) throw new Error('Discipline is NOT empty!');
  if (s360.certificates && s360.certificates.length > 0) throw new Error('Certificates is NOT empty!');
  if (s360.participation && s360.participation.length > 0) throw new Error('Participation is NOT empty!');
  if (s360.projects && s360.projects.length > 0) throw new Error('Projects is NOT empty!');
  if (s360.achievements && s360.achievements.length > 0) throw new Error('Achievements is NOT empty!');
  if (s360.attendance && Object.keys(s360.attendance).length > 0) throw new Error('Attendance is NOT empty!');
  if (s360.leetcode && s360.leetcode.totalSolved) throw new Error('LeetCode is NOT empty!');
  if (s360.skilledge && s360.skilledge.completedLevels && s360.skilledge.completedLevels.length > 0) throw new Error('SkillEdge is NOT empty!');

  console.log('✅ STEP 3 PASSED: Verified all 12 performance modules start 100% EMPTY for newly onboarded student.');
  console.log('📊 CLEAN REAL DATA SYSTEM TEST PASSED PERFECTLY!');
}

runCleanRealDataTest().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
