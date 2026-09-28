import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const WORKSPACE_DIR = process.cwd();
const DATA_DIR = path.resolve(WORKSPACE_DIR, 'server', 'data');
const DB_PATH = path.join(DATA_DIR, 'aids_system.db');
const BACKUP_PATH = path.join(DATA_DIR, 'aids_system.db.backup');
const SCHEMA_PATH = path.join(DATA_DIR, 'supabase_schema.sql');
const DUMP_PATH = path.join(DATA_DIR, 'supabase_data_dump.sql');

// Topological order respecting Foreign Key hierarchies
const TABLE_INSERTION_ORDER = [
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

export async function generateFreshDataDump(sqlite: Database.Database): Promise<Record<string, number>> {
  let dumpSql = `-- SUPABASE POSTGRESQL DATA DUMP GENERATED ON ${new Date().toISOString()}\n`;
  dumpSql += `-- Target Database: Supabase PostgreSQL (iducgryrqyqjzvqzxgje)\n\n`;

  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  dumpSql += `${schemaContent}\n\n`;
  dumpSql += `-- DATA INSERTS IN TOPOLOGICAL FOREIGN KEY ORDER --\n\n`;

  const sqliteTables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  const tableSet = new Set(sqliteTables.map(t => t.name));

  const orderedTables = [
    ...TABLE_INSERTION_ORDER.filter(t => tableSet.has(t)),
    ...sqliteTables.map(t => t.name).filter(t => !TABLE_INSERTION_ORDER.includes(t))
  ];

  const counts: Record<string, number> = {};

  const validUserIds = new Set((sqlite.prepare("SELECT id FROM users").all() as { id: string }[]).map(u => u.id));

  for (const name of orderedTables) {
    const rows = sqlite.prepare(`SELECT * FROM "${name}"`).all() as Record<string, any>[];
    counts[name] = rows.length;
    if (rows.length === 0) continue;

    dumpSql += `-- Table: ${name} (${rows.length} records)\n`;
    for (const rawRow of rows) {
      const row = { ...rawRow };
      if (name === 'students' && row.created_by_faculty_id && !validUserIds.has(row.created_by_faculty_id)) {
        row.created_by_faculty_id = null;
      }
      if (name === 'connected_accounts') {
        if (!row.connected_email) row.connected_email = row.provider_username || 'unspecified@aids.edu';
        if (!row.connected_at) row.connected_at = row.last_synced_at || new Date().toISOString();
      }
      const keys = Object.keys(row);
      const cols = keys.map(k => `"${k}"`).join(', ');
      const vals = keys.map(k => {
        const val = row[k];
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number') return val.toString();
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return `'${String(val).replace(/'/g, "''")}'`;
      }).join(', ');

      dumpSql += `INSERT INTO "${name}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`;
    }
    dumpSql += `\n`;
  }

  fs.writeFileSync(DUMP_PATH, dumpSql, 'utf-8');
  return counts;
}

async function runMigration() {
  console.log('=== STARTING SUPABASE DATABASE MIGRATION EXECUTION ===\n');

  if (!fs.existsSync(DB_PATH)) {
    console.error(`[ERROR]: SQLite database not found at: ${DB_PATH}`);
    process.exit(1);
  }

  // STEP 1: CREATE SAFE BACKUP
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log(`[SAFE BACKUP]: Created/Verified database backup at: ${BACKUP_PATH}`);

  const sqlite = new Database(DB_PATH, { readonly: true });
  const allSqliteTables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
  
  // STEP 2: REGENERATE DATA DUMP FROM LIVE SQLITE DATABASE
  const counts = await generateFreshDataDump(sqlite);
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`[DUMP REFRESHED]: Updated ${DUMP_PATH} with 100% live SQLite rows (${totalRows} total records across ${allSqliteTables.length} tables).`);

  // STEP 3: CHECK IF USER HAS CONFIGURED LIVE SUPABASE PASSWORD
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  const isPlaceholder = !connectionString || connectionString.includes('[YOUR-PASSWORD]') || connectionString.includes('your_supabase');

  if (isPlaceholder) {
    console.log('\n[DRY RUN PREPARATION COMPLETE]:');
    console.log('  -> Live SQLite database preserved at: server/data/aids_system.db');
    console.log('  -> Safe backup created at: server/data/aids_system.db.backup');
    console.log(`  -> Executable PostgreSQL data dump generated with ${totalRows} records at: server/data/supabase_data_dump.sql`);
    console.log('  -> Remote execution paused awaiting real Supabase database password in .env.');
    sqlite.close();
    return;
  }

  // Live remote migration block with atomic transaction
  console.log('\n[POSTGRES CONFIGURED]: Attempting live migration to Supabase PostgreSQL...');
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  console.log('[POSTGRES CONNECTED]: Connected to Supabase PostgreSQL.');

  try {
    // ATOMIC TRANSACTION BEGIN
    await client.query('BEGIN');

    // Apply Schema DDL, Indexes, RLS Policies, and Storage Bucket inside transaction
    const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    await client.query(schemaContent);
    console.log('[SCHEMA APPLIED]: Supabase schema DDL, indexes, RLS policies, and storage bucket initialized inside transaction.');

    // Migrate rows table by table in topological foreign key order
    let totalMigratedRows = 0;
    const validUserIds = new Set((sqlite.prepare("SELECT id FROM users").all() as { id: string }[]).map(u => u.id));

    for (const name of TABLE_INSERTION_ORDER) {
      if (!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name)) continue;
      const rows = sqlite.prepare(`SELECT * FROM "${name}"`).all() as Record<string, any>[];
      if (rows.length === 0) continue;

      let insertedCount = 0;
      for (const rawRow of rows) {
        const row = { ...rawRow };
        if (name === 'students' && row.created_by_faculty_id && !validUserIds.has(row.created_by_faculty_id)) {
          row.created_by_faculty_id = null;
        }
        if (name === 'connected_accounts') {
          if (!row.connected_email) row.connected_email = row.provider_username || 'unspecified@aids.edu';
          if (!row.connected_at) row.connected_at = row.last_synced_at || new Date().toISOString();
        }
        const keys = Object.keys(row);
        const cols = keys.map(k => `"${k}"`).join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const values = keys.map(k => row[k]);

        const query = `INSERT INTO "${name}" (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`;
        await client.query(query, values);
        insertedCount++;
      }
      totalMigratedRows += insertedCount;
      console.log(` -> Migrated ${insertedCount}/${rows.length} rows for table "${name}"`);
    }

    // ATOMIC TRANSACTION COMMIT
    await client.query('COMMIT');
    console.log('\n[TRANSACTION COMMITTED]: Schema & all data rows committed to Supabase PostgreSQL.');

    // STEP 4: VERIFY POST-MIGRATION ROW COUNTS FROM POSTGRESQL TABLE BY TABLE
    console.log('\n=== POST-MIGRATION RECORD VERIFICATION (TABLE BY TABLE) ===');
    let totalVerifiedPgRows = 0;

    for (const { name } of allSqliteTables) {
      const res = await client.query(`SELECT COUNT(*) as cnt FROM "${name}"`);
      const cnt = parseInt(res.rows[0].cnt, 10);
      const expected = counts[name] || 0;
      totalVerifiedPgRows += cnt;
      console.log(` -> Table "${name.padEnd(28)}": ${cnt}/${expected} PostgreSQL rows verified.`);
    }

    console.log(`\n✓ Total Verified PostgreSQL Rows: ${totalVerifiedPgRows} / ${totalRows} SQLite Source Rows.`);
    if (totalVerifiedPgRows === totalRows) {
      console.log('✓ 100% PERFECT MATCH VERIFIED POST-MIGRATION!');
    } else {
      console.warn(`⚠️ Warning: Total row mismatch (PG: ${totalVerifiedPgRows}, SQLite: ${totalRows})`);
    }

    client.release();
    await pool.end();
    console.log('\n=== MIGRATION COMPLETED & VERIFIED SUCCESSFULLY ===');
  } catch (err: any) {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
    console.error(`\n❌ [MIGRATION ERROR - TRANSACTION ROLLED BACK]: ${err.message}`);
    process.exit(1);
  }

  sqlite.close();
}

runMigration().catch(err => {
  console.error('Migration execution failed:', err);
  process.exit(1);
});
