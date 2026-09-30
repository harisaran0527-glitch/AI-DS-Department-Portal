const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = "postgresql://neondb_owner:npg_5f6VDuRoHeEm@ep-morning-hat-b3a7h7ov-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkUsers() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, email, identifier, name, role, password_hash, is_active FROM users');
    console.log(`\nFound ${res.rows.length} users in Neon DB:\n`);

    const testPasswords = ['aids@avs', 'hod@123', 'faculty@123', 'student@123', 'admin123', 'password123'];

    for (const u of res.rows) {
      let matchedPass = null;
      for (const p of testPasswords) {
        if (u.password_hash && (await bcrypt.compare(p, u.password_hash))) {
          matchedPass = p;
          break;
        }
      }
      console.log(`[${u.role.padEnd(7)}] ID: "${(u.identifier || u.id || '').padEnd(20)}" | Email: "${(u.email || '').padEnd(35)}" | Active: ${u.is_active} | Match: ${matchedPass || 'NO_MATCH'}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

checkUsers().catch(console.error);
