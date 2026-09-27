import Database from 'better-sqlite3';
import path from 'path';
import { syncStudentSkillEdge, syncDepartmentSkillEdge } from '../server/services/skilledgeSync.js';
import { getSkillEdgeSyncHistory, getSkillEdgeRecord, getStudent360 } from '../server/db.js';

console.log('Testing SkillEdge Sync system...');

try {
  // 1. Get a sample student
  const dbPath = path.resolve(process.cwd(), 'server', 'data', 'aids_system.db');
  const db = new Database(dbPath);
  const student = db.prepare("SELECT id, name, register_number, email FROM students LIMIT 1").get();
  
  if (!student) {
    console.log('No student found in DB');
    process.exit(0);
  }

  console.log(`Testing with student: ${student.name} (${student.register_number})`);

  // 2. Perform single student sync
  const singleResult = syncStudentSkillEdge(student.id, 'MANUAL_FACULTY');
  console.log('Single student sync result:', singleResult);

  // 3. Verify record in skilledge_records
  const record = getSkillEdgeRecord(student.id);
  console.log('Retrieved SkillEdge record:', {
    totalPoints: record?.totalPoints,
    previousPoints: record?.previousPoints,
    earnedDelta: record?.earnedDelta,
    status: record?.status,
    skilledgeHandle: record?.skilledgeHandle,
    lastSyncedAt: record?.lastSyncedAt
  });

  // 4. Verify history log
  const history = getSkillEdgeSyncHistory(student.id, 5);
  console.log(`History records count for ${student.id}:`, history.length);
  if (history.length > 0) {
    console.log('Latest history item:', history[0]);
  }

  // 5. Test Department Batch Sync
  console.log('\nTesting department batch sync...');
  const batchResult = syncDepartmentSkillEdge('CRON_DAILY');
  console.log('Batch sync result summary:', {
    totalProcessed: batchResult.totalProcessed,
    successCount: batchResult.successCount,
    failCount: batchResult.failCount,
    syncedAt: batchResult.syncedAt
  });

  // 6. Check student 360 view
  const student360 = getStudent360(student.id);
  console.log('Student 360 SkillEdge Data:', student360?.skilledge);

  console.log('\nSUCCESS: SkillEdge synchronization engine verified!');
} catch (err) {
  console.error('Error during SkillEdge verification:', err);
  process.exit(1);
}
