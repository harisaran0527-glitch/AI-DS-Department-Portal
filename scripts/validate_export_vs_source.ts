import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const liveDbPath = path.join(process.cwd(), 'server', 'data', 'aids_system.db');
const dumpPath = path.join(process.cwd(), 'server', 'data', 'supabase_data_dump.sql');

const sqlite = new Database(liveDbPath, { readonly: true });
const dumpContent = fs.readFileSync(dumpPath, 'utf-8');

console.log('=== SOURCE-VERSUS-EXPORT 31-TABLE VALIDATION ===\n');

const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];

let grandSourceRows = 0;
let grandExportRows = 0;
let duplicatesFound = 0;

for (const { name } of tables) {
  const sourceCount = (sqlite.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as any).c;
  grandSourceRows += sourceCount;

  // Match INSERTS for this table in dump SQL line by line
  const lines = dumpContent.split('\n');
  const tableInserts = lines.filter(l => l.startsWith(`INSERT INTO "${name}"`));
  const exportCount = tableInserts.length;
  grandExportRows += exportCount;

  // Primary key duplicate check in export
  const pkSet = new Set<string>();
  let dupes = 0;
  for (const line of tableInserts) {
    const valMatch = line.match(/VALUES \(([^)]+)\)/);
    if (valMatch) {
      const firstVal = valMatch[1].split(',')[0].trim().replace(/^'|'$/g, '');
      if (pkSet.has(firstVal)) {
        dupes++;
      } else {
        pkSet.add(firstVal);
      }
    }
  }
  duplicatesFound += dupes;

  const status = (sourceCount === exportCount && dupes === 0) ? '✓ PERFECT MATCH' : '❌ MISMATCH';
  console.log(`Table "${name.padEnd(28)}": Source = ${String(sourceCount).padStart(4)}, Export = ${String(exportCount).padStart(4)}, Dupes = ${dupes} | ${status}`);
}

console.log(`\n==================================================`);
console.log(`✓ Total Source SQLite Rows: ${grandSourceRows}`);
console.log(`✓ Total Export Dump Rows:   ${grandExportRows}`);
console.log(`✓ Total Export Duplicates:  ${duplicatesFound}`);
if (grandSourceRows === grandExportRows && duplicatesFound === 0) {
  console.log(`✓ 100% PERFECT SOURCE-TO-EXPORT ROW AND PK COVERAGE VERIFIED!`);
} else {
  console.log(`❌ EXPORT VALIDATION FAILED!`);
}
