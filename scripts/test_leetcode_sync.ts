import { syncLeetCodeProfile } from '../server/services/externalSync';
import { db } from '../server/db';

async function testLeetCodeSync() {
  console.log('=== TESTING LIVE LEETCODE DATA SYNC & BEST LEETCODE PERFORMER RANKING ===\n');

  // 1. Get sample student from DB
  const students = db.getStudents();
  if (students.length === 0) {
    console.error('No students found in DB.');
    process.exit(1);
  }

  const sampleStudent = students[0];
  console.log(`Target Student: ${sampleStudent.name} (${sampleStudent.register_no || sampleStudent.registerNo})`);

  // Test URL parsing and handle sync with live handle (e.g., 'leetcode' or 'neal_wu' or 'https://leetcode.com/u/neal_wu')
  const testHandles = [
    'https://leetcode.com/u/neal_wu',
    'leetcode',
    'tourist'
  ];

  for (const handleInput of testHandles) {
    console.log(`\nSyncing handle/URL: "${handleInput}"...`);
    try {
      const result = await syncLeetCodeProfile(sampleStudent.id, handleInput);
      console.log(`[PASS] Sync Success for "${result.username}":`, {
        totalSolved: result.totalSolved,
        easy: result.easySolved,
        medium: result.mediumSolved,
        hard: result.hardSolved,
        contestRating: result.contestRating,
        ranking: result.ranking,
        syncedAt: result.syncedAt
      });
    } catch (err: any) {
      console.error(`[NOTICE] Sync Result for "${handleInput}":`, err.message);
    }
  }

  // Check 360 profile
  const full360 = db.getStudent360(sampleStudent.id);
  console.log('\n[UPDATED 360 LEETCODE RECORD]:', full360?.leetcode);
}

testLeetCodeSync().catch(console.error);
