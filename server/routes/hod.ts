import { Router, Response } from 'express';
import { db } from '../db.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';
import {
  calculateCategoryScores,
  computeOverallScore,
  computeLeetCodeAwardScore,
  computeEliteStudentScore,
  computeTeamHeadScore,
  computeRepresentativeScore,
  generateAIExplanation,
  generateFinalCandidateRecommendation
} from '../scoringEngine.js';

const router = Router();

router.use(authenticateToken, requireRole('HOD'));

// GET Faculty List from production DB for HOD portal
router.get('/faculty', async (req: AuthRequest, res: Response) => {
  const facultyUsers = await db.getUsers('FACULTY');
  const assignmentsMap = await db.getAllFacultyAssignments();
  const enriched = facultyUsers.map((f) => {
    const assignment = assignmentsMap[f.id];
    const { password_hash: _ph, ...safe } = f;
    return {
      ...safe,
      year: assignment ? assignment.year : f.year,
      section: assignment ? assignment.section : f.section,
      facultyRole: assignment ? assignment.role : f.faculty_role,
      department: assignment ? assignment.department : 'AI & DS',
      isActive: Boolean(f.is_active)
    };
  });
  return res.json({ count: enriched.length, faculty: enriched });
});

router.get('/faculty-list', async (req: AuthRequest, res: Response) => {
  const facultyUsers = await db.getUsers('FACULTY');
  const assignmentsMap = await db.getAllFacultyAssignments();
  const enriched = facultyUsers.map((f) => {
    const assignment = assignmentsMap[f.id];
    const { password_hash: _ph, ...safe } = f;
    return {
      ...safe,
      year: assignment ? assignment.year : f.year,
      section: assignment ? assignment.section : f.section,
      facultyRole: assignment ? assignment.role : f.faculty_role,
      department: assignment ? assignment.department : 'AI & DS',
      isActive: Boolean(f.is_active)
    };
  });
  return res.json({ count: enriched.length, faculty: enriched });
});

// GET department students with hierarchy filters
router.get('/students', async (req: AuthRequest, res: Response) => {
  const { year, section } = req.query;
  const students = await db.getStudents(year as string, section as string);
  return res.json({ count: students.length, students });
});

// GET department Elite Students
router.get('/elite-students', async (req: AuthRequest, res: Response) => {
  const { year, section } = req.query;
  const students = await db.getEliteStudents(year as string, section as string);
  return res.json({ count: students.length, students });
});

// POST toggle student Elite designation (Blocked - READ-ONLY FOR HOD)
router.post('/students/:studentId/elite-status', async (req: AuthRequest, res: Response) => {
  return res.status(403).json({ error: 'Forbidden: HOD student profile view is strictly READ-ONLY. Student records must be modified by assigned Class Coordinator or Admin.' });
});

// POST update student profile (Blocked - READ-ONLY FOR HOD)
router.post('/students/:studentId/update-profile', async (req: AuthRequest, res: Response) => {
  return res.status(403).json({ error: 'Forbidden: HOD student profile view is strictly READ-ONLY. Student records must be modified by assigned Class Coordinator or Admin.' });
});

