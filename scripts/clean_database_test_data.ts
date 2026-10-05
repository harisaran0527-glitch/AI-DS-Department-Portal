import { executeRun } from '../server/postgresAdapter.js';

async function clean() {
  console.log('--- Cleaning test records from database ---');
  await executeRun("DELETE FROM users WHERE role IN ('STUDENT', 'FACULTY', 'HOD')");
  await executeRun('DELETE FROM students');
  await executeRun('DELETE FROM faculty_assignments');
  await executeRun('DELETE FROM academic_records');
  await executeRun('DELETE FROM attendance_records');
  await executeRun('DELETE FROM daily_attendance_records');
  await executeRun('DELETE FROM discipline_records');
  await executeRun('DELETE FROM certificate_records');
  await executeRun('DELETE FROM participation_records');
  await executeRun('DELETE FROM leetcode_stats');
  await executeRun('DELETE FROM leetcode_proofs');
  await executeRun('DELETE FROM project_records');
  await executeRun('DELETE FROM achievement_records');
  await executeRun('DELETE FROM subjects');
  await executeRun('DELETE FROM finalized_awards');
  console.log('--- Database cleanup successful ---');
  process.exit(0);
}

clean();
