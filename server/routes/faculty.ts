import { Router, Request, Response } from 'express';
import { extractAttendanceFromImage } from '../services/attendanceOcr.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db, normalizeYear, normalizeSection, normalizeSemester } from '../db.js';
import { executeRun, queryAll, queryOne, isPostgresActive } from '../postgresAdapter.js';
import { authenticateToken, requireRole, verifyFacultySectionAccess, AuthRequest, getRouteParam } from '../middleware/auth.js';
import { calculateCategoryScores, computeOverallScore } from '../scoringEngine.js';
import { generateSecureRandomPassword } from '../services/security.js';
import {
  MAX_FILE_SIZE_BYTES,
  MSG_FILE_TOO_LARGE,
  DANGEROUS_EXTENSIONS,
  PROOF_ALLOWED_EXTENSIONS,
  uploadFileToStorage,
  downloadFileFromStorage,
  deleteFileFromStorage,
  getMimeFromPath
} from '../storage.js';

const router = Router();

// In-Memory storage: avoids ephemeral /tmp loss on Vercel Serverless
const nptelProofStorage = multer.memoryStorage();
const certStorage = multer.memoryStorage();

const nptelProofUpload = multer({
  storage: nptelProofStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return cb(new Error('Executable or script files are strictly prohibited.'));
    }
    if (!PROOF_ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('Invalid file type. Supported formats are PDF, JPG, and PNG under 10 MB.'));
    }
    cb(null, true);
  }
});

const certUpload = multer({
  storage: certStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return cb(new Error('Executable or script files are strictly prohibited.'));
    }
    if (!PROOF_ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('Invalid file type. Supported formats are PDF, JPG, and PNG under 10 MB.'));
    }
    cb(null, true);
  }
});

router.use(authenticateToken, requireRole('FACULTY', 'HOD', 'ADMIN', 'STUDENT'));
router.use((req: AuthRequest, res, next) => {
  // Students may use these shared proof readers; other faculty operations require staff.
  if (req.user!.role === 'STUDENT' &&
      !(req.method === 'GET' && /^\/(?:certificates|participation|nptel-proofs)\/[^/]+\/(?:view|download)$/.test(req.path))) {
    return res.status(403).json({ error: 'Faculty access is required for this operation.' });
  }
  return next();
});

// GET assigned roster ONLY based on authenticated backend identity derived from faculty_assignments table
router.get('/students', async (req: AuthRequest, res: Response) => {
  const assignment = await db.getFacultyAssignment(req.user!.id);
  const assignedYear = assignment ? assignment.year : req.user!.assignedYear || '2nd Year';
  const assignedSection = assignment ? assignment.section : req.user!.assignedSection || 'A';

  const assignedRoster = await db.getStudentsForFaculty(req.user!.id, assignedYear, assignedSection);

  return res.json({
    assignedYear,
    assignedSection,
    count: assignedRoster.length,
    students: assignedRoster
  });
});

// GET Single Student Detail View by Faculty (Assigned Section Only)
router.get('/students/:id', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const student = await db.getStudentById(id);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found.' });
  }
  return res.json({ student });
});

// PUT Edit Student Details by Faculty (Assigned Section Only)
router.put('/students/:id', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const student = await db.getStudentById(id);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  const { name, mobileNumber, collegeEmail, personalEmail, address, cgpa, year, section, batch } = req.body || {};

  const nameToUse = typeof name === 'string' && name.trim() ? name.trim() : student.name;
  const mobileToUse = typeof mobileNumber === 'string' ? mobileNumber.trim() : (student.mobileNumber || '');
  const emailToUse = typeof collegeEmail === 'string' && collegeEmail.trim() ? collegeEmail.trim().toLowerCase() : student.email;
  const personalEmailToUse = typeof personalEmail === 'string' ? personalEmail.trim().toLowerCase() : (student.personalEmail || '');
  const addressToUse = typeof address === 'string' ? address.trim() : (student.address || '');
  let cgpaToUse = student.cgpa;
  if (cgpa !== undefined) {
    if (cgpa === null || cgpa === '' || String(cgpa).toUpperCase() === 'N/A' || String(cgpa).toUpperCase() === 'NULL' || String(cgpa).toUpperCase() === 'NOT AVAILABLE') {
      cgpaToUse = null;
    } else {
      const parsed = parseFloat(cgpa);
      if (!isNaN(parsed)) cgpaToUse = Math.max(0, Math.min(10, parsed));
    }
  }

  const updatedStudent = await db.upsertStudentWithUserLogin({
    registerNo: student.register_no,
    name: nameToUse,
    email: emailToUse,
    mobileNumber: mobileToUse || undefined,
    personalEmail: personalEmailToUse || undefined,
    address: addressToUse || undefined,
    cgpa: cgpaToUse,
    year: year || student.year,
    section: section || student.section,
    batch: batch || student.batch,
    createdByFacultyId: student.created_by_faculty_id
  });

  if (req.user) {
    await db.logAudit(
      req.user.id,
      req.user.email,
      req.user.role,
      'UPDATE_STUDENT',
      `STUDENT:${student.register_no} (Edited by Faculty ${req.user.name})`
    );
  }

  return res.json({
    message: `Student details updated successfully for ${updatedStudent.name}.`,
    student: updatedStudent
  });
});

// GET workspace Elite Students
router.get('/elite-students', async (req: AuthRequest, res: Response) => {
  const assignment = await db.getFacultyAssignment(req.user!.id);
  const assignedYear = assignment ? assignment.year : req.user!.assignedYear || '2nd Year';
  const assignedSection = assignment ? assignment.section : req.user!.assignedSection || 'A';

  const students = await db.getEliteStudents(assignedYear, assignedSection, req.user!.id);
  return res.json({ count: students.length, students });
});

// POST toggle student Elite designation
router.post('/students/:studentId/elite-status', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = req.params.studentId || req.body?.studentId;
  if (!studentId) {
    return res.status(400).json({ error: 'Bad Request: Student ID parameter is required.' });
  }

  const student = await db.getStudentById(studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  const isEliteRaw = req.body?.isElite ?? req.body?.is_elite ?? req.body?.isEliteStudent;
  if (isEliteRaw === undefined || isEliteRaw === null) {
    return res.status(400).json({ error: 'Bad Request: isElite boolean field is required in request body.' });
  }

  const isElite = Boolean(isEliteRaw === true || isEliteRaw === 'true' || isEliteRaw === 1 || isEliteRaw === '1');

  await db.updateStudentEliteStatus(studentId, isElite);
  return res.json({
    message: isElite ? `Marked ${student.name} as an Elite Student.` : `Removed ${student.name} from Elite Students list.`,
    studentId,
    isElite
  });
});

// POST update student profile (LinkedIn, GitHub, LeetCode, CGPA, Points)
router.post('/students/:studentId/update-profile', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = req.params.studentId || req.body?.studentId;
  if (!studentId) {
    return res.status(400).json({ error: 'Bad Request: Student ID parameter is required.' });
  }

  const student = await db.getStudentById(studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  const { linkedinUrl, githubUrl, leetcodeUsername, cgpa, skillEdgePoints } = req.body || {};

  const parsedCgpa = cgpa !== undefined && cgpa !== null && !isNaN(parseFloat(cgpa)) ? parseFloat(cgpa) : undefined;
  const parsedPoints = skillEdgePoints !== undefined && skillEdgePoints !== null && !isNaN(parseInt(skillEdgePoints, 10)) ? parseInt(skillEdgePoints, 10) : undefined;

  await db.updateStudentProfile(studentId, {
    linkedinUrl: typeof linkedinUrl === 'string' ? linkedinUrl.trim() : undefined,
    githubUrl: typeof githubUrl === 'string' ? githubUrl.trim() : undefined,
    leetcodeUsername: typeof leetcodeUsername === 'string' ? leetcodeUsername.trim() : undefined,
    cgpa: parsedCgpa,
    skillEdgePoints: parsedPoints
  });

  const updated360 = await db.getStudent360(studentId);
  return res.json({
    message: `Updated profile details for ${student.name}.`,
    profile: updated360
  });
});

