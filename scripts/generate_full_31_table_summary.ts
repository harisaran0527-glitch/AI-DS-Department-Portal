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

console.log('=== COMPLETE 31-TABLE AUDIT RECONCILIATION SUMMARY ===\n');

for (const { name } of sqliteTables) {
  const liveCnt = (liveDb.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as any).c;
  const backupCnt = backupDb ? (backupDb.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get() as any).c : 0;
  const dumpCnt = dumpCounts[name] !== undefined ? dumpCounts[name] : 0;

  // Let's determine baseline count from when baseline 1382 was captured:
  // Baseline had audit_logs: 450, users: 74, students: 49, faculty_assignments: 24.
  let baselineCnt = dumpCnt;
  if (name === 'audit_logs') baselineCnt = 450;
  if (name === 'users') baselineCnt = 74;
  if (name === 'students') baselineCnt = 49;

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

  console.log(`Table: ${name.padEnd(28)} | Baseline: ${String(baselineCnt).padStart(4)} | Backup: ${String(backupCnt).padStart(4)} | Current Live: ${String(liveCnt).padStart(4)} | Export Dump: ${String(dumpCnt).padStart(4)} | Added: +${added} | Deleted: -${deleted}`);
}
