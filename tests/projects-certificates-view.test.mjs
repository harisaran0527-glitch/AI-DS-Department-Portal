import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { registerHooks } from 'node:module';
import http from 'node:http';
import Database from 'better-sqlite3';
import express from 'express';
import { isolateServer } from './helpers/isolated-server.mjs';

process.env.JWT_SECRET = 'isolated-test-projects-certificates-view-secret-key-32-chars';

const memory = new Database(':memory:');
after(() => {
  try { memory.close(); } catch {}
});

globalThis.__bootstrapAdapter = {
  sqliteDb: memory,
  sqliteReady: Promise.resolve(),
  isPostgresActive: () => false,
  queryOne: async (sql, params = []) => memory.prepare(sql).get(...params),
  queryAll: async (sql, params = []) => memory.prepare(sql).all(...params),
  executeRun: async (sql, params = []) => memory.prepare(sql).run(...params),
  executeTransaction: async (cb) => cb()
};

isolateServer(undefined, {}, { loadRealDatabase: true });
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './postgresAdapter.js') return { url: 'isolated-bootstrap:adapter', shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'isolated-bootstrap:adapter') {
      return {
        format: 'module',
        shortCircuit: true,
        source: Object.keys(globalThis.__bootstrapAdapter)
          .map(key => `export const ${key} = globalThis.__bootstrapAdapter.${key};`)
          .join('\n')
      };
    }
    return next(url, context);
  }
});

const { db, initDatabaseSchema } = await import('../server/db.ts');
const { signSessionToken } = await import('../server/services/sessionTokens.ts');
const { fetchRemoteFormBuilderBuffer, detectMimeFromBuffer } = await import('../server/storage.ts');
const { default: facultyRoutes } = await import('../server/routes/faculty.ts');
const { default: fileRoutes } = await import('../server/routes/files.ts');

await initDatabaseSchema();

// Fixtures
const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG magic header
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82
]);

const JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, // JPEG JFIF header
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0xff, 0xd9
]);

const PDF_BUFFER = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 1\n0000000000 65535 f \ntrailer<</Size 1/Root 1 0 R>>\nstartxref\n32\n%%EOF');

// Insert Test Accounts into SQLite
const users = [
  { id: 'usr-fac-a', name: 'Faculty Section A', email: 'fac_a@college.edu', role: 'FACULTY', year: '3rd Year', section: 'A' },
  { id: 'usr-fac-b', name: 'Faculty Section B', email: 'fac_b@college.edu', role: 'FACULTY', year: '3rd Year', section: 'B' },
  { id: 'usr-hod', name: 'Department HOD', email: 'hod@college.edu', role: 'HOD', year: null, section: null },
  { id: 'stu-user-1', name: 'Student One', email: 'stu1@college.edu', role: 'STUDENT', year: '3rd Year', section: 'A', identifier: '91762114001' },
  { id: 'stu-user-2', name: 'Student Two', email: 'stu2@college.edu', role: 'STUDENT', year: '3rd Year', section: 'B', identifier: '91762114002' }
];