// GET single student 360 profile (verifies section access on server!)
router.get('/students/:studentId/360', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
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

// Helper function to recalculate ONLY the affected student's score and update section rank atomically
async function recalculateAffectedStudentScore(studentId: string): Promise<{ overallScore: number; profile: any }> {
  const full360 = await db.getStudent360(studentId);
  if (!full360 || !full360.student) {
    return { overallScore: 0, profile: null };
  }

  const targetStudent = full360.student;
  const scoringConfig = await db.getScoringConfig();
  const breakdown = calculateCategoryScores(
    full360.student as any,
    full360.academics,
    full360.arrears,
    full360.skillEdge,
    full360.nptel,
    full360.attendance,
    full360.discipline,
    full360.leetcode,
    full360.projects,
    full360.certificates,
    full360.participation
  );

  const newOverallScore = computeOverallScore(breakdown, scoringConfig) || 0;

  // 1. Update the target student's overall score
  await executeRun('UPDATE students SET overall_score = ? WHERE id = ?', [newOverallScore, studentId]);

  // 2. High-speed single CTE atomic update for section ranks (takes ~15ms instead of 60 round-trips)
  if (isPostgresActive()) {
    await executeRun(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY overall_score DESC, cgpa DESC NULLS LAST) as new_rank
        FROM students
        WHERE year = ? AND section = ?
      )
      UPDATE students s
      SET current_rank = r.new_rank
      FROM ranked r
      WHERE s.id = r.id
    `, [targetStudent.year, targetStudent.section]);
  } else {
    // Local SQLite fallback
    const sectionStudents = await db.getStudents(targetStudent.year, targetStudent.section);
    const sorted = [...sectionStudents].sort((a, b) => {
      const aScore = a.id === studentId ? newOverallScore : (a.overall_score || 0);
      const bScore = b.id === studentId ? newOverallScore : (b.overall_score || 0);
      return bScore - aScore;
    });
    for (let idx = 0; idx < sorted.length; idx++) {
      const s = sorted[idx];
      const sScore = s.id === studentId ? newOverallScore : (s.overall_score || 0);
      await db.updateStudentScoreAndRank(s.id, sScore, idx + 1);
    }
  }

  // Update in-memory profile so callers can reuse it immediately without issuing another database fetch
  full360.student.overall_score = newOverallScore;

  return { overallScore: newOverallScore, profile: full360 };
}

// PUT update student 360 performance details (verifies section access on server!)
router.put('/students/:studentId/360', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const {
    cgpa, presentDays, totalDays,
    easySolved, mediumSolved, hardSolved, contestRating,
    leetcode,
    academics, skilledge, discipline, certificates, participation, projects
  } = req.body;

  const targetStudent = await db.getStudentById(studentId);
  if (!targetStudent) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  // Numeric scalar fields
  if (cgpa !== undefined) {
    const val = (cgpa === null || cgpa === '' || String(cgpa).toUpperCase() === 'N/A' || String(cgpa).toUpperCase() === 'NULL' || String(cgpa).toUpperCase() === 'NOT AVAILABLE' || isNaN(parseFloat(cgpa))) ? null : Math.max(0, Math.min(10, parseFloat(cgpa)));
    await db.updateStudentCGPA(studentId, val);
  }

  if (presentDays !== undefined && totalDays !== undefined) {
    await db.updateAttendance(studentId, parseInt(presentDays) || 0, parseInt(totalDays) || 1);
  }

  // Persist LeetCode stats if sent as object or scalar numbers
  if (leetcode && typeof leetcode === 'object') {
    const handleToSave = leetcode.username && !['student', 'leetcode_user', 'null', 'undefined'].includes(String(leetcode.username).toLowerCase())
      ? String(leetcode.username).trim()
      : undefined;

    if (handleToSave) {
      await db.updateLeetCode(
        studentId,
        handleToSave,
        leetcode.easySolved !== undefined ? leetcode.easySolved : parseInt(easySolved) || 0,
        leetcode.mediumSolved !== undefined ? leetcode.mediumSolved : parseInt(mediumSolved) || 0,
        leetcode.hardSolved !== undefined ? leetcode.hardSolved : parseInt(hardSolved) || 0,
        leetcode.contestRating !== undefined ? leetcode.contestRating : parseInt(contestRating) || 1200,
        leetcode.totalAttempted || 0,
        leetcode.acceptanceRate || 0,
        leetcode.totalSolved
      );
    } else {
      await db.updateLeetCode(
        studentId,
        leetcode.easySolved !== undefined ? leetcode.easySolved : parseInt(easySolved) || 0,
        leetcode.mediumSolved !== undefined ? leetcode.mediumSolved : parseInt(mediumSolved) || 0,
        leetcode.hardSolved !== undefined ? leetcode.hardSolved : parseInt(hardSolved) || 0,
        leetcode.contestRating !== undefined ? leetcode.contestRating : parseInt(contestRating) || 1200,
        leetcode.totalAttempted || 0,
        leetcode.acceptanceRate || 0,
        leetcode.totalSolved
      );
    }
  } else if (easySolved !== undefined || mediumSolved !== undefined || hardSolved !== undefined) {
    await db.updateLeetCode(
      studentId,
      parseInt(easySolved) || 0,
      parseInt(mediumSolved) || 0,
      parseInt(hardSolved) || 0,
      parseInt(contestRating) || 1200
    );
  }

  // Persist module record arrays
  if (Array.isArray(academics)) await db.saveAcademicRecords(studentId, academics);
  if (skilledge && typeof skilledge === 'object') await db.saveSkillEdgeRecord(studentId, skilledge);
  if (Array.isArray(discipline)) await db.saveDisciplineRecords(studentId, discipline);
  if (Array.isArray(certificates)) await db.saveCertificateRecords(studentId, certificates);
  if (Array.isArray(participation)) await db.saveParticipationRecords(studentId, participation);
  if (Array.isArray(projects)) await db.saveProjectRecords(studentId, projects);

  const { overallScore: updatedOverallScore, profile: updatedProfile } = await recalculateAffectedStudentScore(studentId);

  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPDATE_STUDENT_360', `STUDENT:${studentId}`);

  return res.json({
    message: 'Student 360 profile updated and score recalculated successfully.',
    overallScore: updatedOverallScore,
    profile: updatedProfile
  });
});

// POST Add new category record item to student 360 profile (verifies section access on server!)
router.post('/students/:studentId/records/:recordType', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const recordType = getRouteParam(req, 'recordType');
  const targetStudent = await db.getStudentById(studentId);
  if (!targetStudent) {
    return res.status(404).json({ error: 'Student profile not found.' });
  }

  let createdId = '';
  const type = recordType.toLowerCase();

  if (type === 'arrears') {
    createdId = await db.addArrearRecord({ studentId, subjectCode: req.body.subjectCode || 'CS301', subjectName: req.body.subjectName || 'Data Structures' });
  } else if (type === 'nptel') {
    createdId = await db.addNPTELRecord({ studentId, courseName: req.body.courseName || 'NPTEL Course', examScore: req.body.examScore || 75 });
  } else if (type === 'discipline') {
    createdId = await db.addDisciplineRecord({ studentId, remark: req.body.remark || 'Discipline remark logged', recordedBy: req.user!.email });
  } else if (type === 'certificates') {
    createdId = await db.addCertificateRecord({ studentId, courseName: req.body.courseName || 'Certificate Course', platform: req.body.platform });
  } else if (type === 'participation') {
    createdId = await db.addParticipationRecord({ studentId, eventName: req.body.eventName || 'Symposium Event', organizer: req.body.organizer });
  } else if (type === 'projects') {
    createdId = await db.addProjectRecord({ studentId, title: req.body.title || 'Technical Project', description: req.body.description });
  } else if (type === 'achievements') {
    createdId = await db.addAchievementRecord({ studentId, title: req.body.title || 'Achievement Award', eventName: req.body.eventName });
  } else {
    return res.status(400).json({ error: `Unsupported record type: ${recordType}` });
  }

  const { overallScore: updatedOverallScore } = await recalculateAffectedStudentScore(studentId);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'CREATE_PERFORMANCE_RECORD', `TYPE:${recordType}:ID:${createdId}:STUDENT:${studentId}`);

  return res.status(201).json({
    message: `Record added successfully to ${recordType}.`,
    createdId,
    overallScore: updatedOverallScore
  });
});

// Class Coordinator Role Guard Middleware
async function requireClassCoordinator(req: AuthRequest, res: Response, next: any) {
  const assign = await db.getFacultyAssignment(req.user!.id);
  if (assign && assign.role === 'Subject Faculty') {
    return res.status(403).json({ error: 'Forbidden: Only Class Coordinators can create or import student accounts.' });
  }
  next();
}

// Helper for flexible, case-insensitive, alias-tolerant column extraction
const getRowValue = (row: any, ...aliases: string[]): string => {
  if (!row || typeof row !== 'object') return '';
  for (const k of aliases) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
  }
  const rowKeys = Object.keys(row);
  for (const k of aliases) {
    const cleanAlias = k.toLowerCase().replace(/[\s_\-]/g, '');
    const foundKey = rowKeys.find((rk) => rk.toLowerCase().replace(/[\s_\-]/g, '') === cleanAlias);
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
      return String(row[foundKey]).trim();
    }
  }
  return '';
};

// POST Add Single Student by Faculty (Emergency Single-Student Onboarding)
router.post(['/students', '/students/emergency-add'], requireClassCoordinator, async (req: AuthRequest, res: Response) => {
  try {
    const facultyId = req.user!.id;
    const targetFaculty = await db.getUserById(facultyId);
    if (!targetFaculty) {
      return res.status(404).json({ error: 'Faculty account not found in system.' });
    }

    // Strict Section Authorization: Always derive Year and Section from authenticated faculty assignment
    const assignment = await db.getFacultyAssignment(facultyId);
    const assignedYear = String(assignment?.year || targetFaculty.year || '1st Year').trim();
    const assignedSection = String(assignment?.section || targetFaculty.section || 'A').trim();
    const batchToUse = req.body.batch || (assignedYear.includes('1st') ? '2024-2028' : assignedYear.includes('2nd') ? '2023-2027' : assignedYear.includes('3rd') ? '2022-2026' : '2021-2025');

    const { registerNo, name, email, collegeEmail, mobileNumber, personalEmail, address, cgpa } = req.body || {};
    const effectiveEmail = (email || collegeEmail || '').trim().toLowerCase();

    if (!registerNo || !name || !effectiveEmail) {
      return res.status(400).json({ error: 'Register Number, Name, and College Mail ID are required.' });
    }

    let cgpaVal: number | null = null;
    if (cgpa !== undefined && cgpa !== null && cgpa !== '') {
      const upper = String(cgpa).trim().toUpperCase();
      if (upper !== 'N/A' && upper !== 'NA' && upper !== 'NULL' && upper !== 'NOT AVAILABLE' && upper !== 'NONE') {
        const parsed = parseFloat(String(cgpa));
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
          cgpaVal = Math.round(parsed * 100) / 100;
        }
      }
    }

    const updatedStudent = await db.upsertStudentWithUserLogin({
      registerNo: String(registerNo).trim(),
      name: String(name).trim(),
      email: effectiveEmail,
      mobileNumber: mobileNumber ? String(mobileNumber).trim() : undefined,
      personalEmail: personalEmail ? String(personalEmail).trim().toLowerCase() : undefined,
      address: address ? String(address).trim() : undefined,
      cgpa: cgpaVal,
      year: assignedYear,
      section: assignedSection,
      batch: batchToUse,
      createdByFacultyId: targetFaculty.id,
      facultyWorkspaceId: targetFaculty.id,
      classCoordinatorName: targetFaculty.name
    });

    await db.logAudit(
      targetFaculty.id,
      targetFaculty.email,
      targetFaculty.role,
      'FACULTY_CREATE_STUDENT',
      `Emergency added student ${updatedStudent.name} (${updatedStudent.register_no}) in ${assignedYear} Sec ${assignedSection}.`
    );

    return res.status(201).json({
      message: `Successfully created student ${updatedStudent.name} in Section ${assignedSection}.`,
      student: updatedStudent
    });
  } catch (err: any) {
    console.error('❌ Faculty Create Student Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create student account.' });
  }
});

// POST Faculty Student Excel/CSV Import Preview (BLOCKED: Restrict bulk import to HOD only)
router.post('/students/import-preview', (req: Request, res: Response) => {
  return res.status(403).json({
    error: 'Bulk student import is strictly restricted to HOD only. Faculty may use Emergency Add Student to add one student at a time.'
  });
});

// POST Faculty Student Excel/CSV Import Confirm (BLOCKED: Restrict bulk import to HOD only)
router.post(['/students/import-confirm', '/students/import'], (req: Request, res: Response) => {
  return res.status(403).json({
    error: 'Bulk student import is strictly restricted to HOD only. Faculty may use Emergency Add Student to add one student at a time.'
  });
});

// POST Reset Student Password by Class Coordinator
router.post('/students/:studentId/reset-password', requireClassCoordinator, verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const { password, confirmPassword } = req.body;

  if (!password || password !== confirmPassword) {
    return res.status(400).json({ error: 'New password and matching confirm password are required.' });
  }

  try {
    await db.resetStudentPasswordByFaculty(req.user!.id, studentId, password);
    return res.json({ message: 'Student portal password reset successfully.' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to reset student password.' });
  }
});

// DELETE Student by Faculty (ONLY Class Coordinator for assigned students)
router.delete('/students/:studentId', requireClassCoordinator, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');

  // 1. Inspect student in database
  const student = await db.getStudentById(studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  // 2. Strict Staff Isolation Check: Verify that student is assigned to this faculty member's workspace/section
  const facultyAssignment = await db.getFacultyAssignment(req.user!.id);
  const isAssignedToFaculty = (student.created_by_faculty_id === req.user!.id || student.faculty_workspace_id === req.user!.id) ||
    (facultyAssignment && student.year === facultyAssignment.year && student.section === facultyAssignment.section);

  if (!isAssignedToFaculty) {
    return res.status(403).json({ error: 'Unauthorized: You can only delete students assigned to your own workspace/section.' });
  }

  try {
    // 3. Delete student account & associated records safely
    await db.deleteStudentUser(studentId);
    await db.logAudit(req.user!.id, req.user!.email, 'FACULTY', 'DELETE_STUDENT', `STUDENT_ID:${studentId},REG:${student.register_no}`);

    return res.json({
      message: `Student ${student.name} (${student.register_no}) deleted successfully from your section.`,
      studentId
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete student account.' });
  }
});

// PATCH Toggle Student Account Status (Enable/Disable) by Class Coordinator
router.patch('/students/:studentId/status', requireClassCoordinator, verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const { isActive } = req.body;

  try {
    await db.setStudentStatusByFaculty(req.user!.id, studentId, Boolean(isActive));
    return res.json({ message: `Student status updated to ${isActive ? 'Active' : 'Disabled'}.` });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update student status.' });
  }
});

// NPTEL GOOGLE OAUTH CONNECTION MANAGEMENT ENDPOINTS
router.get('/students/:studentId/nptel-connection', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const conn = await db.getNptelGoogleConnection(studentId);
  return res.json({ connection: conn });
});

// POST NPTEL Connection Sync
router.post('/students/:studentId/nptel-connection/sync', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const conn = await db.getNptelGoogleConnection(studentId);
  if (!conn) {
    return res.status(404).json({ error: 'No active Google OAuth connection found for student.' });
  }
  const now = new Date().toISOString();
  await db.saveNptelGoogleConnection(studentId, {
    connectedEmail: conn.connectedEmail,
    lastSynced: now,
    status: 'CONNECTED'
  });
  return res.json({ message: 'NPTEL records synchronized via Google OAuth connection.', connection: await db.getNptelGoogleConnection(studentId) });
});

// DELETE NPTEL Connection
router.delete('/students/:studentId/nptel-connection', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  await db.disconnectNptelGoogleConnection(studentId);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'DISCONNECT_NPTEL_GOOGLE', `STU:${studentId}`);
  return res.json({ message: 'NPTEL Google OAuth connection disconnected successfully.' });
});

// NPTEL WEEKLY PROOFS MODULE ENDPOINTS
router.get('/students/:studentId/nptel-proofs', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const proofs = await db.getNptelProofs(studentId);
  return res.json({ proofs });
});

// POST NPTEL Proofs Upload
router.post('/students/:studentId/nptel-proofs', verifyFacultySectionAccess, (req: AuthRequest, res: Response) => {
  nptelProofUpload.single('file')(req, res, async (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE' || err.message?.includes('File size exceeds')) {
        return res.status(400).json({ error: MSG_FILE_TOO_LARGE });
      }
      return res.status(400).json({ error: err.message || 'Proof file upload failed.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Proof screenshot/file is required.' });
    }

    if (req.file.size > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: MSG_FILE_TOO_LARGE });
    }

    const studentId = getRouteParam(req, 'studentId');
    const weekVal = req.body.weekNo || req.body.week;
    const weekNo = parseInt(String(weekVal).replace('Week ', ''), 10);

    if (isNaN(weekNo) || weekNo < 1 || weekNo > 10) {
      return res.status(400).json({ error: 'Week number must be an integer between 1 and 10.' });
    }

    try {
      const ext = path.extname(req.file.originalname).toLowerCase();
      const storagePath = `nptel/${studentId}/week-${weekNo}-${Date.now()}${ext}`;
      await uploadFileToStorage(storagePath, req.file.buffer, req.file.mimetype);

      const proofRecord = await db.addNptelProof(studentId, weekNo, storagePath, req.file.originalname);
      await db.logAudit(
        req.user!.id,
        req.user!.email,
        req.user!.role,
        'UPLOAD_NPTEL_PROOF',
        `STUDENT:${studentId}:WEEK:${weekNo}:FILE:${req.file.originalname}`
      );

      return res.status(201).json({
        message: `NPTEL Week ${weekNo} proof uploaded successfully.`,
        proof: {
          ...proofRecord,
          viewUrl: `/api/faculty/nptel-proofs/${proofRecord.id}/view`,
          downloadUrl: `/api/faculty/nptel-proofs/${proofRecord.id}/download`
        }
      });
    } catch (dbErr: any) {
      return res.status(500).json({ error: dbErr.message || 'Failed to persist NPTEL proof record.' });
    }
  });
});

// DELETE NPTEL Proof
router.delete('/students/:studentId/nptel-proofs/:proofId', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const proofId = getRouteParam(req, 'proofId');
  const proof = await db.getNptelProofById(proofId);

  if (!proof) {
    return res.status(404).json({ error: 'NPTEL proof record not found.' });
  }

  if (proof.student_id !== studentId) {
    return res.status(400).json({ error: 'Proof record does not belong to selected student.' });
  }

  try {
    await db.deleteNptelProof(proofId, studentId);
    if (proof.proof_file_path) {
      await deleteFileFromStorage(proof.proof_file_path);
    }

    await db.logAudit(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'DELETE_NPTEL_PROOF',
      `STUDENT:${studentId}:PROOF:${proofId}`
    );

    return res.json({ message: 'NPTEL proof record deleted successfully.' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to delete NPTEL proof record.' });
  }
});

async function checkFacultyStudentFileAccess(req: AuthRequest, student: any): Promise<boolean> {
  if (!req.user || !student) return false;

  if (req.user.role === 'HOD' || req.user.role === 'ADMIN') {
    return true;
  }

  if (req.user.role === 'STUDENT') {
    return Boolean(
      (req.user.studentId && req.user.studentId === student.id) ||
      (req.user.registerNo && req.user.registerNo === student.register_no) ||
      (req.user.email && req.user.email.toLowerCase() === (student.college_email || student.email || '').toLowerCase())
    );
  }

  if (req.user.role !== 'FACULTY') {
    return false;
  }

  const isCreatedByStaff = student.created_by_faculty_id === req.user.id;
  const isWorkspaceStaff = student.faculty_workspace_id === req.user.id;

  const isOwnedByAnotherStaff =
    (student.created_by_faculty_id && student.created_by_faculty_id !== req.user.id) ||
    (student.faculty_workspace_id && student.faculty_workspace_id !== req.user.id);

  if (isOwnedByAnotherStaff && !isCreatedByStaff && !isWorkspaceStaff) {
    return false;
  }

  const facultyAssignment = await db.getFacultyAssignment(req.user.id, { fresh: true });
  const assignedYear = facultyAssignment?.is_active ? facultyAssignment.year : undefined;
  const assignedSection = facultyAssignment?.is_active ? facultyAssignment.section : undefined;

  const cleanAssignedYear = normalizeYear(assignedYear);
  const cleanAssignedSec = normalizeSection(assignedSection);
  const cleanStudentYear = normalizeYear(student.year);
  const cleanStudentSec = normalizeSection(student.section);

  const isYearMatch = Boolean(cleanAssignedYear && cleanAssignedYear !== 'ALL' && cleanStudentYear === cleanAssignedYear);
  const isSectionMatch = Boolean(cleanAssignedSec && cleanAssignedSec !== 'ALL' && cleanStudentSec === cleanAssignedSec);

  return (isYearMatch && isSectionMatch) || isCreatedByStaff || isWorkspaceStaff;
}

router.get('/nptel-proofs/:proofId/view', async (req: AuthRequest, res: Response) => {
  const proofId = getRouteParam(req, 'proofId');
  const proof = await db.getNptelProofById(proofId);

  if (!proof) {
    return res.status(404).json({ error: 'NPTEL proof record not found.' });
  }

  const student = await db.getStudentById(proof.student_id);
  if (!student || !(await checkFacultyStudentFileAccess(req, student))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to view files for this student.' });
  }

  const fileData = await downloadFileFromStorage(proof.proof_file_path);
  if (!fileData) {
    return res.status(404).json({ error: 'Proof file missing on server storage.' });
  }

  const ext = path.extname(proof.proof_file_path).toLowerCase();
  res.setHeader('Content-Type', fileData.contentType || getMimeFromPath(proof.proof_file_path));
  res.setHeader('Content-Length', fileData.buffer.length.toString());
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(proof.original_file_name || 'proof' + ext)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(fileData.buffer);
});

router.get('/nptel-proofs/:proofId/download', async (req: AuthRequest, res: Response) => {
  const proofId = getRouteParam(req, 'proofId');
  const proof = await db.getNptelProofById(proofId);

  if (!proof) {
    return res.status(404).json({ error: 'NPTEL proof record not found.' });
  }

  const student = await db.getStudentById(proof.student_id);
  if (!student || !(await checkFacultyStudentFileAccess(req, student))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to download files for this student.' });
  }

  const fileData = await downloadFileFromStorage(proof.proof_file_path);
  if (!fileData) {
    return res.status(404).json({ error: 'Proof file missing on server storage.' });
  }

  const ext = path.extname(proof.proof_file_path).toLowerCase();
  res.setHeader('Content-Type', fileData.contentType || getMimeFromPath(proof.proof_file_path));
  res.setHeader('Content-Length', fileData.buffer.length.toString());
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(proof.original_file_name || 'nptel-proof' + ext)}"`);
  return res.send(fileData.buffer);
});

