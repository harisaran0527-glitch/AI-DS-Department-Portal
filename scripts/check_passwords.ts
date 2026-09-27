import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.resolve(process.cwd(), 'server', 'data', 'aids_system.db');
const sqlite = new Database(dbPath);

const users = sqlite.prepare('SELECT id, email, identifier, role, password_hash FROM users LIMIT 10').all() as any[];

console.log('Checking passwords:');
for (const u of users) {
  const matchP123 = bcrypt.compareSync('Password123!', u.password_hash);
  const matchAdmin = bcrypt.compareSync('admin123', u.password_hash);
  const matchAids = bcrypt.compareSync('aids2026', u.password_hash);
  console.log(`User ${u.identifier} (${u.role}): P123=${matchP123}, admin123=${matchAdmin}, aids2026=${matchAids}`);
}
