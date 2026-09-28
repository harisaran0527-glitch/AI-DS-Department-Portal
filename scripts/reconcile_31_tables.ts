import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const liveDbPath = path.join(process.cwd(), 'server', 'data', 'aids_system.db');
const backupDbPath = path.join(process.cwd(), 'server', 'data', 'aids_system.db.backup');
const dumpPath = path.join(process.cwd(), 'server', 'data', 'supabase_data_dump.sql');

const liveDb = new Database(liveDbPath, { readonly: true });
const backupDb = fs.existsSync(backupDbPath) ? new Database(backupDbPath, { readonly: true }) : null;

// Parse counts from dump file
const dumpContent = fs.readFileSync(dumpPath, 'utf-8');
const dumpCounts: Record<string, number> = {};
const dumpMatches = dumpContent.matchAll(/-- Table: ([a-z_]+) \((\d+) records\)/g);
for (const match of dumpMatches) {
  dumpCounts[match[1]] = parseInt(match[2], 10);
}

const sqliteTables = liveDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];

console.log('=== EXACT 31-TABLE RECONCILIATION AUDIT ===\n');

const auditResults: any[] = [];
let grandLive = 0;
let grandBackup = 0;
let grandDump = 0;

for (const { name } of sqliteTables) {
  const liveCnt = (liveDb.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as any).c;
  const backupCnt = backupDb ? (backupDb.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as any).c : 0;
  const dumpCnt = dumpCounts[name] !== undefined ? dumpCounts[name] : 0;

  grandLive += liveCnt;
  grandBackup += backupCnt;
  grandDump += dumpCnt;

  // Find diffs between backup and live
  let added = 0;
  let deleted = 0;
  if (backupDb) {
    const liveRows = liveDb.prepare(`SELECT * FROM "${name}"`).all() as any[];
    const backupRows = backupDb.prepare(`SELECT * FROM "${name}"`).all() as any[];

    const liveKeys = new Set(liveRows.map(r => JSON.stringify(r)));
    const backupKeys = new Set(backupRows.map(r => JSON.stringify(r)));

    for (const k of liveKeys) {
      if (!backupKeys.has(k)) added++;
    }
    for (const k of backupKeys) {
      if (!liveKeys.has(k)) deleted++;
    }
  }

  auditResults.push({
    table: name,
    backupCnt,
    liveCnt,
    dumpCnt,
    added,
    deleted,
    netDiff: liveCnt - backupCnt
  });
}

console.table(auditResults);

console.log(`\nGrand Totals:`);
console.log(` - Backup DB Count: ${grandBackup}`);
console.log(` - Live DB Count: ${grandLive}`);
console.log(` - Export Dump Count: ${grandDump}`);

// Print details of tables with differences
console.log('\n=== TABLES WITH DIFFERENCES BETWEEN BACKUP AND LIVE ===');
for (const r of auditResults) {
  if (r.netDiff !== 0 || r.added > 0 || r.deleted > 0) {
    console.log(`\nTable "${r.table}": Backup=${r.backupCnt}, Live=${r.liveCnt}, Dump=${r.dumpCnt}, Added=${r.added}, Deleted=${r.deleted}`);

    if (backupDb && r.added > 0) {
      const liveRows = liveDb.prepare(`SELECT * FROM "${r.table}"`).all() as any[];
      const backupRows = backupDb.prepare(`SELECT * FROM "${r.table}"`).all() as any[];
      const backupKeys = new Set(backupRows.map(b => JSON.stringify(b)));
      const addedRows = liveRows.filter(row => !backupKeys.has(JSON.stringify(row)));
      console.log(' Added Rows Details:');
      for (const row of addedRows) {
        console.log('   +', JSON.stringify(row));
      }
    }

    if (backupDb && r.deleted > 0) {
      const liveRows = liveDb.prepare(`SELECT * FROM "${r.table}"`).all() as any[];
      const backupRows = backupDb.prepare(`SELECT * FROM "${r.table}"`).all() as any[];
      const liveKeys = new Set(liveRows.map(l => JSON.stringify(l)));
      const deletedRows = backupRows.filter(row => !liveKeys.has(JSON.stringify(row)));
      console.log(' Deleted Rows Details:');
      for (const row of deletedRows) {
        console.log('   -', JSON.stringify(row));
      }
    }
  }
}
