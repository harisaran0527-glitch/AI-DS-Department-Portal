import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'server', 'data', 'aids_system.db');
const db = new Database(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];

console.log(`--- DATABASE INSPECTION FOR: ${dbPath} ---`);
console.log(`Total Tables Found: ${tables.length}\n`);

for (const t of tables) {
  const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get() as { c: number };
  const pragma = db.prepare(`PRAGMA table_info("${t.name}")`).all() as { name: string; type: string; notnull: number; dflt_value: any; pk: number }[];
  console.log(`Table: [${t.name}] -> ${count.c} rows`);
  console.log('Columns:', pragma.map(p => `${p.name} (${p.type})`).join(', '));
  console.log('--------------------------------------------------');
}
