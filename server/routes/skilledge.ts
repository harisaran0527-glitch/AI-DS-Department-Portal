import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { syncDepartmentSkillEdge, syncStudentSkillEdge } from '../services/skilledgeSync.js';
import { normalizeEmail } from '../../scripts/skilledge_connector.js';

const router = Router();

/**
 * POST /api/skilledge/sync-ingest
 * Ingestion endpoint for Local Institutional Sync Daemon.
 * Allows institutional local sync agent to securely push updated SkillEdge data to Neon PostgreSQL.
 */
router.post('/sync-ingest', async (req: Request, res: Response) => {
  const syncSecret = process.env.SKILLEDGE_SYNC_TOKEN || 'aids-skilledge-sync-secret';
  const clientSecret = req.headers['x-skilledge-sync-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (clientSecret !== syncSecret && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'Unauthorized: Invalid SkillEdge sync token.' });
  }

  const { records } = req.body || {};

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Invalid payload. "records" array is required.' });
  }

  const students = await db.getStudents('ALL', 'ALL');
  let updatedCount = 0;
  let unlinkedCount = 0;

  for (const rec of records) {
    const normEmail = normalizeEmail(rec.collegeEmail || rec.email);
    if (!normEmail) continue;

    const matchedStudent = students.find((s) => {
      const stuEmail = normalizeEmail(s.email || s.college_email || s.personal_email);
      return stuEmail === normEmail;
    });

    if (matchedStudent) {
      updatedCount++;
      const score = Number(rec.score || rec.totalRewardPoints || 0);
      const pct = Number(rec.completionPct || rec.overallCompletionPct || 0);
      const tracks = Array.isArray(rec.tracks) ? rec.tracks : [];

      await db.saveSkillEdgeRecord(matchedStudent.id, {
        overallCompletionPct: pct,
        totalRewardPoints: score,
        previousPoints: 0,
        earnedDelta: 0,
        status: 'VERIFIED',
        skilledgeHandle: normEmail,
        lastSyncedAt: new Date().toISOString(),
        tracks
      });
    } else {
      unlinkedCount++;
    }
  }

  return res.json({
    message: 'SkillEdge live metrics ingested successfully.',
    totalReceived: records.length,
    matchedAndUpdated: updatedCount,
    unlinkedRecords: unlinkedCount,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/skilledge/trigger-sync
 * Manual trigger for department-wide SkillEdge synchronization.
 */
router.post('/trigger-sync', async (req: Request, res: Response) => {
  try {
    const summary = await syncDepartmentSkillEdge('MANUAL_HOD');
    return res.json({
      message: 'Department-wide SkillEdge synchronization completed successfully.',
      summary
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Department SkillEdge sync failed.' });
  }
});

export default router;
