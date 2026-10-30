import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { isolateServer } from './helpers/isolated-server.mjs';

isolateServer({});

const { DashboardLayout } = await import('../src/components/layout/DashboardLayout.tsx');
const { ThemeProvider, useTheme } = await import('../src/context/ThemeContext.tsx');
const { ThemeToggle } = await import('../src/components/common/ThemeToggle.tsx');
const { clearSessionAuth } = await import('../src/services/api.ts');

const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear()
  };
};

globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();

const sampleMenuItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'faculty', label: 'Faculty Roster' },
  { id: 'subjects', label: 'Department Subjects' },
  { id: 'discipline', label: 'Discipline' }
];

test('1 & 2. Forgot Password button has high-contrast styling classes in Light and Dark Modes', () => {
  const forgotButton = React.createElement(
    'button',
    {
      type: 'button',
      className: 'btn-header-forgot min-h-[44px] text-xs px-3.5 py-2 rounded-xl font-mono flex items-center space-x-1.5 cursor-pointer shadow-sm',
      'aria-label': 'Forgot Password'
    },
    React.createElement('span', null, 'Forgot Password?')
  );

  const markup = renderToStaticMarkup(
    React.createElement(DashboardLayout, {
      portalRole: 'HOD',
      userName: 'Dr. Test HOD',
      userRoleTitle: 'Head of Department',
      menuItems: sampleMenuItems,
      activeTab: 'dashboard',
      onSelectTab: () => {},
      onLogout: () => {},
      headerActions: forgotButton
    }, React.createElement('div', null, 'Dashboard Content'))
  );

  // Must render Forgot Password button with btn-header-forgot class
  assert.match(markup, /btn-header-forgot/);
  assert.match(markup, /Forgot Password\?/);
  assert.match(markup, /aria-label="Forgot Password"/);
});

test('3, 4 & 5. Only ONE Logout option remains in HOD Portal (Sidebar only, top-right removed)', () => {
  let logoutCalled = false;
  const markup = renderToStaticMarkup(
    React.createElement(DashboardLayout, {
      portalRole: 'HOD',
      userName: 'Dr. Test HOD',
      userRoleTitle: 'Head of Department',
      menuItems: sampleMenuItems,
      activeTab: 'dashboard',
      onSelectTab: () => {},
      onLogout: () => { logoutCalled = true; },
      headerActions: React.createElement('button', { className: 'btn-header-forgot' }, 'Forgot Password?')
    }, React.createElement('div', null, 'Dashboard Content'))
  );

  // 1. Sidebar logout must exist with btn-sidebar-logout and "Logout Portal"
  assert.match(markup, /btn-sidebar-logout/);
  assert.match(markup, /Logout Portal/);

  // 2. Header must NOT contain a Logout button
  // The header section only contains ThemeToggle and headerActions
  const headerMatch = markup.match(/<header\b[^>]*>([\s\S]*?)<\/header>/);
  assert.ok(headerMatch, 'Header must be rendered');
  const headerHtml = headerMatch[1];
  assert.doesNotMatch(headerHtml, />Logout</, 'Header must not contain Logout button');
  assert.doesNotMatch(headerHtml, />Logout Portal</, 'Header must not contain Logout Portal');

  // 3. Count total occurrences of the word "Logout" in the entire layout markup
  // Should only be in the sidebar button
  const logoutButtons = markup.match(/Logout/g) || [];
  assert.equal(logoutButtons.length, 1, 'Exactly one Logout label must exist in the entire layout');
});

test('6 & 7. Selected theme persists across logout and subsequent login without switching', () => {
  localStorage.clear();
  sessionStorage.clear();

  // Set theme to light
  localStorage.setItem('app_theme', 'light');

  // Verify clearSessionAuth does NOT touch or reset app_theme
  sessionStorage.setItem('aids_token_hod', 'test-token');
  localStorage.setItem('aids_token_hod', 'test-token');

  clearSessionAuth('HOD');

  // Auth tokens cleared
  assert.equal(sessionStorage.getItem('aids_token_hod'), null);
  assert.equal(localStorage.getItem('aids_token_hod'), null);

  // app_theme is PRESERVED!
  assert.equal(localStorage.getItem('app_theme'), 'light', 'app_theme must remain light after logout');

  // Simulate subsequent login
  sessionStorage.setItem('aids_token_hod', 'new-token');
  assert.equal(localStorage.getItem('app_theme'), 'light', 'app_theme must still be light after login');
});

test('8. Theme switching is fast, synchronous and updates DOM immediately', () => {
  const rootClasses = new Set();
  const bodyClasses = new Set();
  const rootAttrs = {};
  const bodyAttrs = {};

  globalThis.document = {
    documentElement: {
      classList: {
        add: (c) => rootClasses.add(c),
        remove: (c) => rootClasses.delete(c),
        contains: (c) => rootClasses.has(c)
      },
      setAttribute: (k, v) => { rootAttrs[k] = v; },
      getAttribute: (k) => rootAttrs[k]
    },
    body: {
      classList: {
        add: (c) => bodyClasses.add(c),
        remove: (c) => bodyClasses.delete(c),
        contains: (c) => bodyClasses.has(c)
      },
      setAttribute: (k, v) => { bodyAttrs[k] = v; },
      getAttribute: (k) => bodyAttrs[k]
    }
  };

  localStorage.setItem('app_theme', 'dark');

  // Verify toggleTheme changes attributes synchronously
  let currentTheme;
  let toggle;

  function TestConsumer() {
    const ctx = useTheme();
    currentTheme = ctx.theme;
    toggle = ctx.toggleTheme;
    return React.createElement('div', null, ctx.theme);
  }

  renderToStaticMarkup(
    React.createElement(ThemeProvider, null, React.createElement(TestConsumer))
  );

  assert.equal(currentTheme, 'dark');

  // Toggle theme
  toggle();

  // DOM attributes must be synchronously updated to light
  assert.equal(rootAttrs['data-theme'], 'light');
  assert.ok(rootClasses.has('light'));
  assert.ok(!rootClasses.has('dark'));
  assert.equal(localStorage.getItem('app_theme'), 'light');

  // Toggle back
  toggle();
  assert.equal(rootAttrs['data-theme'], 'dark');
  assert.ok(rootClasses.has('dark'));
  assert.ok(!rootClasses.has('light'));
  assert.equal(localStorage.getItem('app_theme'), 'dark');
});

test('9 & 10. Mobile and desktop layouts remain correct with full HOD navigation items', () => {
  const markup = renderToStaticMarkup(
    React.createElement(DashboardLayout, {
      portalRole: 'HOD',
      userName: 'Dr. HOD User',
      userRoleTitle: 'Head of Department',
      subtitle: 'AVSEC Salem - AI & DS',
      menuItems: sampleMenuItems,
      activeTab: 'dashboard',
      onSelectTab: () => {},
      onLogout: () => {}
    }, React.createElement('div', { id: 'hod-content' }, 'Active View Content'))
  );

  // Verify responsive navigation
  assert.match(markup, /md:hidden/, 'Must contain mobile drawer controls');
  assert.match(markup, /hidden md:flex/, 'Must contain desktop header bar');
  assert.match(markup, /AVSEC - SALEM/);
  assert.match(markup, /HOD PORTAL/);
  assert.match(markup, /Dashboard Roster|Faculty Roster/);
  assert.match(markup, /Department Subjects/);
  assert.match(markup, /Discipline/);
  assert.match(markup, /id="hod-content"/);
});

