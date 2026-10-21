import path from 'node:path';
import { databaseReady } from '../db.js';
import { createDisciplinePortalUser, getDisciplinePortalUserByEmail } from '../disciplinePortalStore.js';

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.USE_SQLITE !== 'true') {
    throw new Error('Admin provisioning is restricted to an explicitly configured non-production SQLite database.');
  }
  if (!process.env.DATABASE_PATH) {
    throw new Error('Set DATABASE_PATH to an isolated SQLite file outside the project directory.');
  }
  const databasePath = path.resolve(process.env.DATABASE_PATH);
  const projectPath = path.resolve(process.cwd());
  const relativePath = path.relative(projectPath, databasePath);
  if (!relativePath || (!relativePath.startsWith(`..${path.sep}`) && relativePath !== '..' && !path.isAbsolute(relativePath))) {
    throw new Error('DATABASE_PATH must resolve outside the project directory.');
  }

  const name = process.env.DISCIPLINE_ADMIN_NAME?.trim() || '';
  const email = process.env.DISCIPLINE_ADMIN_EMAIL?.trim().toLowerCase() || '';
  const password = process.env.DISCIPLINE_ADMIN_PASSWORD || '';
  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 12 || password.length > 256) {
    throw new Error('Provide DISCIPLINE_ADMIN_NAME, DISCIPLINE_ADMIN_EMAIL, and a DISCIPLINE_ADMIN_PASSWORD of 12–256 characters.');
  }

  await databaseReady;
  if (await getDisciplinePortalUserByEmail(email)) {
    throw new Error('A Discipline Portal account already exists for that email.');
  }
  await createDisciplinePortalUser({ name, email, password, role: 'ADMIN' });
  console.info('Discipline Portal Admin provisioned in the isolated SQLite database.');
}

main().catch(error => {
  console.error('[Discipline Portal] Admin provisioning failed:', error instanceof Error ? error.message : 'Unexpected error.');
  process.exitCode = 1;
});
