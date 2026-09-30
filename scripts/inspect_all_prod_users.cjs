const bcrypt = require('bcryptjs');

async function inspectAllUsers() {
  const { db } = await import('../server/db.js');
  const users = await db.getUsers('ALL');
  console.log(`\nFound ${users.length} users in DB:\n`);
  
  const testPasswords = ['aids@avs', 'hod@123', 'faculty@123', 'student@123', 'admin123', 'password123'];

  for (const u of users) {
    let matchedPass = null;
    for (const p of testPasswords) {
      if (u.password_hash && (await bcrypt.compare(p, u.password_hash))) {
        matchedPass = p;
        break;
      }
    }
    console.log(`[${u.role.padEnd(7)}] Identifier: "${(u.identifier || '').padEnd(25)}" | Email: "${(u.email || '').padEnd(32)}" | PasswordMatch: ${matchedPass || 'CUSTOM_HASH'}`);
  }
}

inspectAllUsers().catch(console.error);
