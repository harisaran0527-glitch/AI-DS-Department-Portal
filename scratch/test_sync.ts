import { syncLeetCodeProfile } from '../server/services/externalSync';
import { db } from '../server/db';

async function testSync() {
  console.log('Testing syncLeetCodeProfile for student stu-1788857771540-uvs7 (Hari)...');
  try {
    const res = await syncLeetCodeProfile('stu-1788857771540-uvs7', 'OFQwEti18b');
    console.log('Sync SUCCESS! Result:', res);

    const full360 = db.getStudent360('stu-1788857771540-uvs7');
    console.log('\nRetrieved 360 LeetCode record after sync:', full360?.leetcode);
  } catch (err) {
    console.error('Sync FAILED:', err);
  }
}

testSync();
