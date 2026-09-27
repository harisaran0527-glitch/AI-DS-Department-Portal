async function testLeetCodeGQL(username) {
  console.log('\n--- 1. Official GraphQL query ---');
  const query = JSON.stringify({
    query: `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile { ranking reputation }
          submitStats: submitStatsGlobal {
            acSubmissionNum { difficulty count submissions }
            totalSubmissionNum { difficulty count submissions }
          }
        }
        userContestRanking(username: $username) { rating globalRanking }
      }
    `,
    variables: { username }
  });

  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: query
    });
    console.log(`GQL Status:`, res.status);
    const data = await res.json();
    const mu = data?.data?.matchedUser;
    if (mu) {
      const acList = mu.submitStats?.acSubmissionNum || [];
      const allAc = acList.find(x => x.difficulty === 'All');
      const easyAc = acList.find(x => x.difficulty === 'Easy');
      const medAc = acList.find(x => x.difficulty === 'Medium');
      const hardAc = acList.find(x => x.difficulty === 'Hard');
      console.log('GQL Solved:', {
        all: allAc,
        easy: easyAc,
        medium: medAc,
        hard: hardAc
      });
    } else {
      console.log('GQL matchedUser null:', data);
    }
  } catch (err) {
    console.error('GQL Error:', err);
  }
}

async function testVercelApi(username) {
  console.log('\n--- 2. Vercel API ---');
  try {
    const res = await fetch(`https://leetcode-api.vercel.app/api/profile/${encodeURIComponent(username)}`);
    console.log('Vercel API status:', res.status);
    const data = await res.json();
    console.log('Vercel API data:', data);
  } catch (err) {
    console.error('Vercel API error:', err);
  }
}

async function testAlfaApi(username) {
  console.log('\n--- 3. Alfa API ---');
  try {
    const res = await fetch(`https://alfa-leetcode-api.onrender.com/userProfile/${encodeURIComponent(username)}`);
    console.log('Alfa API status:', res.status);
    const data = await res.json();
    console.log('Alfa API data:', data);
  } catch (err) {
    console.error('Alfa API error:', err);
  }
}

async function run() {
  const username = 'OFQwEti18b';
  console.log(`Testing profile: ${username}`);
  await testLeetCodeGQL(username);
  await testVercelApi(username);
  await testAlfaApi(username);
}

run();
