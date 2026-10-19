import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const INDEX_STATEMENTS = [
  // User Authentication & Identifiers
  'CREATE INDEX IF NOT EXISTS idx_users_lower_email ON users (LOWER(email));',
  'CREATE INDEX IF NOT EXISTS idx_users_lower_identifier ON users (LOWER(identifier));',
  'CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);',

  // Student lookups & filters
  'CREATE INDEX IF NOT EXISTS idx_students_created_by ON students (created_by_faculty_id);',
  'CREATE INDEX IF NOT EXISTS idx_students_workspace ON students (faculty_workspace_id);',
  'CREATE INDEX IF NOT EXISTS idx_students_reg_no ON students (register_no);',
  'CREATE INDEX IF NOT EXISTS idx_students_year_sec ON students (year, section);',

  // Faculty Assignments
  'CREATE INDEX IF NOT EXISTS idx_faculty_assignments_fid ON faculty_assignments (faculty_id, is_active);',

  // Student 360 sub-tables (queried by student_id)
  'CREATE INDEX IF NOT EXISTS idx_academic_records_student_id ON academic_records (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_arrear_history_student_id ON arrear_history (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_skilledge_records_student_id ON skilledge_records (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_skilledge_sync_hist_student_id ON skilledge_sync_history (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_nptel_records_student_id ON nptel_records (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON attendance_records (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_discipline_records_student_id ON discipline_records (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_certificate_records_student_id ON certificate_records (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_participation_records_student_id ON participation_records (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_leetcode_stats_student_id ON leetcode_stats (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_connected_accounts_student_id ON connected_accounts (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_project_records_student_id ON project_records (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_achievement_records_student_id ON achievement_records (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_nptel_proofs_student_id ON nptel_proofs (student_id);',
  'CREATE INDEX IF NOT EXISTS idx_leetcode_proofs_student_id ON leetcode_proofs (student_id);',

  // Subjects
  'CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects (subject_code);',
  'CREATE INDEX IF NOT EXISTS idx_subjects_year_sem_sec ON subjects (year, semester, section);',

  // Audit Logs
  'CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC);'
];

async function applyIndexes() {
  console.log('Connecting to PostgreSQL database to apply performance indexes...');
  const client = await pool.connect();
  try {
    let createdCount = 0;
    for (const sql of INDEX_STATEMENTS) {
      const start = performance.now();
      await client.query(sql);
      const elapsed = (performance.now() - start).toFixed(1);
      const indexName = sql.match(/INDEX IF NOT EXISTS (\w+)/)?.[1] || 'index';
      console.log(`  ✓ Applied: ${indexName} (${elapsed}ms)`);
      createdCount++;
    }
    console.log(`\n🎉 Successfully ensured ${createdCount} performance indexes on PostgreSQL database.`);
  } catch (err: any) {
    console.error('❌ Error applying indexes:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

applyIndexes();

