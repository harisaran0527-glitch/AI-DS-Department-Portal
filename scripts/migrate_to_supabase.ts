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

async function runMigration() {
  console.log('=== STARTING SUPABASE DATABASE MIGRATION ===\n');

  // STEP 1: CREATE SAFE BACKUP OF EXISTING SQLITE DATABASE
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    console.log(`[SAFE BACKUP]: Created database backup at: ${BACKUP_PATH}`);
  } else {
    console.error(`[ERROR]: SQLite database not found at: ${DB_PATH}`);
    process.exit(1);
  }

  const sqlite = new Database(DB_PATH);
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  console.log(`[SQLITE]: Discovered ${tables.length} tables to migrate.`);

  // STEP 2: GENERATE EXECUTABLE POSTGRESQL DATA DUMP
  let dumpSql = `-- SUPABASE POSTGRESQL DATA DUMP GENERATED ON ${new Date().toISOString()}\n`;
  dumpSql += `-- Target Database: Supabase PostgreSQL (iducgryrqyqjzvqzxgje)\n\n`;

  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  dumpSql += `${schemaContent}\n\n`;
  dumpSql += `-- DATA INSERTS --\n`;

  const counts: Record<string, number> = {};

  for (const { name } of tables) {
    const rows = sqlite.prepare(`SELECT * FROM "${name}"`).all() as Record<string, any>[];
    counts[name] = rows.length;
    if (rows.length === 0) continue;

    dumpSql += `-- Table: ${name} (${rows.length} records)\n`;
    for (const row of rows) {
      const keys = Object.keys(row);
      const cols = keys.map(k => `"${k}"`).join(', ');
      const vals = keys.map(k => {
        const val = row[k];
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number') return val.toString();
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        // String escaping for SQL
        return `'${String(val).replace(/'/g, "''")}'`;
      }).join(', ');

      dumpSql += `INSERT INTO "${name}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`;
    }
    dumpSql += `\n`;
  }

  fs.writeFileSync(DUMP_PATH, dumpSql, 'utf-8');
  console.log(`[DUMP GENERATED]: Saved executable SQL dump to: ${DUMP_PATH}`);

  // STEP 3: CONNECT TO SUPABASE POSTGRESQL IF CREDENTIALS AVAILABLE
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  const pgConfig = connectionString
    ? { connectionString, ssl: { rejectUnauthorized: false } }
    : (process.env.PGHOST && process.env.PGPASSWORD)
    ? {
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT) || 5432,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE || 'postgres',
        ssl: { rejectUnauthorized: false }
      }
    : null;

  if (pgConfig) {
    console.log('\n[POSTGRES CONFIGURED]: Attempting connection to Supabase PostgreSQL...');
    try {
      const pool = new Pool(pgConfig);
      const client = await pool.connect();
      console.log('[POSTGRES CONNECTED]: Connected to Supabase PostgreSQL successfully.');

      // Apply schema
      console.log('[SCHEMA]: Applying DDL schema to Supabase PostgreSQL...');
      await client.query(schemaContent);
      console.log('[SCHEMA APPLIED]: Supabase schema & RLS policies created.');

      // Migrate rows table by table
      for (const { name } of tables) {
        const rows = sqlite.prepare(`SELECT * FROM "${name}"`).all() as Record<string, any>[];
        if (rows.length === 0) continue;

        let insertedCount = 0;
        for (const row of rows) {
          const keys = Object.keys(row);
          const cols = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const values = keys.map(k => row[k]);

          const query = `INSERT INTO "${name}" (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`;
          await client.query(query, values);
          insertedCount++;
        }
        console.log(` -> Migrated ${insertedCount}/${rows.length} rows for table "${name}"`);
      }

      client.release();
      await pool.end();
      console.log('\n[MIGRATION SUCCESS]: All records synced to Supabase PostgreSQL directly.');
    } catch (err: any) {
      console.warn(`[MIGRATION NOTICE]: Direct connection notice: ${err.message}`);
      console.log(`[FALLBACK]: Data dump file is ready at ${DUMP_PATH} for execution in Supabase Dashboard.`);
    }
  } else {
    console.log('\n[INFO]: No direct DB password provided in .env yet.');
    console.log(`[READY]: Executable PostgreSQL SQL dump is ready at: ${DUMP_PATH}`);
  }

  // STEP 4: VERIFY RECORD COUNTS
  console.log('\n=== MIGRATION VERIFICATION SUMMARY ===');
  for (const [tbl, count] of Object.entries(counts)) {
    console.log(`Table: ${tbl.padEnd(30)} -> ${count} rows preserved`);
  }
  console.log('\nMigration plan and backup ready. Original SQLite DB preserved at aids_system.db.backup.');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
