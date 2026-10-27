import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import integrationRouter from '../server/routes/integration.ts';

// Test secret for isolated tests (>= 32 chars)
const TEST_INTEGRATION_KEY = 'test-hod-integration-secret-key-at-least-32-chars-long';
process.env.HOD_INTEGRATION_KEY = TEST_INTEGRATION_KEY;

// Synthetic in-memory database
const syntheticStudent = {
  id: 'stu-synthetic-001',
  register_no: '91762114001',
  name: 'Synthetic Student A',
  email: 'synthetic.a@example.invalid',
  department: 'AI & DS',
  year: '3rd Year',
  section: 'A',
  batch: '2023-2027',
  overall_score: 50.0,
  current_rank: 1
};

const syntheticStudentB = {
  id: 'stu-synthetic-002',
  register_no: '91762114002',
  name: 'Synthetic Student B',
  email: 'synthetic.b@example.invalid',
  department: 'AI & DS',
  year: '3rd Year',
  section: 'A',
  batch: '2023-2027',
  overall_score: 45.0,
  current_rank: 2
};

const students = [syntheticStudent, syntheticStudentB];
const certificateRecords = [];
const projectRecords = [];
const attachments = [];
const auditLogs = [];

// Setup express app with integration router
const app = express();
app.use(express.json());
app.use('/api/integration', integrationRouter);

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const body = options.body ? JSON.stringify(options.body) : undefined;

  return new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = server.address().port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers,
          body
        });
        const json = await res.json().catch(() => null);
        server.close(() => resolve({ status: res.status, json }));
      } catch (err) {
        server.close(() => resolve({ status: 500, error: err }));
      }
    });
  });
}

test('HOD Integration API: Authentication Enforcement', async () => {
  // 1. Missing Authorization header -> 401
  const res1 = await request('/api/integration/health');
  assert.equal(res1.status, 401);

  // 2. Wrong Bearer token -> 401
  const res2 = await request('/api/integration/health', {
    headers: { Authorization: 'Bearer wrong-key-that-does-not-match' }
  });
  assert.equal(res2.status, 401);

  // 3. Valid Bearer token -> 200
  const res3 = await request('/api/integration/health', {
    headers: { Authorization: `Bearer ${TEST_INTEGRATION_KEY}` }
  });
  assert.equal(res3.status, 200);
  assert.equal(res3.json.status, 'ok');
});

test('HOD Integration API: Strict Template Whitelist Enforcement', async () => {
  const res = await request('/api/integration/sync-submission', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TEST_INTEGRATION_KEY}` },
    body: {
      submissionId: 'sub-test-custom',
      templateKey: 'CUSTOM_FEEDBACK_FORM',
      registerNo: '91762114001',
      record: {}
    }
  });

  assert.equal(res.status, 400);
  assert.ok(res.json.error.includes('Only DEFAULT_CERTIFICATE and DEFAULT_PROJECT are permitted'));
});

test('HOD Integration API: Missing or Blank Register Number Rejection', async () => {
  const res = await request('/api/integration/sync-submission', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TEST_INTEGRATION_KEY}` },
    body: {
      submissionId: 'sub-test-blank',
      templateKey: 'DEFAULT_CERTIFICATE',
      registerNo: '   ',
      record: {}
    }
  });

  assert.equal(res.status, 400);
  assert.equal(res.json.status, 'NEEDS_REVIEW');
  assert.ok(res.json.error.includes('Missing required student register number'));
});

test('HOD Integration API: Unknown Register Number Transitions to NEEDS_REVIEW (Never Mismatched)', async () => {
  const res = await request('/api/integration/sync-submission', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TEST_INTEGRATION_KEY}` },
    body: {
      submissionId: 'sub-test-unknown',
      templateKey: 'DEFAULT_CERTIFICATE',
      registerNo: 'UNKNOWN_99999999',
      record: {
        courseName: 'Test Course',
        platform: 'Coursera'
      }
    }
  });

  assert.equal(res.status, 404);
  assert.equal(res.json.status, 'NEEDS_REVIEW');
  assert.ok(res.json.error.includes('UNKNOWN_99999999'));
});

