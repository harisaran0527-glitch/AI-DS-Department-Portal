import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'server', 'data', 'aids_system.db');
const sqlite = new Database(dbPath);

const students = sqlite.prepare("SELECT id, name, register_no, year, section FROM students WHERE year = '2nd Year' AND section = 'A'").all();
console.log('2nd Year Section A Students in Students table:');
console.table(students);
