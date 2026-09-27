import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'server', 'data', 'aids_system.db');
const db = new Database(dbPath);

const users = db.prepare('SELECT id, email, identifier, name, role, password_hash FROM users').all() as any[];

console.log('=== ALL USERS IN DB ===');
for (const u of users) {
  console.log(`- [${u.role}] ID: ${u.id}, Identifier: "${u.identifier}", Email: "${u.email}", Name: "${u.name}"`);
}