// CERTIFICATE MODULE FILE UPLOAD & MANAGEMENT ENDPOINTS
router.post('/students/:studentId/certificates/upload', verifyFacultySectionAccess, (req: AuthRequest, res: Response) => {
  certUpload.single('file')(req, res, async (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE' || err.message?.includes('File size exceeds')) {
        return res.status(400).json({ error: MSG_FILE_TOO_LARGE });
      }
      return res.status(400).json({ error: err.message || 'Certificate file upload failed.' });
    }

    const studentId = getRouteParam(req, 'studentId');
    const { courseName, platform, category, issueDate } = req.body;

    if (!courseName || !platform) {
      return res.status(400).json({ error: 'Certificate Course Name and Issuing Organization/Platform are required.' });
    }

    if (req.file && req.file.size > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: MSG_FILE_TOO_LARGE });
    }

    let filePath = '';
    const originalFileName = req.file ? req.file.originalname : '';

    try {
      if (req.file) {
        const ext = path.extname(req.file.originalname).toLowerCase();
        filePath = `certificates/${studentId}/cert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}${ext}`;
        await uploadFileToStorage(filePath, req.file.buffer, req.file.mimetype);
      }

      const certId = await db.saveCertificateUpload({
        studentId,
        courseName: courseName.trim(),
        platform: platform.trim(),
        category: (category || 'Technical Certification').trim(),
        issueDate: issueDate || new Date().toISOString().split('T')[0],
        filePath,
        originalFileName,
        fileData: req.file ? req.file.buffer : null,
        mimeType: req.file ? req.file.mimetype : ''
      });

      if (req.file) {
        await db.createAttachment({
          id: `att-cert-${certId}`,
          student_id: studentId,
          record_type: 'certificates',
          record_id: certId,
          original_file_name: req.file.originalname,
          stored_file_name: filePath,
          mime_type: req.file.mimetype,
          file_size: req.file.size,
          uploaded_by_user_id: req.user!.id,
          uploaded_by_role: req.user!.role,
          uploaded_at: new Date().toISOString(),
          is_deleted: 0,
          file_data: req.file.buffer
        });
      }

      const { overallScore: updatedScore, profile: full360 } = await recalculateAffectedStudentScore(studentId);
      await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPLOAD_CERTIFICATE', `STUDENT:${studentId}:CERT:${certId}`);

      return res.status(201).json({
        message: 'Certificate uploaded and verified successfully.',
        certId,
        certificates: full360?.certificates || [],
        overallScore: updatedScore
      });
    } catch (dbErr: any) {
      return res.status(400).json({ error: dbErr.message || 'Failed to save certificate record.' });
    }
  });
});

