import { queryAll, pgPool } from '../server/postgresAdapter.ts';

async function main() {
  console.log('==================================================');
  console.log('   EXECUTING CLEANUP OF SYNTHETIC / TEST DATA');
  console.log('==================================================\n');

  if (!pgPool) {
    console.error('PostgreSQL pool not available!');
    process.exit(1);
  }

  const client = await pgPool.connect();

  try {
    await client.query('BEGIN');
    console.log('✓ Started PostgreSQL Transaction (BEGIN)\n');

    // 1. Get real student IDs and user IDs
    const realStudentsRes = await client.query(`SELECT id, email FROM students WHERE email NOT LIKE '%@aids.edu' AND id NOT LIKE 'stu-test-isolation%'`);
    const realStudentIds = realStudentsRes.rows.map(r => r.id);
    console.log(`Preserving ${realStudentIds.length} real students:`, realStudentsRes.rows.map(r => r.email));

    const realUsersRes = await client.query(`
      SELECT id, role, email FROM users 
      WHERE email NOT LIKE '%@aids.edu' 
      AND id NOT LIKE 'admin-1790%' 
      AND id NOT LIKE 'hod-1790%' 
      AND id NOT LIKE 'fac-test-%'
    `);
    const realUserIds = realUsersRes.rows.map(r => r.id);
    console.log(`Preserving ${realUserIds.length} real users:`, realUsersRes.rows.map(r => `${r.role}: ${r.email}`));

    const studentPlaceholders = realStudentIds.map((_, i) => `$${i + 1}`).join(',');
    const userPlaceholders = realUserIds.map((_, i) => `$${i + 1}`).join(',');

    // 2. Delete synthetic team head members
    const delThm = await client.query(`
      DELETE FROM team_head_members 
      WHERE student_id NOT IN (${studentPlaceholders})
      OR team_head_id IN (
        SELECT id FROM team_heads WHERE head_student_id NOT IN (${studentPlaceholders})
      )
    `, realStudentIds);
    console.log(`\n  ✓ Deleted ${delThm.rowCount} synthetic team head members`);

    // 3. Delete synthetic team heads
    const headStudentPlaceholders = realStudentIds.map((_, i) => `$${i + 1}`).join(',');
    const facultyPlaceholders = realUserIds.map((_, i) => `$${i + 1 + realStudentIds.length}`).join(',');
    const delTh = await client.query(`
      DELETE FROM team_heads 
      WHERE head_student_id NOT IN (${headStudentPlaceholders})
      OR faculty_id NOT IN (${facultyPlaceholders})
    `, [...realStudentIds, ...realUserIds]);
    console.log(`  ✓ Deleted ${delTh.rowCount} synthetic team heads`);

    // 4. Delete synthetic skilledge records
    const delSk = await client.query(`
      DELETE FROM skilledge_records 
      WHERE student_id NOT IN (${studentPlaceholders})
      OR skilledge_handle LIKE '%@aids.edu'
    `, realStudentIds);
    console.log(`  ✓ Deleted ${delSk.rowCount} synthetic skilledge records`);

    // 5. Delete synthetic external metrics
    const delEm = await client.query(`
      DELETE FROM external_metrics 
      WHERE student_id NOT IN (${studentPlaceholders})
    `, realStudentIds);
    console.log(`  ✓ Deleted ${delEm.rowCount} synthetic external metrics records`);

    // 6. Delete synthetic connected accounts by student_id
    const delCa = await client.query(`
      DELETE FROM connected_accounts 
      WHERE student_id NOT IN (${studentPlaceholders})
      OR connected_email LIKE '%@aids.edu'
    `, realStudentIds);
    console.log(`  ✓ Deleted ${delCa.rowCount} synthetic connected accounts`);

    // 7. Delete synthetic faculty assignments
    const delFa = await client.query(`
      DELETE FROM faculty_assignments 
      WHERE faculty_id NOT IN (${userPlaceholders})
    `, realUserIds);
    console.log(`  ✓ Deleted ${delFa.rowCount} synthetic faculty assignments`);

    // 8. Delete synthetic subjects
    const delSub = await client.query(`
      DELETE FROM subjects 
      WHERE id NOT LIKE 'sub-seed-%'
    `);
    console.log(`  ✓ Deleted ${delSub.rowCount} synthetic subjects`);

    // 9. Delete synthetic students
    const delStu = await client.query(`
      DELETE FROM students 
      WHERE id NOT IN (${studentPlaceholders})
    `, realStudentIds);
    console.log(`  ✓ Deleted ${delStu.rowCount} synthetic student profiles`);

    // 10. Delete synthetic users
    const delUsr = await client.query(`
      DELETE FROM users 
      WHERE id NOT IN (${userPlaceholders})
    `, realUserIds);
    console.log(`  ✓ Deleted ${delUsr.rowCount} synthetic user accounts`);

    await client.query('COMMIT');
    console.log('\n✅ TRANSACTION COMMITTED SUCCESSFULLY!\n');

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('\n❌ TRANSACTION ROLLED BACK DUE TO ERROR:', err.message);
  } finally {
    client.release();
    if (pgPool) {
      await pgPool.end();
    }
  }
}

main();
