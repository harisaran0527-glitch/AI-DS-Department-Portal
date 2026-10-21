import fs from 'fs';
import path from 'path';
import pg from 'pg';
import betterSqlite3 from 'better-sqlite3';
import { db } from '../db.js';
import { resolvePgConnection } from '../databaseConnection.js';
import { calculateCategoryScores, computeOverallScore } from '../scoringEngine.js';
import { normalizeEmail } from '../../scripts/skilledge_connector.js';

export interface SkillEdgeLevelItem {
  levelNumber: number;
  levelName: string;
  status: 'Cleared' | 'Not Cleared' | 'Unknown';
}

export interface SkillEdgeAssessmentAreaItem {
  areaName: 'C' | 'Python' | 'Java' | 'Data Structure';
  levels: SkillEdgeLevelItem[];
}

export interface SkillEdgeSyncResult {
  studentId: string;
  studentName: string;
  registerNo: string;
  previousPoints: number;
  currentPoints: number;
  earnedDelta: number;
  overallCompletionPct: number;
  status: 'VERIFIED' | 'NOT_LINKED' | 'FAILED' | 'TEMPORARILY_UNAVAILABLE';
  lastSyncedAt: string;
  assessments: SkillEdgeAssessmentAreaItem[];
  errorMessage?: string;
}

const CONFIG_PATH = path.resolve(process.cwd(), 'server', 'config', 'skilledge_config.json');

let isDepartmentSyncRunning = false;
let globalLastDailySyncAt: string | null = null;

export function loadSkillEdgeConfig(): any | null {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (process.env.SKILLEDGE_DATABASE_URL) {
    const url = process.env.SKILLEDGE_DATABASE_URL.trim();
    const isPg = url.startsWith('postgres://') || url.startsWith('postgresql://');
    return {
      dbType: isPg ? 'postgresql' : 'sqlite',
      connectionUrl: url,
      studentTable: process.env.SKILLEDGE_TABLE || 'students',
      emailColumn: process.env.SKILLEDGE_EMAIL_COL || 'college_email',
      scoreColumn: process.env.SKILLEDGE_SCORE_COL || 'total_reward_points',
      completionPctColumn: process.env.SKILLEDGE_PROGRESS_COL || 'overall_completion_pct',
      tracksColumn: process.env.SKILLEDGE_TRACKS_COL || 'tracks_json'
    };
  }
  return null;
}

/**
 * Generate assessment level statuses for C, Python, Java, and Data Structure
 */
