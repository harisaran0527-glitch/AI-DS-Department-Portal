import { db } from '../server/db';

async function testSubjectManagement() {
  console.log('🧪 Starting Subject Management end-to-end verification...\n');

  // 1. Initial subjects list check
  const initialSubjects = db.getSubjects();
  console.log(`✅ Default Seeded Subjects Count: ${initialSubjects.length}`);
  console.log('  Seeded subjects:', initialSubjects.map(s => `${s.subject_code} (${s.year} ${s.section})`).join(', '));

  // 2. Add a new test subject
  const testSubjectCode = `AD3499_${Date.now()}`;
  const newSubject = db.addSubject({
    subject_code: testSubjectCode,
    subject_name: 'Deep Learning & Neural Networks',
    department: 'AI & Data Science',
    academic_year: '2025-2026',
    year: '2nd Year',
    semester: 4,
    section: 'A',
    subject_type: 'Theory',
    credits: 4,
    faculty_handler: 'Dr. Test Handler',
    created_by_user_id: 'test_admin'
  });

  console.log(`\n✅ Subject Created Successfully! ID: ${newSubject.id}, Code: ${newSubject.subject_code}`);

  // 3. Verify duplicate prevention in same context
  try {
    db.addSubject({
      subject_code: testSubjectCode,
      subject_name: 'Duplicate Subject Test',
      department: 'AI & Data Science',
      academic_year: '2025-2026',
      year: '2nd Year',
      semester: 4,
      section: 'A',
      subject_type: 'Theory',
      credits: 3,
      faculty_handler: 'Dr. Duplicate',
      created_by_user_id: 'test_admin'
    });
    console.error('❌ ERROR: Duplicate subject code was allowed unexpectedly!');
    process.exit(1);
  } catch (err: any) {
    console.log(`✅ Duplicate Prevention Verified! Caught expected error: "${err.message}"`);
  }

  // 4. Update Subject
  const updatedSubject = db.updateSubject(newSubject.id, {
    subject_name: 'Advanced Deep Learning & Neural Networks',
    credits: 5
  });
  console.log(`\n✅ Subject Updated Successfully! Name: "${updatedSubject.subject_name}", Credits: ${updatedSubject.credits}`);

  // 5. Test Filters
  const yearFiltered = db.getSubjects({ year: '2nd Year', semester: 4, section: 'A' });
  console.log(`\n✅ Filtered Subjects (2nd Year, Sem 4, Sec A): ${yearFiltered.length} subjects found.`);

  const searchFiltered = db.getSubjects({ search: 'Deep Learning' });
  console.log(`✅ Search Filtered Subjects ("Deep Learning"): ${searchFiltered.length} subject(s) found.`);

  // 6. Delete Subject
  const deleted = db.deleteSubject(newSubject.id);
  console.log(`\n✅ Subject Deleted: ${deleted}`);

  const checkDeleted = db.getSubjectById(newSubject.id);
  if (checkDeleted) {
    console.error('❌ ERROR: Subject still exists after deletion!');
    process.exit(1);
  }
  console.log('✅ Verified Subject no longer exists in database.');

  console.log('\n🎉 ALL SUBJECT MANAGEMENT TESTS PASSED PERFECTLY!');
}

testSubjectManagement().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