for (const u of users) {
  memory.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, identifier, year, section, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
  `).run(u.id, u.name, u.email, 'test-password-hash', u.role, u.identifier || u.email, u.year, u.section);
}

// Insert Students
memory.prepare(`
  INSERT INTO students (id, register_no, name, email, department, year, section, batch, created_by_faculty_id)
  VALUES ('stu-user-1', '91762114001', 'Student One', 'stu1@college.edu', 'AI & DS', '3rd Year', 'A', '2023-2027', 'usr-fac-a')
`).run();

memory.prepare(`
  INSERT INTO students (id, register_no, name, email, department, year, section, batch, created_by_faculty_id)
  VALUES ('stu-user-2', '91762114002', 'Student Two', 'stu2@college.edu', 'AI & DS', '3rd Year', 'B', '2023-2027', 'usr-fac-b')
`).run();

// Express App Setup with IPC Named Pipe
const app = express();
app.use(express.json());
app.use('/api/faculty', facultyRoutes);
app.use('/api/files', fileRoutes);
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

const pipePath = `\\\\.\\pipe\\test-pvc-${Date.now()}`;
const server = app.listen(pipePath);
await new Promise(res => server.once('listening', res));
after(() => new Promise(res => server.close(res)));

function signTokenFor(userId) {
  const u = users.find(x => x.id === userId);
  return signSessionToken({
    id: u.id,
    role: u.role,
    email: u.email,
    password_hash: 'test-password-hash',
    identifier: u.identifier
  });
}

function request(path, options = {}) {
  const method = options.method || 'GET';
  const userId = options.userId;
  const headers = { ...(options.headers || {}) };
  if (userId) {
    const u = users.find(x => x.id === userId);
    headers['Authorization'] = `Bearer ${signTokenFor(userId)}`;
    headers['X-Portal-Role'] = u.role;
  }
  let postData = options.body;
  if (postData && typeof postData === 'object' && !Buffer.isBuffer(postData) && !(postData instanceof Uint8Array)) {
    postData = JSON.stringify(postData);
    headers['Content-Type'] = 'application/json';
  }

  return new Promise((resolve, reject) => {
    const req = http.request({
      socketPath: pipePath,
      path,
      method,
      headers
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(rawBuffer.toString('utf8')); } catch {}
        resolve({
          status: res.statusCode,
          headers: {
            get: (k) => res.headers[k.toLowerCase()]
          },
          buffer: rawBuffer,
          json,
          text: rawBuffer.toString('utf8')
        });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// ==========================================
// TEST SUITE: PROJECTS & CERTIFICATES PHOTO VIEW
// ==========================================

test('1. Upload certificate image -> View -> success (HTTP 200, correct MIME type)', async () => {
  const certId = 'cert-test-001';
  const attId = 'att-cert-001';

  // 1a. Insert certificate record with file_data BYTEA and attachment record
  memory.prepare(`
    INSERT INTO certificate_records (id, student_id, course_name, platform, category, issue_date, file_data, mime_type, original_file_name, file_path)
    VALUES (?, 'stu-user-1', 'Deep Learning Specialization', 'Coursera', 'Technical', '2026-05-10', ?, 'image/png', 'dl-cert.png', '/api/files/att-cert-001')
  `).run(certId, PNG_BUFFER);

  memory.prepare(`
    INSERT INTO attachments (id, student_id, record_type, record_id, original_file_name, stored_file_name, mime_type, file_size, uploaded_by_user_id, uploaded_by_role, uploaded_at, file_data)
    VALUES (?, 'stu-user-1', 'certificates', ?, 'dl-cert.png', 'dl-cert.png', 'image/png', ?, 'usr-fac-a', 'FACULTY', datetime('now'), ?)
  `).run(attId, certId, PNG_BUFFER.length, PNG_BUFFER);

  // 1b. Faculty A views certificate via faculty endpoint
  const viewRes = await request(`/api/faculty/certificates/${certId}/view`, { userId: 'usr-fac-a' });
  assert.equal(viewRes.status, 200, `Expected 200, got ${viewRes.status}: ${viewRes.text}`);
  assert.equal(viewRes.headers.get('content-type'), 'image/png');
  assert.match(viewRes.headers.get('content-disposition'), /inline/);
  assert.equal(viewRes.buffer.compare(PNG_BUFFER), 0, 'Buffer must match uploaded PNG bytes');

  // 1c. Faculty A views via general files endpoint
  const filesRes = await request(`/api/files/${attId}`, { userId: 'usr-fac-a' });
  assert.equal(filesRes.status, 200);
  assert.equal(filesRes.headers.get('content-type'), 'image/png');
  assert.equal(filesRes.buffer.compare(PNG_BUFFER), 0);

  // 1d. Resolve attachment metadata via record lookup route
  const recRes = await request('/api/files/record/stu-user-1/certificates/' + certId, { userId: 'usr-fac-a' });
  assert.equal(recRes.status, 200);
  assert.equal(recRes.json.attachment.id, attId);
  assert.equal(recRes.json.attachment.viewUrl, `/api/files/${attId}`);
});

test('2. Upload project image -> View -> success (HTTP 200, correct MIME type)', async () => {
  const projId = 'proj-test-001';
  const attId = 'att-proj-001';

  // 2a. Insert project record with product_photo_path
  memory.prepare(`
    INSERT INTO project_records (id, student_id, title, description, domain, tech_stack_json, is_team, student_role, category, status, product_photo_path)
    VALUES (?, 'stu-user-1', 'Autonomous Drone Navigation', 'AI quadcopter project', 'AI / Robotics', '["Python","ROS"]', 0, 'Lead', 'Hardware', 'Completed', '/api/files/att-proj-001')
  `).run(projId);

  // Insert attachment with JPEG file_data
  memory.prepare(`
    INSERT INTO attachments (id, student_id, record_type, record_id, original_file_name, stored_file_name, mime_type, file_size, uploaded_by_user_id, uploaded_by_role, uploaded_at, file_data)
    VALUES (?, 'stu-user-1', 'projects', ?, 'drone-photo.jpg', 'drone-photo.jpg', 'image/jpeg', ?, 'usr-fac-a', 'FACULTY', datetime('now'), ?)
  `).run(attId, projId, JPEG_BUFFER.length, JPEG_BUFFER);

  // 2b. Faculty A views project image via /api/faculty/projects/:id/view
  const viewRes = await request(`/api/faculty/projects/${projId}/view`, { userId: 'usr-fac-a' });
  assert.equal(viewRes.status, 200, `Expected 200, got ${viewRes.status}: ${viewRes.text}`);
  assert.equal(viewRes.headers.get('content-type'), 'image/jpeg');
  assert.match(viewRes.headers.get('content-disposition'), /inline/);
  assert.equal(viewRes.buffer.compare(JPEG_BUFFER), 0, 'Buffer must match uploaded JPEG bytes');

  // 2c. General /api/files/:fileId route with attachment ID
  const fileRes = await request(`/api/files/${attId}`, { userId: 'usr-fac-a' });
  assert.equal(fileRes.status, 200);
  assert.equal(fileRes.headers.get('content-type'), 'image/jpeg');

  // 2d. General /api/files/:fileId route fallback with project ID
  const fallbackRes = await request(`/api/files/${projId}`, { userId: 'usr-fac-a' });
  assert.equal(fallbackRes.status, 200);
  assert.equal(fallbackRes.headers.get('content-type'), 'image/jpeg');

  // 2e. Query record endpoint
  const recRes = await request('/api/files/record/stu-user-1/projects/' + projId, { userId: 'usr-fac-a' });
  assert.equal(recRes.status, 200);
  assert.equal(recRes.json.attachment.id, attId);
});

test('3. Refresh / update 360 profile preserves existing file_data and photo paths', async () => {
  const certId = 'cert-test-001';
  const projId = 'proj-test-001';

  // Verify before update
  const certBefore = memory.prepare('SELECT file_data, file_path, original_file_name FROM certificate_records WHERE id = ?').get(certId);
  assert.ok(certBefore.file_data, 'Certificate file_data must exist before update');
  assert.equal(certBefore.file_path, '/api/files/att-cert-001');

  const projBefore = memory.prepare('SELECT product_photo_path FROM project_records WHERE id = ?').get(projId);
  assert.equal(projBefore.product_photo_path, '/api/files/att-proj-001');

  // Simulate Student 360 profile save (which calls db.saveCertificateRecords and db.saveProjectRecords)
  await db.saveCertificateRecords('stu-user-1', [
    {
      id: certId,
      courseName: 'Deep Learning Specialization (Updated Title)',
      platform: 'Coursera',
      category: 'Technical',
      issueDate: '2026-05-10'
      // Note: user did not re-upload a file here, so existing file_data & path must be preserved!
    }
  ]);

  await db.saveProjectRecords('stu-user-1', [
    {
      id: projId,
      title: 'Autonomous Drone Navigation (Updated Title)',
      description: 'AI quadcopter project with SLAM',
      domain: 'AI / Robotics',
      techStack: ['Python', 'ROS'],
      isTeam: false,
      studentRole: 'Lead',
      category: 'Hardware',
      status: 'Completed'
      // Note: photo was not re-uploaded here, so existing product_photo_path must be preserved!
    }
  ]);

  // Verify after update: data was NOT wiped
  const certAfter = memory.prepare('SELECT course_name, file_data, file_path, original_file_name FROM certificate_records WHERE id = ?').get(certId);
  assert.equal(certAfter.course_name, 'Deep Learning Specialization (Updated Title)');
  assert.ok(certAfter.file_data, 'Certificate file_data BYTEA was preserved!');
  assert.equal(certAfter.file_path, '/api/files/att-cert-001', 'Certificate file_path was preserved!');
  assert.equal(certAfter.original_file_name, 'dl-cert.png');

  const projAfter = memory.prepare('SELECT title, product_photo_path FROM project_records WHERE id = ?').get(projId);
  assert.equal(projAfter.title, 'Autonomous Drone Navigation (Updated Title)');
  assert.equal(projAfter.product_photo_path, '/api/files/att-proj-001', 'Project product_photo_path was preserved!');

  // Calling View routes again MUST still succeed with 200
  const viewCert = await request(`/api/faculty/certificates/${certId}/view`, { userId: 'usr-fac-a' });
  assert.equal(viewCert.status, 200);
  assert.equal(viewCert.buffer.compare(PNG_BUFFER), 0);

  const viewProj = await request(`/api/faculty/projects/${projId}/view`, { userId: 'usr-fac-a' });
  assert.equal(viewProj.status, 200);
  assert.equal(viewProj.buffer.compare(JPEG_BUFFER), 0);
});

test('4. Download attachment -> success (Content-Disposition: attachment)', async () => {
  const certId = 'cert-test-001';
  const projId = 'proj-test-001';
  const attId = 'att-cert-001';

  // 4a. Certificate download
  const certDl = await request(`/api/faculty/certificates/${certId}/download`, { userId: 'usr-fac-a' });
  assert.equal(certDl.status, 200);
  assert.match(certDl.headers.get('content-disposition'), /^attachment;/);
  assert.equal(certDl.buffer.compare(PNG_BUFFER), 0);

  // 4b. Project download
  const projDl = await request(`/api/faculty/projects/${projId}/download`, { userId: 'usr-fac-a' });
  assert.equal(projDl.status, 200);
  assert.match(projDl.headers.get('content-disposition'), /^attachment;/);
  assert.equal(projDl.buffer.compare(JPEG_BUFFER), 0);

  // 4c. Files endpoint download
  const fileDl = await request(`/api/files/${attId}/download`, { userId: 'usr-fac-a' });
  assert.equal(fileDl.status, 200);
  assert.match(fileDl.headers.get('content-disposition'), /^attachment;/);
  assert.equal(fileDl.buffer.compare(PNG_BUFFER), 0);
});

test('5. Unauthorized user -> access denied (401 unauthenticated, 403 section mismatch)', async () => {
  const certId = 'cert-test-001';
  const projId = 'proj-test-001';

  // 5a. Unauthenticated -> 401
  const noAuthCert = await request(`/api/faculty/certificates/${certId}/view`);
  assert.equal(noAuthCert.status, 401);

  const noAuthProj = await request(`/api/faculty/projects/${projId}/view`);
  assert.equal(noAuthProj.status, 401);

  // 5b. Faculty B (assigned to Section B) cannot access Student 1 (Section A) -> 403
  const wrongFacultyCert = await request(`/api/faculty/certificates/${certId}/view`, { userId: 'usr-fac-b' });
  assert.equal(wrongFacultyCert.status, 403);
  assert.match(wrongFacultyCert.json.error, /permission/i);

  const wrongFacultyProj = await request(`/api/faculty/projects/${projId}/view`, { userId: 'usr-fac-b' });
  assert.equal(wrongFacultyProj.status, 403);
  assert.match(wrongFacultyProj.json.error, /permission/i);

  // 5c. Student 2 cannot access Student 1 files -> 403
  const wrongStudentCert = await request(`/api/faculty/certificates/${certId}/view`, { userId: 'stu-user-2' });
  assert.equal(wrongStudentCert.status, 403);

  // 5d. Student 1 (owner) CAN access own files -> 200
  const ownerCert = await request(`/api/faculty/certificates/${certId}/view`, { userId: 'stu-user-1' });
  assert.equal(ownerCert.status, 200);

  // 5e. HOD CAN access all students -> 200
  const hodCert = await request(`/api/faculty/certificates/${certId}/view`, { userId: 'usr-hod' });
  assert.equal(hodCert.status, 200);

  const hodProj = await request(`/api/faculty/projects/${projId}/view`, { userId: 'usr-hod' });
  assert.equal(hodProj.status, 200);
});

test('6. Missing file -> returns appropriate 404 with descriptive JSON', async () => {
  // 6a. Non-existent certificate record
  const missingCertRec = await request('/api/faculty/certificates/cert-non-existent/view', { userId: 'usr-fac-a' });
  assert.equal(missingCertRec.status, 404);
  assert.equal(missingCertRec.json.error, 'Certificate record not found.');

  // 6b. Certificate record exists but has no file content on storage
  memory.prepare(`
    INSERT INTO certificate_records (id, student_id, course_name, platform, category, issue_date)
    VALUES ('cert-empty-file', 'stu-user-1', 'Empty Cert', 'Coursera', 'Technical', '2026-01-01')
  `).run();
  const emptyCertFile = await request('/api/faculty/certificates/cert-empty-file/view', { userId: 'usr-fac-a' });
  assert.equal(emptyCertFile.status, 404);
  assert.equal(emptyCertFile.json.error, 'Certificate file content is not available on server storage.');

  // 6c. Non-existent project record
  const missingProjRec = await request('/api/faculty/projects/proj-non-existent/view', { userId: 'usr-fac-a' });
  assert.equal(missingProjRec.status, 404);
  assert.equal(missingProjRec.json.error, 'Project record not found.');

  // 6d. Project record exists but has no photo or attachment
  memory.prepare(`
    INSERT INTO project_records (id, student_id, title, description, domain, tech_stack_json, is_team, student_role, category, status)
    VALUES ('proj-empty-file', 'stu-user-1', 'Empty Project', 'No photo', 'Web', '[]', 0, 'Solo', 'Software', 'Ongoing')
  `).run();
  const emptyProjFile = await request('/api/faculty/projects/proj-empty-file/view', { userId: 'usr-fac-a' });
  assert.equal(emptyProjFile.status, 404);
  assert.equal(emptyProjFile.json.error, 'Project file content is not available on server storage.');

  // 6e. Missing file on /api/files/:id
  const missingFile = await request('/api/files/att-non-existent', { userId: 'usr-fac-a' });
  assert.equal(missingFile.status, 404);
  assert.equal(missingFile.json.error, 'Attachment not found.');
});

test('7. Storage utilities and Form Builder proxy resilience', async () => {
  // 7a. detectMimeFromBuffer
  assert.equal(detectMimeFromBuffer(PNG_BUFFER), 'image/png');
  assert.equal(detectMimeFromBuffer(JPEG_BUFFER), 'image/jpeg');
  assert.equal(detectMimeFromBuffer(PDF_BUFFER), 'application/pdf');
  assert.equal(detectMimeFromBuffer(Buffer.from('plain text')), null);

  // 7b. fetchRemoteFormBuilderBuffer for self-referential /api/files/ path
  // att-cert-001 has PNG_BUFFER in DB
  const resolved = await fetchRemoteFormBuilderBuffer('/api/files/att-cert-001');
  assert.ok(resolved, 'Should resolve local attachment without looping');
  assert.equal(resolved.contentType, 'image/png');
  assert.equal(resolved.buffer.compare(PNG_BUFFER), 0);

  // 7c. Null/empty path returns null
  assert.equal(await fetchRemoteFormBuilderBuffer(''), null);
  assert.equal(await fetchRemoteFormBuilderBuffer(null), null);
});
