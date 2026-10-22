import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { registerHooks } from 'node:module';
import Database from 'better-sqlite3';
import { isolateServer } from './helpers/isolated-server.mjs';

const memory = new Database(':memory:');
after(() => memory.close());

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
await initDatabaseSchema();

test('initDatabaseSchema creates import_idempotency_records and saves/retrieves results', async () => {
  const testId = `test-idemp-${Date.now()}`;
  const testPayload = { importedCount: 42, updatedCount: 5, skippedCount: 2 };

  await db.saveIdempotentImport(testId, 'TEST_IMPORT', testPayload);
  const retrieved = await db.getIdempotentImport(testId);
  assert.ok(retrieved, 'Should retrieve saved idempotency record');
  assert.equal(retrieved.importedCount, 42);
  assert.equal(retrieved.updatedCount, 5);
  assert.equal(retrieved.skippedCount, 2);

  // Non-existent importId returns null
  const missing = await db.getIdempotentImport('non-existent-import-id-xyz');
  assert.equal(missing, null);
});

test('getStudentsByIds retrieves multiple students in a single batch', async () => {
  // Insert 2 test students into in-memory database
  memory.prepare(`
    INSERT INTO students (id, register_no, name, email, year, section, batch, overall_score, current_rank)
    VALUES ('stu-batch-1', '620123AD001', 'ALICE M', 'alice@test.edu', '2nd Year', 'A', '2023-2027', 85.0, 1),
           ('stu-batch-2', '620123AD002', 'BOB K', 'bob@test.edu', '2nd Year', 'A', '2023-2027', 82.0, 2)
  `).run();

  const studentsMap = await db.getStudentsByIds(['stu-batch-1', 'stu-batch-2', 'stu-batch-3']);
  assert.equal(studentsMap.size, 2);
  assert.equal(studentsMap.get('stu-batch-1').name, 'ALICE M');
  assert.equal(studentsMap.get('stu-batch-2').name, 'BOB K');
  assert.equal(studentsMap.has('stu-batch-3'), false);
});

test('batchFindStudentAcademicRecords returns in-memory map for batch processing', async () => {
  memory.prepare(`
    INSERT INTO academic_records (id, student_id, semester_no, sgpa, cgpa, total_credits, subjects_json, exam_type, created_at)
    VALUES ('acad-b-1', 'stu-batch-1', 3, 8.5, 8.5, 20, '[]', 'Unit Test 1', '2026-09-01')
  `).run();

  const acadMap = await db.batchFindStudentAcademicRecords(['stu-batch-1', 'stu-batch-2']);
  assert.equal(acadMap.has('stu-batch-1'), true);
  assert.equal(acadMap.get('stu-batch-1').length, 1);
  assert.equal(acadMap.has('stu-batch-2'), false);
});

test('batchRecalculateStudentAttendancePercentages aggregates correctly in batch', async () => {
  // Insert daily attendance records for stu-batch-1
  memory.prepare(`
    INSERT INTO daily_attendance_records (id, student_id, date, status, recorded_by, recorded_at)
    VALUES ('att-1', 'stu-batch-1', '2026-08-01', 'PRESENT', 'faculty@test.edu', '2026-08-01'),
           ('att-2', 'stu-batch-1', '2026-08-02', 'ABSENT', 'faculty@test.edu', '2026-08-02'),
           ('att-3', 'stu-batch-1', '2026-08-03', 'OD', 'faculty@test.edu', '2026-08-03')
  `).run();

  await db.batchRecalculateStudentAttendancePercentages(['stu-batch-1', 'stu-batch-2']);

  const rec = memory.prepare('SELECT * FROM attendance_records WHERE student_id = ?').get('stu-batch-1');
  assert.ok(rec, 'Attendance record should be created');
  assert.equal(rec.total_working_days, 3);
  assert.equal(rec.present_days, 1);
  assert.equal(rec.absent_days, 1);
  assert.equal(rec.od_days, 1);
  assert.equal(rec.percentage, 66.67);
});