router.put('/students/:studentId/certificates/:certId', verifyFacultySectionAccess, (req: AuthRequest, res: Response) => {
  certUpload.single('file')(req, res, async (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE' || err.message?.includes('File size exceeds')) {
        return res.status(400).json({ error: MSG_FILE_TOO_LARGE });
      }
      return res.status(400).json({ error: err.message || 'Certificate file upload failed.' });
    }

    const studentId = getRouteParam(req, 'studentId');
  const certId = getRouteParam(req, 'certId');
    const { courseName, platform, category, issueDate } = req.body;

    if (!courseName || !platform) {
      return res.status(400).json({ error: 'Certificate Course Name and Issuing Organization/Platform are required.' });
    }

    if (req.file && req.file.size > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: MSG_FILE_TOO_LARGE });
    }

    const existingCert = await db.getCertificateById(certId);
    if (!existingCert || existingCert.student_id !== studentId) {
      return res.status(404).json({ error: 'Certificate record not found.' });
    }

    let filePath = existingCert.file_path;
    let originalFileName = existingCert.original_file_name;

    try {
      if (req.file) {
        if (existingCert.file_path) {
          await deleteFileFromStorage(existingCert.file_path);
        }
        const ext = path.extname(req.file.originalname).toLowerCase();
        filePath = `certificates/${studentId}/cert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}${ext}`;
        await uploadFileToStorage(filePath, req.file.buffer, req.file.mimetype);
        originalFileName = req.file.originalname;

        await db.createAttachment({
          id: `att-cert-${certId}`,
          student_id: studentId,
          record_type: 'certificates',
          record_id: certId,
          original_file_name: req.file.originalname,
          stored_file_name: filePath,
          mime_type: req.file.mimetype,
          file_size: req.file.size,
          uploaded_by_user_id: req.user!.id,
          uploaded_by_role: req.user!.role,
          uploaded_at: new Date().toISOString(),
          is_deleted: 0,
          file_data: req.file.buffer
        });
      }

      await db.updateCertificateUpload(certId, studentId, {
        courseName: courseName.trim(),
        platform: platform.trim(),
        category: (category || 'Technical Certification').trim(),
        issueDate: issueDate || new Date().toISOString().split('T')[0],
        filePath,
        originalFileName,
        fileData: req.file ? req.file.buffer : undefined,
        mimeType: req.file ? req.file.mimetype : undefined
      });

      const { overallScore: updatedScore, profile: full360 } = await recalculateAffectedStudentScore(studentId);
      await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPDATE_CERTIFICATE', `STUDENT:${studentId}:CERT:${certId}`);

      return res.json({
        message: 'Certificate record updated successfully.',
        certificates: full360?.certificates || [],
        overallScore: updatedScore
      });
    } catch (dbErr: any) {
      return res.status(400).json({ error: dbErr.message || 'Failed to update certificate record.' });
    }
  });
});

router.delete('/students/:studentId/certificates/:certId', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const certId = getRouteParam(req, 'certId');
  const existingCert = await db.getCertificateById(certId);

  if (!existingCert) {
    return res.status(404).json({ error: 'Certificate record not found.' });
  }

  if (existingCert.student_id !== studentId) {
    return res.status(400).json({ error: 'Certificate record does not belong to selected student.' });
  }

  try {
    await db.deleteStudent360Record(studentId, 'certificates', certId);

    if (existingCert.file_path) {
      await deleteFileFromStorage(existingCert.file_path);
    }

    const { overallScore: updatedScore, profile: full360 } = await recalculateAffectedStudentScore(studentId);
    await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'DELETE_CERTIFICATE', `STUDENT:${studentId}:CERT:${certId}`);

    return res.json({
      message: 'Certificate record deleted successfully.',
      certificates: full360?.certificates || [],
      overallScore: updatedScore
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to delete certificate record.' });
  }
});

router.get('/certificates/:certId/view', async (req: AuthRequest, res: Response) => {
  const certId = getRouteParam(req, 'certId');
  const cert = await db.getCertificateById(certId);

  if (!cert) {
    return res.status(404).json({ error: 'Certificate record not found.' });
  }

  const student = await db.getStudentById(cert.student_id);
  if (!student || !(await checkFacultyStudentFileAccess(req, student))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to view files for this student.' });
  }

  let buffer: Buffer | null = null;
  let contentType = cert.mime_type || '';

  // 1. Primary: Direct record bytea persistence
  if (cert.file_data) {
    buffer = Buffer.isBuffer(cert.file_data) ? cert.file_data : Buffer.from(cert.file_data);
  }

  // 2. Secondary: Attachments table bytea persistence
  if (!buffer) {
    const att = await db.getAttachmentForRecord(cert.student_id, 'certificates', certId);
    if (att && att.file_data) {
      buffer = Buffer.isBuffer(att.file_data) ? att.file_data : Buffer.from(att.file_data);
      if (!contentType && att.mime_type) contentType = att.mime_type;
    }
  }

  // 3. Fallback: Supabase Storage / filesystem
  const filePath = cert.file_path || cert.proof_file_path;
  if (!buffer && filePath) {
    const fileData = await downloadFileFromStorage(filePath);
    if (fileData) {
      buffer = fileData.buffer;
      if (!contentType && fileData.contentType) contentType = fileData.contentType;
    }
  }

  if (!buffer) {
    return res.status(404).json({ error: 'Certificate file content is not available on server storage.' });
  }

  const ext = path.extname(cert.original_file_name || filePath || '.pdf').toLowerCase();
  const origName = cert.original_file_name || `${cert.course_name}_Certificate${ext}`;
  res.setHeader('Content-Type', contentType || getMimeFromPath(origName));
  res.setHeader('Content-Length', buffer.length.toString());
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(origName)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(buffer);
});

router.get('/certificates/:certId/download', async (req: AuthRequest, res: Response) => {
  const certId = getRouteParam(req, 'certId');
  const cert = await db.getCertificateById(certId);

  if (!cert) {
    return res.status(404).json({ error: 'Certificate record not found.' });
  }

  const student = await db.getStudentById(cert.student_id);
  if (!student || !(await checkFacultyStudentFileAccess(req, student))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to download files for this student.' });
  }

  let buffer: Buffer | null = null;
  let contentType = cert.mime_type || '';

  // 1. Primary: Direct record bytea persistence
  if (cert.file_data) {
    buffer = Buffer.isBuffer(cert.file_data) ? cert.file_data : Buffer.from(cert.file_data);
  }

  // 2. Secondary: Attachments table bytea persistence
  if (!buffer) {
    const att = await db.getAttachmentForRecord(cert.student_id, 'certificates', certId);
    if (att && att.file_data) {
      buffer = Buffer.isBuffer(att.file_data) ? att.file_data : Buffer.from(att.file_data);
      if (!contentType && att.mime_type) contentType = att.mime_type;
    }
  }

  // 3. Fallback: Supabase Storage / filesystem
  const filePath = cert.file_path || cert.proof_file_path;
  if (!buffer && filePath) {
    const fileData = await downloadFileFromStorage(filePath);
    if (fileData) {
      buffer = fileData.buffer;
      if (!contentType && fileData.contentType) contentType = fileData.contentType;
    }
  }

  if (!buffer) {
    return res.status(404).json({ error: 'Certificate file content is not available on server storage.' });
  }

  const ext = path.extname(cert.original_file_name || filePath || '.pdf').toLowerCase();
  const origName = cert.original_file_name || `${cert.course_name}_Certificate${ext}`;
  res.setHeader('Content-Type', contentType || getMimeFromPath(origName));
  res.setHeader('Content-Length', buffer.length.toString());
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(origName)}"`);
  return res.send(buffer);
});

// PARTICIPATION MODULE FILE UPLOAD & MANAGEMENT ENDPOINTS
router.post('/students/:studentId/participation/upload', verifyFacultySectionAccess, (req: AuthRequest, res: Response) => {
  certUpload.single('file')(req, res, async (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE' || err.message?.includes('File size exceeds')) {
        return res.status(400).json({ error: MSG_FILE_TOO_LARGE });
      }
      return res.status(400).json({ error: err.message || 'Proof file upload failed.' });
    }

    const studentId = getRouteParam(req, 'studentId');
    const { eventName, category, eventLevel, organizer, date, achievement, description } = req.body;

    if (!eventName || !organizer) {
      return res.status(400).json({ error: 'Event Name and Organizer/Host Institution are required.' });
    }

    if (req.file && req.file.size > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: MSG_FILE_TOO_LARGE });
    }

    let filePath = '';
    const originalFileName = req.file ? req.file.originalname : '';

    try {
      if (req.file) {
        const ext = path.extname(req.file.originalname).toLowerCase();
        filePath = `participation/${studentId}/part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}${ext}`;
        await uploadFileToStorage(filePath, req.file.buffer, req.file.mimetype);
      }

      const partId = await db.saveParticipationUpload({
        studentId,
        eventName: eventName.trim(),
        category: (category || 'Symposium').trim(),
        eventLevel: (eventLevel || 'College').trim(),
        organizer: organizer.trim(),
        date: date || new Date().toISOString().split('T')[0],
        achievement: (achievement || 'Participant').trim(),
        description: (description || '').trim(),
        filePath,
        originalFileName,
        fileData: req.file ? req.file.buffer : null,
        mimeType: req.file ? req.file.mimetype : ''
      });

      if (req.file) {
        await db.createAttachment({
          id: `att-part-${partId}`,
          student_id: studentId,
          record_type: 'participation',
          record_id: partId,
          original_file_name: req.file.originalname,
          stored_file_name: filePath,
          mime_type: req.file.mimetype,
          file_size: req.file.size,
          uploaded_by_user_id: req.user!.id,
          uploaded_by_role: req.user!.role,
          uploaded_at: new Date().toISOString(),
          is_deleted: 0,
          file_data: req.file.buffer
        });
      }

      const { overallScore: updatedScore, profile: full360 } = await recalculateAffectedStudentScore(studentId);

      await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPLOAD_PARTICIPATION', `STUDENT:${studentId}:EVENT:${eventName}`);

      return res.status(201).json({
        message: 'Participation record saved successfully.',
        partId,
        participation: full360?.participation || [],
        overallScore: updatedScore
      });
    } catch (dbErr: any) {
      return res.status(400).json({ error: dbErr.message || 'Failed to save participation record.' });
    }
  });
});

