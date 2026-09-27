import { syncLeetCodeProfile } from '../server/services/externalSync';
import { db } from '../server/db';

async function runFullVerification() {
  console.log('================================================================');
  console.log('🚀 LEETCODE INTEGRATION & PROBLEM COUNT FULL VERIFICATION TEST');
  console.log('================================================================\n');

  const studentId = 'stu-1788857771540-uvs7';
  const realHandle = 'OFQwEti18b';

  // 1. Sync real student account (OFQwEti18b)
  console.log(`[TEST 1] Syncing real profile handle "${realHandle}" for student ${studentId}...`);
  const res1 = await syncLeetCodeProfile(studentId, realHandle);

  console.log('Sync Result 1:', res1);

  if (res1.totalSolved !== 62) {
    console.error(`❌ FAILED: Total solved expected 62, got ${res1.totalSolved}`);
    process.exit(1);
  }
  if (res1.easySolved !== 45 || res1.mediumSolved !== 14 || res1.hardSolved !== 3) {
    console.error(`❌ FAILED: Difficulty breakdown mismatch! Easy: ${res1.easySolved}, Med: ${res1.mediumSolved}, Hard: ${res1.hardSolved}`);
    process.exit(1);
  }
  if (res1.easySolved + res1.mediumSolved + res1.hardSolved !== res1.totalSolved) {
    console.error('❌ FAILED: Easy + Medium + Hard breakdown does not sum up to Total Solved!');
    process.exit(1);
  }
  console.log('✅ TEST 1 PASSED: Mismatch fixed! User profile accurately shows 62 total solved (45 Easy, 14 Med, 3 Hard).\n');

  // 2. Database Persistence Verification
  console.log('[TEST 2] Verifying SQLite database persistence...');
  const stu360 = db.getStudent360(studentId);
  const lcRecord = stu360?.leetcode;
  console.log('Stored DB LeetCode Record:', lcRecord);

  if (!lcRecord || lcRecord.totalSolved !== 62 || lcRecord.easySolved !== 45 || lcRecord.mediumSolved !== 14 || lcRecord.hardSolved !== 3) {
    console.error('❌ FAILED: DB persistence verification failed!');
    process.exit(1);
  }
  if (!lcRecord.lastUpdated) {
    console.error('❌ FAILED: Synchronization timestamp missing in DB!');
    process.exit(1);
  }
  console.log('✅ TEST 2 PASSED: Database correctly stores 62 total solved with timestamp.\n');

  // 3. Email-based Account Linking Verification
  console.log('[TEST 3] Testing email-based profile sync for student email "harisaran@gmail.com"...');
  const res3 = await syncLeetCodeProfile(studentId, 'harisaran@gmail.com');
  console.log('Email sync result:', res3);
  if (res3.username !== realHandle || res3.totalSolved !== 62) {
    console.error('❌ FAILED: Email-based account linking failed to resolve to correct handle!');
    process.exit(1);
  }
  console.log('✅ TEST 3 PASSED: Email-based linking correctly resolved to student handle OFQwEti18b.\n');

  // 4. Invalid handle / Error Handling & Data Preservation Verification
  console.log('[TEST 4] Testing invalid handle error handling & previous data preservation...');
  try {
    await syncLeetCodeProfile(studentId, 'invalid_nonexistent_handle_xyz_999999');
    console.error('❌ FAILED: Expected error for invalid handle but none was thrown!');
    process.exit(1);
  } catch (err: any) {
    console.log('Caught expected error:', err.message);
    const dbCheckAfterFail = db.getStudent360(studentId)?.leetcode;
    if (dbCheckAfterFail?.totalSolved !== 62) {
      console.error('❌ FAILED: Previously verified DB stats were corrupted on sync failure!');
      process.exit(1);
    }
    console.log('✅ TEST 4 PASSED: Invalid handle rejected cleanly and previously verified DB stats preserved.\n');
  }

  // 5. Test another real LeetCode profile (e.g. "leetcode")
  console.log('[TEST 5] Testing sync for official "leetcode" handle...');
  const student2Id = 'stu-1787911528640-3s12';
  const res5 = await syncLeetCodeProfile(student2Id, 'leetcode');
  console.log('Official leetcode profile stats:', res5);
  if (res5.totalSolved <= 0 || res5.easySolved <= 0) {
    console.error('❌ FAILED: Failed to fetch valid stats for "leetcode" handle!');
    process.exit(1);
  }
  console.log('✅ TEST 5 PASSED: Successfully fetched and verified stats for second real LeetCode profile.\n');

  console.log('================================================================');
  console.log('🎉 ALL LEETCODE TESTS & VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runFullVerification().catch((err) => {
  console.error('Verification script crash:', err);
  process.exit(1);
});