export function generateSkillEdgeAssessments(existingData?: any): SkillEdgeAssessmentAreaItem[] {
  const areas: ('C' | 'Python' | 'Java' | 'Data Structure')[] = ['C', 'Python', 'Java', 'Data Structure'];
  const unknownLevels = (area: 'C' | 'Python' | 'Java' | 'Data Structure'): SkillEdgeAssessmentAreaItem => ({
    areaName: area,
    levels: [1, 2, 3, 4, 5].map((levelNumber) => ({
      levelNumber,
      levelName: `Level ${levelNumber}`,
      status: 'Unknown'
    }))
  });

  // If existing assessment array is passed, try to parse it
  if (Array.isArray(existingData) && existingData.length > 0 && existingData[0].areaName && existingData[0].levels) {
    return areas.map((area) => {
      const found = existingData.find((a: any) => a.areaName === area || (a.areaName === 'Data Structures' && area === 'Data Structure'));
      if (found && Array.isArray(found.levels)) {
        return {
          areaName: area,
          levels: [1, 2, 3, 4, 5].map((lvlNum) => {
            const matchLvl = found.levels.find((l: any) => l.levelNumber === lvlNum || l.levelName === `Level ${lvlNum}`);
            const status = String(matchLvl?.status || '').toLowerCase();
            return {
              levelNumber: lvlNum,
              levelName: `Level ${lvlNum}`,
              status: ['cleared', 'passed', 'complete', 'completed'].includes(status)
                ? 'Cleared'
                : ['not cleared', 'not_cleared', 'not-cleared', 'failed', 'incomplete'].includes(status)
                  ? 'Not Cleared'
                  : 'Unknown'
            };
          })
        };
      }
      return unknownLevels(area);
    });
  }

  // If legacy tracks format passed, convert cleared level counts to assessment status
  if (Array.isArray(existingData) && existingData.length > 0) {
    return areas.map((area) => {
      const trackMatch = existingData.find((t: any) => {
        const name = (t.skillName || t.courseName || '').toLowerCase();
        if (area === 'C') return name === 'c' || name.includes('c prog');
        if (area === 'Python') return name.includes('python');
        if (area === 'Java') return name.includes('java');
        if (area === 'Data Structure') return name.includes('data struct') || name.includes('dsa');
        return false;
      });
      const completedLevels = trackMatch?.completedLevels;
      if (!trackMatch || completedLevels === null || completedLevels === undefined || completedLevels === '' ||
          !Number.isFinite(Number(completedLevels))) {
        return unknownLevels(area);
      }
      const clearedCount = Number(completedLevels);
      return {
        areaName: area,
        levels: [1, 2, 3, 4, 5].map((lvlNum) => ({
          levelNumber: lvlNum,
          levelName: `Level ${lvlNum}`,
          status: lvlNum <= clearedCount ? 'Cleared' : 'Not Cleared'
        }))
      };
    });
  }

  return areas.map(unknownLevels);
}

/**
 * Perform a live read query directly from the source SkillEdge Database for a given student email.
 * Strictly uses READ-ONLY SELECT queries.
 */
export async function fetchLiveRecordFromSkillEdge(collegeEmail: string): Promise<{
  assessments: SkillEdgeAssessmentAreaItem[];
  score: number;
  completionPct: number;
} | null> {
  const normEmail = normalizeEmail(collegeEmail);
  if (!normEmail) return null;

  const cfg = loadSkillEdgeConfig();
  if (!cfg || !cfg.connectionUrl) return null;
  if (cfg.dbType === 'postgresql') {
    const resolvedConnection = resolvePgConnection(cfg.connectionUrl);
    const client = new pg.Client({
      connectionString: resolvedConnection.provider === 'neon'
        ? resolvedConnection.effectiveConnStr
        : cfg.connectionUrl,
      ssl: resolvedConnection.provider === 'neon'
        ? resolvedConnection.ssl
        : cfg.connectionUrl.includes('localhost') || cfg.connectionUrl.includes('127.0.0.1')
          ? false
          : { rejectUnauthorized: false }
    });
    await client.connect();
    try {
      const query = `
        SELECT * FROM "${cfg.studentTable || 'students'}"
        WHERE LOWER(TRIM("${cfg.emailColumn || 'college_email'}")) = $1
      `;
      const res = await client.query(query, [normEmail]);

      if (res.rows.length === 0) return null;

      const row = res.rows[0];
      let rawData: any = null;
      if (cfg.tracksColumn && row[cfg.tracksColumn]) {
        try {
          rawData = typeof row[cfg.tracksColumn] === 'string' ? JSON.parse(row[cfg.tracksColumn]) : row[cfg.tracksColumn];
        } catch {
          rawData = null;
        }
      }

      const assessments = generateSkillEdgeAssessments(rawData || row);
      const score = Number(row[cfg.scoreColumn || 'total_reward_points']);
      const completionPct = Number(row[cfg.completionPctColumn || 'overall_completion_pct']);
      return {
        assessments,
        score: Number.isFinite(score) ? score : 0,
        completionPct: Number.isFinite(completionPct) ? completionPct : 0
      };
    } finally {
      await client.end();
    }
  } else if (cfg.dbType === 'sqlite') {
    const cleanedPath = cfg.connectionUrl.replace(/^sqlite:/, '');
    if (!fs.existsSync(cleanedPath)) return null;
    const sqlite = new betterSqlite3(cleanedPath, { readonly: true });
    try {
      const row = sqlite
        .prepare(`SELECT * FROM "${cfg.studentTable || 'students'}" WHERE LOWER(TRIM("${cfg.emailColumn || 'email'}")) = ?`)
        .get(normEmail) as any;

      if (!row) return null;

      let rawData: any = null;
      if (cfg.tracksColumn && row[cfg.tracksColumn]) {
        try {
          rawData = typeof row[cfg.tracksColumn] === 'string' ? JSON.parse(row[cfg.tracksColumn]) : row[cfg.tracksColumn];
        } catch {
          rawData = null;
        }
      }

      const assessments = generateSkillEdgeAssessments(rawData || row);
      const score = Number(row[cfg.scoreColumn || 'total_reward_points']);
      const completionPct = Number(row[cfg.completionPctColumn || 'overall_completion_pct']);
      return {
        assessments,
        score: Number.isFinite(score) ? score : 0,
        completionPct: Number.isFinite(completionPct) ? completionPct : 0
      };
    } finally {
      sqlite.close();
    }
  }

  return null;
}

