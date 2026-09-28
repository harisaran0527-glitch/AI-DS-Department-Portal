process.env.DATABASE_URL = '';
import { isPostgresActive, queryAll, queryOne } from '../server/postgresAdapter';
import { db } from '../server/db';

async function testSqliteFallback() {
  console.log('=== TESTING SQLITE FALLBACK MODE ===');
  console.log(`✓ Active Engine: ${isPostgresActive() ? 'PostgreSQL' : 'SQLite'}`);
  if (isPostgresActive()) {
    throw new Error('Expected SQLite mode but PostgreSQL was active');
  }

  const users = await queryAll('SELECT id, email, role FROM users LIMIT 5');
  console.log(`✓ queryAll() returned ${users.length} users from SQLite.`);

  const admin = await db.getUserById('admin-sys');
  console.log(`✓ db.getUserById('admin-sys') returned: ${admin?.email} (${admin?.role})`);

  const students = await db.getStudents('ALL', 'ALL');
  console.log(`✓ db.getStudents() returned ${students.length} students from SQLite.`);

  const student360 = await db.getStudent360(students[0]?.id || 'stu-1');
  console.log(`✓ db.getStudent360() returned: ${student360?.name}`);

  console.log('=== SQLITE FALLBACK MODE PASSED SUCCESSFULLY! ===');
}

testSqliteFallback().catch(err => {
  console.error('❌ SQLITE FALLBACK TEST FAILED:', err);
  process.exit(1);
});
