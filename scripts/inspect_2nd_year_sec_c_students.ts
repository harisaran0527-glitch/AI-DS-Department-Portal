import { db } from '../server/db.js';

async function inspectStudents() {
  const allStudents = await db.getStudents('ALL', 'ALL');
  console.log('=== ALL STUDENTS IN DB (' + allStudents.length + ' total) ===');
  const mapped = allStudents.map((s) => ({
    id: s.id,
    name: s.name,
    register_no: s.register_no,
    email: s.email,
    year: s.year,
    section: s.section,
    created_by_faculty_id: (s as any).created_by_faculty_id || null,
    faculty_workspace_id: (s as any).faculty_workspace_id || null
  }));
  console.table(mapped);

  const secCStudents = mapped.filter(
    (s) => s.year === '2nd Year' && (s.section === 'C' || s.section === 'Section C')
  );
  console.log('\n=== 2ND YEAR SECTION C STUDENTS (' + secCStudents.length + ' total) ===');
  console.table(secCStudents);
}

inspectStudents().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
