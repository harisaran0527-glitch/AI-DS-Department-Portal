import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const { Pool } = pg;

async function runReadOnlyConnectionCheck() {
  console.log('=== STARTING READ-ONLY SUPABASE POSTGRESQL CONNECTION TEST ===\n');

  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is missing in .env');
    process.exit(1);
  }

  // Sanitize host display (No password exposed)
  const host = process.env.PGHOST || 'db.iducgryrqyqjzvqzxgje.supabase.co';
  console.log(`[TARGET PROJECT]: Supabase Project (iducgryrqyqjzvqzxgje)`);
  console.log(`[TARGET HOST]: ${host}:5432`);

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000
  });

  try {
    const client = await pool.connect();
    console.log('\n✓ [CONNECTION SUCCESS]: Successfully connected to Supabase PostgreSQL!');

    // Read-only queries
    const infoRes = await client.query(`
      SELECT 
        current_database() as db_name,
        current_user as db_user,
        NOW() as server_time,
        version() as pg_version
    `);
    const info = infoRes.rows[0];

    console.log(`  -> Database Name: ${info.db_name}`);
    console.log(`  -> Database User: ${info.db_user}`);
    console.log(`  -> Server Time: ${info.server_time}`);
    console.log(`  -> PostgreSQL Version: ${info.pg_version.split(',')[0]}`);

    // Query existing tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const publicTables = tablesRes.rows.map(r => r.table_name);
    console.log(`\n--- Public Schema Table Status ---`);
    console.log(`Total Tables in Public Schema: ${publicTables.length}`);

    if (publicTables.length === 0) {
      console.log('✓ Public schema is EMPTY and 100% READY for schema DDL application and data import!');
    } else {
      console.log(`Existing Tables in Public Schema: ${publicTables.join(', ')}`);
    }

    client.release();
    await pool.end();

    console.log('\n=== READ-ONLY CONNECTION TEST COMPLETED SUCCESSFULLY ===');
  } catch (err: any) {
    console.error(`\n❌ [CONNECTION ERROR]: ${err.message}`);
    process.exit(1);
  }
}

runReadOnlyConnectionCheck().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
