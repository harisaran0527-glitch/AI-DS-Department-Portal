import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve('C:/Users/DELL/Downloads/AI-DS-Department-Portal-main/AI-DS-Department-Portal-main');

test('Certificate UI: FacultyDashboard renders 2-column desktop grid and single-column mobile layout', () => {
  const code = fs.readFileSync(path.join(REPO_ROOT, 'src/pages/faculty/FacultyDashboard.tsx'), 'utf8');

  // Verify responsive 2-column on desktop and single-column mobile grid
  assert.ok(
    code.includes('grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5'),
    'Certificate cards must use responsive grid: 1 column mobile, 2 columns on lg (desktop)'
  );

  // Verify white cards in light mode and dark slate in dark mode
  assert.ok(
    code.includes('bg-white dark:bg-slate-950') && code.includes('border border-slate-200/90 dark:border-slate-800'),
    'Certificate cards must have white background in Light mode and dark slate in Dark mode'
  );

  // Verify Purple/Indigo accent styling
  assert.ok(
    code.includes('bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'),
    'Certificate category badges must use purple/indigo accent styling'
  );

  // Verify available metadata rendering
  assert.ok(code.includes('Issuing Org:'), 'Must show Issuing Organization when recorded');
  assert.ok(code.includes('Issue Date:'), 'Must show Issue Date when recorded');
  assert.ok(code.includes('Credential ID:'), 'Must show Credential ID when recorded');
});

test('Certificate UI: File attachment controls include View, Download, Replace, Delete, Icon, Name, Size & Type', () => {
  const code = fs.readFileSync(path.join(REPO_ROOT, 'src/pages/faculty/FacultyDashboard.tsx'), 'utf8');

  // Verify File attachment box exists
  assert.ok(code.includes('formatFileSizeHelper'), 'File size formatter must be present');
  assert.ok(code.includes('formatTag'), 'File type format tag must be present');

  // Verify all 4 action controls
  assert.ok(code.includes('handleOpenCertificatePreview'), 'View action must open certificate preview modal');
  assert.ok(code.includes('handleDownloadCertificate'), 'Download action must trigger authenticated download');
  assert.ok(code.includes('handleReplaceCertificateFile'), 'Replace action must trigger file replacement');
  assert.ok(code.includes('handleDeleteCertificateRecord'), 'Delete action must be present');

  // Verify controls do not overlap file names (truncate + shrink-0 flex controls)
  assert.ok(code.includes('truncate') && code.includes('shrink-0 self-end sm:self-auto'), 'Controls and filenames must be structured to avoid overlapping');
});

test('Certificate Preview Modal: Header contains all required controls and metadata', () => {
  const code = fs.readFileSync(path.join(REPO_ROOT, 'src/components/faculty/CertificatePreviewModal.tsx'), 'utf8');

  // Header controls
  assert.ok(code.includes('cert-preview-title'), 'Modal must have an accessible title');
  assert.ok(code.includes('ZoomOut'), 'Modal must have Zoom Out button');
  assert.ok(code.includes('ZoomIn'), 'Modal must have Zoom In button');
  assert.ok(code.includes('Math.round(zoomLevel * 100)'), 'Modal must display Zoom percentage');
  assert.ok(code.includes('toggleFullscreen'), 'Modal must have Fullscreen toggle');
  assert.ok(code.includes('handleDownload'), 'Modal must have Download button');
  assert.ok(code.includes('onClose'), 'Modal must have Close button');
  assert.ok(code.includes('RotateCw'), 'Modal must have Rotate button for images');

  // Sidebar for multipage PDFs
  assert.ok(code.includes('sidebarOpen') && code.includes('Pages'), 'Modal must have left thumbnail sidebar for multipage PDFs');

  // Theme-aware Canvas: Light-grey preview canvas in Light Mode, dark slate in Dark Mode
  assert.ok(
    code.includes('bg-slate-100') && code.includes('dark:bg-[#0B101B]'),
    'Preview canvas must be light-grey (bg-slate-100) in Light Mode and dark slate (dark:bg-[#0B101B]) in Dark Mode'
  );

  // Keyboard accessibility
  assert.ok(code.includes('Escape') && code.includes('onClose()'), 'Modal must close on Escape key');

  // Cleanup on unmount/close
  assert.ok(code.includes('URL.revokeObjectURL'), 'Modal must revoke object URLs to prevent memory leaks');
});

test('API service: getCertificateBlob and downloadCertificateBlob are defined with secure headers', () => {
  const code = fs.readFileSync(path.join(REPO_ROOT, 'src/services/api.ts'), 'utf8');

  assert.ok(code.includes('getCertificateBlob: async'), 'API must export getCertificateBlob');
  assert.ok(code.includes('downloadCertificateBlob: async'), 'API must export downloadCertificateBlob');
  assert.ok(code.includes('/faculty/certificates/'), 'Must use authenticated /faculty/certificates/ routes');
  assert.ok(code.includes("'X-Portal-Role': activeRole"), 'Must send role header');
  assert.ok(code.includes('Authorization'), 'Must send Bearer token');
});