/**
 * Synchronize a single student's SkillEdge assessment data
 */
export async function syncStudentSkillEdge(
  studentId: string,
  syncSource: 'DAILY_AUTO' | 'MANUAL_FACULTY' | 'MANUAL_HOD' | 'LIVE_READ' = 'DAILY_AUTO'
): Promise<SkillEdgeSyncResult> {
  const student = await db.getStudentById(studentId);
  if (!student) {
    throw new Error(`Student record not found for ID "${studentId}".`);
  }

  const registerNo = student.register_no || student.registerNo || '';
  const studentName = student.name || 'Student';
  const collegeEmail = normalizeEmail(student.email || student.college_email || student.personal_email || '');
  const now = new Date().toISOString();

  const existingRecord = await db.getSkillEdgeRecord(studentId);

  try {
    let liveResult = null;
    let liveError = false;

    try {
      liveResult = await fetchLiveRecordFromSkillEdge(collegeEmail);
    } catch (err: any) {
      liveError = true;
      console.warn(`⚠️ [SkillEdge Unreachable] ${err.message}`);
    }

    if (liveError) {
      return {
        studentId,
        studentName,
        registerNo,
        previousPoints: 0,
        currentPoints: 0,
        earnedDelta: 0,
        overallCompletionPct: 0,
        status: 'TEMPORARILY_UNAVAILABLE',
        lastSyncedAt: now,
        assessments: generateSkillEdgeAssessments(existingRecord?.tracks),
        errorMessage: 'SkillEdge data temporarily unavailable.'
      };
    }

    if (!liveResult) {
      const currentPoints = existingRecord?.totalRewardPoints ?? 0;
      const completionPct = existingRecord?.overallCompletionPct ?? 0;
      return {
        studentId,
        studentName,
        registerNo,
        previousPoints: currentPoints,
        currentPoints,
        earnedDelta: 0,
        overallCompletionPct: completionPct,
        status: 'NOT_LINKED',
        lastSyncedAt: existingRecord?.lastSyncedAt || now,
        assessments: generateSkillEdgeAssessments(existingRecord?.tracks)
      };
    }

    const assessments = liveResult.assessments;
    const previousPoints = existingRecord?.totalRewardPoints ?? 0;
    const currentPoints = liveResult.score;
    const earnedDelta = currentPoints - previousPoints;
    const skilledgeData = {
      overallCompletionPct: liveResult.completionPct,
      totalRewardPoints: currentPoints,
      previousPoints,
      earnedDelta,
      status: 'VERIFIED',
      skilledgeHandle: collegeEmail,
      lastSyncedAt: now,
      tracks: assessments,
      assessments
    };

    await db.saveSkillEdgeRecord(studentId, skilledgeData);

    await db.saveSkillEdgeSyncHistory({
      student_id: studentId,
      previousPoints,
      currentPoints,
      earnedDelta,
      overallCompletionPct: liveResult.completionPct,
      tracks: assessments,
      syncedAt: now,
      syncSource,
      status: 'SUCCESS'
    });

    return {
      studentId,
      studentName,
      registerNo,
      previousPoints,
      currentPoints,
      earnedDelta,
      overallCompletionPct: liveResult.completionPct,
      status: 'VERIFIED',
      lastSyncedAt: now,
      assessments
    };
  } catch (err: any) {
    const errorMsg = err.message || 'SkillEdge sync failed.';

    return {
      studentId,
      studentName,
      registerNo,
      previousPoints: 0,
      currentPoints: 0,
      earnedDelta: 0,
      overallCompletionPct: 0,
      status: 'FAILED',
      lastSyncedAt: now,
      assessments: generateSkillEdgeAssessments(existingRecord?.tracks),
      errorMessage: errorMsg
    };
  }
}

