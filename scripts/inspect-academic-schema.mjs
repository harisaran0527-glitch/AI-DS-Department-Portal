import pg from 'pg';
const { Pool } = pg;

const neonUrl = 'postgresql://neondb_owner:npg_5f6VDuRoHeEm@ep-morning-hat-b3a7h7ov-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString: neonUrl, ssl: { rejectUnauthorized: false } });

async function checkTables() {
  const tables = ['academic_records', 'bulk_import_audits', 'audit_logs', 'students', 'scoring_configuration'];
  for (const t of tables) {
    const res = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_name = '${t}'`);
    console.log(`Table "${t}" exists in Neon:`, res.rows.length > 0);
  }

  const indexes = await pool.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'academic_records'
  `);
  console.log('\nIndexes on academic_records in Neon:');
  console.table(indexes.rows);

  await pool.end();
}

checkTables().catch(console.error);