router.put('/students/:studentId/participation/:partId', verifyFacultySectionAccess, (req: AuthRequest, res: Response) => {
  certUpload.single('file')(req, res, async (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE' || err.message?.includes('File size exceeds')) {
        return res.status(400).json({ error: MSG_FILE_TOO_LARGE });
      }
      return res.status(400).json({ error: err.message || 'Proof file upload failed.' });
    }

    const studentId = getRouteParam(req, 'studentId');
  const partId = getRouteParam(req, 'partId');
    const { eventName, category, eventLevel, organizer, date, achievement, description } = req.body;

    if (!eventName || !organizer) {
      return res.status(400).json({ error: 'Event Name and Organizer/Host Institution are required.' });
    }

    if (req.file && req.file.size > MAX_FILE_SIZE_BYTES) {
      return res.status(400).json({ error: MSG_FILE_TOO_LARGE });
    }

    const existingPart = await db.getParticipationById(partId);
    if (!existingPart || existingPart.student_id !== studentId) {
      return res.status(404).json({ error: 'Participation record not found.' });
    }

    let filePath = existingPart.proof_file_path || existingPart.file_path;
    let originalFileName = existingPart.original_file_name;

    try {
      if (req.file) {
        if (filePath) {
          await deleteFileFromStorage(filePath);
        }
        const ext = path.extname(req.file.originalname).toLowerCase();
        filePath = `participation/${studentId}/part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}${ext}`;
        await uploadFileToStorage(filePath, req.file.buffer, req.file.mimetype);
        originalFileName = req.file.originalname;

        await db.createAttachment({
          id: `att-part-${partId}`,
          student_id: studentId,
          record_type: 'participation',
          record_id: partId,
          original_file_name: req.file.originalname,
          stored_file_name: filePath,
          mime_type: req.file.mimetype,
          file_size: req.file.size,
          uploaded_by_user_id: req.user!.id,
          uploaded_by_role: req.user!.role,
          uploaded_at: new Date().toISOString(),
          is_deleted: 0,
          file_data: req.file.buffer
        });
      }

      await db.updateParticipationUpload(partId, studentId, {
        eventName: eventName.trim(),
        category: (category || 'Symposium').trim(),
        eventLevel: (eventLevel || 'College').trim(),
        organizer: organizer.trim(),
        date: date || new Date().toISOString().split('T')[0],
        achievement: (achievement || 'Participant').trim(),
        description: (description || '').trim(),
        filePath,
        originalFileName,
        fileData: req.file ? req.file.buffer : undefined,
        mimeType: req.file ? req.file.mimetype : undefined
      });

      const { overallScore: updatedScore, profile: full360 } = await recalculateAffectedStudentScore(studentId);

      await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPDATE_PARTICIPATION', `STUDENT:${studentId}:PART:${partId}`);

      return res.json({
        message: 'Participation record updated successfully.',
        participation: full360?.participation || [],
        overallScore: updatedScore
      });
    } catch (dbErr: any) {
      return res.status(400).json({ error: dbErr.message || 'Failed to update participation record.' });
    }
  });
});

router.delete('/students/:studentId/participation/:partId', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const partId = getRouteParam(req, 'partId');
  const existingPart = await db.getParticipationById(partId);

  if (!existingPart) {
    return res.status(404).json({ error: 'Participation record not found.' });
  }

  if (existingPart.student_id !== studentId) {
    return res.status(400).json({ error: 'Participation record does not belong to selected student.' });
  }

  try {
    await db.deletePerformanceRecord('participation', partId, studentId);

    const oldFile = existingPart.proof_file_path || existingPart.file_path;
    if (oldFile) {
      await deleteFileFromStorage(oldFile);
    }

    const { overallScore: updatedScore, profile: full360 } = await recalculateAffectedStudentScore(studentId);

    await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'DELETE_PARTICIPATION', `STUDENT:${studentId}:PART:${partId}`);

    return res.json({
      message: 'Participation record deleted successfully.',
      participation: full360?.participation || [],
      overallScore: updatedScore
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to delete participation record.' });
  }
});

router.get('/participation/:partId/view', async (req: AuthRequest, res: Response) => {
  const partId = getRouteParam(req, 'partId');
  const part = await db.getParticipationById(partId);

  if (!part) {
    return res.status(404).json({ error: 'Participation record not found.' });
  }

  const student = await db.getStudentById(part.student_id);
  if (!student || !(await checkFacultyStudentFileAccess(req, student))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to view files for this student.' });
  }

  let buffer: Buffer | null = null;
  let contentType = part.mime_type || '';

  // 1. Primary: Direct record bytea persistence
  if (part.file_data) {
    buffer = Buffer.isBuffer(part.file_data) ? part.file_data : Buffer.from(part.file_data);
  }

  // 2. Secondary: Attachments table bytea persistence
  if (!buffer) {
    const att = await db.getAttachmentForRecord(part.student_id, 'participation', partId);
    if (att && att.file_data) {
      buffer = Buffer.isBuffer(att.file_data) ? att.file_data : Buffer.from(att.file_data);
      if (!contentType && att.mime_type) contentType = att.mime_type;
    }
  }

  // 3. Fallback: Supabase Storage / filesystem
  const proofFile = part.proof_file_path || part.file_path;
  if (!buffer && proofFile) {
    const fileData = await downloadFileFromStorage(proofFile);
    if (fileData) {
      buffer = fileData.buffer;
      if (!contentType && fileData.contentType) contentType = fileData.contentType;
    }
  }

  if (!buffer) {
    return res.status(404).json({ error: 'Participation proof file is not available on server storage.' });
  }

  const ext = path.extname(part.original_file_name || proofFile || '.pdf').toLowerCase();
  const origName = part.original_file_name || part.originalFileName || `${part.event_name}_Proof${ext}`;
  res.setHeader('Content-Type', contentType || getMimeFromPath(origName));
  res.setHeader('Content-Length', buffer.length.toString());
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(origName)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(buffer);
});

router.get('/participation/:partId/download', async (req: AuthRequest, res: Response) => {
  const partId = getRouteParam(req, 'partId');
  const part = await db.getParticipationById(partId);

  if (!part) {
    return res.status(404).json({ error: 'Participation record not found.' });
  }

  const student = await db.getStudentById(part.student_id);
  if (!student || !(await checkFacultyStudentFileAccess(req, student))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to download files for this student.' });
  }

  let buffer: Buffer | null = null;
  let contentType = part.mime_type || '';

  // 1. Primary: Direct record bytea persistence
  if (part.file_data) {
    buffer = Buffer.isBuffer(part.file_data) ? part.file_data : Buffer.from(part.file_data);
  }

  // 2. Secondary: Attachments table bytea persistence
  if (!buffer) {
    const att = await db.getAttachmentForRecord(part.student_id, 'participation', partId);
    if (att && att.file_data) {
      buffer = Buffer.isBuffer(att.file_data) ? att.file_data : Buffer.from(att.file_data);
      if (!contentType && att.mime_type) contentType = att.mime_type;
    }
  }

  // 3. Fallback: Supabase Storage / filesystem
  const proofFile = part.proof_file_path || part.file_path;
  if (!buffer && proofFile) {
    const fileData = await downloadFileFromStorage(proofFile);
    if (fileData) {
      buffer = fileData.buffer;
      if (!contentType && fileData.contentType) contentType = fileData.contentType;
    }
  }

  if (!buffer) {
    return res.status(404).json({ error: 'Participation proof file is not available on server storage.' });
  }

  const ext = path.extname(part.original_file_name || proofFile || '.pdf').toLowerCase();
  const origName = part.original_file_name || part.originalFileName || `${part.event_name}_Proof${ext}`;
  res.setHeader('Content-Type', contentType || getMimeFromPath(origName));
  res.setHeader('Content-Length', buffer.length.toString());
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(origName)}"`);
  return res.send(buffer);
});

// ATTENDANCE MODULE ENDPOINTS
router.get('/attendance', async (req: AuthRequest, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const records = await db.getClassDailyAttendanceByDate(date, req.user!.id);
  return res.json({ date, records });
});

router.get('/attendance/daily', async (req: AuthRequest, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const records = await db.getClassDailyAttendanceByDate(date, req.user!.id);
  return res.json({ date, records });
});

router.get('/attendance/summary', async (req: AuthRequest, res: Response) => {
  const summary = await db.getMonthlyAttendanceSummary(req.user!.id);
  return res.json({ summary });
});

router.post('/attendance', async (req: AuthRequest, res: Response) => {
  const { date, records } = req.body;
  if (!date || !Array.isArray(records)) {
    return res.status(400).json({ success: false, error: 'Date and records array are required.' });
  }

  try {
    // High-performance workspace or class section authorization check
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'HOD') {
      const studentIds = records.map((r: any) => r.studentId).filter(Boolean);
      if (studentIds.length > 0) {
        const assignment = await db.getFacultyAssignment(req.user!.id, { fresh: true });
        const facultyUser = await db.getUserById(req.user!.id);
        const assignedYear = assignment?.is_active ? assignment.year : (facultyUser?.year || req.user!.year);
        const assignedSection = assignment?.is_active ? assignment.section : (facultyUser?.section || req.user!.section);
        const cleanAssignedYear = normalizeYear(assignedYear);
        const cleanAssignedSec = normalizeSection(assignedSection);

        for (const sId of studentIds) {
          const stu = await db.getStudentById(sId);
          if (stu) {
            const isOwner = stu.created_by_faculty_id === req.user!.id || stu.faculty_workspace_id === req.user!.id;
            const cleanStudentYear = normalizeYear(stu.year);
            const cleanStudentSec = normalizeSection(stu.section);
            const isYearMatch = cleanAssignedYear === 'ALL' || (cleanAssignedYear && cleanStudentYear === cleanAssignedYear);
            const isSecMatch = cleanAssignedSec === 'ALL' || (cleanAssignedSec && cleanStudentSec === cleanAssignedSec);
            if (!isOwner && !(isYearMatch && isSecMatch)) {
              return res.status(403).json({
                success: false,
                error: 'Forbidden: Attendance record contains student outside your assigned workspace.'
              });
            }
          }
        }
      }
    }

    await db.saveDailyAttendance(date, records, req.user!.email);
    await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'SAVE_DAILY_ATTENDANCE', `DATE:${date}:COUNT:${records.length}`);
    const updatedRecords = await db.getClassDailyAttendanceByDate(date, req.user!.id);

    return res.json({
      success: true,
      message: 'Daily attendance saved successfully.',
      date,
      count: records.length,
      records: updatedRecords
    });
  } catch (err: any) {
    console.error('[Save Attendance Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to save attendance.' });
  }
});

