import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

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

async function main() {
  const root = path.resolve(import.meta.dirname, '..');
  const tempProfileDir = path.join(root, '.chrome-temp-profile');
  if (fs.existsSync(tempProfileDir)) fs.rmSync(tempProfileDir, { recursive: true, force: true });
  fs.mkdirSync(tempProfileDir, { recursive: true });

  const testDbPath = path.join(tempProfileDir, 'browser-test.db');
  
  // 1. Start the server on port 5174 in test mode
  console.log('Starting local application server on port 5174 with isolated test database...');
  const serverProc = spawn('node', ['--import', 'tsx/esm', 'server/index.ts'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: '5174',
      USE_SQLITE: 'true',
      DATABASE_PATH: testDbPath,
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

  // Seed test student in SQLite
  console.log('Seeding test student user into isolated SQLite database...');
  const db = new Database(testDbPath);
  const testPassword = 'StudentSecret2026!';
  const passwordHash = bcrypt.hashSync(testPassword, 4);

  db.prepare(`
    INSERT INTO users (id, email, identifier, name, role, password_hash, year, section, is_active, created_at)
    VALUES ('user-stu-test-1', 'student6201@aids.edu', '620125243001', 'Arun Kumar', 'STUDENT', ?, '3rd Year', 'A', 1, datetime('now'))
  `).run(passwordHash);

  db.prepare(`
    INSERT INTO students (id, register_no, name, email, department, year, section, batch, class_coordinator_name, cgpa, overall_score, current_rank)
    VALUES ('stu-test-1', '620125243001', 'Arun Kumar', 'student6201@aids.edu', 'AI & DS', '3rd Year', 'A', '2022-2026', 'Dr. Coordinator', 8.75, 84.5, 1)
  `).run();

  // Also seed an unlinked student user (without a student profile row) to verify watchdog error handling
  db.prepare(`
    INSERT INTO users (id, email, identifier, name, role, password_hash, year, section, is_active, created_at)
    VALUES ('user-stu-unlinked', 'unlinked@aids.edu', '620125243999', 'Unlinked Student', 'STUDENT', ?, '3rd Year', 'B', 1, datetime('now'))
  `).run(passwordHash);

  db.close();
  console.log('Test student account seeded successfully.');

  // 2. Launch headless Chrome with clean user profile
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

    console.log('\n--- VERIFICATION 3: Direct Navigation to /student/dashboard Redirects to /student ---');
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5174/student/dashboard' });
    await wait(1500);

    const unauthDashboardUrl = await cdp.eval('window.location.pathname');
    console.log(`[Browser] Direct visit to /student/dashboard -> URL: ${unauthDashboardUrl}`);
    if (unauthDashboardUrl !== '/student') {
      throw new Error(`Expected unauthenticated visit to redirect to /student but got: ${unauthDashboardUrl}`);
    }
    console.log('✅ PASS: Unauthenticated access to dashboard redirected to login');

    console.log('\n--- VERIFICATION 4: Expired Token in Browser Storage Purged & Redirected ---');
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

    console.log('\n--- VERIFICATION 5: Full Student Login -> Dashboard Load -> Logout -> Clean Reset ---');
    // Navigate back to fresh /student login page
    await cdp.send('Page.navigate', { url: 'http://127.0.0.1:5174/student' });
    await wait(1200);

    // Enter credentials via React native setters
    console.log('[Browser] Submitting student credentials for 620125243001...');
    await cdp.eval(`
      (() => {
        const idInput = document.querySelector('input[name="student-identifier"]');
        const passInput = document.querySelector('input[name="student-password"]');
        
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(idInput, '620125243001');
        idInput.dispatchEvent(new Event('input', { bubbles: true }));
        idInput.dispatchEvent(new Event('change', { bubbles: true }));

        setter.call(passInput, 'StudentSecret2026!');
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.dispatchEvent(new Event('change', { bubbles: true }));

        const submitBtn = document.querySelector('button[type="submit"]');
        submitBtn.click();
      })()
    `);

    // Wait for login processing and navigation to /student/dashboard
    let loggedIn = false;
    for (let i = 0; i < 25; i++) {
      await wait(500);
      const curPath = await cdp.eval('window.location.pathname');
      if (curPath === '/student/dashboard') {
        loggedIn = true;
        break;
      }
    }
    if (!loggedIn) {
      const curPath = await cdp.eval('window.location.pathname');
      const errText = await cdp.eval('document.body.innerText');
      throw new Error(`Failed to navigate to /student/dashboard after login. Current path: ${curPath}. Body: ${errText.slice(0, 200)}`);
    }
    console.log('[Browser] Successfully navigated to /student/dashboard!');

    // Wait for Student Dashboard to finish loading profile (Loading screen disappears)
    console.log('[Browser] Verifying Student Dashboard finishes loading 360 profile...');
    let profileLoaded = false;
    for (let i = 0; i < 30; i++) {
      await wait(400);
      const isStillLoading = await cdp.eval(`document.body.innerText.includes('Loading 360° Student Performance Profile...')`);
      const hasStudentName = await cdp.eval(`document.body.innerText.includes('Arun Kumar')`);
      const hasRegNo = await cdp.eval(`document.body.innerText.includes('620125243001')`);
      
      if (!isStillLoading && (hasStudentName || hasRegNo)) {
        profileLoaded = true;
        console.log(`[Browser] Profile loaded in DOM! Student name and Reg No verified. (took ~${(i + 1) * 0.4}s)`);
        break;
      }
    }

    if (!profileLoaded) {
      const bodySnippet = await cdp.eval('document.body.innerText');
      throw new Error(`Student Dashboard remained stuck or profile failed to load: ${bodySnippet.slice(0, 300)}`);
    }
    console.log('✅ PASS: Student Dashboard loaded cleanly without getting stuck on loading screen');

    // Verify token exists in storage during active session
    const activeToken = await cdp.eval("sessionStorage.getItem('aids_token_student') || localStorage.getItem('aids_token_student')");
    if (!activeToken) throw new Error('Expected active student token in storage but found none');
    console.log('✅ PASS: Valid student token safely held in browser session storage during active session');

    // Click Logout button
    console.log('[Browser] Clicking Logout button on Student Dashboard...');
    const logoutClicked = await cdp.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const logoutBtn = buttons.find(b => b.innerText.includes('Logout'));
        if (logoutBtn) {
          logoutBtn.click();
          return true;
        }
        return false;
      })()
    `);
    if (!logoutClicked) throw new Error('Logout button not found in Student Dashboard');

    // Wait for redirect to /student
    let loggedOut = false;
    for (let i = 0; i < 20; i++) {
      await wait(400);
      const pathAfterLogout = await cdp.eval('window.location.pathname');
      if (pathAfterLogout === '/student') {
        loggedOut = true;
        break;
      }
    }
    if (!loggedOut) {
      const curPath = await cdp.eval('window.location.pathname');
      throw new Error(`Expected redirect to /student after logout, but remained at: ${curPath}`);
    }

    // Verify localStorage and sessionStorage tokens are completely removed
    const tokenAfterLogout = await cdp.eval("localStorage.getItem('aids_token_student')");
    const sessionTokenAfterLogout = await cdp.eval("sessionStorage.getItem('aids_token_student')");
    console.log(`[Browser] Post-logout storage: localStorage token = ${tokenAfterLogout}, sessionStorage token = ${sessionTokenAfterLogout}`);
    if (tokenAfterLogout !== null || sessionTokenAfterLogout !== null) {
      throw new Error('Student auth tokens were NOT cleared upon logout');
    }

    // Verify login input fields are empty post-logout
    const idAfterLogout = await cdp.eval(`document.querySelector('input[name="student-identifier"]')?.value`);
    const passAfterLogout = await cdp.eval(`document.querySelector('input[name="student-password"]')?.value`);
    if (idAfterLogout !== '' || passAfterLogout !== '') {
      throw new Error(`Login inputs not empty after logout: id="${idAfterLogout}", pass="${passAfterLogout}"`);
    }
    console.log('✅ PASS: Logout clears session tokens completely and resets inputs to empty');

    // Reload page to verify post-logout revisit never auto-logs in
    console.log('[Browser] Reloading page to verify revisit does NOT auto-login...');
    await cdp.send('Page.reload');
    await wait(1500);
    const postReloadUrl = await cdp.eval('window.location.pathname');
    const postReloadToken = await cdp.eval("localStorage.getItem('aids_token_student')");
    if (postReloadUrl !== '/student' || postReloadToken !== null) {
      throw new Error(`Revisit after logout unexpectedly restored session or redirected: ${postReloadUrl}`);
    }
    console.log('✅ PASS: Revisit after logout remains unauthenticated on /student');

    console.log('\n--- VERIFICATION 6: Watchdog & Timeout UI Renders Clear Error with Working Retry & Logout ---');
    // Log in as unlinked student (no profile row in `students` table)
    console.log('[Browser] Logging in with unlinked student account (620125243999)...');
    await cdp.eval(`
      (() => {
        const idInput = document.querySelector('input[name="student-identifier"]');
        const passInput = document.querySelector('input[name="student-password"]');
        
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(idInput, '620125243999');
        idInput.dispatchEvent(new Event('input', { bubbles: true }));
        idInput.dispatchEvent(new Event('change', { bubbles: true }));

        setter.call(passInput, 'StudentSecret2026!');
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.dispatchEvent(new Event('change', { bubbles: true }));

        const submitBtn = document.querySelector('button[type="submit"]');
        submitBtn.click();
      })()
    `);

    // Wait for dashboard navigation
    for (let i = 0; i < 20; i++) {
      await wait(400);
      if ((await cdp.eval('window.location.pathname')) === '/student/dashboard') break;
    }

    // Verify error UI appears (does NOT get stuck on loading)
    let errorCardRendered = false;
    for (let i = 0; i < 25; i++) {
      await wait(400);
      const text = await cdp.eval('document.body.innerText');
      if (text.includes('Retry Loading Profile') && text.includes('Logout to Portal')) {
        errorCardRendered = true;
        console.log(`[Browser] Verified error state rendered with Retry and Logout buttons:`);
        console.log(`[Browser] Heading text snippet: "${text.split('\\n')[0]}"`);
        break;
      }
    }
    if (!errorCardRendered) {
      const stuckText = await cdp.eval('document.body.innerText');
      throw new Error(`Dashboard got stuck without rendering error/retry options: ${stuckText.slice(0, 200)}`);
    }
    console.log('✅ PASS: Missing/failing student profile terminates loading and displays Retry and Logout controls');

    // Click "Logout to Portal" on the error card
    console.log('[Browser] Clicking "Logout to Portal" button on error screen...');
    await cdp.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const logoutBtn = buttons.find(b => b.innerText.includes('Logout to Portal'));
        logoutBtn?.click();
      })()
    `);

    // Wait for redirect to /student
    let backToLogin = false;
    for (let i = 0; i < 20; i++) {
      await wait(400);
      if ((await cdp.eval('window.location.pathname')) === '/student') {
        backToLogin = true;
        break;
      }
    }
    if (!backToLogin) {
      throw new Error('Clicking Logout to Portal did not redirect back to /student');
    }
    const tokenCleaned = await cdp.eval("localStorage.getItem('aids_token_student')");
    if (tokenCleaned !== null) {
      throw new Error('Token was not purged after Logout to Portal click');
    }
    console.log('✅ PASS: Logout to Portal button purges session and returns to login');

    console.log('\n--- VERIFICATION 7: No Plaintext Passwords in Browser Storage ---');
    const storageKeys = await cdp.eval(`JSON.stringify({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })`);
    console.log('[Browser] Current storage keys:', storageKeys);
    const storageDump = await cdp.eval(`JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })`);
    if (/StudentSecret2026|password123|admin123|student123|faculty123/i.test(storageDump)) {
      throw new Error('Plaintext password found in browser storage!');
    }
    console.log('✅ PASS: Zero plaintext passwords in browser storage');

    ws.close();
    console.log('\n============================================================');
    console.log('🎉 ALL 7 REAL BROWSER VERIFICATIONS PASSED 100%! 🎉');
    console.log('============================================================\n');
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
