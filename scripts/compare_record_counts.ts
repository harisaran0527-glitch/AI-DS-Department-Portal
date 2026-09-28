import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const liveDbPath = path.join(process.cwd(), 'server', 'data', 'aids_system.db');
const backupDbPath = path.join(process.cwd(), 'server', 'data', 'aids_system.db.backup');
const dumpPath = path.join(process.cwd(), 'server', 'data', 'supabase_data_dump.sql');

const liveDb = new Database(liveDbPath, { readonly: true });
const backupDb = fs.existsSync(backupDbPath) ? new Database(backupDbPath, { readonly: true }) : null;

console.log('=== TABLE-BY-TABLE RECORD COUNT COMPARISON ===\n');

// Extract table counts from dump file comments if available
const dumpContent = fs.readFileSync(dumpPath, 'utf-8');
const dumpCounts: Record<string, number> = {};
const dumpMatches = dumpContent.matchAll(/-- Table: ([a-z_]+) \((\d+) records\)/g);
for (const match of dumpMatches) {
  dumpCounts[match[1]] = parseInt(match[2], 10);
}

const sqliteTables = liveDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];

let totalLive = 0;
let totalBackup = 0;
let totalDump = 0;

const comparisonTable: any[] = [];

for (const { name } of sqliteTables) {
  const liveCount = (liveDb.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as any).c;
  const backupCount = backupDb ? (backupDb.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as any).c : 0;
  const dumpCount = dumpCounts[name] || 0;

  totalLive += liveCount;
  totalBackup += backupCount;
  totalDump += dumpCount;

  const diff = liveCount - dumpCount;

  comparisonTable.push({
    Table: name,
    'Previous Count (Dump)': dumpCount,
    'Backup Count': backupCount,
    'Current Live Count': liveCount,
    'Difference (Current - Dump)': diff > 0 ? `+${diff}` : `${diff}`
  });
}

console.table(comparisonTable);

console.log(`\n✓ Total Dump (Previous) Records: ${totalDump}`);
console.log(`✓ Total Backup Records: ${totalBackup}`);
console.log(`✓ Total Live Current Records: ${totalLive}`);
console.log(`✓ Overall Difference: +${totalLive - totalDump} records\n`);

// Identify newly added rows in tables with differences
for (const row of comparisonTable) {
  const diffVal = parseInt(row['Difference (Current - Dump)'], 10);
  if (diffVal !== 0) {
    console.log(`\n🔍 Table "${row.Table}" gained ${diffVal} new record(s):`);
    if (backupDb) {
      const newRows = liveDb.prepare(`
        SELECT * FROM "${row.Table}" WHERE id NOT IN (SELECT id FROM "${row.Table}")
      `).all();
      // Compare by id
      const backupIds = new Set((backupDb.prepare(`SELECT id FROM "${row.Table}"`).all() as { id: string }[]).map(r => r.id));
      const added = (liveDb.prepare(`SELECT * FROM "${row.Table}"`).all() as any[]).filter(r => !backupIds.has(r.id));
      console.log(`Added rows details in "${row.Table}":`);
      for (const a of added) {
        console.log(` - ID: "${a.id}", Info: ${JSON.stringify(a).substring(0, 120)}...`);
      }
    }
  }
}
