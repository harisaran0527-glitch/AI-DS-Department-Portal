import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'server', 'data', 'aids_system.db');
const sqlite = new Database(dbPath);

const users = sqlite.prepare('SELECT id, email, identifier, role, faculty_role, year, section FROM users LIMIT 15').all();
console.log('Registered Users in DB:');
console.table(users);
