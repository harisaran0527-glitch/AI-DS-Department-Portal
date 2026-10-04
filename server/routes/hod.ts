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

// PUT HOD Faculty Assignment (Assign Faculty -> Year + Section)
router.put('/faculty-assignments/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { year, section, role } = req.body || {};

  const facultyUser = await db.getUserById(id);
  if (!facultyUser || facultyUser.role !== 'FACULTY') {
    return res.status(404).json({ error: 'Faculty account not found.' });
  }

  const yearToUse = String(year || facultyUser.year || '2nd Year').trim();
  const sectionToUse = String(section || facultyUser.section || 'A').trim();
  const roleToUse = String(role || facultyUser.faculty_role || 'Class Coordinator').trim();

  await db.updateUserAssignment(id, yearToUse, sectionToUse, roleToUse);
  if (req.user) {
    await db.logAudit(req.user.id, req.user.email, req.user.role, 'HOD_ASSIGN_FACULTY', `FACULTY:${facultyUser.email} -> ${yearToUse} Sec ${sectionToUse}`);
  }

  return res.json({ message: `Successfully assigned Faculty ${facultyUser.name} to ${yearToUse} Section ${sectionToUse}.` });
});

router.put('/faculty/:id', async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { year, section, role } = req.body || {};

  const facultyUser = await db.getUserById(id);
  if (!facultyUser || facultyUser.role !== 'FACULTY') {
    return res.status(404).json({ error: 'Faculty account not found.' });
  }

  const yearToUse = String(year || facultyUser.year || '2nd Year').trim();
  const sectionToUse = String(section || facultyUser.section || 'A').trim();
  const roleToUse = String(role || facultyUser.faculty_role || 'Class Coordinator').trim();

  await db.updateUserAssignment(id, yearToUse, sectionToUse, roleToUse);
  if (req.user) {
    await db.logAudit(req.user.id, req.user.email, req.user.role, 'HOD_ASSIGN_FACULTY', `FACULTY:${facultyUser.email} -> ${yearToUse} Sec ${sectionToUse}`);
  }

  return res.json({ message: `Successfully assigned Faculty ${facultyUser.name} to ${yearToUse} Section ${sectionToUse}.` });
});

// GET department students with hierarchy filters
router.get('/students', async (req: AuthRequest, res: Response) => {
  const { year, section } = req.query;
  const students = await db.getStudents(year as string, section as string);
  return res.json({ count: students.length, students });
});

