import { queryAll, queryOne } from '../server/postgresAdapter.js';

async function checkDatabaseInventory() {
  console.log('--- DATABASE INVENTORY CHECK ---');
  const tables = [
    'users',
    'students',
    'faculty_assignments',
    'academic_records',
    'attendance_records',
    'daily_attendance_records',
    'discipline_records',
    'certificate_records',
    'participation_records',
    'leetcode_stats',
    'project_records',
    'achievement_records',
    'subjects',
    'finalized_awards'
  ];

  for (const table of tables) {
    try {
      const res = await queryOne<{ cnt: string | number }>(`SELECT COUNT(*) as cnt FROM ${table}`);
      console.log(`Table '${table}': ${res?.cnt || 0} rows`);
    } catch (err: any) {
      console.log(`Table '${table}': table or error (${err.message})`);
    }
  }
}

checkDatabaseInventory();
