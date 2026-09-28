import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'server', 'data', 'aids_system.db');
const schemaPath = path.join(process.cwd(), 'server', 'data', 'supabase_schema.sql');

const sqlite = new Database(dbPath, { readonly: true });
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

console.log('=== AUDITING SCHEMAS vs SQLITE NULL VALUES ACROSS ALL TABLES ===\n');

const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];

for (const { name } of tables) {
  const rows = sqlite.prepare(`SELECT * FROM "${name}"`).all() as Record<string, any>[];
  if (rows.length === 0) continue;

  const cols = Object.keys(rows[0]);
  for (const col of cols) {
    const nullCount = rows.filter(r => r[col] === null || r[col] === undefined).length;
    if (nullCount > 0) {
      // Check if schema defines this column as NOT NULL
      const tableBlockRegex = new RegExp(`CREATE TABLE IF NOT EXISTS ${name} \\(([\\s\\S]+?)\\);`, 'm');
      const match = schemaContent.match(tableBlockRegex);
      if (match) {
        const ddlBody = match[1];
        const colLineRegex = new RegExp(`^\\s*${col}\\s+[^,\n]+NOT NULL`, 'm');
        if (colLineRegex.test(ddlBody)) {
          console.log(`❌ Mismatch in table "${name}", column "${col}": ${nullCount}/${rows.length} rows are NULL in SQLite, but schema specifies NOT NULL!`);
        }
      }
    }
  }
}

console.log('\n=== NULLABILITY AUDIT COMPLETE ===');
