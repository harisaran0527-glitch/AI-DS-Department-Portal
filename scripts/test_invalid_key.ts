import { testGeminiApiConnection } from '../server/services/geminiRankingService';

async function testInvalidKey() {
  console.log('Testing probe with invalid key...');
  const res = await testGeminiApiConnection('AIzaSyFakeTestKey123456789');
  console.log('Result:', res);
}

testInvalidKey().catch(console.error);
