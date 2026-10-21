// Read-only PostgreSQL inspection. Does not import application bootstrap or print connection strings.
import fs from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ quiet: true });
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.NEON_DB_URL;
if (!connectionString || process.env.USE_SQLITE === 'true') {
  throw new Error('Configure the authorized PostgreSQL connection in local .env before auditing.');
}
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000, query_timeout: 15000, max: 1 });
let client;
try {
  client = await pool.connect();
  await client.query('BEGIN READ ONLY');
  await client.query("SET LOCAL statement_timeout = '15s'");
  const counts = {};
  for (const table of ['students', 'discipline_records', 'users', 'faculty_assignments']) {
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    counts[table] = result.rows[0].count;
  }
  const roles = await client.query('SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY role');
  const duplicates = await client.query(`SELECT COUNT(*)::int AS count FROM
    (SELECT UPPER(TRIM(register_no)) FROM students GROUP BY UPPER(TRIM(register_no)) HAVING COUNT(*) > 1) duplicates`);
  const orphans = await client.query(`SELECT COUNT(*)::int AS count FROM discipline_records d
    LEFT JOIN students s ON s.id = d.student_id WHERE s.id IS NULL`);
  const columns = await client.query(`SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('students', 'discipline_records', 'faculty_assignments')
    ORDER BY table_name, ordinal_position`);
  const report = { inspectedAt: new Date().toISOString(), mode: 'read-only', counts, roles: roles.rows,
    duplicateRegisterGroups: duplicates.rows[0].count, orphanDisciplineRecords: orphans.rows[0].count, columns: columns.rows };
  await client.query('ROLLBACK');
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ ...report, columns: undefined }, null, 2));
} catch (error) {
  // Connection/provider errors can contain infrastructure details. Keep them out of terminal reports.
  console.error(`Read-only database audit failed (${error.code || 'connection/query error'}). No application data was changed.`);
  process.exitCode = 1;
} finally {
  if (client) client.release();
  await pool.end();
}