// POST HOD Student Excel Import Preview (Validation & Conflict Detection)
router.post('/students/import-preview', async (req: AuthRequest, res: Response) => {
  try {
    const { facultyId, year, section, rows } = req.body || {};

    if (!facultyId || !year || !section) {
      return res.status(400).json({ error: 'Assigned Faculty, Year, and Section selection are required.' });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No student rows provided in Excel file.' });
    }

    // Verify assigned Faculty exists in DB with role 'FACULTY'
    const targetFaculty = await db.getUserById(facultyId);
    if (!targetFaculty || targetFaculty.role !== 'FACULTY') {
      return res.status(400).json({ error: `Selected Faculty account does not exist in system.` });
    }

    const allDbStudents = await db.getStudents('ALL', 'ALL');
    const existingRegNos = new Set(allDbStudents.map((s) => s.register_no.trim().toLowerCase()));
    const dbEmailToRegNo = new Map<string, string>();
    allDbStudents.forEach((s) => dbEmailToRegNo.set(s.email.trim().toLowerCase(), s.register_no.trim().toLowerCase()));

    const regNoInFileCount = new Map<string, number>();
    const emailInFileCount = new Map<string, number>();

    // First pass to detect file-level duplicates
    rows.forEach((r) => {
      const reg = String(r['Register Number'] || r['Register No'] || r.registerNo || r.register_no || r.regNo || '').trim().toLowerCase();
      const email = String(r['College Mail ID'] || r['College Email ID'] || r['College Mail'] || r.collegeEmail || r.email || '').trim().toLowerCase();
      if (reg) regNoInFileCount.set(reg, (regNoInFileCount.get(reg) || 0) + 1);
      if (email) emailInFileCount.set(email, (emailInFileCount.get(email) || 0) + 1);
    });

    let validCount = 0;
    let updateCount = 0;
    let errorCount = 0;

    const preview = rows.map((r, index) => {
      const rowNumber = index + 1;
      const errors: string[] = [];

      const name = String(r['Name'] || r['Student Name'] || r.name || '').trim();
      const registerNo = String(r['Register Number'] || r['Register No'] || r.registerNo || r.register_no || r.regNo || '').trim();
      const mobileNumber = String(r['Mobile Number'] || r['Mobile No'] || r.mobileNumber || r.mobile_number || r.phone || r['Contact Number'] || '').trim();
      const collegeEmail = String(r['College Mail ID'] || r['College Email ID'] || r['College Mail'] || r.collegeEmail || r.email || '').trim().toLowerCase();
      const personalEmail = String(r['Personal Mail ID'] || r['Personal Email ID'] || r['Personal Email'] || r.personalEmail || r.personal_email || '').trim().toLowerCase();
      const address = String(r['Address'] || r.address || '').trim();
      
      const rawCgpa = r['CGPA'] !== undefined ? r['CGPA'] : (r.cgpa !== undefined ? r.cgpa : undefined);
      let cgpa: number | null = null;

      if (!name) errors.push('Missing required student Name.');
      if (!registerNo) errors.push('Missing required Register Number.');
      if (!collegeEmail) errors.push('Missing required College Mail ID.');

      if (collegeEmail && !collegeEmail.includes('@')) {
        errors.push('Invalid College Mail ID format (missing @).');
      }

      if (personalEmail && !personalEmail.includes('@')) {
        errors.push('Invalid Personal Mail ID format (missing @).');
      }

      if (rawCgpa !== undefined && rawCgpa !== null) {
        const str = String(rawCgpa).trim();
        if (str !== '' && str.toUpperCase() !== 'N/A' && str.toUpperCase() !== 'NULL' && str.toUpperCase() !== 'NOT AVAILABLE') {
          const parsedCgpa = parseFloat(str);
          if (isNaN(parsedCgpa) || parsedCgpa < 0 || parsedCgpa > 10) {
            errors.push('CGPA must be a valid number between 0.00 and 10.00 or left blank.');
          } else {
            cgpa = parsedCgpa;
          }
        }
      }

      const lowerReg = registerNo.toLowerCase();
      const lowerEmail = collegeEmail.toLowerCase();

      if (lowerReg && (regNoInFileCount.get(lowerReg) || 0) > 1) {
        errors.push(`Duplicate Register Number "${registerNo}" found in Excel file.`);
      }

      if (lowerEmail && (emailInFileCount.get(lowerEmail) || 0) > 1) {
        errors.push(`Duplicate College Mail ID "${collegeEmail}" found in Excel file.`);
      }

      if (lowerEmail && dbEmailToRegNo.has(lowerEmail)) {
        const ownerReg = dbEmailToRegNo.get(lowerEmail);
        if (ownerReg && ownerReg !== lowerReg) {
          errors.push(`College Mail ID "${collegeEmail}" is already assigned to student ${ownerReg.toUpperCase()} in system.`);
        }
      }

      const isUpdate = existingRegNos.has(lowerReg);
      let status: 'VALID_NEW' | 'UPDATE_EXISTING' | 'ERROR' = 'VALID_NEW';

      if (errors.length > 0) {
        status = 'ERROR';
        errorCount++;
      } else if (isUpdate) {
        status = 'UPDATE_EXISTING';
        updateCount++;
        validCount++;
      } else {
        validCount++;
      }

      return {
        rowNumber,
        status,
        errors,
        parsedData: {
          name,
          registerNo,
          mobileNumber: mobileNumber || null,
          collegeEmail,
          personalEmail: personalEmail || null,
          address: address || null,
          cgpa
        }
      };
    });

    return res.json({
      faculty: { id: targetFaculty.id, name: targetFaculty.name, email: targetFaculty.email },
      year,
      section,
      totalRows: rows.length,
      validRowsCount: validCount,
      updateRowsCount: updateCount,
      errorRowsCount: errorCount,
      canImport: errorCount === 0 && validCount > 0,
      preview
    });
  } catch (err: any) {
    console.error('❌ HOD Excel Preview Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to parse and validate Excel file.' });
  }
});

