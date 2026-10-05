import { isPostgresActive, queryAll, queryOne } from '../server/postgresAdapter.js';
import Database from 'better-sqlite3';
import path from 'path';

async function check() {
  console.log('=== ACTIVE DB ENGINE CHECK ===');
  console.log('PostgreSQL configured & active:', isPostgresActive());

  if (isPostgresActive()) {
    try {
      const tables = await queryAll("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
      console.log('PostgreSQL Public Tables:', tables.length);
      const pgCounts: Record<string, any> = {};
      for (const t of tables) {
        try {
          const res = await queryOne(`SELECT count(*) as count FROM "${t.table_name}"`);
          pgCounts[t.table_name] = res?.count;
        } catch (e: any) {
          pgCounts[t.table_name] = e.message;
        }
      }
      console.log('Postgres Counts:\n', JSON.stringify(pgCounts, null, 2));
    } catch (err: any) {
      console.log('Postgres Query Error:', err.message);
    }
  }

  // SQLite check
  try {
    const dbPath = path.resolve(process.cwd(), 'server/data/aids_system.db');
    const sqlite = new Database(dbPath, { readonly: true });
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as any[];
    console.log('\nSQLite Tables:', tables.length);
    const sqliteCounts: Record<string, any> = {};
    for (const t of tables) {
      const res = sqlite.prepare(`SELECT count(*) as count FROM "${t.name}"`).get() as any;
      sqliteCounts[t.name] = res?.count;
    }
    console.log('SQLite Counts:\n', JSON.stringify(sqliteCounts, null, 2));
    sqlite.close();
  } catch (err: any) {
    console.log('SQLite Check Error:', err.message);
  }

  process.exit(0);
}

check();
