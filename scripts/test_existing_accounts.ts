import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.resolve(process.cwd(), 'server', 'data', 'aids_system.db');
const db = new Database(dbPath);

async function testPasswordMatching() {
  const users = db.prepare('SELECT id, email, identifier, name, role, password_hash FROM users').all() as any[];

  console.log('=== CHECKING EXISTING ACCOUNT PASSWORDS ===\n');

  const testPasswords = ['aids@avs', 'hod@123', 'faculty@123', 'student@123', 'password123', '123456', 'admin123', 'saran@123'];

  for (const u of users) {
    let matchedPass: string | null = null;
    for (const pass of testPasswords) {
      if (await bcrypt.compare(pass, u.password_hash)) {
        matchedPass = pass;
        break;
      }
    }
    console.log(`[${u.role.padEnd(7)}] ID: ${u.identifier.padEnd(20)} | Email: ${u.email.padEnd(35)} | PassMatch: ${matchedPass || 'UNKNOWN'}`);

    // If an existing FACULTY or STUDENT has an unknown password, update password to standard test password (faculty@123 / student@123)
    if (!matchedPass) {
      const defaultPass = u.role === 'FACULTY' ? 'faculty@123' : u.role === 'STUDENT' ? 'student@123' : 'admin123';
      const newHash = await bcrypt.hash(defaultPass, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, u.id);
      console.log(` -> Set default password "${defaultPass}" for ${u.identifier}`);
    }
  }
}

testPasswordMatching();