// POST HOD Student Excel Import Confirm (Execute Bulk Upsert & Student Login Creation)
router.post('/students/import-confirm', async (req: AuthRequest, res: Response) => {
  try {
    const { facultyId, year, section, batch, students } = req.body || {};

    if (!facultyId || !year || !section) {
      return res.status(400).json({ error: 'Assigned Faculty, Year, and Section selection are required.' });
    }

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'No student records provided for import.' });
    }

    // Verify assigned Faculty exists in DB with role 'FACULTY'
    const targetFaculty = await db.getUserById(facultyId);
    if (!targetFaculty || targetFaculty.role !== 'FACULTY') {
      return res.status(400).json({ error: `Selected Faculty account does not exist in system.` });
    }

    const importedList: any[] = [];
    const yearToUse = String(year).trim();
    const sectionToUse = String(section).trim();
    const batchToUse = batch || '2023-2027';

    for (const s of students) {
      const reg = String(s.registerNo || s.register_no || s['Register Number'] || s['Register No'] || '').trim();
      const mail = String(s.collegeEmail || s.email || s['College Mail ID'] || s['College Email ID'] || '').trim();
      const name = String(s.name || s['Name'] || s['Student Name'] || '').trim();

      if (!reg || !mail || !name) continue;

      const rawCgpa = s.cgpa !== undefined ? s.cgpa : (s['CGPA'] !== undefined ? s['CGPA'] : undefined);
      let cgpaVal: number | null = null;
      if (rawCgpa !== undefined && rawCgpa !== null) {
        const str = String(rawCgpa).trim();
        if (str !== '' && str.toUpperCase() !== 'N/A' && str.toUpperCase() !== 'NULL' && str.toUpperCase() !== 'NOT AVAILABLE') {
          const parsed = parseFloat(str);
          if (!isNaN(parsed)) cgpaVal = parsed;
        }
      }

      const updatedStudent = await db.upsertStudentWithUserLogin({
        registerNo: reg,
        name,
        email: mail,
        mobileNumber: s.mobileNumber || s.mobile_number || s['Mobile Number'] || s['Mobile No'],
        personalEmail: s.personalEmail || s.personal_email || s['Personal Mail ID'] || s['Personal Email ID'],
        address: s.address || s['Address'],
        cgpa: cgpaVal,
        year: yearToUse,
        section: sectionToUse,
        batch: s.batch || batchToUse,
        createdByFacultyId: facultyId
      });

      importedList.push(updatedStudent);
    }

    if (req.user) {
      await db.logAudit(req.user.id, req.user.email, req.user.role, 'HOD_BULK_IMPORT_STUDENTS', `Imported ${importedList.length} student records assigned to Faculty ${targetFaculty.name} (${yearToUse} Sec ${sectionToUse}).`);
    }

    return res.status(201).json({
      message: `Successfully imported/updated ${importedList.length} individual student accounts mapped to Faculty ${targetFaculty.name} (${yearToUse} Section ${sectionToUse}). Student logins synchronized with initial password = Register Number.`,
      importedCount: importedList.length,
      students: importedList
    });
  } catch (err: any) {
    console.error('❌ HOD Excel Import Confirm Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to execute bulk student import.' });
  }
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
    return res.json({
      message: 'Award finalized successfully.',
      award: awardObj
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to finalize award.' });
  }
});

