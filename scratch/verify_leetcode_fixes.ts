import { db } from '../server/db';
import Database from 'better-sqlite3';
import path from 'path';

async function testBackend() {
  console.log('Testing LeetCode Username Storage & Sync Backend Logic...');

  const DB_PATH = path.resolve(process.cwd(), 'server', 'data', 'aids_system.db');
  const sqlite = new Database(DB_PATH);
  const students = sqlite.prepare('SELECT * FROM students LIMIT 5').all() as any[];
  
  if (students.length === 0) {
    console.error('No students found in DB!');
    process.exit(1);
  }

  const testStudent = students[0];
  console.log(`Test student: ${testStudent.name} (${testStudent.id})`);

  // 1. Set explicit username via db.updateLeetCode
  console.log('\n--- Test 1: Saving explicit LeetCode handle ---');
  db.updateLeetCode(testStudent.id, 'OFQwEti18b', 15, 20, 5, 1450);
  
  let p1 = db.getStudent360(testStudent.id);
  console.log('Retrieved 360 LeetCode Username:', p1?.leetcode?.username);
  if (p1?.leetcode?.username !== 'OFQwEti18b') {
    console.error('❌ FAILED: Username was not set to OFQwEti18b!');
    process.exit(1);
  } else {
    console.log('✅ PASS: Username correctly saved and retrieved.');
  }

  // 2. Call updateLeetCode with scalar numbers (simulating PUT /360 performance update)
  console.log('\n--- Test 2: Updating scalar problem counts without overwriting handle ---');
  db.updateLeetCode(testStudent.id, 18, 22, 6, 1480);

  let p2 = db.getStudent360(testStudent.id);
  console.log('Retrieved 360 LeetCode Username after scalar stats update:', p2?.leetcode?.username);
  if (p2?.leetcode?.username !== 'OFQwEti18b') {
    console.error(`❌ FAILED: Handle was overwritten! Got: ${p2?.leetcode?.username}`);
    process.exit(1);
  } else {
    console.log('✅ PASS: Saved username preserved during scalar stats update.');
  }

  // 3. Verify statistics mapping
  console.log('\n--- Test 3: Verifying Statistics Mapping ---');
  const stats = {
    totalSolved: p2?.leetcode?.totalSolved,
    easySolved: p2?.leetcode?.easySolved,
    mediumSolved: p2?.leetcode?.mediumSolved,
    hardSolved: p2?.leetcode?.hardSolved,
    contestRating: p2?.leetcode?.contestRating
  };
  console.log('Mapped Stats:', stats);

  if (p2?.leetcode?.totalSolved !== 46 || p2?.leetcode?.easySolved !== 18 || p2?.leetcode?.mediumSolved !== 22 || p2?.leetcode?.hardSolved !== 6) {
    console.error('❌ FAILED: Statistics mapping mismatch!');
    process.exit(1);
  } else {
    console.log('✅ PASS: Statistics accurately mapped to saved username.');
  }

  // 4. Verify connected accounts table sync
  console.log('\n--- Test 4: Verifying connected accounts table sync ---');
  const conn = sqlite.prepare("SELECT provider_username FROM connected_accounts WHERE student_id = ? AND LOWER(provider) = 'leetcode'").get(testStudent.id) as any;
  console.log('Connected accounts provider_username:', conn?.provider_username);
  if (conn?.provider_username !== 'OFQwEti18b') {
    console.error('❌ FAILED: Connected accounts table not synchronized!');
    process.exit(1);
  } else {
    console.log('✅ PASS: Connected accounts table in sync with saved handle.');
  }

  // 5. Test profile link URL generation format
  console.log('\n--- Test 5: Profile Link URL Generation ---');
  const profileUrl = `https://leetcode.com/u/${encodeURIComponent(p2!.leetcode!.username)}/`;
  console.log('Generated Profile URL:', profileUrl);
  if (profileUrl !== 'https://leetcode.com/u/OFQwEti18b/') {
    console.error('❌ FAILED: Profile URL incorrect!');
    process.exit(1);
  } else {
    console.log('✅ PASS: Profile URL accurately formatted using saved username.');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL LEETCODE USERNAME & SYNC TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

testBackend().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
