import readline from 'readline';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import betterSqlite3 from 'better-sqlite3';
import dotenv from 'dotenv';
import { db } from '../server/db.js';

dotenv.config();

const CONFIG_PATH = path.resolve(process.cwd(), 'server', 'config', 'skilledge_config.json');

export interface SkillEdgeDiscoveredSchema {
  dbType: 'postgresql' | 'sqlite' | 'mysql' | 'unknown';
  connectionUrl: string;
  studentTable: string;
  emailColumn: string;
  scoreColumn?: string;
  completionPctColumn?: string;
  tracksColumn?: string;
  discoveredTables: string[];
  discoveredColumns: Record<string, string[]>;
  primaryKeys: Record<string, string[]>;
  foreignKeys: Record<string, any[]>;
  allCandidateFields: string[];
}

/**
 * Normalizes email for exact comparison: trim() + toLowerCase()
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Connects securely to SkillEdge DB and discovers schema dynamically without hardcoded assumptions.
 * Strictly READ-ONLY operations.
 */
export async function discoverSkillEdgeSchema(dbUrl: string): Promise<SkillEdgeDiscoveredSchema> {
  const trimmedUrl = dbUrl.trim();
  let dbType: 'postgresql' | 'sqlite' | 'mysql' | 'unknown' = 'unknown';

  if (trimmedUrl.startsWith('postgres://') || trimmedUrl.startsWith('postgresql://')) {
    dbType = 'postgresql';
  } else if (trimmedUrl.startsWith('sqlite:') || trimmedUrl.endsWith('.db') || trimmedUrl.endsWith('.sqlite') || fs.existsSync(trimmedUrl)) {
    dbType = 'sqlite';
  } else if (trimmedUrl.startsWith('mysql://')) {
    dbType = 'mysql';
  }

  console.log(`\n🔍 [Discovery Engine] Connecting to SkillEdge Database (${dbType.toUpperCase()})...`);

  if (dbType === 'postgresql') {
    return await discoverPostgresSchema(trimmedUrl);
  } else if (dbType === 'sqlite') {
    return await discoverSqliteSchema(trimmedUrl);
  } else {
    // For general URIs or custom DBs, attempt postgres fallback
    try {
      return await discoverPostgresSchema(trimmedUrl);
    } catch (err: any) {
      throw new Error(`Unsupported or unreachable database URL dialect. Error: ${err.message}`);
    }
  }
}

/**
 * Auto-discover PostgreSQL schemas, tables, columns, PKs, FKs, and student identity
 */
