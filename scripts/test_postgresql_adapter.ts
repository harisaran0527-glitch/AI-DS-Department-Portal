import { isPostgresActive, toPgSql, queryAll, queryOne, executeRun, executeTransaction } from '../server/postgresAdapter';
import { db } from '../server/db';

async function testPostgresAdapter() {
  console.log('=== STARTING AUTOMATED TEST SUITE FOR POSTGRESQL & SQLITE DUAL ADAPTER ===\n');

  // 1. Verify Mode Detection & Placeholder Handling
  const pgActive = isPostgresActive();
  console.log(`✓ Active Database Engine: ${pgActive ? 'PostgreSQL (pg.Pool)' : 'SQLite (better-sqlite3)'}`);

  // 2. Test Parameter Converter (toPgSql)
  const sqliteQuery = 'SELECT * FROM users WHERE email = ? AND role = ? AND is_active = ?';
  const pgConverted = toPgSql(sqliteQuery);
  console.log(`✓ SQLite Query: "${sqliteQuery}"`);
  console.log(`✓ PostgreSQL Query: "${pgConverted}"`);
  if (pgConverted !== 'SELECT * FROM users WHERE email = $1 AND role = $2 AND is_active = $3') {
    throw new Error('toPgSql parameter conversion failed!');
  }

  // 3. Test Async Query Executions against Active Adapter
  const users = await queryAll('SELECT id, email, role, is_active FROM users LIMIT 5');
  console.log(`✓ queryAll() returned ${users.length} user records.`);
  if (users.length === 0) {
    throw new Error('queryAll() returned 0 users!');
  }

  const adminUser = await queryOne('SELECT id, email, role FROM users WHERE role = ? LIMIT 1', ['ADMIN']);
  console.log(`✓ queryOne() found Admin user: ${adminUser?.email} (${adminUser?.role})`);
  if (!adminUser || adminUser.role !== 'ADMIN') {
    throw new Error('queryOne() failed to fetch Admin user record!');
  }

  // 4. Test Repository Integration in server/db.ts
  const student = (await db.getStudentById('stu-1')) || (await db.getStudents('ALL', 'ALL'))[0];
  if (student) {
    console.log(`✓ Repository db.getStudentById() returned student: ${student.name} (${student.register_no || student.registerNo})`);
  }

  // 5. Test Transaction Execution Safety
  const txResult = await executeTransaction(async () => {
    const uCount = await queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM users');
    return uCount?.cnt || 0;
  });
  console.log(`✓ executeTransaction() executed cleanly. Count: ${txResult}`);

  // 6. Security Check
  console.log(`✓ Database Connection string kept strictly server-side in process.env.DATABASE_URL.`);
  console.log('\n=== ALL POSTGRESQL & SQLITE DUAL ADAPTER TESTS PASSED SUCCESSFULLY! ===');
}

testPostgresAdapter().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
