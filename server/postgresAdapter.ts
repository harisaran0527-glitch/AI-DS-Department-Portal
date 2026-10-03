import pg from 'pg';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Parse BIGINT (oid 20) as integer in PostgreSQL queries
pg.types.setTypeParser(20, (val: string) => parseInt(val, 10));

const rawConn = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.NEON_DB_URL;
const connectionString = rawConn ? rawConn.trim() : undefined;
const isPgConfigured = Boolean(
  process.env.USE_SQLITE !== 'true' &&
  connectionString &&
  !connectionString.includes('[YOUR-PASSWORD]') &&
  !connectionString.includes('your_supabase') &&
  !connectionString.includes('your_neon') &&
  !connectionString.includes('your_database')
);

export let pgPool: pg.Pool | null = null;
export let sqliteDb: any = null;

if (isPgConfigured) {
  try {
    pgPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    pgPool.on('error', (err) => {
      console.warn('⚠️ PostgreSQL Pool Idle Client Error (handing gracefully):', err.message);
    });

    console.log('⚡ PostgreSQL Adapter Initialized (Connecting via Pool)');
  } catch (err: any) {
    console.warn('⚠️ Failed to initialize PostgreSQL Pool:', err.message);
  }
}

if (!process.env.VERCEL) {
  try {
    import('better-sqlite3').then((module) => {
      const Database = module.default || module;
      const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
      const DB_PATH = process.env.DATABASE_PATH
        ? (path.isAbsolute(process.env.DATABASE_PATH)
            ? process.env.DATABASE_PATH
            : path.resolve(process.cwd(), process.env.DATABASE_PATH))
        : path.join(DATA_DIR, 'aids_system.db');

      const dbDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      sqliteDb = new Database(DB_PATH);
      sqliteDb.pragma('journal_mode = WAL');
      sqliteDb.pragma('foreign_keys = ON');
    }).catch((e) => {
      console.warn('⚠️ SQLite driver not loaded:', e.message);
    });
  } catch (e: any) {
    console.warn('⚠️ SQLite driver not loaded:', e.message);
  }
}

export function isPostgresActive(): boolean {
  return Boolean(pgPool);
}

// Convert SQLite ? placeholders into PostgreSQL $1, $2, $3...
export function toPgSql(sql: string): string {
  let paramIndex = 1;
  let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
  pgSql = pgSql.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');
  pgSql = pgSql.replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO');
  return pgSql;
}

// Query All Rows (Supports both Sync & Async)
export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (pgPool) {
    try {
      const pgSql = toPgSql(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows as T[];
    } catch (err: any) {
      console.warn('⚠️ PostgreSQL queryAll retry following error:', err.message);
      if (sqliteDb) {
        return sqliteDb.prepare(sql).all(...params) as T[];
      }
      const pgSql = toPgSql(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows as T[];
    }
  } else if (sqliteDb) {
    return sqliteDb.prepare(sql).all(...params) as T[];
  }
  return [];
}

// Query Single Row
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  if (pgPool) {
    try {
      const pgSql = toPgSql(sql);
      const res = await pgPool.query(pgSql, params);
      return (res.rows[0] as T) || null;
    } catch (err: any) {
      console.warn('⚠️ PostgreSQL queryOne retry following error:', err.message);
      if (sqliteDb) {
        return (sqliteDb.prepare(sql).get(...params) as T) || null;
      }
      const pgSql = toPgSql(sql);
      const res = await pgPool.query(pgSql, params);
      return (res.rows[0] as T) || null;
    }
  } else if (sqliteDb) {
    return (sqliteDb.prepare(sql).get(...params) as T) || null;
  }
  return null;
}

// Execute Statement (INSERT / UPDATE / DELETE)
export async function executeRun(sql: string, params: any[] = []): Promise<{ changes: number }> {
  if (pgPool) {
    try {
      const pgSql = toPgSql(sql);
      const res = await pgPool.query(pgSql, params);
      return { changes: res.rowCount || 0 };
    } catch (err: any) {
      console.warn('⚠️ PostgreSQL executeRun retry following error:', err.message);
      if (sqliteDb) {
        const res = sqliteDb.prepare(sql).run(...params);
        return { changes: res.changes };
      }
      const pgSql = toPgSql(sql);
      const res = await pgPool.query(pgSql, params);
      return { changes: res.rowCount || 0 };
    }
  } else if (sqliteDb) {
    const res = sqliteDb.prepare(sql).run(...params);
    return { changes: res.changes };
  }
  return { changes: 0 };
}

// Execute Transaction safely
export async function executeTransaction<T>(
  callback: (client?: pg.PoolClient) => Promise<T>
): Promise<T> {
  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else if (sqliteDb) {
    return await callback();
  }
  throw new Error('No database driver initialized.');
}
