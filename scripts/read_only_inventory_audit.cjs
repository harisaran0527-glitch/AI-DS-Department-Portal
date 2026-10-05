require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('====================================================');
    console.log('LIVE POSTGRESQL PRODUCTION DATABASE INVENTORY AUDIT');
    console.log('====================================================\n');

    const tables = [
      'users',
      'students',
      'subjects',
      'faculty_assignments',
      'attendance_records',
      'academic_records',
      'certificate_records',
      'discipline_records',
      'project_records',
      'achievement_records',
      'participation_records',
      'audit_logs',
      'scoring_configuration',
      'finalized_awards',
      'connected_accounts',
      'external_metrics',
      'teams',
      'skilledge_sync_logs',
      'nptel_proofs',
      'leetcode_proofs',
      'student_ai_rewards',
      'bulk_import_audits'
    ];

    const counts = {};
    for (const t of tables) {
      try {
        const r = await client.query(`SELECT count(*) FROM ${t}`);
        counts[t] = parseInt(r.rows[0].count, 10);
        console.log(`${t.padEnd(25)} : ${counts[t]}`);
      } catch (err) {
        counts[t] = 'ERROR/ABSENT';
        console.log(`${t.padEnd(25)} : [TABLE NOT FOUND / ERROR]`);
      }
    }

    console.log('\n--- VERIFIED USERS IN DATABASE ---');
    const users = await client.query('SELECT id, name, email, role, identifier, created_at FROM users');
    console.log(JSON.stringify(users.rows, null, 2));

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Audit Error:', err);
  process.exit(1);
});