router.post('/attendance/import-preview', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No attendance rows provided.' });
    }

    const preview = await db.previewBulkAttendanceImport(rows, req.user!.id);
    return res.json(preview);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to preview bulk attendance import.' });
  }
});

router.post('/attendance/import-confirm', async (req: AuthRequest, res: Response) => {
  try {
    const { records } = req.body || {};
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'No valid attendance records to confirm.' });
    }

    // Verify workspace ownership or class section match for every student in records
    if (req.user!.role !== 'ADMIN' && req.user!.role !== 'HOD') {
      const assignment = await db.getFacultyAssignment(req.user!.id, { fresh: true });
      const facultyUser = await db.getUserById(req.user!.id);
      const assignedYear = assignment?.is_active ? assignment.year : (facultyUser?.year || req.user!.year);
      const assignedSection = assignment?.is_active ? assignment.section : (facultyUser?.section || req.user!.section);
      const cleanAssignedYear = normalizeYear(assignedYear);
      const cleanAssignedSec = normalizeSection(assignedSection);

      for (const r of records) {
        const stu = await db.getStudentById(r.studentId);
        if (stu) {
          const isOwner = stu.created_by_faculty_id === req.user!.id || stu.faculty_workspace_id === req.user!.id;
          const cleanStudentYear = normalizeYear(stu.year);
          const cleanStudentSec = normalizeSection(stu.section);
          const isYearMatch = cleanAssignedYear === 'ALL' || (cleanAssignedYear && cleanStudentYear === cleanAssignedYear);
          const isSecMatch = cleanAssignedSec === 'ALL' || (cleanAssignedSec && cleanStudentSec === cleanAssignedSec);
          if (!isOwner && !(isYearMatch && isSecMatch)) {
            return res.status(403).json({ error: 'Forbidden: Record contains student outside your assigned workspace.' });
          }
        }
      }
    }

    const result = await db.confirmBulkAttendanceImport(records, req.user!.email);
    await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'BULK_IMPORT_ATTENDANCE', `RECORDS:${result.importedCount}:STUDENTS:${result.updatedStudentsCount}`);

    return res.json({
      message: 'Monthly bulk attendance imported successfully.',
      ...result
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to import bulk attendance.' });
  }
});

router.get('/attendance/history', async (req: AuthRequest, res: Response) => {
  const history = await db.getAttendanceHistoryForFaculty(req.user!.id);
  return res.json({ history });
});

router.get('/attendance/history/:date', async (req: AuthRequest, res: Response) => {
  const date = getRouteParam(req, 'date');
  const historyDetails = await db.getAttendanceHistoryByDateForFaculty(req.user!.id, date);
  return res.json({ details: historyDetails });
});

const attendanceOcrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/attendance/ocr-extract', attendanceOcrUpload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    let buffer: Buffer | null = null;
    let mimeType = 'image/png';
    const defaultDate = (req.body?.date as string) || new Date().toISOString().split('T')[0];

    if (req.file) {
      buffer = req.file.buffer;
      mimeType = req.file.mimetype || 'image/png';
    } else if (req.body?.imageBase64) {
      const cleanBase64 = String(req.body.imageBase64).replace(/^data:image\/[a-z]+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
      mimeType = req.body.mimeType || 'image/png';
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ success: false, error: 'No image file or base64 data provided.' });
    }

    // Fetch assigned roster for name verification and auto-matching
    const assignment = await db.getFacultyAssignment(req.user!.id);
    const facultyUser = await db.getUserById(req.user!.id);
    const assignedYear = assignment ? assignment.year : req.user!.assignedYear || facultyUser?.year || '2nd Year';
    const assignedSection = assignment ? assignment.section : req.user!.assignedSection || facultyUser?.section || 'A';
    const roster = await db.getStudentsForFaculty(req.user!.id, assignedYear, assignedSection);

    const result = await extractAttendanceFromImage(buffer, mimeType, defaultDate, roster);
    return res.json(result);
  } catch (err: any) {
    console.error('[Attendance OCR Extraction Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to extract attendance from image.' });
  }
});

// TEAMS MODULE ENDPOINTS
router.post('/teams', async (req: AuthRequest, res: Response) => {
  const { teamName, eventName, teamHeadStudentId, category, projectName, resultPosition, prize, proofFile, members } = req.body;
  if (!teamName || !eventName || !teamHeadStudentId) {
    return res.status(400).json({ error: 'Team Name, Event Name, and Team Head Student ID are required.' });
  }

  const headStu = await db.getStudentById(teamHeadStudentId);
  if (!headStu) return res.status(404).json({ error: 'Team head student record not found.' });

  if (headStu.created_by_faculty_id && headStu.created_by_faculty_id !== req.user!.id && headStu.faculty_workspace_id !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden: Team head student does not belong to your private faculty workspace.' });
  }

  try {
    const team = await db.createTeam({ teamName, eventName, teamHeadStudentId, category, projectName, resultPosition, prize, proofFile, members });
    await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'CREATE_TEAM', `TEAM:${teamName}:HEAD:${teamHeadStudentId}`);
    return res.status(201).json({ message: 'Team created successfully.', team });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to create team.' });
  }
});

router.get('/teams', async (req: AuthRequest, res: Response) => {
  const teams = await db.getTeamsForFaculty(req.user!.id);
  return res.json({ count: teams.length, teams });
});

// REPRESENTATIVE EVALUATION ENDPOINTS
router.post('/representative', async (req: AuthRequest, res: Response) => {
  const { studentId, evaluationPeriod, communicationScore, facultyCoordinationScore, studentCoordinationScore, attendanceFollowupScore, lateComerMonitoringScore, academicUpdatesScore, disciplineSupportScore, cleanlinessResponsibilityScore, noticeBoardScore, eventCoordinationScore, responsibilityCompletionScore, overallRemarks } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: 'Student ID is required.' });
  }

  const stu = await db.getStudentById(studentId);
  if (!stu) return res.status(404).json({ error: 'Student not found.' });

  if (stu.created_by_faculty_id && stu.created_by_faculty_id !== req.user!.id && stu.faculty_workspace_id !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden: Target student does not belong to your private faculty workspace.' });
  }

  try {
    await db.upsertRepresentativeEvaluation({
      studentId,
      year: stu.year,
      section: stu.section,
      evaluationPeriod: evaluationPeriod || 'Current Semester',
      communicationScore: parseFloat(communicationScore) || 8,
      facultyCoordinationScore: parseFloat(facultyCoordinationScore) || 8,
      studentCoordinationScore: parseFloat(studentCoordinationScore) || 8,
      attendanceFollowupScore: parseFloat(attendanceFollowupScore) || 8,
      lateComerMonitoringScore: parseFloat(lateComerMonitoringScore) || 8,
      academicUpdatesScore: parseFloat(academicUpdatesScore) || 8,
      disciplineSupportScore: parseFloat(disciplineSupportScore) || 8,
      cleanlinessResponsibilityScore: parseFloat(cleanlinessResponsibilityScore) || 8,
      noticeBoardScore: parseFloat(noticeBoardScore) || 8,
      eventCoordinationScore: parseFloat(eventCoordinationScore) || 8,
      responsibilityCompletionScore: parseFloat(responsibilityCompletionScore) || 8,
      overallRemarks: overallRemarks || 'CR evaluation recorded',
      evaluatedBy: req.user!.email
    });

    await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'EVALUATE_REPRESENTATIVE', `STUDENT:${studentId}`);
    return res.status(201).json({ message: 'Representative evaluation recorded successfully.' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to record representative evaluation.' });
  }
});

