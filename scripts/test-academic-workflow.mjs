import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const neonUrl = 'postgresql://neondb_owner:npg_5f6VDuRoHeEm@ep-morning-hat-b3a7h7ov-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

// Set DATABASE_URL so postgresAdapter connects to Neon
process.env.DATABASE_URL = neonUrl;
process.env.USE_SQLITE = 'false';

const { db } = await import('../server/db.ts');

async function testWorkflow() {
  console.log('--- Testing upsertStudentSubjectMark with Neon PostgreSQL ---');

  const allStudents = await db.getAllStudents();
  console.log(`Fetched ${allStudents.length} students from Neon.`);
  if (allStudents.length === 0) {
    console.error('No students found in Neon.');
    return;
  }

  const student = allStudents[0];
  console.log('Selected student:', {
    id: student.id,
    register_no: student.register_no || student.registerNo,
    name: student.name,
    year: student.year,
    section: student.section
  });

  const allSubjects = await db.getSubjects({});
  console.log(`Fetched ${allSubjects.length} subjects from Neon.`);
  const subject = allSubjects[0];
  console.log('Selected subject:', {
    id: subject?.id,
    subjectCode: subject?.subjectCode,
    subjectName: subject?.subjectName
  });

  if (!subject) {
    console.log('No subjects in Neon. Cannot test subject marks.');
    return;
  }

  try {
    console.log('\nAttempting upsertStudentSubjectMark...');
    await db.upsertStudentSubjectMark(
      student.id,
      subject.subjectCode,
      subject.subjectName,
      88,
      3,
      'Unit Test 1'
    );
    console.log('✓ upsertStudentSubjectMark succeeded!');

    console.log('\nFetching academic records...');
    const records = await db.getAcademicRecords({
      year: student.year,
      section: student.section,
      examType: 'Unit Test 1'
    });
    console.log(`✓ Retrieved ${records.length} academic records.`);
    const matching = records.find(r => r.studentId === student.id);
    console.log('Matching student record:', matching);

  } catch (err) {
    console.error('❌ Error during upsertStudentSubjectMark:', err);
  }

  process.exit(0);
}

testWorkflow().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
