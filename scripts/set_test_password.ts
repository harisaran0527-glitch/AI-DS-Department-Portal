import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbPath = path.resolve(process.cwd(), 'server', 'data', 'aids_system.db');
const sqlite = new Database(dbPath);

const newHash = bcrypt.hashSync('Password123!', 10);

sqlite.prepare("UPDATE users SET password_hash = ? WHERE identifier IN ('CC_A_90555', 'CC_B_90555', '620125243144', '620125243146', 'departmentai&ds@gmail.com')").run(newHash);
console.log('Updated test user passwords to Password123!');