/**
 * Synchronize all students in the department
 */
export async function syncDepartmentSkillEdge(
  syncSource: 'DAILY_AUTO' | 'MANUAL_FACULTY' | 'MANUAL_HOD' | 'LIVE_READ' = 'DAILY_AUTO'
): Promise<{
  totalStudents: number;
  totalPointsEarned: number;
  syncedAt: string;
  results: SkillEdgeSyncResult[];
}> {
  if (isDepartmentSyncRunning) {
    throw new Error('SkillEdge synchronization is currently in progress. Please wait for the current job to finish.');
  }

  isDepartmentSyncRunning = true;
  const now = new Date().toISOString();
  const students = await db.getStudents('ALL', 'ALL');
  const results: SkillEdgeSyncResult[] = [];

  try {
    for (const stu of students) {
      try {
        const res = await syncStudentSkillEdge(stu.id, syncSource);
        results.push(res);
      } catch (err: any) {
        results.push({
          studentId: stu.id,
          studentName: stu.name,
          registerNo: stu.register_no || stu.registerNo || '',
          previousPoints: 0,
          currentPoints: 0,
          earnedDelta: 0,
          overallCompletionPct: 0,
          status: 'FAILED',
          lastSyncedAt: now,
          assessments: generateSkillEdgeAssessments(),
          errorMessage: err.message
        });
      }
    }

    globalLastDailySyncAt = now;
    return {
      totalStudents: students.length,
      totalPointsEarned: 0,
      syncedAt: now,
      results
    };
  } finally {
    isDepartmentSyncRunning = false;
  }
}

export function initSkillEdgeScheduler() {
  console.log('⚡ [SkillEdge Scheduler] Initializing automated SkillEdge assessment status sync job...');

  syncDepartmentSkillEdge('DAILY_AUTO')
    .then((summary) => {
      console.log(`✅ [SkillEdge Scheduler] Initial sync complete. Synced ${summary.totalStudents} student assessment profiles.`);
    })
    .catch((err) => {
      console.error(`⚠️ [SkillEdge Scheduler] Initial sync warning: ${err.message}`);
    });

  const FIFTEEN_MINUTES = 15 * 60 * 1000;
  setInterval(() => {
    console.log('⏰ [SkillEdge Scheduler] Running scheduled 15-minute automated SkillEdge assessment synchronization...');
    syncDepartmentSkillEdge('DAILY_AUTO')
      .then((summary) => {
        console.log(`✅ [SkillEdge Scheduler] Automated assessment sync complete. Synced ${summary.totalStudents} students.`);
      })
      .catch((err) => {
        console.error(`❌ [SkillEdge Scheduler] Automated sync failed: ${err.message}`);
      });
  }, FIFTEEN_MINUTES);
}

export function getLastDailySyncTimestamp(): string | null {
  return globalLastDailySyncAt;
}
