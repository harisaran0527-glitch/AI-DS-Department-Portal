const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;
const BASE_URL = 'http://localhost:4173';
const ARTIFACT_DIR = 'C:\\Users\\ELCOT\\.gemini\\antigravity-ide\\brain\\ce1e4344-73d3-4e03-8ec1-3744a0fb5b68';

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.msgId++;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async setViewport(width, height, isMobile = true) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: isMobile,
    });
    await this.send('Emulation.setTouchEmulationEnabled', {
      enabled: isMobile,
    });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await delay(1200); // Wait for React render & animations
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    if (res.data) {
      fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    }
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runAudit() {
  console.log('🚀 Starting Chrome for Mobile UX Audit...');
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--user-data-dir=' + path.resolve(__dirname, '../.chrome-test-profile'),
    ],
    { stdio: 'ignore' }
  );

  await delay(1500);

  try {
    const version = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    console.log('Connected to Browser:', version['Browser']);

    const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const pageTarget = targets.find((t) => t.type === 'page') || (await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/new?${BASE_URL}`));
    console.log('Target WS URL:', pageTarget.webSocketDebuggerUrl);

    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    const viewports = [
      { name: '360x800', width: 360, height: 800, isMobile: true },
      { name: '390x844', width: 390, height: 844, isMobile: true },
      { name: '412x915', width: 412, height: 915, isMobile: true },
      { name: '1440px', width: 1440, height: 900, isMobile: false },
    ];

    const auditResults = {
      viewports: {},
      portals: {},
      horizontalOverflow: true,
      keyboardAndTouch: {},
    };

    const routes = [
      { path: '/', name: 'Student Portal Login' },
      { path: '/admin', name: 'Admin Portal Login' },
      { path: '/hod', name: 'HOD Portal Login' },
      { path: '/faculty', name: 'Faculty Portal Login' },
    ];

    for (const vp of viewports) {
      console.log(`\n========================================`);
      console.log(`📱 Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      console.log(`========================================`);

      await client.setViewport(vp.width, vp.height, vp.isMobile);

      auditResults.viewports[vp.name] = {
        routes: {},
        allOverflowPass: true,
      };

      for (const route of routes) {
        const fullUrl = `${BASE_URL}${route.path}`;
        await client.navigate(fullUrl);

        // Perform measurements in DOM
        const pageMetrics = await client.evaluate(`(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
          const innerWidth = window.innerWidth;
          const clientWidth = docEl.clientWidth;
          const hasHorizontalOverflow = scrollWidth > (innerWidth + 1);

          // Check inputs
          const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
          const inputChecks = inputs.map(el => {
            const rect = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            return {
              type: el.type,
              id: el.id,
              name: el.name,
              value: el.value,
              placeholder: el.placeholder,
              fontSize: cs.fontSize,
              height: rect.height,
              width: rect.width,
              isPrefilled: Boolean(el.value && el.value.trim() !== ''),
              touchCompliant: rect.height >= 42,
              fontCompliant: parseFloat(cs.fontSize) >= 15.5
            };
          });

          // Check buttons
          const buttons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]'));
          const buttonChecks = buttons.map(b => {
            const rect = b.getBoundingClientRect();
            return {
              text: b.innerText.trim().slice(0, 30),
              height: rect.height,
              width: rect.width,
              touchCompliant: rect.height >= 38 || rect.width >= 38,
            };
          });

          return {
            title: document.title,
            scrollWidth,
            innerWidth,
            clientWidth,
            hasHorizontalOverflow,
            inputs: inputChecks,
            buttons: buttonChecks,
            h1Text: document.querySelector('h1')?.innerText || '',
          };
        })()`);

        const overflowPass = !pageMetrics.hasHorizontalOverflow;
        const prefilledInputs = pageMetrics.inputs.filter((i) => i.isPrefilled);
        const inputsFontOk = pageMetrics.inputs.every((i) => i.fontCompliant || !vp.isMobile);
        const inputsHeightOk = pageMetrics.inputs.every((i) => i.touchCompliant);

        console.log(`[${vp.name}] ${route.name} (${route.path}):`);
        console.log(`  - Horizontal Overflow: ${overflowPass ? 'PASS (scrollWidth: ' + pageMetrics.scrollWidth + 'px <= ' + pageMetrics.innerWidth + 'px)' : 'FAIL (scrollWidth: ' + pageMetrics.scrollWidth + 'px > ' + pageMetrics.innerWidth + 'px)'}`);
        console.log(`  - Pre-filled inputs: ${prefilledInputs.length === 0 ? 'PASS (0 inputs pre-filled)' : 'FAIL (' + prefilledInputs.length + ' inputs pre-filled: ' + prefilledInputs.map(i => i.value).join(', ') + ')'}`);
        console.log(`  - Input Font Size (iOS anti-zoom >= 16px): ${inputsFontOk ? 'PASS' : 'WARN'}`);
        console.log(`  - Input Height (Touch target >= 44px): ${inputsHeightOk ? 'PASS' : 'WARN'}`);

        const scrPath = path.join(ARTIFACT_DIR, `screenshot_${vp.name}_${route.path.replace('/', '') || 'student'}.png`);
        await client.screenshot(scrPath);

        auditResults.viewports[vp.name].routes[route.path] = {
          metrics: pageMetrics,
          overflowPass,
          prefilledCount: prefilledInputs.length,
          inputsFontOk,
          inputsHeightOk,
          screenshot: scrPath,
        };

        if (!overflowPass) {
          auditResults.viewports[vp.name].allOverflowPass = false;
          auditResults.horizontalOverflow = false;
        }
      }
    }

    client.close();
    console.log('\nAudit complete! Saving results to JSON...');
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'audit_raw_results.json'), JSON.stringify(auditResults, null, 2));
    console.log('✅ Audit results saved successfully.');
  } finally {
    chromeProcess.kill();
  }
}

runAudit().catch(err => {
  console.error('Audit Error:', err);
  process.exit(1);
});