// POST Connect Academic Account & Trigger Verified Sync by Faculty (Section Guarded)
router.post('/students/:studentId/connect-account', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const { provider, username } = req.body;

  if (!provider || !username) {
    return res.status(400).json({ error: 'Provider and handle/username are required.' });
  }

  const cleanHandle = String(username).trim();
  if (['student', 'leetcode_user'].includes(cleanHandle.toLowerCase())) {
    return res.status(400).json({ error: 'Please enter a valid student LeetCode handle.' });
  }

  const targetStudent = await db.getStudentById(studentId);
  if (!targetStudent) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  try {
    if (provider.toLowerCase() === 'leetcode') {
      const { syncLeetCodeProfile } = await import('../services/externalSync.js');
      const result = await syncLeetCodeProfile(studentId, cleanHandle);
      return res.status(201).json({
        message: `LeetCode handle set and verified metrics synchronized for ${targetStudent.name}.`,
        result
      });
    }

    await db.upsertConnectedAccount(studentId, provider, cleanHandle, 'Connected', 'VERIFIED');
    return res.status(201).json({
      message: `${provider} handle set for ${targetStudent.name} successfully.`
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to connect service account.' });
  }
});

// POST Trigger LeetCode Sync by Faculty for Assigned Student
router.post('/students/:studentId/sync-leetcode', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const { username } = req.body;

  const targetStudent = await db.getStudentById(studentId);
  if (!targetStudent) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  const current360 = await db.getStudent360(studentId);
  const targetUsername = (username && String(username).trim() && !['student', 'leetcode_user'].includes(String(username).trim().toLowerCase()))
    ? String(username).trim()
    : current360?.leetcode?.username;

  if (!targetUsername || ['student', 'leetcode_user'].includes(targetUsername.toLowerCase())) {
    return res.status(400).json({ error: 'No valid LeetCode handle saved for this student. Please enter and save a handle first.' });
  }

  try {
    const { syncLeetCodeProfile } = await import('../services/externalSync.js');
    const result = await syncLeetCodeProfile(studentId, targetUsername);

    return res.json({
      message: `Verified LeetCode metrics synchronized successfully for ${targetStudent.name}.`,
      result
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to sync LeetCode metrics.' });
  }
});

// POST Trigger SkillEdge Sync for a Single Student by Faculty
router.post('/students/:studentId/sync-skilledge', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const targetStudent = await db.getStudentById(studentId);
  if (!targetStudent) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  try {
    const { syncStudentSkillEdge } = await import('../services/skilledgeSync.js');
    const result = await syncStudentSkillEdge(studentId, 'MANUAL_FACULTY');
    return res.json({
      message: `SkillEdge points synchronized successfully for ${targetStudent.name}.`,
      result
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to sync SkillEdge statistics.' });
  }
});

// POST Trigger Section-Wide / Department SkillEdge Sync by Faculty
router.post('/sync-skilledge-all', async (req: AuthRequest, res: Response) => {
  try {
    const { syncDepartmentSkillEdge } = await import('../services/skilledgeSync.js');
    const summary = await syncDepartmentSkillEdge('MANUAL_FACULTY');
    return res.json({
      message: `Successfully synchronized SkillEdge metrics for all ${summary.totalStudents} students. Total points earned: +${summary.totalPointsEarned}.`,
      summary
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to synchronize SkillEdge metrics.' });
  }
});

// POST Link / Match a Student's SkillEdge Handle / Email
router.post('/students/:studentId/link-skilledge', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const { skilledgeHandle } = req.body;

  if (!skilledgeHandle || !String(skilledgeHandle).trim()) {
    return res.status(400).json({ error: 'Please enter a valid SkillEdge handle or registered email.' });
  }

  const targetStudent = await db.getStudentById(studentId);
  if (!targetStudent) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  const existing = await db.getSkillEdgeRecord(studentId);
  const handleStr = String(skilledgeHandle).trim();

  await db.saveSkillEdgeRecord(studentId, {
    ...(existing || {}),
    overallCompletionPct: existing?.overallCompletionPct || 0,
    totalRewardPoints: existing?.totalRewardPoints || 0,
    skilledgeHandle: handleStr,
    status: 'VERIFIED',
    lastSyncedAt: new Date().toISOString()
  });

  return res.json({
    message: `SkillEdge account handle "${handleStr}" linked to ${targetStudent.name} successfully.`
  });
});

// DELETE student performance record (verifies section access on server!)
router.delete('/students/:studentId/records/:recordType/:recordId', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const studentId = getRouteParam(req, 'studentId');
  const recordType = getRouteParam(req, 'recordType');
  const recordId = getRouteParam(req, 'recordId');

  const targetStudent = await db.getStudentById(studentId);
  if (!targetStudent) {
    return res.status(404).json({ error: 'Student profile not found.' });
  }

  try {
    await db.deletePerformanceRecord(recordType, recordId, studentId);
    const { overallScore: updatedOverallScore } = await recalculateAffectedStudentScore(studentId);

    await db.logAudit(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'DELETE_PERFORMANCE_RECORD',
      `TYPE:${recordType}:ID:${recordId}:STUDENT:${studentId}`
    );

    return res.json({
      message: `Successfully deleted ${recordType} record. Score recalculated.`,
      overallScore: updatedOverallScore
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to delete performance record.' });
  }
});

// --- BEST TEAM HEAD ENDPOINTS ---

// GET all team heads created by authenticated faculty
router.get('/team-heads', async (req: AuthRequest, res: Response) => {
  const teamHeads = await db.getTeamHeadsForFaculty(req.user!.id);
  return res.json({ teamHeads });
});

// GET single team head details
router.get('/team-heads/:id', async (req: AuthRequest, res: Response) => {
  const teamHead = await db.getTeamHeadById(getRouteParam(req, 'id'));
  if (!teamHead) {
    return res.status(404).json({ error: 'Team Head not found.' });
  }
  if (teamHead.facultyId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden: Access denied to this Team Head workspace.' });
  }
  return res.json({ teamHead });
});

// POST create Team Head
router.post('/team-heads', async (req: AuthRequest, res: Response) => {
  const { headStudentId, memberLimit } = req.body;
  if (!headStudentId) {
    return res.status(400).json({ error: 'Head student ID is required.' });
  }

  const limitNum = parseInt(memberLimit, 10);
  if (isNaN(limitNum) || limitNum < 1) {
    return res.status(400).json({ error: 'Member limit must be a positive integer.' });
  }

  // Verify student exists and belongs to this faculty's workspace
  const targetStudent = await db.getStudentById(headStudentId);
  if (!targetStudent) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  const assignment = await db.getFacultyAssignment(req.user!.id);
  const assignedYear = assignment ? assignment.year : req.user!.assignedYear || '2nd Year';
  const assignedSection = assignment ? assignment.section : req.user!.assignedSection || 'A';
  const roster = await db.getStudentsForFaculty(req.user!.id, assignedYear, assignedSection);
  const belongsToFaculty = roster.some((s) => s.id === headStudentId);

  if (!belongsToFaculty) {
    return res.status(403).json({ error: 'Forbidden: Head student does not belong to your assigned roster.' });
  }

  try {
    const teamHead = await db.createTeamHead(req.user!.id, headStudentId, limitNum);
    return res.status(201).json({ teamHead, message: 'Team Head created successfully.' });
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'This student is already configured as a Team Head.' });
    }
    return res.status(400).json({ error: err.message || 'Failed to create Team Head.' });
  }
});

// PUT update Team Head member limit
router.put('/team-heads/:id', async (req: AuthRequest, res: Response) => {
  const id = getRouteParam(req, 'id');
  const { memberLimit } = req.body;
  const limitNum = parseInt(memberLimit, 10);

  if (isNaN(limitNum) || limitNum < 1) {
    return res.status(400).json({ error: 'Member limit must be a positive integer.' });
  }

  const existingHead = await db.getTeamHeadById(id);
  if (!existingHead) {
    return res.status(404).json({ error: 'Team Head not found.' });
  }
  if (existingHead.facultyId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden: Access denied to this Team Head workspace.' });
  }

  if (limitNum < existingHead.addedCount) {
    return res.status(400).json({
      error: `Cannot reduce slot limit to ${limitNum}. Current team has ${existingHead.addedCount} members. Please remove members first.`
    });
  }

  const updatedHead = await db.updateTeamHeadLimit(id, limitNum);
  return res.json({ teamHead: updatedHead, message: 'Team Head member limit updated successfully.' });
});

// DELETE Team Head (removes team relationship only, student records preserved)
router.delete('/team-heads/:id', async (req: AuthRequest, res: Response) => {
  const id = getRouteParam(req, 'id');
  const existingHead = await db.getTeamHeadById(id);

  if (!existingHead) {
    return res.status(404).json({ error: 'Team Head not found.' });
  }
  if (existingHead.facultyId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden: Access denied to this Team Head workspace.' });
  }

  await db.deleteTeamHead(id);
  return res.json({ message: 'Team Head deleted successfully. Student records were preserved.' });
});

// POST assign/update Team Members for a Team Head
router.post('/team-heads/:id/members', async (req: AuthRequest, res: Response) => {
  const id = getRouteParam(req, 'id');
  const { studentIds } = req.body;

  if (!Array.isArray(studentIds)) {
    return res.status(400).json({ error: 'studentIds must be an array.' });
  }

  const existingHead = await db.getTeamHeadById(id);
  if (!existingHead) {
    return res.status(404).json({ error: 'Team Head not found.' });
  }
  if (existingHead.facultyId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden: Access denied to this Team Head workspace.' });
  }

  // 1. Check limit
  if (studentIds.length > existingHead.memberLimit) {
    return res.status(400).json({
      error: `Cannot add ${studentIds.length} members. Maximum allowed slot count is ${existingHead.memberLimit}.`
    });
  }

  // 2. Check head cannot be a member
  if (studentIds.includes(existingHead.headStudentId)) {
    return res.status(400).json({ error: 'Team Head cannot be selected as their own team member.' });
  }

  // 3. Check for duplicates
  const uniqueSet = new Set(studentIds);
  if (uniqueSet.size !== studentIds.length) {
    return res.status(400).json({ error: 'Duplicate team members are not allowed in the same team.' });
  }

  // 4. Verify all students belong to faculty roster
  const assignment = await db.getFacultyAssignment(req.user!.id);
  const assignedYear = assignment ? assignment.year : req.user!.assignedYear || '2nd Year';
  const assignedSection = assignment ? assignment.section : req.user!.assignedSection || 'A';
  const roster = await db.getStudentsForFaculty(req.user!.id, assignedYear, assignedSection);
  const rosterIdSet = new Set(roster.map((s) => s.id));

  for (const sId of studentIds) {
    if (!rosterIdSet.has(sId)) {
      return res.status(403).json({ error: 'Forbidden: Cross-workspace student selection is not allowed.' });
    }
  }

  const updatedHead = await db.setTeamHeadMembers(id, studentIds);
  return res.json({ teamHead: updatedHead, message: 'Team members updated successfully.' });
});

// DELETE single member from Team Head
router.delete('/team-heads/:id/members/:studentId', async (req: AuthRequest, res: Response) => {
  const id = getRouteParam(req, 'id');
  const studentId = getRouteParam(req, 'studentId');

  const existingHead = await db.getTeamHeadById(id);
  if (!existingHead) {
    return res.status(404).json({ error: 'Team Head not found.' });
  }
  if (existingHead.facultyId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden: Access denied to this Team Head workspace.' });
  }

  const updatedHead = await db.removeTeamHeadMember(id, studentId);
  return res.json({ teamHead: updatedHead, message: 'Member removed from team successfully.' });
});

// GET /api/faculty/academics/records - Get saved exam records for Faculty, HOD, and ADMIN
router.get('/academics/records', requireRole('FACULTY', 'HOD', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { year, section, examType, studentId, subjectCode } = req.query;
    const records = await db.getAcademicRecords({
      facultyId: req.user!.id,
      role: req.user!.role,
      year: typeof year === 'string' ? year : undefined,
      section: typeof section === 'string' ? section : undefined,
      examType: typeof examType === 'string' ? examType : undefined,
      studentId: typeof studentId === 'string' ? studentId : undefined,
      subjectCode: typeof subjectCode === 'string' ? subjectCode : undefined
    });
    return res.json({ records });
  } catch (error: any) {
    console.error('Error fetching academic exam records:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch academic records.' });
  }
});

