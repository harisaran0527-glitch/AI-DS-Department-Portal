import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { isolateServer } from './helpers/isolated-server.mjs';

const originalFetch = globalThis.fetch;
const requestedUrls = [];
globalThis.fetch = async url => {
  requestedUrls.push(String(url));
  return new Response(JSON.stringify({ reward: { totalPoints: 0 } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

isolateServer();
const { API } = await import('../src/services/api.ts');
after(() => { globalThis.fetch = originalFetch; });

test('student AI reward uses the authenticated self endpoint', async () => {
  await API.getStudentAiReward();
  assert.equal(requestedUrls[0], '/api/student/ai-reward');
});
