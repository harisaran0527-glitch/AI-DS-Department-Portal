import { queryAll, pgPool } from '../server/postgresAdapter.ts';

async function main() {
  console.log('==================================================');
  console.log('   FULL USERS LIST (75 RECORDS)');
  console.log('==================================================\n');

  try {
    const users = await queryAll(`SELECT * FROM users ORDER BY role, email`);
    users.forEach((u: any, idx: number) => {
      console.log(`[${idx + 1}] ID: ${u.id.padEnd(30)} | Role: ${u.role.padEnd(8)} | Name: "${u.name}" | Email: "${u.email}"`);
    });
  } catch (error: any) {
    console.error('Failed to list users:', error);
  } finally {
    if (pgPool) {
      await pgPool.end();
    }
  }
}

main();