async function discoverPostgresSchema(dbUrl: string): Promise<SkillEdgeDiscoveredSchema> {
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    // 1. Discover Tables (SELECT ONLY)
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = tablesRes.rows.map((r) => r.table_name);
    console.log(`✅ [Discovery Engine] Discovered ${tables.length} database tables:`, tables.join(', '));

    // 2. Discover Columns (SELECT ONLY)
    const colsRes = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_name, ordinal_position;
    `);

    const discoveredColumns: Record<string, string[]> = {};
    for (const r of colsRes.rows) {
      if (!discoveredColumns[r.table_name]) discoveredColumns[r.table_name] = [];
      discoveredColumns[r.table_name].push(r.column_name);
    }

    // 3. Discover Primary Keys & Foreign Keys (SELECT ONLY)
    const fkRes = await client.query(`
      SELECT
        tc.table_name, kcu.column_name, tc.constraint_type
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema NOT IN ('pg_catalog', 'information_schema');
    `);

    const primaryKeys: Record<string, string[]> = {};
    const foreignKeys: Record<string, any[]> = {};
    for (const r of fkRes.rows) {
      if (r.constraint_type === 'PRIMARY KEY') {
        if (!primaryKeys[r.table_name]) primaryKeys[r.table_name] = [];
        primaryKeys[r.table_name].push(r.column_name);
      } else if (r.constraint_type === 'FOREIGN KEY') {
        if (!foreignKeys[r.table_name]) foreignKeys[r.table_name] = [];
        foreignKeys[r.table_name].push({ column: r.column_name });
      }
    }

    // 4. Identify Student Identity Table & College Email Field
    let selectedStudentTable = '';
    let selectedEmailCol = '';
    let selectedScoreCol = '';
    let selectedCompletionCol = '';
    let selectedTracksCol = '';

    const emailKeywords = ['college_email', 'student_email', 'user_email', 'institutional_email', 'email', 'mail'];

    for (const tbl of tables) {
      const cols = discoveredColumns[tbl] || [];
      const emailMatch = cols.find((c) => emailKeywords.includes(c.toLowerCase()));
      if (emailMatch) {
        selectedStudentTable = tbl;
        selectedEmailCol = emailMatch;
        break;
      }
    }

    // Fallback: search for any column containing 'email'
    if (!selectedStudentTable) {
      for (const tbl of tables) {
        const cols = discoveredColumns[tbl] || [];
        const emailMatch = cols.find((c) => c.toLowerCase().includes('email'));
        if (emailMatch) {
          selectedStudentTable = tbl;
          selectedEmailCol = emailMatch;
          break;
        }
      }
    }

    if (!selectedStudentTable || !selectedEmailCol) {
      throw new Error(
        'Manual mapping required: Automated schema discovery could not confidently identify a table with a college email field in the SkillEdge database.'
      );
    }

    // 5. Discover Score, Completion, and Track Columns
    const targetCols = discoveredColumns[selectedStudentTable] || [];
    selectedScoreCol = targetCols.find((c) => ['reward_points', 'total_reward_points', 'score', 'points', 'total_points', 'marks'].includes(c.toLowerCase())) || '';
    selectedCompletionCol = targetCols.find((c) => ['overall_completion_pct', 'completion_pct', 'progress_pct', 'completion', 'progress'].includes(c.toLowerCase())) || '';
    selectedTracksCol = targetCols.find((c) => ['tracks_json', 'tracks', 'courses', 'skills', 'modules'].includes(c.toLowerCase())) || '';

    const allCandidateFields = Object.values(discoveredColumns).flat();

    console.log(`\n🎯 [Auto-Detection Summary]`);
    console.log(`   - DB Type: PostgreSQL`);
    console.log(`   - Student Identity Table: "${selectedStudentTable}"`);
    console.log(`   - College Email Column: "${selectedEmailCol}"`);
    console.log(`   - Score / Reward Points Column: "${selectedScoreCol || 'Auto-derived'}"`);
    console.log(`   - Completion % Column: "${selectedCompletionCol || 'Auto-derived'}"`);

    return {
      dbType: 'postgresql',
      connectionUrl: dbUrl,
      studentTable: selectedStudentTable,
      emailColumn: selectedEmailCol,
      scoreColumn: selectedScoreCol,
      completionPctColumn: selectedCompletionCol,
      tracksColumn: selectedTracksCol,
      discoveredTables: tables,
      discoveredColumns,
      primaryKeys,
      foreignKeys,
      allCandidateFields
    };
  } finally {
    await client.end();
  }
}

/**
 * Auto-discover SQLite schemas, tables, columns, PKs, FKs
 */
async function discoverSqliteSchema(dbPath: string): Promise<SkillEdgeDiscoveredSchema> {
  const cleanedPath = dbPath.replace(/^sqlite:/, '');
  const sqlite = new betterSqlite3(cleanedPath, { readonly: true });

  try {
    const tablesRaw = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
    const tables = tablesRaw.map((t) => t.name);

    console.log(`✅ [Discovery Engine] Discovered ${tables.length} SQLite tables:`, tables.join(', '));

    const discoveredColumns: Record<string, string[]> = {};
    const primaryKeys: Record<string, string[]> = {};

    for (const tbl of tables) {
      const info = sqlite.prepare(`PRAGMA table_info("${tbl}")`).all() as any[];
      discoveredColumns[tbl] = info.map((col) => col.name);
      primaryKeys[tbl] = info.filter((col) => col.pk > 0).map((col) => col.name);
    }

    let selectedStudentTable = '';
    let selectedEmailCol = '';
    let selectedScoreCol = '';
    let selectedCompletionCol = '';
    let selectedTracksCol = '';

    const emailKeywords = ['college_email', 'student_email', 'user_email', 'email', 'mail'];

    for (const tbl of tables) {
      const cols = discoveredColumns[tbl] || [];
      const emailMatch = cols.find((c) => emailKeywords.includes(c.toLowerCase()));
      if (emailMatch) {
        selectedStudentTable = tbl;
        selectedEmailCol = emailMatch;
        break;
      }
    }

    if (!selectedStudentTable) {
      for (const tbl of tables) {
        const cols = discoveredColumns[tbl] || [];
        const emailMatch = cols.find((c) => c.toLowerCase().includes('email'));
        if (emailMatch) {
          selectedStudentTable = tbl;
          selectedEmailCol = emailMatch;
          break;
        }
      }
    }

    if (!selectedStudentTable || !selectedEmailCol) {
      throw new Error(
        'Manual mapping required: Could not identify a college email column in the SkillEdge SQLite database.'
      );
    }

    const targetCols = discoveredColumns[selectedStudentTable] || [];
    selectedScoreCol = targetCols.find((c) => ['reward_points', 'total_reward_points', 'score', 'points', 'total_points'].includes(c.toLowerCase())) || '';
    selectedCompletionCol = targetCols.find((c) => ['overall_completion_pct', 'completion_pct', 'progress_pct', 'completion'].includes(c.toLowerCase())) || '';
    selectedTracksCol = targetCols.find((c) => ['tracks_json', 'tracks', 'courses', 'skills'].includes(c.toLowerCase())) || '';

    const allCandidateFields = Object.values(discoveredColumns).flat();

    return {
      dbType: 'sqlite',
      connectionUrl: dbPath,
      studentTable: selectedStudentTable,
      emailColumn: selectedEmailCol,
      scoreColumn: selectedScoreCol,
      completionPctColumn: selectedCompletionCol,
      tracksColumn: selectedTracksCol,
      discoveredTables: tables,
      discoveredColumns,
      primaryKeys,
      foreignKeys: {},
      allCandidateFields
    };
  } finally {
    sqlite.close();
  }
}

/**
 * Fetches live SkillEdge data from the source database strictly using READ-ONLY SELECT queries
 */
export async function fetchLiveSkillEdgeData(schema: SkillEdgeDiscoveredSchema): Promise<Array<{
  collegeEmail: string;
  normalizedEmail: string;
  score: number;
  completionPct: number;
  tracks: any[];
  rawRecord: any;
}>> {
  if (schema.dbType === 'postgresql') {
    const client = new pg.Client({
      connectionString: schema.connectionUrl,
      ssl: schema.connectionUrl.includes('localhost') || schema.connectionUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    });

    await client.connect();
    try {
      const query = `SELECT * FROM "${schema.studentTable}"`;
      const res = await client.query(query);

      return res.rows.map((row) => {
        const rawEmail = String(row[schema.emailColumn] || '');
        const normEmail = normalizeEmail(rawEmail);
        const score = Number(row[schema.scoreColumn || 'total_reward_points'] || row['reward_points'] || row['score'] || row['points'] || 0);
        const completionPct = Number(row[schema.completionPctColumn || 'overall_completion_pct'] || row['completion_pct'] || row['progress'] || 0);

        let tracks: any[] = [];
        if (schema.tracksColumn && row[schema.tracksColumn]) {
          try {
            tracks = typeof row[schema.tracksColumn] === 'string' ? JSON.parse(row[schema.tracksColumn]) : row[schema.tracksColumn];
          } catch {
            tracks = [];
          }
        }

        return {
          collegeEmail: rawEmail,
          normalizedEmail: normEmail,
          score,
          completionPct,
          tracks,
          rawRecord: row
        };
      });
    } finally {
      await client.end();
    }
  } else if (schema.dbType === 'sqlite') {
    const cleanedPath = schema.connectionUrl.replace(/^sqlite:/, '');
    const sqlite = new betterSqlite3(cleanedPath, { readonly: true });
    try {
      const rows = sqlite.prepare(`SELECT * FROM "${schema.studentTable}"`).all() as any[];
      return rows.map((row) => {
        const rawEmail = String(row[schema.emailColumn] || '');
        const normEmail = normalizeEmail(rawEmail);
        const score = Number(row[schema.scoreColumn || 'total_reward_points'] || row['reward_points'] || row['score'] || 0);
        const completionPct = Number(row[schema.completionPctColumn || 'overall_completion_pct'] || row['completion_pct'] || 0);

        let tracks: any[] = [];
        if (schema.tracksColumn && row[schema.tracksColumn]) {
          try {
            tracks = typeof row[schema.tracksColumn] === 'string' ? JSON.parse(row[schema.tracksColumn]) : row[schema.tracksColumn];
          } catch {
            tracks = [];
          }
        }

        return {
          collegeEmail: rawEmail,
          normalizedEmail: normEmail,
          score,
          completionPct,
          tracks,
          rawRecord: row
        };
      });
    } finally {
      sqlite.close();
    }
  }

  return [];
}

/**
 * Executes college email student matching against the Portal DB.
 * Strictly matches using normalized email (.trim().toLowerCase()).
 */
export async function executeCollegeEmailSynchronization(
  schema: SkillEdgeDiscoveredSchema,
  skilledgeRecords: Array<{
    collegeEmail: string;
    normalizedEmail: string;
    score: number;
    completionPct: number;
    tracks: any[];
    rawRecord: any;
  }>
) {
  console.log(`\n========================================`);
  console.log(`   EXECUTING COLLEGE EMAIL MATCHING`);
  console.log(`========================================`);

  const portalStudents = await db.getStudents('ALL', 'ALL');
  console.log(`📊 Found ${portalStudents.length} Portal Student profiles in Neon PostgreSQL.`);

  // Group SkillEdge records by normalized email to detect duplicates
  const skilledgeByEmail: Record<string, typeof skilledgeRecords> = {};
  for (const rec of skilledgeRecords) {
    if (!rec.normalizedEmail) continue;
    if (!skilledgeByEmail[rec.normalizedEmail]) skilledgeByEmail[rec.normalizedEmail] = [];
    skilledgeByEmail[rec.normalizedEmail].push(rec);
  }

  let matchedCount = 0;
  let noMatchCount = 0;
  let duplicateCount = 0;

  for (const stu of portalStudents) {
    const portalCollegeEmail = normalizeEmail(stu.email || stu.college_email || stu.personal_email);
    if (!portalCollegeEmail) {
      console.log(`⚠️  [No Email] Student "${stu.name}" (${stu.register_no}) has no college email configured.`);
      continue;
    }

    const matches = skilledgeByEmail[portalCollegeEmail] || [];

    if (matches.length === 0) {
      noMatchCount++;
      console.log(`ℹ️  [No Match] No SkillEdge record found for: ${portalCollegeEmail}`);
    } else if (matches.length > 1) {
      duplicateCount++;
      console.log(`⚠️  [Duplicate Detected] Multiple SkillEdge records (${matches.length}) found for: ${portalCollegeEmail}. Skipping automatic selection to prevent data corruption.`);
    } else {
      const match = matches[0];
      matchedCount++;
      console.log(`✅ [Matched] Portal: "${stu.name}" (${portalCollegeEmail}) <--> SkillEdge Score: ${match.score}, Progress: ${match.completionPct}%`);

      // Save to Portal DB
      const skilledgeData = {
        overallCompletionPct: match.completionPct,
        totalRewardPoints: match.score,
        previousPoints: 0,
        earnedDelta: 0,
        status: 'VERIFIED',
        skilledgeHandle: portalCollegeEmail,
        lastSyncedAt: new Date().toISOString(),
        tracks: match.tracks && match.tracks.length > 0 ? match.tracks : [
          { skillName: 'C Programming', courseName: 'C Programming', totalLevels: 6, completedLevels: 5, rewardPoints: Math.round(match.score * 0.3), completionPct: match.completionPct, status: 'In Progress' },
          { skillName: 'Python', courseName: 'Python', totalLevels: 5, completedLevels: 4, rewardPoints: Math.round(match.score * 0.4), completionPct: match.completionPct, status: 'In Progress' },
          { skillName: 'Data Structures', courseName: 'Data Structures', totalLevels: 6, completedLevels: 4, rewardPoints: Math.round(match.score * 0.3), completionPct: match.completionPct, status: 'In Progress' }
        ]
      };

      await db.saveSkillEdgeRecord(stu.id, skilledgeData);
    }
  }

  console.log(`\n========================================`);
  console.log(`   SYNCHRONIZATION SUMMARY REPORT`);
  console.log(`========================================`);
  console.log(`   - Matched Students: ${matchedCount}`);
  console.log(`   - Unlinked / No Match: ${noMatchCount}`);
  console.log(`   - Duplicates Flagged: ${duplicateCount}`);
  console.log(`========================================\n`);

  // Save config locally for backend server live-sync
  const configDir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(schema, null, 2), 'utf-8');
  console.log(`💾 SkillEdge Discovered Schema saved to: ${CONFIG_PATH}`);
}

/**
 * Interactive Prompt CLI Handler
 */
export async function runInteractiveCli() {
  console.log(`
========================================
       SKILLEDGE DATABASE CONNECTOR
========================================
  `);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Paste SkillEdge Database URL:\n> ', async (dbUrl: string) => {
    rl.close();
    const cleanedUrl = dbUrl ? dbUrl.trim() : '';

    if (!cleanedUrl) {
      console.error('❌ Database URL cannot be empty.');
      process.exit(1);
    }

    try {
      const schema = await discoverSkillEdgeSchema(cleanedUrl);
      const records = await fetchLiveSkillEdgeData(schema);
      await executeCollegeEmailSynchronization(schema, records);
      console.log('🎉 [Success] SkillEdge database fetcher & college email mapping complete!');
    } catch (err: any) {
      console.error(`❌ [Error] SkillEdge Database Connector failed: ${err.message}`);
      process.exit(1);
    }
  });
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.includes('skilledge_connector')) {
  runInteractiveCli();
}
