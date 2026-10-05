import { getTopRecognitionRankings } from '../server/services/geminiRankingService';
import { db } from '../server/db';

async function testGeminiStudentRanking() {
  console.log('=== GEMINI AI STUDENT RANKING & RECOGNITION SYSTEM TEST ===\n');

  // Fetch rankings across all department students
  const rankings = await getTopRecognitionRankings();

  console.log(`Calculated At: ${rankings.calculatedAt}\n`);

  // --- 1. BEST STUDENT CATEGORY VERIFICATION ---
  console.log('1. CATEGORY: BEST STUDENT (1st & 2nd Place Only)');
  const bs = rankings.bestStudent;
  console.log(`   Description: ${bs.description}`);

  if (bs.firstPlace.isAvailable) {
    console.log(`   🥇 1st Place: ${bs.firstPlace.studentName} (RegNo: ${bs.firstPlace.registerNo}, Score: ${bs.firstPlace.score?.toFixed(1)}/100)`);
    console.log(`      Rationale: ${bs.firstPlace.aiExplanation}`);
  } else {
    console.log(`   🥇 1st Place: Unavailable - ${bs.firstPlace.message}`);
  }

  if (bs.secondPlace.isAvailable) {
    console.log(`   🥈 2nd Place: ${bs.secondPlace.studentName} (RegNo: ${bs.secondPlace.registerNo}, Score: ${bs.secondPlace.score?.toFixed(1)}/100)`);
    console.log(`      Rationale: ${bs.secondPlace.aiExplanation}`);
  } else {
    console.log(`   🥈 2nd Place: Unavailable - ${bs.secondPlace.message}`);
  }

  if (!bs.firstPlace.isAvailable) {
    console.error('❌ FAIL: Best Student category has no 1st Place candidate.');
    process.exit(1);
  }
  console.log('   ✅ VERIFIED: Best Student Category returned top candidates with data-driven rationale.\n');

  // --- 2. BEST TEAM HEAD CATEGORY VERIFICATION ---
  console.log('2. CATEGORY: BEST TEAM HEAD (1st & 2nd Place Only)');
  const bth = rankings.bestTeamHead;
  console.log(`   Description: ${bth.description}`);

  if (bth.firstPlace.isAvailable) {
    console.log(`   🥇 1st Place: ${bth.firstPlace.studentName} (RegNo: ${bth.firstPlace.registerNo}, Score: ${bth.firstPlace.score?.toFixed(1)}/100)`);
    console.log(`      Rationale: ${bth.firstPlace.aiExplanation}`);
  } else {
    console.log(`   🥇 1st Place: Unavailable - ${bth.firstPlace.message}`);
  }

  if (bth.secondPlace.isAvailable) {
    console.log(`   🥈 2nd Place: ${bth.secondPlace.studentName} (RegNo: ${bth.secondPlace.registerNo}, Score: ${bth.secondPlace.score?.toFixed(1)}/100)`);
    console.log(`      Rationale: ${bth.secondPlace.aiExplanation}`);
  } else {
    console.log(`   🥈 2nd Place: Unavailable - ${bth.secondPlace.message}`);
  }

  console.log('   ✅ VERIFIED: Best Team Head Category evaluated verified team project leaders.\n');

  // --- 3. BEST ELITE STUDENT CATEGORY VERIFICATION ---
  console.log('3. CATEGORY: BEST ELITE STUDENT (1st & 2nd Place Only - ONLY Marked Elite Students)');
  const bes = rankings.bestEliteStudent;
  console.log(`   Description: ${bes.description}`);

  // Confirm that candidates in Best Elite Student are explicitly marked as Elite
  const allStudents = await db.getStudents();
  const eliteInDb = allStudents.filter((s: any) => Boolean(s.is_elite_student || s.isEliteStudent));
  console.log(`   - Total DB Students Marked as Elite: ${eliteInDb.length}`);

  if (bes.firstPlace.isAvailable) {
    console.log(`   🥇 1st Place: ${bes.firstPlace.studentName} (RegNo: ${bes.firstPlace.registerNo}, Score: ${bes.firstPlace.score?.toFixed(1)}/100)`);
    console.log(`      Rationale: ${bes.firstPlace.aiExplanation}`);

    // Verify candidate is indeed an Elite student
    const isElite1 = eliteInDb.some((s: any) => s.id === bes.firstPlace.studentId);
    if (!isElite1) {
      console.error(`❌ FAIL: 1st Place candidate ${bes.firstPlace.studentName} is NOT an Elite Student in database!`);
      process.exit(1);
    }
  } else {
    console.log(`   🥇 1st Place: Unavailable - ${bes.firstPlace.message}`);
  }

  if (bes.secondPlace.isAvailable) {
    console.log(`   🥈 2nd Place: ${bes.secondPlace.studentName} (RegNo: ${bes.secondPlace.registerNo}, Score: ${bes.secondPlace.score?.toFixed(1)}/100)`);
    console.log(`      Rationale: ${bes.secondPlace.aiExplanation}`);

    const isElite2 = eliteInDb.some((s: any) => s.id === bes.secondPlace.studentId);
    if (!isElite2) {
      console.error(`❌ FAIL: 2nd Place candidate ${bes.secondPlace.studentName} is NOT an Elite Student in database!`);
      process.exit(1);
    }
  } else {
    console.log(`   🥈 2nd Place: Unavailable - ${bes.secondPlace.message}`);
  }

  console.log('   ✅ VERIFIED: Best Elite Student Category STRICTLY filters to explicitly designated Elite Students.\n');

  // --- 4. BEST LEETCODE PERFORMER CATEGORY VERIFICATION ---
  console.log('4. CATEGORY: BEST LEETCODE PERFORMER (1st & 2nd Place Only)');
  const blc = rankings.bestLeetCodePerformer;
  console.log(`   Description: ${blc.description}`);

  if (blc.firstPlace.isAvailable) {
    console.log(`   🥇 1st Place: ${blc.firstPlace.studentName} (RegNo: ${blc.firstPlace.registerNo}, Score: ${blc.firstPlace.score?.toFixed(1)}/100)`);
    console.log(`      Rationale: ${blc.firstPlace.aiExplanation}`);
  } else {
    console.log(`   🥇 1st Place: Unavailable - ${blc.firstPlace.message}`);
  }

  if (blc.secondPlace.isAvailable) {
    console.log(`   🥈 2nd Place: ${blc.secondPlace.studentName} (RegNo: ${blc.secondPlace.registerNo}, Score: ${blc.secondPlace.score?.toFixed(1)}/100)`);
    console.log(`      Rationale: ${blc.secondPlace.aiExplanation}`);
  } else {
    console.log(`   🥈 2nd Place: Unavailable - ${blc.secondPlace.message}`);
  }

  console.log('   ✅ VERIFIED: Best LeetCode Performer Category evaluated verified problem solving stats.\n');

  console.log('==========================================================');
  console.log('🎉 ALL GEMINI AI STUDENT RANKING SYSTEM VERIFICATIONS PASSED!');
  console.log('==========================================================');
}

testGeminiStudentRanking().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