// Student Name verification helper: supports Indian naming conventions (initials at front/end, etc.)
function normalizePersonName(name: string): string {
  return String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function verifyStudentNameMatch(inputName: string, dbStudentName: string): boolean {
  if (!inputName || !inputName.trim()) return true; // Optional in sheet, only verified when provided
  const normInput = normalizePersonName(inputName);
  const normDb = normalizePersonName(dbStudentName);
  if (!normInput || !normDb) return true;
  if (normInput === normDb) return true;

  const inputWords = normInput.split(' ').filter(Boolean).sort();
  const dbWords = normDb.split(' ').filter(Boolean).sort();
  if (inputWords.join(' ') === dbWords.join(' ')) return true;

  // Single name or primary token match when initials are omitted
  const longInput = inputWords.filter((w) => w.length > 1);
  const longDb = dbWords.filter((w) => w.length > 1);
  if (longInput.length > 0 && longDb.length > 0 && longInput.join(' ') === longDb.join(' ')) {
    return true;
  }

  return false;
}

// POST /api/faculty/academics/import-preview - Preview and validate bulk mark Excel upload
router.post('/academics/import-preview', requireRole('FACULTY', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { rows, examType = 'Unit Test 1', year: selectedYear, section: selectedSection, semester: selectedSemester } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty rows provided for Bulk Marks Upload.' });
    }

    const assignment = await db.getFacultyAssignment(req.user!.id);
    const facultyAssignedYear = selectedYear || (assignment ? assignment.year : (req.user as any)?.assignedYear);
    const facultyAssignedSection = selectedSection || (assignment ? assignment.section : (req.user as any)?.assignedSection);
    const isSpecialRole = req.user!.role === 'ADMIN' || req.user!.role === 'HOD';

    const validRows: any[] = [];
    const invalidRows: any[] = [];
    const seenMap = new Set<string>();

    let newCount = 0;
    let updateCount = 0;
    let identicalCount = 0;

    const allStudents = await db.getAllStudents();
    const studentRegMap = new Map(allStudents.map((s) => [(s.register_no || s.registerNo || '').trim().toUpperCase(), s]));

    const allSubjects = await db.getSubjects({});
    const subjectCodeMap = new Map(allSubjects.map((s) => [s.subjectCode.trim().toUpperCase(), s]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== 'object') continue;

      const rawRegNo = getRowValue(
        row,
        'Register Number',
        'Register No',
        'Register_No',
        'Reg No',
        'Reg_No',
        'RegNo',
        'RegisterNumber',
        'Reg. No.',
        'registerNo'
      );
      const rawStudentName = getRowValue(
        row,
        'Student Name',
        'StudentName',
        'Name',
        'Student_Name',
        'Candidate Name',
        'studentName'
      );
      const rawSubjectCode = getRowValue(
        row,
        'Subject Code',
        'SubjectCode',
        'Subject_Code',
        'Code',
        'Sub Code',
        'Sub_Code',
        'Course Code',
        'subjectCode'
      );
      const rawSubjectTitle = getRowValue(
        row,
        'Subject Title',
        'SubjectTitle',
        'Subject Name',
        'Subject_Name',
        'Course Title',
        'Title',
        'Name',
        'subjectTitle'
      );
      const rawMarks = getRowValue(
        row,
        'Marks',
        'Mark',
        'Score',
        'Marks Obtained',
        'Total',
        'marks'
      );
      const rawSemester = getRowValue(
        row,
        'Semester',
        'Sem',
        'Semester No',
        'semester'
      );

      const cleanRegNo = String(rawRegNo).trim().toUpperCase();
      const cleanStudentName = String(rawStudentName).trim();
      const cleanCode = String(rawSubjectCode).trim().toUpperCase();
      const cleanTitle = String(rawSubjectTitle).trim();
      const numMarks = Number(rawMarks);

      // 1. Basic empty & type checks
      if (!cleanRegNo) {
        invalidRows.push({ rowNumber: i + 1, rawData: row, reason: 'Register Number is required.' });
        continue;
      }
      if (!cleanCode) {
        invalidRows.push({ rowNumber: i + 1, rawData: row, reason: 'Subject Code is required.' });
        continue;
      }
      if (rawMarks === '' || rawMarks === null || rawMarks === undefined || isNaN(numMarks) || numMarks < 0 || numMarks > 100) {
        invalidRows.push({
          rowNumber: i + 1,
          rawData: row,
          reason: `Invalid marks value "${rawMarks}". Marks must be a valid number between 0 and 100.`
        });
        continue;
      }

      // 2. Authoritative Register Number student lookup
      const student = studentRegMap.get(cleanRegNo);
      if (!student) {
        invalidRows.push({
          rowNumber: i + 1,
          rawData: row,
          reason: `Student with Register Number "${cleanRegNo}" not found in database.`
        });
        continue;
      }

      // 3. Student Name verification (when student name is supplied in upload sheet)
      if (cleanStudentName && !verifyStudentNameMatch(cleanStudentName, student.name)) {
        invalidRows.push({
          rowNumber: i + 1,
          rawData: row,
          reason: `Name mismatch for Register Number "${cleanRegNo}". Uploaded name "${cleanStudentName}" does not match registered student "${student.name}".`
        });
        continue;
      }

      // 4. Section & Year Scope Isolation check
      const stuYearNorm = normalizeYear(student.year);
      const stuSecNorm = normalizeSection(student.section);
      const facYearNorm = facultyAssignedYear ? normalizeYear(facultyAssignedYear) : '';
      const facSecNorm = facultyAssignedSection ? normalizeSection(facultyAssignedSection) : '';

      const yearMatches = !facYearNorm || facYearNorm === 'ALL' || facYearNorm === stuYearNorm;
      const secMatches = !facSecNorm || facSecNorm === 'ALL' || facSecNorm === stuSecNorm;

      if (!isSpecialRole && (!yearMatches || !secMatches)) {
        invalidRows.push({
          rowNumber: i + 1,
          rawData: row,
          reason: `Access Denied: Student ${student.name} (${cleanRegNo}) belongs to [${student.year}, ${student.section}], which is outside your assigned class assignment [${facultyAssignedYear}, ${facultyAssignedSection}].`
        });
        continue;
      }

      // 5. Subject Master lookup
      const masterSubject = subjectCodeMap.get(cleanCode);
      if (!masterSubject) {
        invalidRows.push({
          rowNumber: i + 1,
          rawData: row,
          reason: `Subject Code "${cleanCode}" does not exist in Subject Master. Please add subject to Subject Master first.`
        });
        continue;
      }

      // 6. Subject Year alignment check (prevent uploading 3rd-year subjects for 1st-year students)
      if (masterSubject.year) {
        const subYearNorm = normalizeYear(masterSubject.year);
        if (subYearNorm !== 'ALL' && subYearNorm !== stuYearNorm) {
          invalidRows.push({
            rowNumber: i + 1,
            rawData: row,
            reason: `Subject "${cleanCode}" (${masterSubject.subjectName}) is configured for ${masterSubject.year}, but student ${student.name} is in ${student.year}.`
          });
          continue;
        }
      }

      // 7. Duplicate check within same upload batch
      const dedupeKey = `${student.id}_${cleanCode}`;
      if (seenMap.has(dedupeKey)) {
        invalidRows.push({
          rowNumber: i + 1,
          rawData: row,
          reason: `Duplicate entry for Student ${cleanRegNo} and Subject Code ${cleanCode} in uploaded file.`
        });
        continue;
      }
      seenMap.add(dedupeKey);

      // 8. Determine target semester
      let rowSemester = Number(rawSemester) || Number(selectedSemester) || Number(masterSubject.semester);
      if (!rowSemester || isNaN(rowSemester)) {
        rowSemester = stuYearNorm.includes('1st') ? 1 : stuYearNorm.includes('2nd') ? 3 : stuYearNorm.includes('3rd') ? 5 : 7;
      }

      // 9. Inspect existing marks in database to classify as NEW, UPDATE, or IDENTICAL
      const existingRecord = await db.findStudentSubjectMark(student.id, masterSubject.subjectCode, rowSemester, examType);
      let rowStatus: 'NEW_MARK' | 'UPDATE_MARK' | 'IDENTICAL_MARK' = 'NEW_MARK';
      let previousMarks: number | undefined;

      if (existingRecord && existingRecord.exists) {
        previousMarks = existingRecord.marks;
        if (existingRecord.marks === numMarks) {
          rowStatus = 'IDENTICAL_MARK';
          identicalCount++;
        } else {
          rowStatus = 'UPDATE_MARK';
          updateCount++;
        }
      } else {
        rowStatus = 'NEW_MARK';
        newCount++;
      }

      validRows.push({
        rowNumber: i + 1,
        studentId: student.id,
        studentName: student.name,
        registerNo: student.register_no || student.registerNo,
        year: student.year,
        section: student.section,
        examType: examType,
        subjectCode: masterSubject.subjectCode,
        subjectTitle: cleanTitle || masterSubject.subjectName,
        subjectAbbreviation: masterSubject.subjectAbbreviation || '',
        semester: rowSemester,
        marks: numMarks,
        status: rowStatus,
        previousMarks
      });
    }

    return res.json({
      summary: {
        totalRowsProcessed: rows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        newCount,
        updateCount,
        identicalCount
      },
      validRows,
      invalidRows
    });
  } catch (error: any) {
    console.error('Error in academic marks import preview:', error);
    return res.status(500).json({ error: error.message || 'Failed to preview academic marks import.' });
  }
});

// POST /api/faculty/academics/import-confirm - Confirm bulk mark upload
router.post('/academics/import-confirm', requireRole('FACULTY', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { marks, examType = 'Unit Test 1', year: selectedYear, section: selectedSection } = req.body;
    if (!Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({ error: 'No valid marks provided for confirmation.' });
    }

    const { evaluateStudentRewardPoints } = await import('../services/studentRewardEngine.js');

    const affectedStudentIds = new Set<string>();
    let importedCount = 0; // newly created
    let updatedCount = 0;  // updated existing
    let skippedCount = 0;  // unchanged
    let failedCount = 0;
    const failedRows: any[] = [];

    for (const item of marks) {
      const { studentId, subjectCode, subjectTitle, marks: scoreVal, semester, examType: rowExamType } = item;
      const targetExam = rowExamType || examType || 'Unit Test 1';
      const targetSem = Number(semester) || 3;
      try {
        const result = await db.upsertStudentSubjectMark(
          studentId,
          subjectCode,
          subjectTitle || subjectCode,
          Number(scoreVal),
          targetSem,
          targetExam
        );
        if (result.action === 'CREATED') {
          importedCount++;
        } else if (result.action === 'UPDATED') {
          updatedCount++;
        } else {
          skippedCount++;
        }
        affectedStudentIds.add(studentId);
      } catch (rowErr: any) {
        failedCount++;
        failedRows.push({
          studentId,
          subjectCode,
          marks: scoreVal,
          reason: rowErr.message || 'Database write error'
        });
      }
    }

    // Trigger score recalculation & reward evaluation for affected students with controlled concurrency
    const affectedArr = Array.from(affectedStudentIds);
    for (let i = 0; i < affectedArr.length; i += 5) {
      const batch = affectedArr.slice(i, i + 5);
      await Promise.all(batch.map(async (sId) => {
        try {
          await recalculateAffectedStudentScore(sId);
          await evaluateStudentRewardPoints(sId);
        } catch (_e) {}
      }));
    }

    const totalProcessed = importedCount + updatedCount + skippedCount;
    await db.createBulkImportAudit(
      req.user!.id,
      req.user!.role,
      'BULK_MARKS_IMPORT',
      'bulk_academic_marks.xlsx',
      totalProcessed,
      failedCount,
      {
        affectedStudentsCount: affectedStudentIds.size,
        importedCount,
        updatedCount,
        skippedCount,
        failedCount,
        examType,
        year: selectedYear,
        section: selectedSection
      }
    );

    await db.logAudit(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'BULK_MARKS_IMPORT',
      `STUDENTS:${affectedStudentIds.size}, CREATED:${importedCount}, UPDATED:${updatedCount}, SKIPPED:${skippedCount}, FAILED:${failedCount}, EXAM:${examType}`
    );

    return res.json({
      message: `Academic marks imported successfully! ${importedCount} created, ${updatedCount} updated, ${skippedCount} unchanged across ${affectedStudentIds.size} students.`,
      importedCount,
      updatedCount,
      skippedCount,
      failedCount,
      failedRows,
      updatedStudentsCount: affectedStudentIds.size
    });
  } catch (error: any) {
    console.error('Error in academic marks import confirm:', error);
    return res.status(500).json({ error: error.message || 'Failed to confirm academic marks import.' });
  }
});

export default router;