// GET Gemini AI Award Candidates for HOD Command Center
router.get('/award-candidates-v2', async (req: AuthRequest, res: Response) => {
  try {
    const { evaluateAllStudentsRewardPoints } = await import('../services/studentRewardEngine.js');
    const evaluations = await evaluateAllStudentsRewardPoints();

    const finalizedAwards = await db.getFinalizedAwards();
    const approvedSet = new Map(finalizedAwards.map((a: any) => [a.winner_student_id || a.winnerStudentId, a]));

    const candidates = evaluations.map((ev, index) => {
      const existingAward = approvedSet.get(ev.studentId);
      return {
        id: existingAward?.id || `cand-${ev.studentId}`,
        rank: index + 1,
        studentId: ev.studentId,
        studentName: ev.studentName,
        registerNo: ev.registerNo,
        year: ev.year,
        section: ev.section,
        totalRewardScore: ev.totalRewardScore,
        performanceLevel: ev.performanceLevel,
        awardCategory: ev.recommendedAward,
        recommendedAward: ev.recommendedAward,
        aiReasoning: ev.aiReasoning,
        activitiesConsidered: ev.activitiesConsidered,
        evidenceSources: ev.evidenceSources,
        categoryPoints: ev.categoryPoints,
        status: existingAward ? (existingAward.status || 'APPROVED') : 'PENDING_REVIEW',
        rejectionReason: existingAward?.rejection_reason || null
      };
    });

    return res.json({ count: candidates.length, candidates });
  } catch (err: any) {
    console.error('Error fetching award candidates:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch award candidates.' });
  }
});

// POST HOD Action on Award Candidate (APPROVE / REJECT)
router.post('/awards/:studentId/action', async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const { action, awardTitle, reason } = req.body;

    if (!action || !['APPROVE', 'REJECT'].includes(action.toUpperCase())) {
      return res.status(400).json({ error: 'Action must be either "APPROVE" or "REJECT".' });
    }

    const student = await db.getStudentById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student record not found.' });
    }

    const cleanAction = action.toUpperCase() as 'APPROVE' | 'REJECT';
    const now = new Date().toISOString();

    const awardObj = {
      id: `awd-${studentId}-${Date.now()}`,
      awardKey: cleanAction === 'APPROVE' ? 'APPROVED_AWARD' : 'REJECTED_AWARD',
      awardTitle: awardTitle || 'Department Recognition Award',
      winnerStudentId: student.id,
      winnerStudentName: student.name,
      registerNo: student.register_no || student.registerNo,
      year: student.year,
      section: student.section,
      overallScore: student.overall_score || 0,
      finalizedAt: now,
      finalizedByHODName: req.user?.name || 'Head of Department',
      aiExplanation: cleanAction === 'APPROVE'
        ? `Approved by HOD: ${student.name} confirmed for ${awardTitle || 'Department Award'}.`
        : `Rejected by HOD: ${reason || 'Decision reviewed by HOD.'}`,
      status: cleanAction === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      rejectionReason: cleanAction === 'REJECT' ? (reason || 'Decision reviewed by HOD.') : undefined
    };

    await db.finalizeAward(awardObj);
    await db.logAudit(req.user!.id, req.user!.email, req.user!.role, `HOD_${cleanAction}_AWARD`, `STUDENT:${student.register_no || student.registerNo}`);

    return res.json({
      message: cleanAction === 'APPROVE'
        ? `Successfully approved award recommendation for ${student.name}.`
        : `Award recommendation for ${student.name} has been rejected.`,
      award: awardObj
    });
  } catch (err: any) {
    console.error('Error processing award action:', err);
    return res.status(500).json({ error: err.message || 'Failed to process award action.' });
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
  const totalStudents = assignedRoster.length;
  const student360List = await Promise.all(assignedRoster.map((s) => db.getStudent360(s.id)));

  // Compute workspace summary metrics
  const studentsWithCgpa = assignedRoster.filter((s) => s.cgpa !== null && s.cgpa !== undefined && !isNaN(Number(s.cgpa)));
  const avgCgpa = studentsWithCgpa.length > 0
    ? studentsWithCgpa.reduce((acc, s) => acc + Number(s.cgpa), 0) / studentsWithCgpa.length
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
