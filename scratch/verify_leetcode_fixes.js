const http = require('http');

async function testBackend() {
  console.log('Testing LeetCode Username Storage & Sync Backend Logic...');
  
  // Test direct db import
  const { db } = require('./server/db');

  // Find a student
  const students = db.getStudents(2, 'A');
  if (students.length === 0) {
    console.error('No students found in Year 2 Section A!');
    process.exit(1);
  }

  const testStudent = students[0];
  console.log(`Test student: ${testStudent.name} (${testStudent.id})`);

  // 1. Set username via db.updateLeetCode with explicit handle
  db.updateLeetCode(testStudent.id, 'OFQwEti18b', 15, 20, 5, 1450);
  
  // 2. Fetch 360 profile
  let p1 = db.getStudent360(testStudent.id);
  console.log('360 LeetCode Username after updateLeetCode:', p1?.leetcode?.username);
  if (p1?.leetcode?.username !== 'OFQwEti18b') {
    console.error('FAILED: Username was not set to OFQwEti18b!');
    process.exit(1);
  }

  // 3. Call updateLeetCode with numerical scalar arguments (like PUT /360 does)
  db.updateLeetCode(testStudent.id, 18, 22, 6, 1480);

  // 4. Fetch 360 profile again to ensure username was PRESERVED!
  let p2 = db.getStudent360(testStudent.id);
  console.log('360 LeetCode Username after scalar updateLeetCode:', p2?.leetcode?.username);
  if (p2?.leetcode?.username !== 'OFQwEti18b') {
    console.error(`FAILED: Handle was overwritten! Got: ${p2?.leetcode?.username}`);
    process.exit(1);
  }

  // 5. Test stats mapping
  console.log('Stats:', {
    totalSolved: p2?.leetcode?.totalSolved,
    easySolved: p2?.leetcode?.easySolved,
    mediumSolved: p2?.leetcode?.mediumSolved,
    hardSolved: p2?.leetcode?.hardSolved,
    contestRating: p2?.leetcode?.contestRating
  });

  if (p2?.leetcode?.totalSolved !== 46 || p2?.leetcode?.easySolved !== 18) {
    console.error('FAILED: Stats mismatch!');
    process.exit(1);
  }

  console.log('\n✅ ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

testBackend().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
