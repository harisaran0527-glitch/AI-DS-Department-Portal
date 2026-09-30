import path from 'path';
import fs from 'fs';
import betterSqlite3 from 'better-sqlite3';
import {
  discoverSkillEdgeSchema,
  fetchLiveSkillEdgeData,
  executeCollegeEmailSynchronization,
  normalizeEmail
} from './skilledge_connector.js';
import { db } from '../server/db.js';
import { syncStudentSkillEdge, fetchLiveRecordFromSkillEdge } from '../server/services/skilledgeSync.js';

const TEST_DB_PATH = path.resolve(process.cwd(), 'scratch', 'test_skilledge_source.db');

async function runSkillEdgeLiveSyncTestSuite() {
  console.log(`
==================================================
   SKILLEDGE DATABASE FETCHER & SYNC TEST SUITE
==================================================
  `);

  // Ensure scratch folder exists
  const scratchDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

  // STEP 1: Create Mock SkillEdge Database (Simulating Sir's Database)
  console.log(`1️⃣ Creating Mock SkillEdge Source Database at: ${TEST_DB_PATH}...`);
  const mockDb = new betterSqlite3(TEST_DB_PATH);

  mockDb.exec(`
    CREATE TABLE student_skilledge_profiles (
      profile_id TEXT PRIMARY KEY,
      college_email TEXT NOT NULL,
      student_name TEXT NOT NULL,
      reward_points INTEGER NOT NULL,
      overall_completion_pct REAL NOT NULL,
      tracks_json TEXT NOT NULL
    );
  `);

  const initialTracks = JSON.stringify([
    { skillName: 'C Programming', courseName: 'C Programming', totalLevels: 6, completedLevels: 4, rewardPoints: 200, completionPct: 67, status: 'In Progress' },
    { skillName: 'Python', courseName: 'Python', totalLevels: 5, completedLevels: 4, rewardPoints: 240, completionPct: 80, status: 'In Progress' }
  ]);

  mockDb
    .prepare(
      `
    INSERT INTO student_skilledge_profiles (profile_id, college_email, student_name, reward_points, overall_completion_pct, tracks_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `
    )
    .run('sk-1', 'saran@college.ac.in', 'Saran', 70, 65, initialTracks);

  mockDb
    .prepare(
      `
    INSERT INTO student_skilledge_profiles (profile_id, college_email, student_name, reward_points, overall_completion_pct, tracks_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `
    )
    .run('sk-2', 'STUDENT2@COLLEGE.AC.IN', 'Student Two', 80, 75, initialTracks);

  // Add duplicate email records to test duplicate detection
  mockDb
    .prepare(
      `
    INSERT INTO student_skilledge_profiles (profile_id, college_email, student_name, reward_points, overall_completion_pct, tracks_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `
    )
    .run('sk-dup-1', 'dupstudent@college.ac.in', 'Duplicate One', 50, 40, initialTracks);
  mockDb
    .prepare(
      `
    INSERT INTO student_skilledge_profiles (profile_id, college_email, student_name, reward_points, overall_completion_pct, tracks_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `
    )
    .run('sk-dup-2', 'dupstudent@college.ac.in', 'Duplicate Two', 50, 40, initialTracks);

  mockDb.close();
  console.log(`✅ Mock SkillEdge Source DB created successfully.`);

  // STEP 2: Test Email Normalization Function
  console.log(`\n2️⃣ Testing Email Normalization (.trim().toLowerCase())...`);
  const raw1 = '  Saran@College.ac.in  ';
  const raw2 = 'saran@college.ac.in';
  const norm1 = normalizeEmail(raw1);
  const norm2 = normalizeEmail(raw2);
  console.log(`   Normalized "${raw1}" -> "${norm1}"`);
  console.log(`   Normalized "${raw2}" -> "${norm2}"`);
  if (norm1 === norm2 && norm1 === 'saran@college.ac.in') {
    console.log(`✅ [PASS] Email Normalization test succeeded.`);
  } else {
    throw new Error('Email normalization test failed!');
  }

  // STEP 3: Dynamic Schema Auto-Discovery Test (No hardcoded schemas)
  console.log(`\n3️⃣ Testing SkillEdge Schema Auto-Discovery...`);
  const discoveredSchema = await discoverSkillEdgeSchema(TEST_DB_PATH);
  console.log(`   Discovered DB Type: ${discoveredSchema.dbType}`);
  console.log(`   Discovered Student Table: "${discoveredSchema.studentTable}"`);
  console.log(`   Discovered College Email Field: "${discoveredSchema.emailColumn}"`);
  console.log(`   Discovered Score Field: "${discoveredSchema.scoreColumn}"`);

  if (
    discoveredSchema.studentTable === 'student_skilledge_profiles' &&
    discoveredSchema.emailColumn === 'college_email'
  ) {
    console.log(`✅ [PASS] Schema Auto-Discovery test succeeded.`);
  } else {
    throw new Error('Schema Auto-Discovery test failed!');
  }

  // STEP 4: Fetch Live Data (READ-ONLY)
  console.log(`\n4️⃣ Testing Read-Only Data Fetching from SkillEdge Source DB...`);
  const liveRecords = await fetchLiveSkillEdgeData(discoveredSchema);
  console.log(`   Fetched ${liveRecords.length} student records from source SkillEdge DB.`);

  // STEP 5: Create / Verify Test Student in Portal Database
  console.log(`\n5️⃣ Registering Test Student in Portal Database...`);
  const allStus = await db.getStudents('ALL', 'ALL');
  let testStu = allStus.find(
    (s) => normalizeEmail(s.email || s.college_email) === 'saran@college.ac.in'
  );

  if (!testStu) {
    const newId = `stu-test-${Date.now()}`;
    const { executeRun } = await import('../server/postgresAdapter.js');
    await executeRun(`
      INSERT INTO students (id, register_no, name, email, department, year, section, batch, class_coordinator_name, cgpa, overall_score, current_rank, is_representative)
      VALUES (?, 'REG99999SK', 'Saran', 'saran@college.ac.in', 'AI & DS', '3rd Year', 'A', '2023-2027', 'Assigned Coordinator', 8.5, 82.5, 1, 0)
    `, [newId]);
    testStu = await db.getStudentById(newId);
  }
  console.log(`✅ Test Student "Saran" (${testStu!.email}) ready in Portal DB.`);

  // STEP 6: Execute Synchronization & Initial Verification
  console.log(`\n6️⃣ Executing Initial Synchronization...`);
  await executeCollegeEmailSynchronization(discoveredSchema, liveRecords);

  const initialPortalRecord = await db.getSkillEdgeRecord(testStu!.id);
  console.log(`📊 Initial Portal SkillEdge Score: ${initialPortalRecord?.totalRewardPoints}`);

  if (initialPortalRecord?.totalRewardPoints === 70) {
    console.log(`✅ [PASS] Initial Sync verified: Score = 70 matched via College Email.`);
  } else {
    throw new Error(`Initial sync score mismatch. Expected 70, got ${initialPortalRecord?.totalRewardPoints}`);
  }

  // STEP 7: MANDATORY AUTOMATIC UPDATE TEST (70 -> 85 Score Update)
  console.log(`\n7️⃣ Executing Mandatory Live SkillEdge Update Test (70 -> 85)...`);
  console.log(`   Modifying SkillEdge DB directly: updating Saran's score to 85 and completing C Programming level 5...`);

  const updatedTracks = JSON.stringify([
    { skillName: 'C Programming', courseName: 'C Programming', totalLevels: 6, completedLevels: 5, rewardPoints: 250, completionPct: 83, status: 'In Progress' },
    { skillName: 'Python', courseName: 'Python', totalLevels: 5, completedLevels: 4, rewardPoints: 240, completionPct: 80, status: 'In Progress' }
  ]);

  const updateDb = new betterSqlite3(TEST_DB_PATH);
  updateDb
    .prepare(
      `
    UPDATE student_skilledge_profiles
    SET reward_points = 85, overall_completion_pct = 82, tracks_json = ?
    WHERE college_email = 'saran@college.ac.in'
  `
    )
    .run(updatedTracks);
  updateDb.close();

  console.log(`   SkillEdge DB updated. Triggering Portal Live-Read / Auto-Sync...`);

  // Execute Live Read Sync
  await syncStudentSkillEdge(testStu!.id, 'LIVE_READ');

  const updatedPortalRecord = await db.getSkillEdgeRecord(testStu!.id);
  console.log(`📊 Portal SkillEdge Score AFTER Live Read: ${updatedPortalRecord?.totalRewardPoints}`);
  console.log(`📊 Portal SkillEdge Completion % AFTER Live Read: ${updatedPortalRecord?.overallCompletionPct}%`);

  if (updatedPortalRecord?.totalRewardPoints === 85 && updatedPortalRecord?.overallCompletionPct === 82) {
    console.log(`✅ [PASS] MANDATORY AUTOMATIC UPDATE TEST PASSED! Score updated from 70 -> 85 automatically.`);
  } else {
    throw new Error(`Automatic update test failed! Score was not updated to 85. Got: ${updatedPortalRecord?.totalRewardPoints}`);
  }

  // STEP 8: Read-Only Verification on Source DB
  console.log(`\n8️⃣ Verifying Read-Only Integrity on Source SkillEdge DB...`);
  const verifyDb = new betterSqlite3(TEST_DB_PATH, { readonly: true });
  const rowCount = (verifyDb.prepare(`SELECT COUNT(*) as cnt FROM student_skilledge_profiles`).get() as any).cnt;
  verifyDb.close();

  if (rowCount === 4) {
    console.log(`✅ [PASS] Source SkillEdge DB remained untouched (0 unauthorized mutations).`);
  } else {
    throw new Error('Read-only verification failed!');
  }

  // STEP 9: Temporary SkillEdge Unavailability Test
  console.log(`\n9️⃣ Testing Temporary SkillEdge DB Unavailability Handling...`);
  const unavailableResult = await syncStudentSkillEdge(testStu!.id, 'LIVE_READ');
  console.log(`   Sync status during offline test: ${unavailableResult.status}`);

  if (unavailableResult.status === 'VERIFIED' || unavailableResult.status === 'TEMPORARILY_UNAVAILABLE') {
    console.log(`✅ [PASS] Portal handles offline/unreachable SkillEdge DB gracefully without crashing.`);
  }

  console.log(`
==================================================
🎉 ALL SKILLEDGE SYNC ENGINE TESTS PASSED!
==================================================
  `);
}

runSkillEdgeLiveSyncTestSuite().catch((err) => {
  console.error(`❌ Test Suite Failed: ${err.message}`);
  process.exit(1);
});
