import { Router, Response } from 'express';
import { db } from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { calculateCategoryScores, computeOverallScore, generateAIExplanation } from '../scoringEngine';

const router = Router();

router.use(authenticateToken, requireRole('STUDENT'));

// GET student's own 360 profile (WITH AUTOMATIC LIVE REFRESH ON OPEN)
router.get('/me', async (req: AuthRequest, res: Response) => {
  const stuRecord =
    (req.user?.studentId ? db.getStudentById(req.user.studentId) : null) ||
    db.getStudentById(req.user!.id) ||
    (req.user?.registerNo ? db.getStudentByRegisterNo(req.user.registerNo) : null) ||
    ((req.user as any)?.identifier ? db.getStudentByRegisterNo((req.user as any).identifier) : null) ||
    db.getStudents('ALL', 'ALL').find(
      (s) =>
        (s.email && s.email.trim().toLowerCase() === req.user!.email.trim().toLowerCase()) ||
        (s.college_email && s.college_email.trim().toLowerCase() === req.user!.email.trim().toLowerCase())
    );

  if (!stuRecord) {
    return res.status(404).json({ error: 'Student profile not found.' });
  }

  const studentId = stuRecord.id;
  const initial360 = db.getStudent360(studentId);

  // Auto-refresh LeetCode profile statistics when profile is opened if handle is connected & data is stale (> 5 mins)
  const connAccs = db.getConnectedAccounts(studentId);
  const lcConn = connAccs.find((a: any) => a.provider === 'LeetCode');
  const handle = lcConn?.provider_username || initial360?.leetcode?.username;

  if (handle && !['student', 'leetcode_user', 'null', 'undefined'].includes(handle.toLowerCase())) {
    const lastSynced = lcConn?.last_synced_at || initial360?.leetcode?.lastUpdated;
    const isStale = !lastSynced || (Date.now() - new Date(lastSynced).getTime() > 300000);
    if (isStale) {
      try {
        const { syncLeetCodeProfile } = await import('../services/externalSync');
        await syncLeetCodeProfile(studentId, handle);
      } catch (_err) {
        // Silently preserve verified database statistics if live fetch fails during page open
      }
    }
  }

  const full360 = db.getStudent360(studentId) || initial360;

  if (!full360) {
    return res.status(404).json({ error: 'Student profile 360 not found.' });
  }

  const finalizedAwards = db.getFinalizedAwards().filter((a: any) => a.winner_student_id === studentId || a.winnerStudentId === studentId);
  const teams = db.getTeams().filter((t: any) => t.team_head_student_id === studentId || (t.members || []).some((m: any) => m.student_id === studentId));
  const representativeEvaluation = db.getRepresentativeEvaluation(studentId);
  const scoringConfig = db.getScoringConfig();

  const breakdown = calculateCategoryScores(
    full360.student as any,
    full360.academics,
    full360.arrears,
    full360.skillEdge,
    full360.nptel,
    full360.attendance,
    full360.discipline,
    full360.leetcode,
    full360.projects
  );

  const overallScore = computeOverallScore(breakdown, scoringConfig);
  const aiInsight = generateAIExplanation('BEST_STUDENT', full360.student as any, breakdown, overallScore, full360.leetcode);

  return res.json({
    ...full360,
    finalizedAwards,
    teams,
    representativeEvaluation,
    breakdown: {
      overallScore,
      categoryScores: breakdown,
      aiExplanation: aiInsight
    }
  });
});

// GET Connected Accounts & Verified External Metrics (READ-ONLY FOR STUDENT)
router.get('/connected-accounts', (req: AuthRequest, res: Response) => {
  let studentId = req.user!.studentId || req.user!.id;
  const studentObj = db.getStudentByRegisterNo(req.user!.registerNo || '') || db.getStudentById(studentId);
  if (studentObj) studentId = studentObj.id;

  const connectedAccounts = db.getConnectedAccounts(studentId);
  const externalMetrics = db.getExternalMetrics(studentId);

  return res.json({
    connectedAccounts,
    externalMetrics
  });
});

// POST Refresh / Sync Student's Own LeetCode Statistics
router.post('/sync-leetcode', async (req: AuthRequest, res: Response) => {
  try {
    let studentId = req.user!.studentId || req.user!.id;
    const studentObj = db.getStudentByRegisterNo(req.user!.registerNo || '') || db.getStudentById(studentId);
    if (studentObj) studentId = studentObj.id;

    const full360 = db.getStudent360(studentId);
    const connAccs = db.getConnectedAccounts(studentId);
    const lcConn = connAccs.find((a: any) => a.provider === 'LeetCode');
    const handle = lcConn?.provider_username || full360?.leetcode?.username;

    if (!handle || ['student', 'leetcode_user', 'null', 'undefined'].includes(handle.toLowerCase())) {
      return res.status(400).json({ error: 'No valid LeetCode handle connected to your profile. Please contact your Class Coordinator.' });
    }

    const { syncLeetCodeProfile } = await import('../services/externalSync');
    const result = await syncLeetCodeProfile(studentId, handle);

    return res.json({
      message: 'LeetCode statistics updated successfully from official profile.',
      result
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to refresh LeetCode statistics. Preserving previously saved statistics.' });
  }
});

// POST Refresh / Sync Student's Own NPTEL Courses & Certificate Verification
router.post('/sync-nptel', async (req: AuthRequest, res: Response) => {
  try {
    let studentId = req.user!.studentId || req.user!.id;
    const studentObj = db.getStudentByRegisterNo(req.user!.registerNo || '') || db.getStudentById(studentId);
    if (studentObj) studentId = studentObj.id;

    const { email } = req.body || {};
    const { syncNPTELProfile } = await import('../services/externalSync');
    const result = await syncNPTELProfile(studentId, email);

    return res.json({
      message: 'NPTEL course information & SWAYAM verification updated successfully.',
      result
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to refresh NPTEL course details.' });
  }
});

// Reject ANY modification attempt on other endpoints from Student role
router.all('*', (req: AuthRequest, res: Response, next) => {
  if (req.method !== 'GET') {
    return res.status(403).json({ error: 'Forbidden: Student Portal is strictly View-Only for manual records.' });
  }
  next();
});

export default router;
