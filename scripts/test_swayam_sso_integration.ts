import { getSwayamSsoUrl, generateSwayamState, getNptelUrlForStudent } from '../src/services/nptelUrlHelper';

async function testSwayamSsoIntegration() {
  console.log('=== TESTING SWAYAM SSO LOGIN URL & INTEGRATION ===\n');

  // Test 1: Generate 3 consecutive SWAYAM SSO URLs to verify dynamic state parameter
  console.log('1. Generating SWAYAM SSO URLs...');
  const url1 = getSwayamSsoUrl();
  const url2 = getSwayamSsoUrl();
  const url3 = getSwayamSsoUrl();

  console.log(`   URL 1: ${url1}`);
  console.log(`   URL 2: ${url2}`);
  console.log(`   URL 3: ${url3}`);

  // Test 2: Verify URL structure
  console.log('\n2. Verifying URL Parameters & Format...');
  const parsed1 = new URL(url1);
  console.log(`   - Hostname     : ${parsed1.hostname} (Expected: swayam-sso.swayam2.ac.in)`);
  console.log(`   - Pathname     : ${parsed1.pathname} (Expected: /signin)`);
  console.log(`   - client_id    : ${parsed1.searchParams.get('client_id')} (Expected: swayam-central-production)`);
  console.log(`   - redirect_uri : ${parsed1.searchParams.get('redirect_uri')} (Expected: https://swayam.gov.in/mycourses)`);
  console.log(`   - state        : ${parsed1.searchParams.get('state')}`);

  if (
    parsed1.hostname === 'swayam-sso.swayam2.ac.in' &&
    parsed1.searchParams.get('client_id') === 'swayam-central-production' &&
    parsed1.searchParams.get('redirect_uri') === 'https://swayam.gov.in/mycourses'
  ) {
    console.log('   ✅ SWAYAM SSO URL structure matches 100% of requirements!');
  } else {
    console.error('   ❌ SWAYAM SSO URL structure mismatch!');
    process.exit(1);
  }

  // Test 3: Verify State Parameter Uniqueness (Non-hardcoded dynamic parameter)
  console.log('\n3. Verifying Dynamic State Uniqueness...');
  const state1 = parsed1.searchParams.get('state');
  const state2 = new URL(url2).searchParams.get('state');
  if (state1 && state2 && state1 !== state2) {
    console.log('   ✅ State parameters are generated dynamically and uniquely for each OAuth request!');
  } else {
    console.error('   ❌ State parameter appears hardcoded or duplicate!');
    process.exit(1);
  }

  // Test 4: Verify getNptelUrlForStudent Helper
  console.log('\n4. Verifying getNptelUrlForStudent Helper...');
  const res = getNptelUrlForStudent({ year: '2nd Year', email: 'student@aids.edu' });
  console.log(`   - Returned URL : ${res.url}`);
  if (res.url.startsWith('https://swayam-sso.swayam2.ac.in/signin')) {
    console.log('   ✅ getNptelUrlForStudent successfully maps to official SWAYAM SSO endpoint!');
  } else {
    console.error('   ❌ getNptelUrlForStudent failed to return SWAYAM SSO endpoint!');
    process.exit(1);
  }

  console.log('\n==========================================================');
  console.log('🎉 SWAYAM SSO INTEGRATION VERIFICATIONS PASSED!');
  console.log('==========================================================');
}

testSwayamSsoIntegration().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