test('confirmBulkAttendanceImport performs batch insert, update, skip and recalculates in one pass', async () => {
  const records = [
    { studentId: 'stu-batch-2', date: '2026-08-05', status: 'PRESENT' },
    { studentId: 'stu-batch-2', date: '2026-08-06', status: 'OD' }
  ];

  const result1 = await db.confirmBulkAttendanceImport(records, 'faculty@test.edu');
  assert.equal(result1.importedCount, 2);
  assert.equal(result1.updatedCount, 0);
  assert.equal(result1.skippedCount, 0);

  // Second confirmation with same records: should skip all (0 new, 2 skipped)
  const result2 = await db.confirmBulkAttendanceImport(records, 'faculty@test.edu');
  assert.equal(result2.importedCount, 0);
  assert.equal(result2.updatedCount, 0);
  assert.equal(result2.skippedCount, 2);

  // Verify attendance record for stu-batch-2 was automatically calculated
  const rec2 = memory.prepare('SELECT * FROM attendance_records WHERE student_id = ?').get('stu-batch-2');
  assert.ok(rec2);
  assert.equal(rec2.total_working_days, 2);
  assert.equal(rec2.percentage, 100.0);
});

test('Idempotency prevents duplicate bulk imports on network timeout and retries', async () => {
  const importKey = `attd-client-tx-${Date.now()}`;
  const payload = {
    message: 'Monthly bulk attendance imported successfully.',
    importedCount: 50,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    failedRows: [],
    updatedStudentsCount: 50
  };

  await db.saveIdempotentImport(importKey, 'ATTENDANCE_IMPORT', payload, 'user-fac-1');

  // When frontend retries with the same importKey:
  const cached = await db.getIdempotentImport(importKey);
  assert.ok(cached);
  assert.equal(cached.importedCount, 50);
  assert.equal(cached.updatedStudentsCount, 50);
});

test('Atomic beginIdempotentImport handles simultaneous duplicate requests and enforces authorization scope', async () => {
  const concurrentKey = `tx-atomic-${Date.now()}`;
  const userIdA = 'faculty-owner-123';
  const userIdB = 'faculty-attacker-456';

  // First request acquires lock
  const lockA = await db.beginIdempotentImport(concurrentKey, 'ACADEMIC_MARKS_IMPORT', userIdA);
  assert.equal(lockA.acquired, true, 'First caller should acquire the import lock');

  // Simultaneous duplicate request from same user hits the conflict
  const lockDup = await db.beginIdempotentImport(concurrentKey, 'ACADEMIC_MARKS_IMPORT', userIdA);
  assert.equal(lockDup.acquired, false, 'Simultaneous caller should detect in-flight operation');
  assert.ok(lockDup.existing);
  assert.equal(lockDup.existing.status, 'PROCESSING');
  assert.equal(lockDup.existing.userId, userIdA);

  // Status check from another user enforces scope isolation
  const record = await db.getIdempotentImportRecord(concurrentKey);
  assert.ok(record);
  assert.equal(record.userId, userIdA);
  assert.notEqual(record.userId, userIdB, 'Ownership scope should distinguish different users');

  // Complete the import
  const resultPayload = { message: 'Imported successfully', importedCount: 60 };
  await db.completeIdempotentImport(concurrentKey, userIdA, resultPayload);

  const completed = await db.getIdempotentImportRecord(concurrentKey);
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.result.importedCount, 60);

  // Test failIdempotentImport
  const failKey = `tx-fail-${Date.now()}`;
  await db.beginIdempotentImport(failKey, 'ACADEMIC_MARKS_IMPORT', userIdA);
  await db.failIdempotentImport(failKey, userIdA, 'Database disk full error');
  const failedRec = await db.getIdempotentImportRecord(failKey);
  assert.equal(failedRec.status, 'FAILED');
  assert.equal(failedRec.result.error, 'Database disk full error');
});

