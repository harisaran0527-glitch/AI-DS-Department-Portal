import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { db } from '../server/db.js';
import { executeRun, queryOne } from '../server/postgresAdapter.js';

dotenv.config();

async function createExplicitAdmin() {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || 'departmentai&ds@gmail.com').trim().toLowerCase();
  const password = process.argv[3] || process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs';
  const name = process.argv[4] || 'System Administrator';
  const identifier = process.argv[5] || 'admin';

  console.log('================================================================');
  console.log('EXPLICIT ADMIN ACCOUNT CREATION UTILITY');
  console.log('================================================================');
  console.log(`Target Email     : ${email}`);
  console.log(`Target Identifier: ${identifier}`);
  console.log(`Target Name      : ${name}`);

  const existing = await queryOne("SELECT id, email, role FROM users WHERE LOWER(email) = ? OR LOWER(identifier) = ?", [email, identifier.toLowerCase()]);

  if (existing) {
    console.log(`\n[NOTICE] User account with email/identifier already exists (ID: ${existing.id}, Role: ${existing.role}).`);
    const hash = await bcrypt.hash(password, 10);
    await executeRun("UPDATE users SET password_hash = ?, role = 'ADMIN', is_active = 1 WHERE id = ?", [hash, existing.id]);
    console.log(`[SUCCESS] Existing user upgraded/reset to ADMIN with password '${password}'.`);
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 10);
  const adminId = `admin-${Date.now()}`;
  const now = new Date().toISOString();

  await executeRun(`
    INSERT INTO users (id, email, identifier, name, role, password_hash, is_active, created_at)
    VALUES (?, ?, ?, ?, 'ADMIN', ?, 1, ?)
  `, [adminId, email, identifier, name, hash, now]);

  console.log(`\n[SUCCESS] ADMIN account explicitly created!`);
  console.log(`Admin ID : ${adminId}`);
  console.log(`Email    : ${email}`);
  console.log(`Password : ${password}`);
  process.exit(0);
}

createExplicitAdmin().catch((err) => {
  console.error('[ERROR] Failed to create Admin account:', err);
  process.exit(1);
});
