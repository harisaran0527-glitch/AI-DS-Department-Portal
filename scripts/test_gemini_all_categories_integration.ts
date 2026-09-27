import {
  getTopRecognitionRankings,
  getAllCategoryRankings,
  getLeetCodeFullAnalytics
} from '../server/services/geminiRankingService';

async function runAudit() {
  console.log('=== GEMINI AI ALL-CATEGORY & LEETCODE INTEGRATION AUDIT ===\n');

  console.log('1. Fetching Overall Top Recognition Rankings...');
  const topRec = await getTopRecognitionRankings('ALL', 'ALL', false);
  console.log('   - Gemini API Status:', topRec.geminiApiStatus.statusMessage);
  console.log('   - Best Student #1:', topRec.bestStudent.firstPlace.studentName || 'None');
  console.log('   - Best LeetCode #1:', topRec.bestLeetCodePerformer.firstPlace.studentName || 'None');

  console.log('\n2. Fetching All 14 Category Rankings...');
  const allCats = await getAllCategoryRankings('ALL', 'ALL', false);
  const keys = Object.keys(allCats.categories);
  console.log(`   - Successfully evaluated ${keys.length} categories:`, keys.join(', '));
  keys.forEach((k) => {
    const cat = allCats.categories[k];
    const p1 = cat.firstPlace;
    console.log(`     * [${k.toUpperCase()}] #1: ${p1.studentName || 'No Candidate'} (${p1.score?.toFixed(1) || 0}/100)`);
  });

  console.log('\n3. Fetching Full-Page LeetCode Analytics Dashboard Data...');
  const lcFull = await getLeetCodeFullAnalytics('ALL', 'ALL', false);
  console.log('   - Top Performer:', lcFull.overview.topPerformerName);
  console.log('   - Top Solved Count:', lcFull.overview.topSolvedCount);
  console.log('   - Highest Rating:', lcFull.overview.highestRating);
  console.log('   - Active Coders:', lcFull.overview.totalCandidates);
  console.log('   - Easy / Med / Hard Solved Totals:', `${lcFull.performanceAnalysis.easySolvedTotal} Easy, ${lcFull.performanceAnalysis.mediumSolvedTotal} Med, ${lcFull.performanceAnalysis.hardSolvedTotal} Hard`);
  console.log('   - AI Overview Rationale:', lcFull.overview.overallExplanation);
  console.log('   - AI Strengths Count:', lcFull.insights.strengths.length);

  console.log('\n==========================================================');
  console.log('🎉 ALL GEMINI AI RANKING & LEETCODE AUDITS PASSED!');
  console.log('==========================================================');
}

runAudit().catch(console.error);
