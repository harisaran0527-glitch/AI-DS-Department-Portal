import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export async function migrateSqliteToPostgres(pgConnectionString?: string): Promise<{ success: boolean; migratedTables: Record<string, number>; error?: string }> {
  const connectionString = pgConnectionString || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.NEON_DB_URL;
  if (!connectionString || connectionString.includes('[YOUR-PASSWORD]')) {
    return { success: false, migratedTables: {}, error: 'No valid PostgreSQL DATABASE_URL provided.' };
  }

  const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
  const DB_PATH = process.env.DATABASE_PATH
    ? (path.isAbsolute(process.env.DATABASE_PATH)
        ? process.env.DATABASE_PATH
        : path.resolve(process.cwd(), process.env.DATABASE_PATH))
    : path.join(DATA_DIR, 'aids_system.db');

  if (!fs.existsSync(DB_PATH)) {
    return { success: false, migratedTables: {}, error: `SQLite database file not found at ${DB_PATH}` };
  }

  const sqlite = new Database(DB_PATH);
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const migratedStats: Record<string, number> = {};

  try {
    const tablesInSqlite = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
    const tableNames = tablesInSqlite.map(t => t.name);

    console.log(`🚀 Starting migration from SQLite (${DB_PATH}) to PostgreSQL...`);
    console.log(`Found ${tableNames.length} tables to migrate.`);

    for (const tableName of tableNames) {
      const rows = sqlite.prepare(`SELECT * FROM "${tableName}"`).all() as Record<string, any>[];
      if (rows.length === 0) {
        migratedStats[tableName] = 0;
        continue;
      }

      let insertedCount = 0;
      for (const row of rows) {
        const keys = Object.keys(row);
        const columns = keys.map(k => `"${k}"`).join(', ');
        const values = keys.map(k => row[k]);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

        const firstKey = keys[0];
        const updateClause = keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');
        const upsertQuery = `
          INSERT INTO "${tableName}" (${columns})
          VALUES (${placeholders})
          ON CONFLICT ("${firstKey}") DO UPDATE SET ${updateClause};
        `;

        try {
          await pool.query(upsertQuery, values);
          insertedCount++;
        } catch (err: any) {
          // If upsert fails on constraint without explicit PK conflict, attempt standard ignore insert
          try {
            const ignoreQuery = `
              INSERT INTO "${tableName}" (${columns})
              VALUES (${placeholders})
              ON CONFLICT DO NOTHING;
            `;
            await pool.query(ignoreQuery, values);
            insertedCount++;
          } catch (innerErr: any) {
            console.warn(`⚠️ Warning inserting row in ${tableName}:`, innerErr.message);
          }
        }
      }

      migratedStats[tableName] = insertedCount;
      console.log(`  ✅ Table "${tableName}": ${insertedCount}/${rows.length} rows synced to PostgreSQL.`);
    }

    await pool.end();
    sqlite.close();
    console.log('🎉 Migration completed successfully!');
    return { success: true, migratedTables: migratedStats };
  } catch (error: any) {
    await pool.end();
    sqlite.close();
    console.error('❌ Migration failed:', error.message);
    return { success: false, migratedTables: migratedStats, error: error.message };
  }
}

// Execute standalone if called directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('migrateToPostgres.ts')) {
  migrateSqliteToPostgres().then(res => {
    console.log('Migration Result:', res);
    process.exit(res.success ? 0 : 1);
  });
}
