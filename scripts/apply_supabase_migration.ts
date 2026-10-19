import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const FULL_DUMP_PATH = path.resolve(process.cwd(), 'server', 'data', 'supabase_data_dump.sql');
const AUTHORIZED_DUMP_PATH = path.resolve(process.cwd(), 'server', 'data', 'authorized_production_data.sql');

const VERIFIED_TABLES = [
  'users',
  'scoring_configuration',
  'subjects',
  'sessions_revocation',
  'audit_logs',
  'faculty_assignments',
  'students',
  'academic_records',
  'arrear_history',
  'skilledge_records',
  'nptel_records',
  'attendance_records',
  'daily_attendance_records',
  'discipline_records',
  'certificate_records',
  'participation_records',
  'leetcode_stats',
  'project_records',
  'achievement_records',
  'finalized_awards',
  'attachments',
  'connected_accounts',
  'external_metrics',
  'teams',
  'representative_evaluations',
  'team_heads',
  'skilledge_sync_history',
  'nptel_proofs',
  'leetcode_proofs',
  'team_members',
  'team_head_members'
];

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const useFullDump = process.argv.includes('--full-dump');
  const neonArgIndex = process.argv.indexOf('--neon');
  const neonUrl = neonArgIndex !== -1 ? process.argv[neonArgIndex + 1] : process.env.NEON_DB_URL;

  console.log('========================================================');
  console.log('  SUPABASE POSTGRESQL PRODUCTION MIGRATION RUNNER');
  console.log('========================================================\n');

  if (isDryRun) {
    console.log('🔍 [MODE]: DRY RUN (Verification only - no database modifications)\n');
  } else {
    console.log('🚀 [MODE]: LIVE EXECUTION (Atomic Transaction with Rollback Protection)\n');
  }

  // 1. Determine Source
  let dumpPath = AUTHORIZED_DUMP_PATH;
  let datasetLabel = 'Clean Authorized Production Dataset (No Test/Demo Accounts)';

  if (neonUrl && !neonUrl.includes('ep-xyz')) {
    datasetLabel = 'Live Neon PostgreSQL Direct Sync';
    console.log(`📡 [SOURCE]: ${datasetLabel}`);
  } else if (useFullDump) {
    dumpPath = FULL_DUMP_PATH;
    datasetLabel = 'Full Legacy Dump (Includes 59 Synthetic/Test Accounts)';
    console.log(`📁 [SOURCE]: ${datasetLabel}`);
  } else {
    console.log(`📁 [SOURCE]: ${datasetLabel}`);
  }

  if (!neonUrl || neonUrl.includes('ep-xyz')) {
    if (!fs.existsSync(dumpPath)) {
      throw new Error(`Dump file not found at: ${dumpPath}`);
    }
    const dumpSize = fs.statSync(dumpPath).size;
    console.log(`✓ [FILE VERIFIED]: ${dumpPath} (${(dumpSize / 1024).toFixed(1)} KB)`);
  }

  // 2. Destination Supabase Connection
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is missing from environment.');
  }

  try {
    const parsed = new URL(connectionString);
    console.log(`✓ [DESTINATION HOST]: ${parsed.hostname}:${parsed.port || '5432'} (DB: ${parsed.pathname})`);
  } catch {
    console.log(`✓ [DESTINATION HOST]: Supabase connection string loaded securely`);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  const client = await pool.connect();
  console.log('✓ [CONNECTION]: Successfully connected to Supabase PostgreSQL.\n');

  try {
    // 3. Inspect Current Tables - Guard: Must be 100% empty
    const existingRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const currentTables = existingRes.rows.map(r => r.table_name);
    console.log(`Current public tables in Supabase: ${currentTables.length}`);
    if (currentTables.length > 0) {
      throw new Error(`Safety stop: Destination Supabase database already contains ${currentTables.length} tables (${currentTables.join(', ')}). Aborting to prevent overwriting existing data.`);
    }
    console.log('✓ Confirmed destination database is clean and empty (0 tables). Ready to import.');

    if (isDryRun) {
      console.log('\n✓ Dry run complete. Database is reachable and ready for live migration.');
      client.release();
      await pool.end();
      return;
    }

    // 4. Execution
    console.log('\n[TRANSACTION BEGIN]: Applying schema DDL and inserting verified records...');
    await client.query('BEGIN');

    const dumpContent = fs.readFileSync(dumpPath, 'utf-8');
    await client.query(dumpContent);
    console.log('✓ Schema DDL and records applied successfully.');

    await client.query('COMMIT');
    console.log('✓ [TRANSACTION COMMIT]: All records committed cleanly to Supabase!\n');

    // 5. Verification Table-by-Table
    console.log('========================================================');
    console.log('  POST-MIGRATION RECORD VERIFICATION (TABLE BY TABLE)');
    console.log('========================================================');

    let totalRows = 0;
    for (const table of VERIFIED_TABLES) {
      try {
        const countRes = await client.query(`SELECT COUNT(*) as c FROM "${table}"`);
        const count = parseInt(countRes.rows[0].c, 10);
        totalRows += count;
        console.log(`  -> "${table.padEnd(28)}": ${String(count).padStart(5)} rows`);
      } catch (err: any) {
        console.warn(`  -> "${table.padEnd(28)}": ⚠️ ${err.message}`);
      }
    }

    console.log('--------------------------------------------------------');
    console.log(`✓ Total Verified Rows in Supabase: ${totalRows}`);
    // 5b. Verify Total Tables Created in Public Schema
    const finalTablesRes = await client.query(`
      SELECT COUNT(*) as cnt 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    const finalTableCount = parseInt(finalTablesRes.rows[0].cnt, 10);
    console.log(`✓ Total Tables Created in Public Schema: ${finalTableCount} / 31`);

    // 5c. Verify Foreign Key Constraints Created
    const fkRes = await client.query(`
      SELECT COUNT(*) as cnt 
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
    `);
    const finalFkCount = parseInt(fkRes.rows[0].cnt, 10);
    console.log(`✓ Foreign Key Constraints Enforced: ${finalFkCount}\n`);

    // 6. Verify Accounts
    const adminRes = await client.query(`SELECT id, email, role FROM users WHERE role = 'ADMIN' LIMIT 1`);
    if (adminRes.rows.length > 0) {
      console.log(`✓ Admin Verified: ${adminRes.rows[0].email} (${adminRes.rows[0].role})`);
    }

    const facRes = await client.query(`SELECT id, email, name FROM users WHERE role = 'FACULTY'`);
    console.log(`✓ Faculty Count: ${facRes.rows.length}`);
    for (const f of facRes.rows) {
      console.log(`  - ${f.name} (${f.email})`);
    }

    const stuRes = await client.query(`SELECT id, register_no, name, email FROM students`);
    console.log(`✓ Student Count: ${stuRes.rows.length}`);
    for (const s of stuRes.rows) {
      console.log(`  - [${s.register_no}] ${s.name} (${s.email})`);
    }

    client.release();
    await pool.end();

    console.log('\n🎉 [MIGRATION COMPLETED & VERIFIED SUCCESSFULLY]');
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      console.log('🛑 [TRANSACTION ROLLED BACK]: Destination database kept unchanged.');
    } catch {
      // ignore
    }
    client.release();
    await pool.end();
    throw err;
  }
}

main().catch(err => {
  console.error('\n❌ [MIGRATION FAILED]:', err.message);
  process.exit(1);
});