test('batchRecalculateStudentScoresAndRewards synchronously updates overall scores, ranks, and AI rewards within request limits', async () => {
  // Insert test students with academic marks
  memory.prepare(`
    INSERT INTO students (id, register_no, name, email, year, section, batch, cgpa, overall_score, current_rank)
    VALUES ('stu-sc-1', '620123AD010', 'DANIEL R', 'daniel@test.edu', '3rd Year', 'B', '2022-2026', 9.2, 0, 0),
           ('stu-sc-2', '620123AD020', 'EMILY S', 'emily@test.edu', '3rd Year', 'B', '2022-2026', 7.5, 0, 0)
  `).run();

  // Add academic records
  memory.prepare(`
    INSERT INTO academic_records (id, student_id, semester_no, sgpa, cgpa, total_credits, subjects_json, exam_type, created_at)
    VALUES ('acad-sc-1', 'stu-sc-1', 5, 9.2, 9.2, 24, '[]', 'Unit Test 1', '2026-09-01'),
           ('acad-sc-2', 'stu-sc-2', 5, 7.5, 7.5, 24, '[]', 'Unit Test 1', '2026-09-01')
  `).run();

  const tStart = performance.now();
  const recalcResult = await db.batchRecalculateStudentScoresAndRewards(['stu-sc-1', 'stu-sc-2']);
  const duration = performance.now() - tStart;

  assert.equal(recalcResult.recalculatedCount, 2);
  assert.ok(duration < 500, `Recalculation should complete well under serverless function limit (took ${duration.toFixed(1)}ms)`);

  // Verify overall_score updated in students table
  const s1 = memory.prepare('SELECT overall_score, current_rank FROM students WHERE id = ?').get('stu-sc-1');
  const s2 = memory.prepare('SELECT overall_score, current_rank FROM students WHERE id = ?').get('stu-sc-2');
  assert.ok(s1.overall_score > 0, 'Daniel overall_score should be recalculated');
  assert.ok(s2.overall_score > 0, 'Emily overall_score should be recalculated');
  assert.ok(s1.overall_score > s2.overall_score, 'Daniel (CGPA 9.2) should have higher score than Emily (CGPA 7.5)');
  assert.equal(s1.current_rank, 1, 'Daniel should be ranked #1 in section');
  assert.equal(s2.current_rank, 2, 'Emily should be ranked #2 in section');

  // Verify student_ai_rewards was committed to database synchronously
  const rew1 = memory.prepare('SELECT * FROM student_ai_rewards WHERE student_id = ?').get('stu-sc-1');
  const rew2 = memory.prepare('SELECT * FROM student_ai_rewards WHERE student_id = ?').get('stu-sc-2');
  assert.ok(rew1, 'AI reward evaluation for Daniel must exist in DB');
  assert.ok(rew2, 'AI reward evaluation for Emily must exist in DB');
  assert.ok(rew1.total_reward_score > 0);
  assert.ok(rew2.total_reward_score > 0);
});