// GET single student 360 profile for HOD (department wide)
router.get('/students/:studentId/360', async (req: AuthRequest, res: Response) => {
  const { studentId } = req.params;
  const full360 = await db.getStudent360(studentId);

  if (!full360) {
    return res.status(404).json({ error: 'Student profile not found.' });
  }

  const scoringConfig = await db.getScoringConfig();
  const categoryScores = calculateCategoryScores(
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

  const overallScore = computeOverallScore(categoryScores, scoringConfig);

  return res.json({
    ...full360,
    breakdown: {
      overallScore,
      categoryScores
    }
  });
});

// GET HOD AI Recognition Award Candidates for ALL 5 AWARDS
router.get('/awards/candidates', async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.query;
    const pool = await db.getStudents(year as string, 'ALL');

    if (pool.length === 0) {
      return res.json({ candidates: null });
    }

    // Calculate detailed performance candidates for pool
    const candidatesDataRaw = await Promise.all(
      pool.map(async (stu) => {
        const full360 = await db.getStudent360(stu.id);
        if (!full360 || !full360.student) return null;

        const config = await db.getScoringConfig();
        const breakdown = calculateCategoryScores(
          full360.student as any,
          full360.academics,
          full360.arrears,
          full360.skillEdge,
          full360.nptel,
          full360.attendance,
          full360.discipline,
          full360.leetcode,
          full360.projects || [],
          full360.certificates || [],
          full360.participation || []
        );

        const overallScore = computeOverallScore(breakdown, config);
        const leetCodeAwardScore = computeLeetCodeAwardScore(full360.leetcode);
        const eliteAwardScore = computeEliteStudentScore(breakdown);
        const teamHeadAwardScore = computeTeamHeadScore(stu as any, full360.projects || []);
        const representativeAwardScore = computeRepresentativeScore(stu as any, breakdown.attendance);

        return {
          student: full360.student,
          full360,
          breakdown,
          overallScore,
          leetCodeAwardScore,
          eliteAwardScore,
          teamHeadAwardScore,
          representativeAwardScore
        };
      })
    );
    const candidatesData = candidatesDataRaw.filter(Boolean) as any[];

    if (candidatesData.length === 0) {
      return res.json({ candidates: null, shortlist: [], finalCandidate: null });
    }

    const sortedByOverall = [...candidatesData].sort((a, b) => b.overallScore - a.overallScore);
    const shortlist = sortedByOverall.slice(0, 2);
    const finalCandidate = generateFinalCandidateRecommendation(shortlist);

    const bestStudentCand = sortedByOverall[0];
    const bestLeetCodeCand = [...candidatesData].sort((a, b) => b.leetCodeAwardScore - a.leetCodeAwardScore)[0];
    const eliteStudentCand = [...candidatesData].sort((a, b) => b.eliteAwardScore - a.eliteAwardScore)[0];
    const bestTeamHeadCand = [...candidatesData].sort((a, b) => b.teamHeadAwardScore - a.teamHeadAwardScore)[0];
    const bestRepCand = [...candidatesData].sort((a, b) => b.representativeAwardScore - a.representativeAwardScore)[0];

    return res.json({
      shortlist,
      finalCandidate,
      candidates: {
        bestStudent: bestStudentCand
          ? {
              student: bestStudentCand.student,
              breakdown: bestStudentCand.breakdown,
              overallScore: bestStudentCand.overallScore,
              aiExplanation: generateAIExplanation('BEST_STUDENT', bestStudentCand.student as any, bestStudentCand.breakdown, bestStudentCand.overallScore)
            }
          : null,
        bestLeetCode: bestLeetCodeCand
          ? {
              student: bestLeetCodeCand.student,
              overallScore: bestLeetCodeCand.leetCodeAwardScore,
              aiExplanation: generateAIExplanation('BEST_LEETCODE', bestLeetCodeCand.student as any, bestLeetCodeCand.breakdown, bestLeetCodeCand.leetCodeAwardScore, bestLeetCodeCand.full360.leetcode)
            }
          : null,
        eliteStudent: eliteStudentCand
          ? {
              student: eliteStudentCand.student,
              overallScore: eliteStudentCand.eliteAwardScore,
              aiExplanation: generateAIExplanation('ELITE_STUDENT', eliteStudentCand.student as any, eliteStudentCand.breakdown, eliteStudentCand.eliteAwardScore)
            }
          : null,
        bestTeamHead: bestTeamHeadCand
          ? {
              student: bestTeamHeadCand.student,
              overallScore: bestTeamHeadCand.teamHeadAwardScore,
              aiExplanation: generateAIExplanation('BEST_TEAM_HEAD', bestTeamHeadCand.student as any, bestTeamHeadCand.breakdown, bestTeamHeadCand.teamHeadAwardScore)
            }
          : null,
        bestRepresentative: bestRepCand
          ? {
              student: bestRepCand.student,
              overallScore: bestRepCand.representativeAwardScore,
              aiExplanation: generateAIExplanation('BEST_REPRESENTATIVE', bestRepCand.student as any, bestRepCand.breakdown, bestRepCand.representativeAwardScore)
            }
          : null
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to compute award candidates.' });
  }
});

// GET Scoring Configuration
router.get('/scoring-config', async (req: AuthRequest, res: Response) => {
  const config = await db.getScoringConfig();
  return res.json({ config });
});

// PUT Save / Update Scoring Configuration
router.put('/scoring-config', async (req: AuthRequest, res: Response) => {
  const { config } = req.body;
  if (!config) {
    return res.status(400).json({ error: 'Config payload is required.' });
  }

  await db.saveScoringConfig(config);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPDATE_SCORING_CONFIG', 'SCORING_CONFIGURATION');

  return res.json({ message: 'Scoring configuration updated successfully.', config });
});

// PUT HOD Correct / Update Any Student 360 Record (Blocked - READ-ONLY FOR HOD)
router.put('/students/:studentId/360', async (req: AuthRequest, res: Response) => {
  return res.status(403).json({ error: 'Forbidden: HOD student profile view is strictly READ-ONLY. Student records must be modified by assigned Class Coordinator or Admin.' });
});

// POST Trigger Department-Wide SkillEdge Synchronization by HOD
router.post('/sync-skilledge-all', async (req: AuthRequest, res: Response) => {
  try {
    const { syncDepartmentSkillEdge } = await import('../services/skilledgeSync.js');
    const summary = await syncDepartmentSkillEdge('MANUAL_HOD');
    await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'HOD_SYNC_SKILLEDGE_DEPARTMENT', 'DEPARTMENT');
    return res.json({
      message: `Department-wide SkillEdge synchronization completed for all ${summary.totalStudents} students. Total points earned across department: +${summary.totalPointsEarned}.`,
      summary
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to synchronize department SkillEdge metrics.' });
  }
});

// DELETE Any Student Performance Record by HOD (Blocked - READ-ONLY FOR HOD)
router.delete('/students/:studentId/records/:recordType/:recordId', async (req: AuthRequest, res: Response) => {
  return res.status(403).json({ error: 'Forbidden: HOD student profile view is strictly READ-ONLY. Student records must be modified by assigned Class Coordinator or Admin.' });
});

// POST Finalize Award (Converts Candidate -> Finalized Award in SQLite)
router.post('/awards/finalize', async (req: AuthRequest, res: Response) => {
  try {
    const awardKey = req.body.awardKey || 'BEST_STUDENT';
    const awardTitle = req.body.awardTitle || req.body.awardName || 'Best Student of Department';
    const winnerStudentId = req.body.winnerStudentId;
    const aiExplanation = req.body.aiExplanation || req.body.explanation || 'Finalized based on top overall department performance.';

    const winner = await db.getStudentById(winnerStudentId);

    if (!winner) {
      return res.status(404).json({ error: 'Winner student record not found.' });
    }

    const awardObj = {
      id: `awd-${Date.now()}`,
      awardKey,
      awardTitle,
      winnerStudentId: winner.id,
      winnerStudentName: winner.name,
      registerNo: winner.register_no,
      year: winner.year,
      section: winner.section,
      overallScore: winner.overall_score || 0,
      finalizedAt: new Date().toISOString().split('T')[0],
      finalizedByHODName: req.user ? req.user.name : 'HOD AI & DS',
      aiExplanation
    };

    await db.finalizeAward(awardObj);
    await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'FINALIZE_AWARD', `AWARD:${awardKey}:${winner.register_no}`);

    return res.status(201).json({ message: 'Award finalized successfully.', award: awardObj });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to finalize award.' });
  }
});

// DELETE Finalized Award by HOD
router.delete('/awards/:awardId', async (req: AuthRequest, res: Response) => {
  const { awardId } = req.params;
  await db.deleteFinalizedAward(awardId);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'DELETE_FINALIZED_AWARD', `AWARD:${awardId}`);
  return res.json({ message: 'Finalized award deleted successfully.' });
});

// POST Add new performance record item by HOD (Blocked - READ-ONLY FOR HOD)
router.post('/students/:studentId/records/:recordType', async (req: AuthRequest, res: Response) => {
  return res.status(403).json({ error: 'Forbidden: HOD student profile view is strictly READ-ONLY. Student records must be modified by assigned Class Coordinator or Admin.' });
});

// GET all faculty list for HOD Panel (single source of truth synchronized with Admin creates)
router.get('/faculty', async (req: AuthRequest, res: Response) => {
  const facultyUsers = await db.getUsers('FACULTY');
  const enriched = await Promise.all(
    facultyUsers.map(async (f) => {
      const assignment = await db.getFacultyAssignment(f.id);
      const assignedYear = assignment ? assignment.year : f.year || '2nd Year';
      const assignedSection = assignment ? assignment.section : f.section || 'A';
      const assignedRoster = await db.getStudentsForFaculty(f.id, assignedYear, assignedSection);

      return {
        id: f.id,
        email: f.email,
        identifier: f.identifier,
        name: f.name,
        role: f.role,
        year: assignedYear,
        section: assignedSection,
        facultyRole: assignment ? assignment.role : f.faculty_role || 'Class Coordinator',
        department: assignment ? assignment.department : 'AI & DS',
        isActive: Boolean(f.is_active),
        createdAt: f.created_at,
        assignedStudentsCount: assignedRoster.length
      };
    })
  );

  return res.json({ count: enriched.length, faculty: enriched });
});

// GET dedicated individual faculty workspace details for HOD inspection
router.get('/faculty/:facultyId', async (req: AuthRequest, res: Response) => {
  const { facultyId } = req.params;
  const facultyUser = await db.getUserById(facultyId);

  if (!facultyUser || facultyUser.role !== 'FACULTY') {
    return res.status(404).json({ error: 'Faculty member not found.' });
  }

  const assignment = await db.getFacultyAssignment(facultyId);
  const assignedYear = assignment ? assignment.year : facultyUser.year || '2nd Year';
  const assignedSection = assignment ? assignment.section : facultyUser.section || 'A';

  const assignedRoster = await db.getStudentsForFaculty(facultyId, assignedYear, assignedSection);
  const student360List = await Promise.all(assignedRoster.map((s) => db.getStudent360(s.id)));

  // Compute workspace summary metrics
  const totalStudents = assignedRoster.length;
  const avgCgpa = totalStudents > 0
    ? assignedRoster.reduce((acc, s) => acc + (s.cgpa || 0), 0) / totalStudents
    : 0;

  const avgSkillEdge = totalStudents > 0
    ? student360List.reduce((acc, s) => acc + (s?.skillEdge?.totalRewardPoints || 0), 0) / totalStudents
    : 0;

  const totalCertificates = student360List.reduce((acc, s) => acc + (s?.certificates?.length || 0), 0);
  const totalEvents = student360List.reduce((acc, s) => acc + (s?.participation?.length || 0), 0);
  const totalProjects = student360List.reduce((acc, s) => acc + (s?.projects?.length || 0), 0);

  return res.json({
    faculty: {
      id: facultyUser.id,
      name: facultyUser.name,
      email: facultyUser.email,
      identifier: facultyUser.identifier,
      role: facultyUser.role,
      year: assignedYear,
      section: assignedSection,
      facultyRole: assignment ? assignment.role : facultyUser.faculty_role || 'Class Coordinator',
      department: assignment ? assignment.department : 'AI & DS',
      isActive: Boolean(facultyUser.is_active),
      createdAt: facultyUser.created_at
    },
    students: assignedRoster,
    workspace360: student360List,
    summary: {
      totalStudents,
      avgCgpa: Number(avgCgpa.toFixed(2)),
      avgSkillEdge: Math.round(avgSkillEdge),
      totalCertificates,
      totalEvents,
      totalProjects,
      topStudent: assignedRoster[0] || null
    }
  });
});

export default router;
