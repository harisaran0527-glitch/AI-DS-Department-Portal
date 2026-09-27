import { testGeminiApiConnection, getTopRecognitionRankings } from '../server/services/geminiRankingService';
import dotenv from 'dotenv';
dotenv.config();

async function testGeminiProbe() {
  console.log('=== GEMINI 2.5 FLASH API CONNECTIVITY PROBE ===\n');

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  console.log(`1. GEMINI_API_KEY Configured in .env : ${apiKey.length > 0 ? 'YES (Length: ' + apiKey.length + ')' : 'NO (Empty/Unconfigured)'}`);

  if (apiKey.length > 0) {
    console.log('2. Sending probe request to Gemini 2.5 Flash API endpoint...');
    const result = await testGeminiApiConnection(apiKey);
    console.log(`   - Probe Result Success : ${result.success}`);
    if (result.success) {
      console.log(`   - Gemini Response     : "${result.text}"`);
    } else {
      console.log(`   - Probe Error         : ${result.error}`);
    }
  } else {
    console.log('2. Key is empty in .env. Probe skipped.');
  }

  console.log('\n3. Testing getTopRecognitionRankings() API Response Status Pill...');
  const rankings = await getTopRecognitionRankings(undefined, undefined, false);
  console.log(`   - isConfigured   : ${rankings.geminiApiStatus.isConfigured}`);
  console.log(`   - Model          : ${rankings.geminiApiStatus.model}`);
  console.log(`   - Status Message : "${rankings.geminiApiStatus.statusMessage}"`);

  console.log('\n==========================================================');
  console.log('🎉 PROBE TEST COMPLETED');
  console.log('==========================================================');
}

testGeminiProbe().catch(console.error);
