import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { isolateServer } from './helpers/isolated-server.mjs';

isolateServer({});
const { StudentLogin } = await import('../src/pages/logins/StudentLogin.tsx');
const { FacultyLogin } = await import('../src/pages/logins/FacultyLogin.tsx');
const { HODLogin } = await import('../src/pages/logins/HODLogin.tsx');
const { AdminLogin } = await import('../src/pages/logins/AdminLogin.tsx');
const { DisciplineLogin } = await import('../src/pages/logins/DisciplineLogin.tsx');
const { API, setSessionAuth, clearSessionAuth, getValidSessionToken, openAuthenticatedFile } = await import('../src/services/api.ts');
const savedFetch = globalThis.fetch;
after(() => { globalThis.fetch = savedFetch; });
const makeStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key), clear: () => data.clear() };
};
globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();
globalThis.window = { location: { pathname: '/faculty/dashboard' } };

test('all four portal forms and Discipline render empty credentials despite remembered browser data', () => {
  const browserWindow = globalThis.window;
  delete globalThis.window; // Render in the server environment; effects and browser animation hooks do not run.
  try {
    localStorage.setItem('remembered_email_faculty', 'remembered-memory-only@example.invalid');
    localStorage.setItem('remembered_email_admin', 'remembered-memory-admin@example.invalid');
    for (const Component of [StudentLogin, FacultyLogin, HODLogin, AdminLogin, DisciplineLogin]) {
      const markup = renderToStaticMarkup(React.createElement(MemoryRouter, {}, React.createElement(Component)));
      const fields = [...markup.matchAll(/<input\b[^>]*>/g)].map(match => match[0]).filter(input => /type="(?:text|email|password)"/.test(input));
      assert.equal(fields.length, 2);
      for (const field of fields) {
        assert.match(field, /value=""/);
        assert.match(field, /name="[a-z]+-(?:identifier|password)"/);
      }
      assert.doesNotMatch(markup, /remembered-memory|student123|admin123|hod123/);
    }
    const disciplineMarkup = renderToStaticMarkup(React.createElement(
      MemoryRouter, {}, React.createElement(DisciplineLogin)
    ));
    for (const role of ['FACULTY', 'ADMIN']) {
      assert.match(disciplineMarkup, new RegExp(`<option value="${role}"(?: selected="")?>`));
    }
    assert.doesNotMatch(disciplineMarkup, /<option value="HOD"/);
  } finally { globalThis.window = browserWindow; }
});

test('persistent session storage requires explicit remember-device consent and remains role isolated', () => {
  localStorage.clear(); sessionStorage.clear();
  setSessionAuth('memory-only-faculty-token', 'FACULTY');
  assert.equal(localStorage.getItem('aids_token_faculty'), null);
  assert.equal(getValidSessionToken('FACULTY'), 'memory-only-faculty-token');
  setSessionAuth('memory-only-admin-token', 'ADMIN', true);
  assert.equal(localStorage.getItem('aids_token_admin'), 'memory-only-admin-token');
  clearSessionAuth('FACULTY');
  assert.equal(getValidSessionToken('FACULTY'), null);
  assert.equal(getValidSessionToken('ADMIN'), 'memory-only-admin-token');
  assert.equal(sessionStorage.getItem('aids_active_role'), 'ADMIN');
});

test('a failed logout is neither hidden nor retried and preserves the session for a retry', async () => {
  setSessionAuth('memory-only-faculty-token', 'FACULTY');
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: 'Revocation unavailable' }, { status: 503 }); };
  await assert.rejects(API.logout('FACULTY'), /Revocation unavailable/);
  assert.equal(calls, 1);
  assert.equal(getValidSessionToken('FACULTY'), 'memory-only-faculty-token');
});

