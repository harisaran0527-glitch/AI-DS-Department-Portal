import { db } from '../server/db';
import Database from 'better-sqlite3';
import path from 'path';

async function testParticipationFeature() {
  console.log('Testing Participation Module Backend Integration...');

  const DB_PATH = path.resolve(process.cwd(), 'server', 'data', 'aids_system.db');
  const sqlite = new Database(DB_PATH);
  const students = sqlite.prepare('SELECT * FROM students LIMIT 1').all() as any[];

  if (students.length === 0) {
    console.error('No students found in DB!');
    process.exit(1);
  }

  const testStudent = students[0];
  console.log(`Testing with student: ${testStudent.name} (${testStudent.id})`);

  // 1. Save participation upload record
  console.log('\n--- Test 1: Uploading Participation Record ---');
  const partId = db.saveParticipationUpload({
    studentId: testStudent.id,
    eventName: 'National Level AI Hackathon 2026',
    category: 'Hackathon',
    eventLevel: 'National',
    organizer: 'IIT Madras',
    date: '2026-08-20',
    achievement: '1st Prize / Winner',
    description: 'Developed an agentic AI system for department analytics.',
    filePath: 'sample_proof.pdf',
    originalFileName: 'National_Hackathon_Certificate.pdf'
  });

  console.log('Saved Participation ID:', partId);

  // 2. Fetch 360 profile
  const p360 = db.getStudent360(testStudent.id);
  const found = p360?.participation?.find((p: any) => p.id === partId);
  console.log('Retrieved record from 360 profile:', found);

  if (!found || found.eventName !== 'National Level AI Hackathon 2026' || found.category !== 'Hackathon' || found.eventLevel !== 'National') {
    console.error('❌ FAILED: Saved participation record mismatch or missing!');
    process.exit(1);
  } else {
    console.log('✅ PASS: Participation record accurately retrieved in 360 profile.');
  }

  // 3. Update participation record
  console.log('\n--- Test 2: Updating Participation Record ---');
  const updateSuccess = db.updateParticipationUpload(partId, testStudent.id, {
    eventName: 'Global AI & DS Hackathon 2026',
    category: 'Hackathon',
    eventLevel: 'International',
    organizer: 'IEEE Computer Society',
    date: '2026-08-25',
    achievement: 'Grand Winner ($5000 Prize)',
    description: 'Updated description for international hackathon victory.',
    filePath: 'updated_proof.pdf',
    originalFileName: 'IEEE_Global_Winner_Certificate.pdf'
  });

  if (!updateSuccess) {
    console.error('❌ FAILED: updateParticipationUpload returned false!');
    process.exit(1);
  }

  const p360Updated = db.getStudent360(testStudent.id);
  const updatedRecord = p360Updated?.participation?.find((p: any) => p.id === partId);
  console.log('Updated record from 360 profile:', updatedRecord);

  if (updatedRecord?.eventName !== 'Global AI & DS Hackathon 2026' || updatedRecord?.eventLevel !== 'International' || updatedRecord?.achievement !== 'Grand Winner ($5000 Prize)') {
    console.error('❌ FAILED: Updated participation record mismatch!');
    process.exit(1);
  } else {
    console.log('✅ PASS: Participation record successfully updated.');
  }

  // 4. Test delete record
  console.log('\n--- Test 3: Deleting Participation Record ---');
  db.deletePerformanceRecord('participation', partId, testStudent.id);

  const p360AfterDelete = db.getStudent360(testStudent.id);
  const deletedCheck = p360AfterDelete?.participation?.find((p: any) => p.id === partId);

  if (deletedCheck) {
    console.error('❌ FAILED: Record was not deleted!');
    process.exit(1);
  } else {
    console.log('✅ PASS: Participation record successfully deleted from database.');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL PARTICIPATION BACKEND TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

testParticipationFeature().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
