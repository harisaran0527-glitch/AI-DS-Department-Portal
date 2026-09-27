import { getTopRecognitionRankings } from '../server/services/geminiRankingService';

async function debugRankings() {
  console.log('=== DEBUG TOP RECOGNITION RANKINGS FOR ALL CATEGORIES ===\n');

  // Test 1: Department-Wide (All)
  const allRankings = await getTopRecognitionRankings(undefined, undefined, false);
  console.log('--- ALL SECTIONS (Department Wide) ---');
  printCategory('Best Student', allRankings.bestStudent);
  printCategory('Best Team Head', allRankings.bestTeamHead);
  printCategory('Best Elite Student', allRankings.bestEliteStudent);
  printCategory('Best LeetCode Performer', allRankings.bestLeetCodePerformer);

  // Test 2: 2nd Year Sec A Workspace
  const secARankings = await getTopRecognitionRankings('2nd Year', 'A', false);
  console.log('\n--- 2nd Year Section A Workspace ---');
  printCategory('Best Student', secARankings.bestStudent);
  printCategory('Best Team Head', secARankings.bestTeamHead);
  printCategory('Best Elite Student', secARankings.bestEliteStudent);
  printCategory('Best LeetCode Performer', secARankings.bestLeetCodePerformer);
}

function printCategory(name: string, cat: any) {
  console.log(`\n[${name}]`);
  console.log(`  1st Place: ${cat.firstPlace?.studentName || 'N/A'} (ID: ${cat.firstPlace?.studentId}, Reg: ${cat.firstPlace?.registerNo}, Score: ${cat.firstPlace?.score})`);
  console.log(`  2nd Place: ${cat.secondPlace?.isAvailable ? cat.secondPlace?.studentName : 'UNAVAILABLE (' + cat.secondPlace?.message + ')'} (ID: ${cat.secondPlace?.studentId || 'N/A'}, Reg: ${cat.secondPlace?.registerNo || 'N/A'}, Score: ${cat.secondPlace?.score || 'N/A'})`);
}

debugRankings().catch(console.error);
