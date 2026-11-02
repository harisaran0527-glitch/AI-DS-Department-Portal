import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(root, 'scratch', 'landing-review');
mkdirSync(artifacts, { recursive: true });
const base = 'http://127.0.0.1:4178';
const chromePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean).find(existsSync);
assert.ok(chromePath, 'Set CHROME_PATH to an installed Chromium browser');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const result = await check(); if (result) return result; } catch {}
    await sleep(100);
  }
  throw new Error('Timed out: ' + label);
}
const children = [];
const report = { layouts: [], routes: [], screenshots: [], errors: [], failedRequests: [], checks: [] };
let ws;
let browserLog = '';
let previewLog = '';
try {
  const preview = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4178', '--strictPort',
  ], { cwd: root, windowsHide: true, stdio: 'pipe' });
  children.push(preview);
  preview.stdout.on('data', data => { previewLog += data; });
  preview.stderr.on('data', data => { previewLog += data; });
  preview.on('error', error => { previewLog += error.message; });
  await until(async () => (await fetch(base)).ok, 'production preview');
  const profile = path.join(artifacts, 'chrome-profile-' + Date.now());
  const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--user-data-dir=' + profile,
    '--window-size=1440,900', 'about:blank',
  ], { windowsHide: true, stdio: 'pipe' });
  children.push(chrome);
  chrome.stderr.on('data', data => { browserLog += data; });
  chrome.on('error', error => { browserLog += error.message; });
  const debugPort = await until(() => {
    const portFile = path.join(profile, 'DevToolsActivePort');
    return existsSync(portFile) && Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  }, 'isolated Chrome debugging port');
  const target = await until(async () => {
    const targets = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list')).json();
    return targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl);
  }, 'Chrome debugging connection');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = pending.get(message.id);
      if (callback) {
        clearTimeout(callback.timer);
        pending.delete(message.id);
        if (message.error) callback.reject(new Error(message.error.message));
        else callback.resolve(message.result);
      }
    }
    if (message.method === 'Runtime.exceptionThrown') {
      report.errors.push({ type: 'exception', detail: message.params.exceptionDetails });
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      report.errors.push({ type: 'console', detail: message.params.args.map(arg => arg.value ?? arg.description) });
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      report.errors.push({ type: 'log', detail: message.params.entry.text, url: message.params.entry.url });
    }
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
      report.failedRequests.push({ url: message.params.response.url, status: message.params.response.status });
    }
    if (message.method === 'Network.loadingFailed' && !message.params.canceled) {
      report.failedRequests.push({ error: message.params.errorText, type: message.params.type });
    }
  };
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable'), send('Log.enable')]);
  const home = async () => {
    await send('Page.navigate', { url: base });
    await until(() => evaluate('Boolean(document.querySelector(".landing-portal"))'), 'landing render');
    await evaluate('document.fonts.ready.then(() => true)');
    await until(() => evaluate('[...document.images].every(image => image.complete && image.naturalWidth > 0)'), 'images loaded');
    await sleep(80);
  };
  await home();
  const click = async selector => {
    const point = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      element.scrollIntoView({block: 'center'});
      const rect = element.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    await sleep(80);
  };
  const setTheme = async theme => {
    if (await evaluate('document.querySelector(".portal-landing").dataset.theme') !== theme) {
      await click('.landing-theme-toggle');
    }
    assert.equal(await evaluate('localStorage.getItem("app_theme")'), theme);
  };
  const viewport = async width => {
    await send('Emulation.setDeviceMetricsOverride', {
      width, height: width >= 1920 ? 1080 : 900, deviceScaleFactor: 1, mobile: width <= 700,
    });
    await send('Emulation.setTouchEmulationEnabled', { enabled: width <= 700 });
    await evaluate('scrollTo(0,0)');
    await sleep(80);
  };
  const widths = [320, 360, 375, 390, 414, 430, 768, 820, 1024, 1280, 1440, 1920];
  for (const theme of ['light', 'dark']) {
    await setTheme(theme);
    for (const width of widths) {
      await viewport(width);
      const layout = await evaluate(`(() => {
        const rect = element => {
          const r = element.getBoundingClientRect();
          return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom };
        };
        const cards = [...document.querySelectorAll('.landing-portal')];
        const overflowing = [...document.querySelectorAll('.portal-landing *')].filter(element => {
          const r = element.getBoundingClientRect();
          return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1);
        }).map(element => element.className);
        const text = cards.map(card => {
          const title = card.querySelector('h2');
          const description = card.querySelector('.landing-portal-description');
          const range = document.createRange();
          range.selectNodeContents(description.querySelector(innerWidth <= 700 ? '.landing-description-short' : '.landing-description-full'));
          return {
            title: title.textContent, titleColor: getComputedStyle(title).color,
            descriptionColor: getComputedStyle(description).color,
            background: getComputedStyle(card).backgroundColor,
            titleClipped: title.scrollWidth > title.clientWidth || title.scrollHeight > title.clientHeight,
            descriptionLines: range.getClientRects().length,
            descriptionClipped: description.scrollWidth > description.clientWidth,
            titleRect: rect(title), descriptionRect: rect(description),
            buttonShown: getComputedStyle(card.querySelector('.landing-portal-login')).display !== 'none',
          };
        });
        const photo = document.querySelector('.landing-campus img');
        return {
          width:innerWidth, theme:document.querySelector('.portal-landing').dataset.theme,
          scrollWidth:document.documentElement.scrollWidth, overflowing,
          columns:getComputedStyle(document.querySelector('.landing-portals')).gridTemplateColumns.split(' ').length,
          cards:cards.map(rect), text,
          photo:{ naturalWidth:photo.naturalWidth, naturalHeight:photo.naturalHeight,
            objectFit:getComputedStyle(photo).objectFit, rect:rect(photo) },
          panel:rect(document.querySelector('.landing-content')),
          header:rect(document.querySelector('.landing-header')),
          titleSize:getComputedStyle(document.querySelector('.landing-title')).fontSize,
          themeButton:rect(document.querySelector('.landing-theme-toggle')),
          menuButton:rect(document.querySelector('.landing-menu summary')),
          headerColor:getComputedStyle(document.querySelector('.landing-header')).backgroundColor,
        };
      })()`);
      assert.equal(layout.width, width);
      assert.ok(layout.scrollWidth <= width, 'Page overflow at ' + theme + ' ' + width);
      assert.deepEqual(layout.overflowing, [], 'Element overflow at ' + theme + ' ' + width);
      assert.equal(layout.columns, width <= 700 ? 1 : width <= 1120 ? 2 : 4);
      assert.equal(layout.headerColor, 'rgb(16, 30, 53)');
      assert.equal(layout.photo.naturalWidth, 594);
      assert.equal(layout.photo.naturalHeight, 334);
      assert.equal(layout.photo.objectFit, 'cover');
      assert.ok(layout.themeButton.width >= 44 && layout.themeButton.height >= 44);
      assert.ok(layout.cards.every(card => card.height >= 44));
      assert.ok(Math.max(...layout.cards.map(card => card.height)) - Math.min(...layout.cards.map(card => card.height)) <= 1);
      assert.ok(layout.text.every(text => !text.titleClipped && !text.descriptionClipped));
      for (const text of layout.text) {
        const luminance = rgb => {
          const values = rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(c => {
            const v = c / 255;
            return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
          });
          return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
        };
        const contrast = color => {
          const a = luminance(color), b = luminance(text.background);
          return (Math.max(a,b) + .05) / (Math.min(a,b) + .05);
        };
        text.titleContrast = contrast(text.titleColor);
        text.descriptionContrast = contrast(text.descriptionColor);
        assert.ok(text.titleContrast >= 4.5 && text.descriptionContrast >= 4.5, 'Card contrast at ' + theme + ' ' + width);
      }
      if (width <= 700) {
        assert.ok(layout.panel.y < layout.photo.rect.bottom, 'Overlapping mobile panel');
        assert.ok(layout.menuButton.width >= 44 && layout.menuButton.height >= 44);
        assert.ok(layout.text.every(text => text.descriptionLines === 1 && !text.buttonShown), 'Compact one-line mobile descriptions');
        assert.ok(parseFloat(layout.titleSize) >= 27);
        for (let i = 1; i < layout.cards.length; i++) assert.ok(layout.cards[i].y >= layout.cards[i-1].bottom);
      } else {
        assert.ok(layout.text.every(text => text.buttonShown), 'Desktop/tablet login labels');
      }
      report.layouts.push(layout);
      console.log('PASS layout', theme, width);
      if ([390, 768, 1440].includes(width)) {
        await evaluate('scrollTo(0,0)');
        const dimensions = await send('Page.getLayoutMetrics');
        const screenshot = await send('Page.captureScreenshot', {
          format: 'png', captureBeyondViewport: true,
          clip: { x:0, y:0, width, height:Math.ceil(dimensions.cssContentSize.height), scale:1 },
        });
        const filename = 'landing-' + theme + '-' + width + '.png';
        writeFileSync(path.join(artifacts, filename), Buffer.from(screenshot.data, 'base64'));
        report.screenshots.push(filename);
      }
    }
    await home();
    assert.equal(await evaluate('document.querySelector(".portal-landing").dataset.theme'), theme);
    report.checks.push(theme + ' preference survives reload');
  }
  for (const width of [390,1440]) {
    await viewport(width);
    for (const theme of ['light','dark']) {
      await setTheme(theme);
      for (const role of ['student','faculty','hod','admin']) {
        await click('.landing-portal-' + role);
        await until(() => evaluate('location.pathname === "/' + role + '" && Boolean(document.querySelector("input[type=password]"))'), role + ' login');
        assert.equal(await evaluate('localStorage.getItem("app_theme")'), theme);
        await evaluate('history.back()');
        await until(() => evaluate('location.pathname === "/" && Boolean(document.querySelector(".landing-portal"))'), 'return home');
        assert.equal(await evaluate('document.querySelector(".portal-landing").dataset.theme'), theme);
        report.routes.push({ width, theme, route:'/' + role, renderedLogin:true, themeRetainedOnReturn:true });
      }
    }
  }
  await viewport(390);
  await click('.landing-menu summary');
  assert.ok(await evaluate('document.querySelector(".landing-menu").open'));
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".landing-menu nav a")].map(a => a.getAttribute("href"))'), ['/student','/faculty','/hod','/admin']);
  await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27 });
  assert.equal(await evaluate('document.querySelector(".landing-menu").open'), false);
  report.checks.push('Mobile menu opens, exposes original routes, closes on Escape');
  await home();
  await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Tab', code:'Tab', windowsVirtualKeyCode:9 });
  assert.equal(await evaluate('document.activeElement.className'), 'landing-skip');
  await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
  assert.equal(await evaluate('document.activeElement.id'), 'portal-selection');
  await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Tab', code:'Tab', windowsVirtualKeyCode:9 });
  assert.ok(await evaluate('document.activeElement.classList.contains("landing-portal-student") && document.activeElement.matches(":focus-visible") && getComputedStyle(document.activeElement).outlineStyle === "solid"'));
  await send('Input.dispatchKeyEvent', { type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13 });
  await until(() => evaluate('location.pathname === "/student" && Boolean(document.querySelector("input[type=password]"))'), 'keyboard login navigation');
  report.checks.push('Keyboard skip link, visible card focus, Enter navigation');
  await home();
  const touchPoint = await evaluate(`(() => {
    const card = document.querySelector('.landing-portal-student');
    card.scrollIntoView({block:'center'});
    const r = card.getBoundingClientRect();
    return {x:r.x + r.width / 2, y:r.y + r.height / 2};
  })()`);
  await send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{...touchPoint, id:1}] });
  await send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await until(() => evaluate('location.pathname === "/student" && Boolean(document.querySelector("input[type=password]"))'), 'mobile touch navigation');
  report.checks.push('Mobile touch tap opens original Student login');
  await home();
  await send('Emulation.setEmulatedMedia', { features:[{ name:'prefers-reduced-motion', value:'reduce' }] });
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".landing-portal")).transitionDuration'), '0s');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".landing-portal")).animationName'), 'none');
  report.checks.push('Reduced motion disables landing animation and transitions');
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const source = readFileSync(path.join(root, 'public/images/avsec-college-front.jpg'));
  const built = readFileSync(path.join(root, 'dist/images/avsec-college-front.jpg'));
  const served = Buffer.from(await (await fetch(base + '/images/avsec-college-front.jpg')).arrayBuffer());
  assert.equal(hash(source),hash(built));
  assert.equal(hash(source),hash(served));
  report.checks.push('Production image HTTP 200, byte-identical static source/build/response: ' + hash(source));
  report.status = 'passed';
  assert.deepEqual(report.errors, [], 'Browser console errors');
  assert.deepEqual(report.failedRequests, [], 'Failed browser requests');
  console.log('PASS', report.layouts.length, 'layouts;', report.routes.length, 'route checks;', report.screenshots.length, 'screenshots; zero console/request errors');
} catch (error) {
  report.status = 'failed';
  report.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
  writeFileSync(path.join(artifacts, 'preview.log'), previewLog);
  writeFileSync(path.join(artifacts, 'browser.log'), browserLog);
  ws?.close();
  for (const child of children.reverse()) child.kill();
}
