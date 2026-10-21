import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const PROD_URL = 'https://aidsportal.vercel.app';
const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

console.log('Testing live production at:', PROD_URL);
console.log('Using browser binary at:', CHROME_PATH);

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getWsUrl(port = 9222) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (res.ok) {
        const data = await res.json();
        const page = Array.isArray(data) && data.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await wait(300);
  }
  throw new Error('Could not connect to browser debugging port');
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const cb = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) cb.reject(new Error(msg.error.message));
        else cb.resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  }
}

async function waitForSelector(cdp, selector, maxWaitMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const found = await cdp.eval(`Boolean(document.querySelector('${selector}'))`);
    if (found) return true;
    await wait(250);
  }
  return false;
}

async function main() {
  const root = path.resolve(import.meta.dirname, '..');
  const tempProfileDir = path.join(root, '.chrome-prod-profile');
  if (fs.existsSync(tempProfileDir)) fs.rmSync(tempProfileDir, { recursive: true, force: true });
  fs.mkdirSync(tempProfileDir, { recursive: true });

  console.log('Launching headless Chrome against live production website...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${tempProfileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-default-apps',
    '--disable-features=Translate,OptimizationHints',
    `${PROD_URL}/student`
  ]);

  try {
    const wsUrl = await getWsUrl(9222);
    console.log('Connected to Chrome DevTools WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);
    await new Promise((res) => (ws.onopen = res));
    const cdp = new CDPClient(ws);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('\n--- LIVE TEST 1: All 4 Portal Login Pages Have Empty Default Credentials ---');
    const portals = [
      { name: 'Student Portal', path: '/student', idInput: 'input[name="student-identifier"]', passInput: 'input[name="student-password"]' },
      { name: 'Faculty Portal', path: '/faculty', idInput: 'input[name="faculty-identifier"]', passInput: 'input[name="faculty-password"]' },
      { name: 'HOD Portal', path: '/hod', idInput: 'input[name="hod-identifier"]', passInput: 'input[name="hod-password"]' },
      { name: 'Admin Portal', path: '/admin', idInput: 'input[name="admin-identifier"]', passInput: 'input[name="admin-password"]' }
    ];

    for (const portal of portals) {
      await cdp.send('Page.navigate', { url: `${PROD_URL}${portal.path}` });
      const found = await waitForSelector(cdp, portal.idInput);
      if (!found) throw new Error(`Timed out waiting for ${portal.name} login inputs at ${portal.path}`);
      await wait(400);

      const currentUrl = await cdp.eval('window.location.pathname');
      const idValue = await cdp.eval(`document.querySelector('${portal.idInput}')?.value`);
      const passValue = await cdp.eval(`document.querySelector('${portal.passInput}')?.value`);
      const passType = await cdp.eval(`document.querySelector('${portal.passInput}')?.type`);

      console.log(`[Live Production] ${portal.name} (${currentUrl}): identifier = "${idValue}", password = "${passValue}", type = "${passType}"`);

      if (idValue !== '') throw new Error(`${portal.name} identifier input is NOT empty: "${idValue}"`);
      if (passValue !== '') throw new Error(`${portal.name} password input is NOT empty: "${passValue}"`);
      if (passType !== 'password') throw new Error(`${portal.name} password input type is not "password": "${passType}"`);
      console.log(`✅ PASS: ${portal.name} credentials are 100% empty by default on production`);
    }

    console.log('\n--- LIVE TEST 2: Discipline Portal Login Page ---');
    await cdp.send('Page.navigate', { url: `${PROD_URL}/discipline/login` });
    await waitForSelector(cdp, 'form');
    await wait(400);
    const discUrl = await cdp.eval('window.location.pathname');
    const discInputs = await cdp.eval(`Array.from(document.querySelectorAll('input')).map(i => ({ name: i.name, value: i.value, type: i.type }))`);
    console.log(`[Live Production] Discipline Portal (${discUrl}) inputs:`, discInputs);
    for (const input of discInputs) {
      if (input.type === 'text' || input.type === 'password' || input.type === 'email') {
        if (input.value !== '') throw new Error(`Discipline input ${input.name} is not empty: "${input.value}"`);
      }
    }
    console.log('✅ PASS: Discipline Portal login fields are empty by default on production');

    console.log('\n--- LIVE TEST 3: Fresh Unauthenticated Visit Never Auto-Logs In ---');
    await cdp.send('Page.navigate', { url: `${PROD_URL}/student` });
    await waitForSelector(cdp, 'input[name="student-identifier"]');
    await wait(500);

    const studentUrl = await cdp.eval('window.location.pathname');
    const studentToken = await cdp.eval("localStorage.getItem('aids_token_student') || sessionStorage.getItem('aids_token_student')");
    console.log(`[Live Production] Visited /student: URL = ${studentUrl}, active storage token = ${studentToken}`);
    if (studentUrl !== '/student') {
      throw new Error(`Expected /student but browser navigated to ${studentUrl}`);
    }
    if (studentToken !== null) {
      throw new Error(`Expected null token on unauthenticated visit but found: ${studentToken}`);
    }
    console.log('✅ PASS: Fresh unauthenticated visit remains safely on /student login');

    console.log('\n--- LIVE TEST 4: Direct Protected Dashboard Access Redirects to Login ---');
    const dashboards = [
      { name: 'Student Dashboard', path: '/student/dashboard', expectedRedirect: '/student' },
      { name: 'Faculty Dashboard', path: '/faculty/dashboard', expectedRedirect: '/faculty' },
      { name: 'HOD Dashboard', path: '/hod/dashboard', expectedRedirect: '/hod' },
      { name: 'Admin Dashboard', path: '/admin/dashboard', expectedRedirect: '/admin' }
    ];

    for (const dash of dashboards) {
      await cdp.send('Page.navigate', { url: `${PROD_URL}${dash.path}` });
      await wait(1500);
      const redirectedUrl = await cdp.eval('window.location.pathname');
      console.log(`[Live Production] Direct visit ${dash.path} -> redirected to: ${redirectedUrl}`);
      if (redirectedUrl !== dash.expectedRedirect) {
        throw new Error(`Expected direct visit to ${dash.path} to redirect to ${dash.expectedRedirect}, but got: ${redirectedUrl}`);
      }
      console.log(`✅ PASS: ${dash.name} unauthenticated access redirected to ${dash.expectedRedirect}`);
    }

    console.log('\n--- LIVE TEST 5: Expired Token in Browser Storage Purged & Redirected ---');
    const expiredJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InN0dS0xIiwicm9sZSI6IlNUVURFTlQiLCJleHAiOjE2MDAwMDAwMDB9.invalid_signature_expired';
    await cdp.eval(`localStorage.setItem('aids_token_student', '${expiredJwt}')`);
    
    // Refresh page
    await cdp.send('Page.navigate', { url: `${PROD_URL}/student` });
    await waitForSelector(cdp, 'input[name="student-identifier"]');
    await wait(500);

    const postExpiredUrl = await cdp.eval('window.location.pathname');
    const postExpiredToken = await cdp.eval("localStorage.getItem('aids_token_student')");
    console.log(`[Live Production] After expired token injection: URL = ${postExpiredUrl}, localStorage token = ${postExpiredToken}`);
    if (postExpiredUrl !== '/student') {
      throw new Error(`Expected /student but redirected to ${postExpiredUrl}`);
    }
    if (postExpiredToken !== null) {
      throw new Error('Expired token was not purged from localStorage');
    }
    console.log('✅ PASS: Expired session detected, purged from storage, stays on login');

    console.log('\n--- LIVE TEST 6: Production Authentication Endpoint Verification ---');
    // Verify that login endpoint correctly returns 401 (not 500 or 503) for invalid credentials across all 4 roles
    const roles = ['STUDENT', 'FACULTY', 'HOD', 'ADMIN'];
    for (const role of roles) {
      const testRes = await cdp.eval(`
        fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: '${role}', identifier: 'probe_test_${role.toLowerCase()}@example.invalid', password: 'probe_invalid_password' })
        }).then(async r => ({ status: r.status, body: await r.json() }))
      `);
      console.log(`[Live Production] POST /api/auth/login for ${role}: HTTP ${testRes.status}`, testRes.body);
      if (testRes.status !== 401) {
        throw new Error(`Expected HTTP 401 for ${role} invalid login, but received ${testRes.status}`);
      }
      if (!testRes.body.error || !testRes.body.error.includes('Invalid credentials')) {
        throw new Error(`Unexpected error message for ${role}: ${JSON.stringify(testRes.body)}`);
      }
      console.log(`✅ PASS: ${role} authentication active and responding with secure HTTP 401`);
    }

    console.log('\n--- LIVE TEST 7: Zero Plaintext Passwords in Browser Storage ---');
    const storageKeys = await cdp.eval(`JSON.stringify({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })`);
    console.log('[Live Production] Current storage keys:', storageKeys);
    const storageDump = await cdp.eval(`JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })`);
    if (/password|secret|student123|admin123|faculty123/i.test(storageDump)) {
      throw new Error('Plaintext password found in browser storage!');
    }
    console.log('✅ PASS: Zero plaintext credentials in browser storage on production');

    ws.close();
    console.log('\n============================================================');
    console.log('🎉 ALL LIVE PRODUCTION VERIFICATIONS PASSED 100%! 🎉');
    console.log('============================================================\n');
  } finally {
    chromeProc.kill();
    try { fs.rmSync(tempProfileDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((err) => {
  console.error('❌ Live Production Verification Failed:', err);
  process.exit(1);
});
