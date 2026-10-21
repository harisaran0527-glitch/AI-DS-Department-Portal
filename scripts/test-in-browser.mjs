
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

console.log('Using browser binary at:', CHROME_PATH);

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getWsUrl(port = 9222) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        const data = await res.json();
        return data.webSocketDebuggerUrl;
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

async function main() {
  const root = path.resolve(import.meta.dirname, '..');
  
  // 1. Start the server on port 5174 in test mode
  console.log('Starting local application server on port 5174...');
  const serverProc = spawn('node', ['--import', 'tsx/esm', 'server/index.ts'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: '5174',
      USE_SQLITE: 'true',
      NODE_ENV: 'test',
      JWT_SECRET: 'browser-verification-secret-32-bytes-minimum-length-2026'
    },
    stdio: 'pipe'
  });

  serverProc.stdout.on('data', (d) => process.stdout.write(`[Server] ${d}`));
  serverProc.stderr.on('data', (d) => process.stderr.write(`[Server ERR] ${d}`));

  // Wait for server to listen
  let serverReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch('http://127.0.0.1:5174/api/health');
      if (res.ok) {
        serverReady = true;
        console.log('Server is healthy and ready!');
        break;
      }
    } catch {}
    await wait(400);
  }

  if (!serverReady) {
    serverProc.kill();
    throw new Error('Server failed to start on port 5174');
  }

  // 2. Launch headless Chrome with clean user profile
  const tempProfileDir = path.join(root, '.chrome-temp-profile');
  if (fs.existsSync(tempProfileDir)) fs.rmSync(tempProfileDir, { recursive: true, force: true });
  fs.mkdirSync(tempProfileDir, { recursive: true });

  console.log('Launching headless Chrome...');
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
    'http://127.0.0.1:5174/student'
  ]);

  try {
    const wsUrl = await getWsUrl(9222);
    console.log('Connected to Chrome DevTools WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);
    await new Promise((res) => (ws.onopen = res));
    const cdp = new CDPClient(ws);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('\n--- VERIFICATION 1: All 4 Portal Login Pages Render Empty Credentials ---');
    const portals = [
      { name: 'Student Portal', path: '/student', idInput: 'input[name="student-identifier"]', passInput: 'input[name="student-password"]' },
      { name: 'Faculty Portal', path: '/faculty', idInput: 'input[name="faculty-identifier"]', passInput: 'input[name="faculty-password"]' },
      { name: 'HOD Portal', path: '/hod', idInput: 'input[name="hod-identifier"]', passInput: 'input[name="hod-password"]' },
      { name: 'Admin Portal', path: '/admin', idInput: 'input[name="admin-identifier"]', passInput: 'input[name="admin-password"]' }
    ];

    for (const portal of portals) {
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:5174${portal.path}` });
      await wait(1500);

      const currentUrl = await cdp.eval('window.location.pathname');
      console.log(`[Browser] Navigated to ${portal.path} -> Current URL: ${currentUrl}`);

      const idValue = await cdp.eval(`document.querySelector('${portal.idInput}')?.value`);
      const passValue = await cdp.eval(`document.querySelector('${portal.passInput}')?.value`);
      const passType = await cdp.eval(`document.querySelector('${portal.passInput}')?.type`);

      console.log(`[Browser] ${portal.name}: identifier = "${idValue}", password = "${passValue}", password type = "${passType}"`);

      if (idValue !== '') throw new Error(`${portal.name} identifier input is NOT empty: "${idValue}"`);
      if (passValue !== '') throw new Error(`${portal.name} password input is NOT empty: "${passValue}"`);
      if (passType !== 'password') throw new Error(`${portal.name} password input type is not "password": "${passType}"`);
      console.log(`✅ PASS: ${portal.name} login fields are 100% empty by default`);
    }

    console.log('\n--- VERIFICATION 2: Fresh Unauthenticated Visit Never Auto-Logs In ---');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5174/student' });
    await wait(1500);

    const studentUrl = await cdp.eval('window.location.pathname');
    const studentToken = await cdp.eval("localStorage.getItem('aids_token_student')");
    console.log(`[Browser] Visited /student: URL = ${studentUrl}, localStorage token = ${studentToken}`);
    if (studentUrl !== '/student') {
      throw new Error(`Expected /student but browser navigated to ${studentUrl}`);
    }
    console.log('✅ PASS: Fresh visit stays cleanly on /student without auto-login');

    console.log('\n--- VERIFICATION 3: Expired Token in Browser Storage Purged & Redirected ---');
    // Inject an expired JWT into browser localStorage
    const expiredJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InN0dS0xIiwicm9sZSI6IlNUVURFTlQiLCJleHAiOjE2MDAwMDAwMDB9.invalid_signature_expired';
    await cdp.eval(`localStorage.setItem('aids_token_student', '${expiredJwt}')`);
    
    // Refresh page
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5174/student' });
    await wait(1500);

    const postExpiredUrl = await cdp.eval('window.location.pathname');
    const postExpiredToken = await cdp.eval("localStorage.getItem('aids_token_student')");
    console.log(`[Browser] After expired token injection: URL = ${postExpiredUrl}, token = ${postExpiredToken}`);
    if (postExpiredUrl !== '/student') {
      throw new Error(`Expected /student but redirected to ${postExpiredUrl}`);
    }
    if (postExpiredToken !== null) {
      throw new Error('Expired token was not purged from localStorage');
    }
    console.log('✅ PASS: Expired session detected, purged from storage, stays on login');

    console.log('\n--- VERIFICATION 4: No Plaintext Passwords in Browser Storage ---');
    const storageKeys = await cdp.eval(`JSON.stringify({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })`);
    console.log('[Browser] Current storage keys:', storageKeys);
    const storageDump = await cdp.eval(`JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })`);
    if (/password123|admin123|student123|faculty123/i.test(storageDump)) {
      throw new Error('Plaintext password found in browser storage!');
    }
    console.log('✅ PASS: Zero plaintext passwords in browser storage');

    ws.close();
    console.log('\n========================================');
    console.log('ALL BROWSER VERIFICATIONS PASSED 100%!');
    console.log('========================================');
  } finally {
    chromeProc.kill();
    serverProc.kill();
    try { fs.rmSync(tempProfileDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((err) => {
  console.error('❌ Browser Verification Failed:', err);
  process.exit(1);
});

