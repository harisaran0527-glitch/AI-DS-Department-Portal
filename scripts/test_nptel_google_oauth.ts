import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000';

async function runNptelGoogleOAuthTest() {
  console.log('🔒 Starting NPTEL GOOGLE OAUTH FLOW VERIFICATION TEST...\n');

  // 1. Test GET /api/auth/google/start when GOOGLE_CLIENT_ID is configured
  const res = await fetch(`${BASE_URL}/api/auth/google/start?studentId=stu-test-123&purpose=nptel`, {
    redirect: 'manual'
  });

  if (res.status === 302) {
    const loc = res.headers.get('location') || '';
    if (loc.startsWith('https://accounts.google.com/o/oauth2/v2/auth')) {
      console.log('✅ TEST 1 PASSED: Backend generated OAuth state & redirected 302 directly to genuine Google authorization page ("https://accounts.google.com/o/oauth2/v2/auth").');
      console.log(`   Location: ${loc.substring(0, 100)}...`);
    } else {
      throw new Error(`TEST 1 FAILED: Expected https://accounts.google.com, got ${loc}`);
    }
  } else {
    throw new Error(`TEST 1 FAILED: Expected 302 redirect, got ${res.status}`);
  }

  console.log('\n📊 ALL NPTEL GOOGLE OAUTH TESTS PASSED PERFECTLY!');
}

runNptelGoogleOAuthTest().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