test('an expired session can finish local sign-out without being mistaken for an availability failure', async () => {
  setSessionAuth('memory-only-expired-token', 'FACULTY');
  globalThis.fetch = async () => Response.json({ error: 'Session expired' }, { status: 401 });
  assert.equal((await API.logout('FACULTY')).message, 'Session has ended.');
  assert.equal(getValidSessionToken('FACULTY'), null);
});

test('proof previews use an authenticated fetch and a blob URL, never JWTs in URLs', async () => {
  setSessionAuth('memory-only-faculty-token', 'FACULTY');
  let request;
  let previewUrl;
  let closed = false;
  const popup = { opener: 'original', location: { replace: url => { previewUrl = url; } }, close: () => { closed = true; } };
  window.open = () => popup;
  globalThis.fetch = async (url, options) => { request = { url, options }; return new Response('memory-only-proof', { headers: { 'Content-Type': 'application/pdf' } }); };
  const savedTimer = globalThis.setTimeout;
  const savedCreate = URL.createObjectURL;
  const savedRevoke = URL.revokeObjectURL;
  let revoked;
  URL.createObjectURL = () => 'blob:isolated-proof';
  URL.revokeObjectURL = url => { revoked = url; };
  globalThis.setTimeout = callback => { callback(); return 0; };
  try {
    await openAuthenticatedFile('/faculty/certificates/memory-only/view', 'FACULTY');
    assert.equal(request.url, '/api/faculty/certificates/memory-only/view');
    assert.equal(request.options.headers.Authorization, 'Bearer memory-only-faculty-token');
    assert.equal(request.options.headers['X-Portal-Role'], 'FACULTY');
    assert.equal(request.options.credentials, 'include');
    assert.equal(request.options.cache, 'no-store');
    assert.equal(popup.opener, null);
    assert.equal(previewUrl, 'blob:isolated-proof');
    assert.equal(revoked, previewUrl);
    assert.equal(closed, false);
    assert.doesNotMatch(request.url, /token|memory-only-faculty/);
    globalThis.fetch = async () => Response.json({ error: 'denied' }, { status: 403 });
    await assert.rejects(openAuthenticatedFile('/faculty/certificates/memory-only/view', 'FACULTY'), /403/);
    assert.equal(closed, true);
  } finally { globalThis.setTimeout = savedTimer; URL.createObjectURL = savedCreate; URL.revokeObjectURL = savedRevoke; }
});

test('proof downloads preserve the suggested filename and use an authenticated blob request', async () => {
  setSessionAuth('memory-only-student-token', 'STUDENT');
  let request;
  let clicked = false;
  let removed = false;
  const link = { click: () => { clicked = true; }, remove: () => { removed = true; } };
  const savedDocument = globalThis.document;
  const savedTimer = globalThis.setTimeout;
  const savedCreate = URL.createObjectURL;
  const savedRevoke = URL.revokeObjectURL;
  globalThis.document = { createElement: () => link, body: { appendChild: element => assert.equal(element, link) } };
  globalThis.fetch = async (url, options) => { request = { url, options }; return new Response('memory-only-proof', { headers: { 'Content-Type': 'application/pdf' } }); };
  URL.createObjectURL = () => 'blob:memory-download';
  URL.revokeObjectURL = () => {};
  globalThis.setTimeout = callback => { callback(); return 0; };
  try {
    await openAuthenticatedFile('/faculty/participation/memory-only/download', 'STUDENT', { download: true, filename: 'memory-proof.pdf' });
    assert.equal(request.options.headers.Authorization, 'Bearer memory-only-student-token');
    assert.equal(request.options.headers['X-Portal-Role'], 'STUDENT');
    assert.doesNotMatch(request.url, /token=|memory-only-student-token/);
    assert.equal(link.href, 'blob:memory-download');
    assert.equal(link.download, 'memory-proof.pdf');
    assert.equal(clicked, true);
    assert.equal(removed, true);
  } finally {
    globalThis.document = savedDocument;
    globalThis.setTimeout = savedTimer;
    URL.createObjectURL = savedCreate;
    URL.revokeObjectURL = savedRevoke;
  }
});