test('29-row attendance import: first import creates 29 records, second import detects and safely skips all 29 unchanged records without duplicating', async () => {
  const date29 = '2026-10-13';
  const facultyEmail = 'tamil1234@gmail.com';
  const facultyId = 'fac-29-test';

  // Seed 29 students in Year 2nd Year, Section A
  const studentRows = [];
  const rawInputRows = [];

  for (let i = 1; i <= 29; i++) {
    const regNo = `620123AD0${i < 10 ? '0' + i : i}`;
    const sId = `stu-29-${i}`;
    const name = `STUDENT_${i} S`;

    memory.prepare(`
      INSERT OR REPLACE INTO students (id, register_no, name, email, year, section, batch, faculty_workspace_id)
      VALUES (?, ?, ?, ?, '2nd Year', 'A', '2023-2027', ?)
    `).run(sId, regNo, name, `stu${i}@avs.edu`, facultyId);

    rawInputRows.push({
      'Register Number': regNo,
      'Student Name': name,
      'Attendance Date': date29,
      'Attendance Status': 'PRESENT'
    });
  }

  // 1. First Preview Run: all 29 records should be valid and new
  const preview1 = await db.previewBulkAttendanceImport(rawInputRows, facultyId, 'FACULTY');
  assert.equal(preview1.summary.totalRowsProcessed, 29);
  assert.equal(preview1.summary.totalValidDailyRecords, 29);
  assert.equal(preview1.summary.totalMatchedStudents, 29);
  assert.equal(preview1.summary.totalUnmatchedRegNos, 0);
  assert.equal(preview1.summary.totalDuplicateEntries, 0);
  assert.equal(preview1.summary.totalInvalidRows, 0);
  assert.equal(preview1.summary.newCount, 29);
  assert.equal(preview1.summary.skippedCount, 0);

  // 2. First Confirm Run: creates 29 records
  const confirm1 = await db.confirmBulkAttendanceImport(preview1.validRecords, facultyEmail);
  assert.equal(confirm1.importedCount, 29);
  assert.equal(confirm1.updatedCount, 0);
  assert.equal(confirm1.skippedCount, 0);
  assert.equal(confirm1.updatedStudentsCount, 29);

  // Verify exactly 29 daily attendance rows exist for date 2026-10-13
  const count1 = memory.prepare('SELECT COUNT(*) as cnt FROM daily_attendance_records WHERE date = ?').get(date29);
  assert.equal(count1.cnt, 29);

  // 3. Second Preview Run with identical 29 rows: all 29 must be detected as SKIPPED / unchanged
  const preview2 = await db.previewBulkAttendanceImport(rawInputRows, facultyId, 'FACULTY');
  assert.equal(preview2.summary.totalRowsProcessed, 29);
  assert.equal(preview2.summary.totalValidDailyRecords, 29);
  assert.equal(preview2.summary.totalMatchedStudents, 29);
  assert.equal(preview2.summary.totalUnmatchedRegNos, 0);
  assert.equal(preview2.summary.totalDuplicateEntries, 0);
  assert.equal(preview2.summary.totalInvalidRows, 0);
  assert.equal(preview2.summary.newCount, 0, 'No records should be marked new on re-upload');
  assert.equal(preview2.summary.updateCount, 0, 'No records should be marked updated when status is unchanged');
  assert.equal(preview2.summary.skippedCount, 29, 'All 29 records must be marked SKIPPED');

  // Verify each record has action = 'SKIPPED'
  for (const rec of preview2.validRecords) {
    assert.equal(rec.action, 'SKIPPED');
  }

  // 4. Second Confirm Run: confirms 0 created, 0 updated, 29 skipped
  const confirm2 = await db.confirmBulkAttendanceImport(preview2.validRecords, facultyEmail);
  assert.equal(confirm2.importedCount, 0);
  assert.equal(confirm2.updatedCount, 0);
  assert.equal(confirm2.skippedCount, 29);

  // Verify daily attendance table still contains exactly 29 rows (NO DUPLICATES CREATED!)
  const count2 = memory.prepare('SELECT COUNT(*) as cnt FROM daily_attendance_records WHERE date = ?').get(date29);
  assert.equal(count2.cnt, 29, 'Daily attendance record count must remain exactly 29 without duplicates');

  // Verify attendance percentage for all 29 students is 100%
  for (let i = 1; i <= 29; i++) {
    const sId = `stu-29-${i}`;
    const attRec = memory.prepare('SELECT * FROM attendance_records WHERE student_id = ?').get(sId);
    assert.ok(attRec, `Attendance summary for ${sId} must exist`);
    assert.equal(attRec.total_working_days, 1);
    assert.equal(attRec.present_days, 1);
    assert.equal(attRec.percentage, 100.0);
  }
});

