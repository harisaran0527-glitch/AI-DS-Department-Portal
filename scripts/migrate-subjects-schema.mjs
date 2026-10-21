import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('========================================================');
  console.log('  MIGRATE SUBJECTS SCHEMA: subject_abbreviation');
  console.log('========================================================\n');

  if (isDryRun) {
    console.log('🔍 [MODE]: DRY RUN (Verification only - no modifications will be applied)\n');
  } else {
    console.log('🚀 [MODE]: LIVE EXECUTION\n');
  }

  const rawConn = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.NEON_DB_URL;
  let connStr = rawConn ? rawConn.trim() : '';
  if (connStr.includes('pooler.supabase.com:5432')) {
    connStr = connStr.replace(':5432', ':6543');
  }
  const isPostgres = process.env.USE_SQLITE !== 'true' && Boolean(connStr);

  if (isPostgres) {
    const { default: pg } = await import('pg');
    const { Pool } = pg;

    const pool = new Pool({
      connectionString: connStr,
      ssl: connStr.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });

    try {
      console.log('📡 Connected to PostgreSQL database.');

      // 1. Inspect existing columns
      const colsBefore = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'subjects'
        ORDER BY ordinal_position;
      `);

      console.log('\n[Current Columns in PostgreSQL subjects table]:');
      console.table(colsBefore.rows);

      const hasAbbr = colsBefore.rows.some(c => c.column_name === 'subject_abbreviation');
      console.log(`\nColumn "subject_abbreviation" exists: ${hasAbbr ? 'YES' : 'NO'}`);

      if (!hasAbbr) {
        if (isDryRun) {
          console.log('\n[DRY RUN] Would execute: ALTER TABLE subjects ADD COLUMN IF NOT EXISTS subject_abbreviation TEXT;');
          console.log('[DRY RUN] Would execute: CREATE INDEX IF NOT EXISTS idx_subjects_code_ctx ON subjects(subject_code, year, semester, section);');
        } else {
          console.log('\nApplying migration: ALTER TABLE subjects ADD COLUMN IF NOT EXISTS subject_abbreviation TEXT;');
          await pool.query('ALTER TABLE subjects ADD COLUMN IF NOT EXISTS subject_abbreviation TEXT;');
          await pool.query('CREATE INDEX IF NOT EXISTS idx_subjects_code_ctx ON subjects(subject_code, year, semester, section);');
          console.log('✓ Migration executed successfully.');
        }
      } else {
        console.log('✓ Column "subject_abbreviation" is already present. Schema is up-to-date.');
      }

      // Inspect columns after
      const colsAfter = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'subjects'
        ORDER BY ordinal_position;
      `);
      console.log('\n[Verified Columns in PostgreSQL subjects table]:');
      console.table(colsAfter.rows);
    } finally {
      await pool.end();
    }
  } else {
    const { default: Database } = await import('better-sqlite3');
    const dbPath = process.env.SQLITE_DB_PATH || './server/data/aids_system.db';
    const sqliteDb = new Database(dbPath);

    console.log(`📁 Connected to SQLite database at ${dbPath}.`);
    const info = sqliteDb.prepare('PRAGMA table_info(subjects)').all();
    const hasAbbr = info.some(c => c.name === 'subject_abbreviation');
    console.log(`Column "subject_abbreviation" in SQLite: ${hasAbbr ? 'YES' : 'NO'}`);

    if (!hasAbbr) {
      if (isDryRun) {
        console.log('[DRY RUN] Would execute: ALTER TABLE subjects ADD COLUMN subject_abbreviation TEXT;');
      } else {
        try {
          sqliteDb.prepare('ALTER TABLE subjects ADD COLUMN subject_abbreviation TEXT;').run();
          console.log('✓ Added subject_abbreviation to SQLite subjects table.');
        } catch (e) {
          console.log('Notice on SQLite ALTER:', e.message);
        }
      }
    } else {
      console.log('✓ Column "subject_abbreviation" is already present in SQLite.');
    }
    sqliteDb.close();
  }

  console.log('\nCompleted successfully.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

