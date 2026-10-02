import { db } from '../server/db.js';

async function cleanTestStudents() {
  console.log('🧹 Cleaning leftover test records from database...');

  const testRegs = ['TEST24AD001', 'TEST24AD_SECA', 'TEST1stYEAR_SECC', 'AUDIT_STUDENT_1790818150357', 'REG99999SK'];
  const testEmails = [
    'saran.test@college.edu',
    'saran.updated@college.edu',
    'secA.student@college.edu',
    'year1.student@college.edu',
    'facultyc.test@college.edu',
    'audit_student_1790818150357@aids.edu',
    'saran@college.ac.in'
  ];

  for (const reg of testRegs) {
    const s = (await db.getStudents('ALL', 'ALL')).find((x) => x.register_no.toUpperCase() === reg.toUpperCase());
    if (s) {
      await db.deleteStudentUser(s.id);
      console.log(`Deleted test student record: ${s.register_no} (${s.name})`);
    }
  }

  for (const email of testEmails) {
    const u = await db.findUserByIdentifier(email);
    if (u) {
      if (u.role === 'FACULTY') {
        await db.deleteFacultyUser(u.id);
      } else if (u.role === 'STUDENT') {
        await db.deleteStudentUser(u.id);
      }
      console.log(`Deleted test user account: ${u.email}`);
    }
  }

  console.log('✅ Test record cleanup complete.');
}

cleanTestStudents().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
