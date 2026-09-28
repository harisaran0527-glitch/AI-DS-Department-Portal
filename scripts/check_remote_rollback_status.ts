import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

async function checkRemoteStatus() {
  console.log('=== CHECKING REMOTE SUPABASE DATABASE STATE (READ-ONLY) ===\n');

  if (!connectionString) {
    console.error('❌ DATABASE_URL is not configured.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    // 1. Check all table names in public schema
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`✓ Total Public Base Tables: ${tablesRes.rows.length}`);
    if (tablesRes.rows.length > 0) {
      console.log('Tables found in public schema:');
      for (const row of tablesRes.rows) {
        console.log(` - ${row.table_name}`);
      }
    } else {
      console.log('✓ Public schema is EMPTY (0 tables exist). The transaction fully rolled back cleanly!');
    }

    // 2. Check total object count in public schema
    const objectsRes = await client.query(`
      SELECT count(*) as total_objects
      FROM information_schema.tables
      WHERE table_schema = 'public';
    `);

    console.log(`✓ Total Table Objects: ${objectsRes.rows[0].total_objects}`);

    client.release();
    await pool.end();
  } catch (err: any) {
    console.error('❌ Error checking remote status:', err.message);
    client.release();
    await pool.end();
    process.exit(1);
  }
}

checkRemoteStatus().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
