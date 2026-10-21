// Public read-only health probe and credential-free validation probe. Never submits account passwords.
const root = 'https://aidsportal.vercel.app';
let failures = 0;
for (const [route, method, expected] of [['/api/health', 'GET', 200], ['/api/auth/login', 'POST', 400]]) {
  try {
    const response = await fetch(root + route, { method,
      ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
      signal: AbortSignal.timeout(20000) });
    const body = await response.text();
    const invocationFailed = body.includes('FUNCTION_INVOCATION_FAILED');
    console.log(JSON.stringify({ route, status: response.status, expected, invocationFailed,
      requestId: response.headers.get('x-vercel-id'), contentType: response.headers.get('content-type') }));
    if (response.status !== expected) failures++;
  } catch (error) {
    console.log(JSON.stringify({ route, failure: error.cause?.code || error.name }));
    failures++;
  }
}
if (failures) process.exitCode = 1;
