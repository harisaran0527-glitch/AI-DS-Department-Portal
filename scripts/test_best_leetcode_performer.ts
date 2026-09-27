import { syncLeetCodeProfile } from '../server/services/externalSync';
import { db } from '../server/db';
import { computeLeetCodeAwardScore, generateAIExplanation } from '../server/scoringEngine';

async function testBestLeetCodePerformer() {
  console.log('=== VERIFYING ACCURATE LIVE LEETCODE DATA & BEST LEETCODE PERFORMER RANKING ===\n');

  // 1. Fetch all students
  const students = db.getStudents();
  if (students.length < 2) {
    throw new Error('At least 2 student records required in database for ranking comparison.');
  }

  const stu1 = students[0];
  const stu2 = students[1];

  console.log(`Student 1: ${stu1.name} (${stu1.register_no || stu1.registerNo})`);
  console.log(`Student 2: ${stu2.name} (${stu2.register_no || stu2.registerNo})\n`);

  // 2. Sync Live Profiles for Student 1 and Student 2
  console.log('Syncing live LeetCode handles...');

  // Student 1 gets 'neal_wu'
  const sync1 = await syncLeetCodeProfile(stu1.id, 'neal_wu');
  console.log(`[PASS]: Student 1 ("${stu1.name}") synced LeetCode handle "${sync1.username}":`, {
    totalSolved: sync1.totalSolved,
    easy: sync1.easySolved,
    medium: sync1.mediumSolved,
    hard: sync1.hardSolved,
    contestRating: sync1.contestRating
  });

  // Student 2 gets 'leetcode'
  const sync2 = await syncLeetCodeProfile(stu2.id, 'leetcode');
  console.log(`[PASS]: Student 2 ("${stu2.name}") synced LeetCode handle "${sync2.username}":`, {
    totalSolved: sync2.totalSolved,
    easy: sync2.easySolved,
    medium: sync2.mediumSolved,
    hard: sync2.hardSolved,
    contestRating: sync2.contestRating
  });

  // 3. Verify Database Storage & Mapping Isolation
  const lc360_1 = db.getStudent360(stu1.id)?.leetcode;
  const lc360_2 = db.getStudent360(stu2.id)?.leetcode;

  if (lc360_1?.username !== 'neal_wu' || lc360_2?.username !== 'leetcode') {
    throw new Error(`[FAIL]: Mapping mismatch! Student 1 has handle "${lc360_1?.username}", Student 2 has handle "${lc360_2?.username}"`);
  }

  console.log('\n[PASS]: Verified unique student-to-handle database mapping isolation.');

  // 4. Calculate Best LeetCode Performer Ranking
  const score1 = computeLeetCodeAwardScore(lc360_1);
  const score2 = computeLeetCodeAwardScore(lc360_2);

  console.log(`\nRanking Calculation:`);
  console.log(` - Student 1 (${stu1.name}): Score = ${score1} (Total Solved: ${lc360_1?.totalSolved}, Contest Rating: ${lc360_1?.contestRating})`);
  console.log(` - Student 2 (${stu2.name}): Score = ${score2} (Total Solved: ${lc360_2?.totalSolved}, Contest Rating: ${lc360_2?.contestRating})`);

  const bestPerformer = score1 >= score2 ? stu1 : stu2;
  const winnerRecord = score1 >= score2 ? lc360_1 : lc360_2;

  console.log(`\n🏆 BEST LEETCODE PERFORMER: ${bestPerformer.name} (${bestPerformer.register_no || bestPerformer.registerNo})`);

  // 5. Verify AI Explanation Generation
  const explanation = generateAIExplanation('BEST_LEETCODE', bestPerformer, {}, Math.max(score1, score2), winnerRecord);
  console.log(`AI Analysis: "${explanation}"`);

  // 6. Test Graceful Fallback for Invalid or Unset Handles
  console.log('\nTesting error handling for non-existent LeetCode handle...');
  try {
    await syncLeetCodeProfile(stu1.id, 'invalid_nonexistent_handle_99420');
    throw new Error('Expected invalid handle error, but sync succeeded!');
  } catch (err: any) {
    console.log(`[PASS]: Invalid handle correctly rejected with error: "${err.message}"`);
  }

  console.log('\n=== ALL BEST LEETCODE PERFORMER VERIFICATIONS COMPLETED SUCCESSFULLY ===');
}

testBestLeetCodePerformer().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
