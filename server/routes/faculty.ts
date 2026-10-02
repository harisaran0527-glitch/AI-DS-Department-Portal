import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db.js';
import { authenticateToken, requireRole, verifyFacultySectionAccess, AuthRequest } from '../middleware/auth.js';
import { calculateCategoryScores, computeOverallScore } from '../scoringEngine.js';
import { generateSecureRandomPassword } from '../services/security.js';

const router = Router();

const UPLOADS_DIR = process.env.VERCEL ? '/tmp' : path.resolve(process.cwd(), 'server', 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (_err) {
  // Ignore filesystem error in read-only environment
}

const nptelProofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `nptel-proof-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  }
});

const certStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `cert-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  }
});

const ALLOWED_CERT_EXTS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);
const ALLOWED_CERT_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/pjpeg', 'application/pdf']);

const nptelProofUpload = multer({
  storage: nptelProofStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    if (!ALLOWED_CERT_EXTS.has(ext) || !ALLOWED_CERT_MIMES.has(mime)) {
      return cb(new Error('Invalid file type. Supported formats are JPG, JPEG, PNG, and PDF under 10 MB.'));
    }
    cb(null, true);
  }
});

const certUpload = multer({
  storage: certStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    if (!ALLOWED_CERT_EXTS.has(ext) || !ALLOWED_CERT_MIMES.has(mime)) {
      return cb(new Error('Invalid file type. Supported formats are PDF, JPG, and PNG under 10 MB.'));
    }
    cb(null, true);
  }
});

router.use(authenticateToken, requireRole('FACULTY'));

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
  const parsedCgpa = typeof cgpa === 'number' ? cgpa : (parseFloat(cgpa) || student.cgpa);
  const cgpaToUse = Math.max(0, Math.min(10, parsedCgpa));

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

// Helper function to recalculate ONLY the affected student's score and update rank
async function recalculateAffectedStudentScore(studentId: string) {
  const targetStudent = await db.getStudentById(studentId);
  if (!targetStudent) return 0;

  const full360 = (await db.getStudent360(studentId))!;
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
    full360.projects
  );

  const newOverallScore = computeOverallScore(breakdown, scoringConfig) || 0;

  // Update ONLY section ranking
  const sectionStudents = await db.getStudents(targetStudent.year, targetStudent.section);
  for (let idx = 0; idx < sectionStudents.length; idx++) {
    const s = sectionStudents[idx];
    const sScore = s.id === studentId ? newOverallScore : (s.overall_score || 0);
    await db.updateStudentScoreAndRank(s.id, sScore, idx + 1);
  }

  return newOverallScore;
}

// PUT update student 360 performance details (verifies section access on server!)
router.put('/students/:studentId/360', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const { studentId } = req.params;
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
    await db.updateStudentCGPA(studentId, parseFloat(cgpa) || 0);
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

  const updatedOverallScore = await recalculateAffectedStudentScore(studentId);

  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPDATE_STUDENT_360', `STUDENT:${studentId}`);

  // Return updated 360 profile so UI can immediately re-render history
  const updatedProfile = await db.getStudent360(studentId);

  return res.json({
    message: 'Student 360 profile updated and score recalculated successfully.',
    overallScore: updatedOverallScore,
    profile: updatedProfile
  });
});

// POST Add new category record item to student 360 profile (verifies section access on server!)
router.post('/students/:studentId/records/:recordType', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const { studentId, recordType } = req.params;
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

  const updatedOverallScore = await recalculateAffectedStudentScore(studentId);
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

// POST Add Single Student by Faculty (ONLY Class Coordinator)
router.post('/students', requireClassCoordinator, async (req: AuthRequest, res: Response) => {
  const { registerNo, regNo, name, email, collegeEmail, personalEmail, personal_email, batch, password, portalPassword, collegePortalPassword, year, section, cgpa, entryType } = req.body;

  const targetRegNo = registerNo || regNo;
  const targetEmail = email || collegeEmail;
  const targetPassword = password || portalPassword || collegePortalPassword;

  if (!targetRegNo || !name || !targetEmail || !targetPassword) {
    return res.status(400).json({ error: 'Register number, name, college email ID, and portal password are required.' });
  }

  try {
    const newStudent = await db.createStudentForFaculty(req.user!.id, {
      registerNo: targetRegNo,
      name,
      email: targetEmail,
      collegeEmail: targetEmail,
      personalEmail: personalEmail || personal_email,
      batch: batch || '2023-2027',
      password: targetPassword,
      portalPassword: targetPassword,
      year,
      section,
      entryType,
      cgpa: parseFloat(cgpa) || 0
    });

    return res.status(201).json({
      message: 'Student account created and assigned to your section successfully.',
      student: newStudent
    });
  } catch (err: any) {
    if (err.message && err.message.toLowerCase().includes('already exists')) {
      return res.status(409).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message || 'Failed to create student account.' });
  }
});

// POST Bulk Import Students by Faculty (ONLY Class Coordinator)
router.post('/students/import', requireClassCoordinator, async (req: AuthRequest, res: Response) => {
  const { students, defaultPassword } = req.body;

  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'No student records provided for import.' });
  }

  const createdList: any[] = [];
  const errorsList: string[] = [];
  const generatedCredentials: any[] = [];

  for (const s of students) {
    try {
      const reg = s.registerNo || s.regNo || s['Register Number'] || s['Register No'];
      const mail = s.email || s.collegeEmail || s['College Email ID'] || s['College Mail ID'] || `${String(reg).toLowerCase()}@aids.edu`;
      let isTemp = false;
      let pass = s.password || s.portalPassword || s.collegePortalPassword || s['College Portal Password'] || s['Portal Password'];
      if (!pass || typeof pass !== 'string' || pass.trim().length < 6) {
        if (defaultPassword && typeof defaultPassword === 'string' && defaultPassword.trim().length >= 6) {
          pass = defaultPassword.trim();
        } else {
          pass = generateSecureRandomPassword(12);
          isTemp = true;
        }
      }

      const created = await db.createStudentForFaculty(req.user!.id, {
        registerNo: reg,
        name: s.name || s['Student Name'] || s['Name'],
        email: mail,
        collegeEmail: mail,
        personalEmail: s.personalEmail || s.personal_email,
        batch: s.batch || '2023-2027',
        password: pass,
        portalPassword: pass,
        year: s.year || s['Year'],
        section: s.section || s['Section'],
        cgpa: parseFloat(s.cgpa) || 0
      });
      createdList.push(created);
      if (isTemp) {
        generatedCredentials.push({ registerNo: reg, name: s.name || '', tempPassword: pass });
      }
    } catch (err: any) {
      errorsList.push(`Skipped ${s.registerNo || s.name || 'row'}: ${err.message}`);
    }
  }

  return res.status(200).json({
    message: `Successfully imported ${createdList.length} students to your section.`,
    count: createdList.length,
    generatedCredentials: generatedCredentials.length > 0 ? generatedCredentials : undefined,
    errors: errorsList
  });
});

// POST Reset Student Password by Class Coordinator
router.post('/students/:studentId/reset-password', requireClassCoordinator, verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const { studentId } = req.params;
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
  const { studentId } = req.params;

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
  const { studentId } = req.params;
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
  const { studentId } = req.params;
  const conn = await db.getNptelGoogleConnection(studentId);
  return res.json({ connection: conn });
});

// POST NPTEL Connection Sync
router.post('/students/:studentId/nptel-connection/sync', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const { studentId } = req.params;
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
  const { studentId } = req.params;
  await db.disconnectNptelGoogleConnection(studentId);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'DISCONNECT_NPTEL_GOOGLE', `STU:${studentId}`);
  return res.json({ message: 'NPTEL Google OAuth connection disconnected successfully.' });
});

// NPTEL WEEKLY PROOFS MODULE ENDPOINTS
router.get('/students/:studentId/nptel-proofs', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const { studentId } = req.params;
  const proofs = await db.getNptelProofs(studentId);
  return res.json({ proofs });
});

// POST NPTEL Proofs Upload
router.post('/students/:studentId/nptel-proofs', verifyFacultySectionAccess, (req: AuthRequest, res: Response) => {
  nptelProofUpload.single('file')(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Proof file upload failed.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Proof screenshot/file is required.' });
    }

    const { studentId } = req.params;
    const weekVal = req.body.weekNo || req.body.week;
    const weekNo = parseInt(String(weekVal).replace('Week ', ''), 10);

    if (isNaN(weekNo) || weekNo < 1 || weekNo > 10) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Week number must be an integer between 1 and 10.' });
    }

    try {
      const proofRecord = await db.addNptelProof(studentId, weekNo, req.file.filename, req.file.originalname);
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
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: dbErr.message || 'Failed to persist NPTEL proof record.' });
    }
  });
});

// DELETE NPTEL Proof
router.delete('/students/:studentId/nptel-proofs/:proofId', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const { studentId, proofId } = req.params;
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
      const fullPath = path.join(UPLOADS_DIR, proof.proof_file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
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

  const facultyAssignment = await db.getFacultyAssignment(req.user.id);
  const assignedYear = facultyAssignment ? facultyAssignment.year : req.user.assignedYear;
  const assignedSection = facultyAssignment ? facultyAssignment.section : req.user.assignedSection;

  const isYearMatch = !assignedYear || assignedYear === 'ALL' || student.year === assignedYear;
  const isSectionMatch = !assignedSection || assignedSection === 'ALL' || student.section === assignedSection;

  return (isYearMatch && isSectionMatch) || isCreatedByStaff || isWorkspaceStaff;
}

router.get('/nptel-proofs/:proofId/view', async (req: AuthRequest, res: Response) => {
  const { proofId } = req.params;
  const proof = await db.getNptelProofById(proofId);

  if (!proof) {
    return res.status(404).json({ error: 'NPTEL proof record not found.' });
  }

  const student = await db.getStudentById(proof.student_id);
  if (!student || !(await checkFacultyStudentFileAccess(req, student))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to view files for this student.' });
  }

  const filePath = path.join(UPLOADS_DIR, proof.proof_file_path);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Proof file missing on server storage.' });
  }

  const ext = path.extname(proof.proof_file_path).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png'
  };

  res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(proof.original_file_name || 'proof' + ext)}"`);
  return res.sendFile(filePath);
});

router.get('/nptel-proofs/:proofId/download', async (req: AuthRequest, res: Response) => {
  const { proofId } = req.params;
  const proof = await db.getNptelProofById(proofId);

  if (!proof) {
    return res.status(404).json({ error: 'NPTEL proof record not found.' });
  }

  const student = await db.getStudentById(proof.student_id);
  if (!student || !(await checkFacultyStudentFileAccess(req, student))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to download files for this student.' });
  }

  const filePath = path.join(UPLOADS_DIR, proof.proof_file_path);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Proof file missing on server storage.' });
  }

  return res.download(filePath, proof.original_file_name || 'nptel-proof');
});

// CERTIFICATE MODULE FILE UPLOAD & MANAGEMENT ENDPOINTS
router.post('/students/:studentId/certificates/upload', verifyFacultySectionAccess, (req: AuthRequest, res: Response) => {
  certUpload.single('file')(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Certificate file upload failed.' });
    }

    const { studentId } = req.params;
    const { courseName, platform, category, issueDate } = req.body;

    if (!courseName || !platform) {
      return res.status(400).json({ error: 'Certificate Course Name and Issuing Organization/Platform are required.' });
    }

    const filePath = req.file ? req.file.filename : '';
    const originalFileName = req.file ? req.file.originalname : '';

    try {
      const certId = await db.saveCertificateUpload({
        studentId,
        courseName: courseName.trim(),
        platform: platform.trim(),
        category: (category || 'Technical Certification').trim(),
        issueDate: issueDate || new Date().toISOString().split('T')[0],
        filePath,
        originalFileName
      });

      const updatedScore = await recalculateAffectedStudentScore(studentId);
      await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPLOAD_CERTIFICATE', `STUDENT:${studentId}:CERT:${certId}`);

      const full360 = await db.getStudent360(studentId);

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
      return res.status(400).json({ error: err.message || 'Certificate file upload failed.' });
    }

    const { studentId, certId } = req.params;
    const { courseName, platform, category, issueDate } = req.body;

    if (!courseName || !platform) {
      return res.status(400).json({ error: 'Certificate Course Name and Issuing Organization/Platform are required.' });
    }

    const existingCert = await db.getCertificateById(certId);
    if (!existingCert || existingCert.student_id !== studentId) {
      return res.status(404).json({ error: 'Certificate record not found.' });
    }

    const filePath = req.file ? req.file.filename : undefined;
    const originalFileName = req.file ? req.file.originalname : undefined;

    try {
      await db.updateCertificateUpload(certId, studentId, {
        courseName: courseName.trim(),
        platform: platform.trim(),
        category: (category || 'Technical Certification').trim(),
        issueDate: issueDate || new Date().toISOString().split('T')[0],
        filePath,
        originalFileName
      });

      // If old file replaced and new file provided, unlink old file
      if (filePath && existingCert.file_path && existingCert.file_path !== filePath) {
        const oldPath = path.join(UPLOADS_DIR, existingCert.file_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const updatedScore = await recalculateAffectedStudentScore(studentId);
      await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPDATE_CERTIFICATE', `STUDENT:${studentId}:CERT:${certId}`);

      const full360 = await db.getStudent360(studentId);

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
  const { studentId, certId } = req.params;
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
      const fullPath = path.join(UPLOADS_DIR, existingCert.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    const updatedScore = await recalculateAffectedStudentScore(studentId);
    await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'DELETE_CERTIFICATE', `STUDENT:${studentId}:CERT:${certId}`);

    const full360 = await db.getStudent360(studentId);

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
  const { certId } = req.params;
  const cert = await db.getCertificateById(certId);

  if (!cert || !cert.file_path) {
    return res.status(404).json({ error: 'Certificate file document not found.' });
  }

  const student = await db.getStudentById(cert.student_id);
  if (!student || !(await checkFacultyStudentFileAccess(req, student))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to view files for this student.' });
  }

  const filePath = path.join(UPLOADS_DIR, cert.file_path);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Certificate file missing on server storage.' });
  }

  const ext = path.extname(cert.file_path).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png'
  };

  res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(cert.original_file_name || 'certificate' + ext)}"`);
  return res.sendFile(filePath);
});

router.get('/certificates/:certId/download', async (req: AuthRequest, res: Response) => {
  const { certId } = req.params;
  const cert = await db.getCertificateById(certId);

  if (!cert || !cert.file_path) {
    return res.status(404).json({ error: 'Certificate file document not found.' });
  }

  const student = await db.getStudentById(cert.student_id);
  if (!student || !(await checkFacultyStudentFileAccess(req, student))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to download files for this student.' });
  }

  const filePath = path.join(UPLOADS_DIR, cert.file_path);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Certificate file missing on server storage.' });
  }

  const ext = path.extname(cert.file_path).toLowerCase();
  return res.download(filePath, cert.original_file_name || `${cert.course_name}_Certificate${ext}`);
});

// PARTICIPATION MODULE FILE UPLOAD & MANAGEMENT ENDPOINTS
router.post('/students/:studentId/participation/upload', verifyFacultySectionAccess, (req: AuthRequest, res: Response) => {
  certUpload.single('file')(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Proof file upload failed.' });
    }

    const { studentId } = req.params;
    const { eventName, category, eventLevel, organizer, date, achievement, description } = req.body;

    if (!eventName || !organizer) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Event Name and Organizer/Host Institution are required.' });
    }

    const filePath = req.file ? req.file.filename : '';
    const originalFileName = req.file ? req.file.originalname : '';

    try {
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
        originalFileName
      });

      const updatedScore = await recalculateAffectedStudentScore(studentId);
      const full360 = await db.getStudent360(studentId);

      await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPLOAD_PARTICIPATION', `STUDENT:${studentId}:EVENT:${eventName}`);

      return res.status(201).json({
        message: 'Participation record saved successfully.',
        partId,
        participation: full360?.participation || [],
        overallScore: updatedScore
      });
    } catch (dbErr: any) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: dbErr.message || 'Failed to save participation record.' });
    }
  });
});

router.put('/students/:studentId/participation/:partId', verifyFacultySectionAccess, (req: AuthRequest, res: Response) => {
  certUpload.single('file')(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Proof file upload failed.' });
    }

    const { studentId, partId } = req.params;
    const { eventName, category, eventLevel, organizer, date, achievement, description } = req.body;

    if (!eventName || !organizer) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Event Name and Organizer/Host Institution are required.' });
    }

    const existingPart = await db.getParticipationById(partId);
    if (!existingPart || existingPart.student_id !== studentId) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Participation record not found.' });
    }

    const filePath = req.file ? req.file.filename : undefined;
    const originalFileName = req.file ? req.file.originalname : undefined;

    try {
      await db.updateParticipationUpload(partId, studentId, {
        eventName: eventName.trim(),
        category: (category || 'Symposium').trim(),
        eventLevel: (eventLevel || 'College').trim(),
        organizer: organizer.trim(),
        date: date || new Date().toISOString().split('T')[0],
        achievement: (achievement || 'Participant').trim(),
        description: (description || '').trim(),
        filePath,
        originalFileName
      });

      // Unlink old file if replaced
      const oldFile = existingPart.proof_file_path || existingPart.file_path;
      if (filePath && oldFile && oldFile !== filePath) {
        const oldPath = path.join(UPLOADS_DIR, oldFile);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      const updatedScore = await recalculateAffectedStudentScore(studentId);
      const full360 = await db.getStudent360(studentId);

      await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPDATE_PARTICIPATION', `STUDENT:${studentId}:PART:${partId}`);

      return res.json({
        message: 'Participation record updated successfully.',
        participation: full360?.participation || [],
        overallScore: updatedScore
      });
    } catch (dbErr: any) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: dbErr.message || 'Failed to update participation record.' });
    }
  });
});

router.delete('/students/:studentId/participation/:partId', verifyFacultySectionAccess, async (req: AuthRequest, res: Response) => {
  const { studentId, partId } = req.params;
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
      const fullPath = path.join(UPLOADS_DIR, oldFile);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    const updatedScore = await recalculateAffectedStudentScore(studentId);
    const full360 = await db.getStudent360(studentId);

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
  const { partId } = req.params;
  const part = await db.getParticipationById(partId);

  const proofFile = part?.proof_file_path || part?.file_path;
  if (!part || !proofFile) {
    return res.status(404).json({ error: 'Participation proof file not found.' });
  }

  const student = await db.getStudentById(part.student_id);
  if (!student || !(await checkFacultyStudentFileAccess(req, student))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to view files for this student.' });
  }

  const filePath = path.join(UPLOADS_DIR, proofFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Proof file missing on server storage.' });
  }

  const ext = path.extname(proofFile).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png'
  };

  const origName = part.original_file_name || part.originalFileName || `${part.event_name}_Proof${ext}`;
  res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(origName)}"`);
  return res.sendFile(filePath);
});

router.get('/participation/:partId/download', async (req: AuthRequest, res: Response) => {
  const { partId } = req.params;
  const part = await db.getParticipationById(partId);

  const proofFile = part?.proof_file_path || part?.file_path;
  if (!part || !proofFile) {
    return res.status(404).json({ error: 'Participation proof file not found.' });
  }

  const student = await db.getStudentById(part.student_id);
  if (!student || !(await checkFacultyStudentFileAccess(req, student))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to download files for this student.' });
  }

  const filePath = path.join(UPLOADS_DIR, proofFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Proof file missing on server storage.' });
  }

  const ext = path.extname(proofFile).toLowerCase();
  const origName = part.original_file_name || part.originalFileName || `${part.event_name}_Proof${ext}`;
  return res.download(filePath, origName);
});

// CR ATTENDANCE STYLE ENDPOINTS
router.get('/attendance', async (req: AuthRequest, res: Response) => {
  const date = (req.query.date as string) || '2026-07-13';
  if (date < '2026-07-13') {
    return res.status(400).json({ error: 'Attendance dates before 13 July 2026 are not valid or selectable.' });
  }
  const records = await db.getDailyAttendanceByDateForFaculty(req.user!.id, date);
  return res.json({ date, records });
});

router.post('/attendance', async (req: AuthRequest, res: Response) => {
  const { date, records } = req.body;
  if (!date || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Date and records array are required.' });
  }
  if (date < '2026-07-13') {
    return res.status(400).json({ error: 'Attendance dates before 13 July 2026 are not valid or selectable.' });
  }

  // Verify workspace ownership for every student record
  for (const r of records) {
    const stu = await db.getStudentById(r.studentId);
    if (stu && stu.created_by_faculty_id && stu.created_by_faculty_id !== req.user!.id && stu.faculty_workspace_id !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden: Attendance record contains student outside your private workspace.' });
    }
  }

  try {
    await db.saveDailyAttendance(date, records, req.user!.email);
    await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'SAVE_DAILY_ATTENDANCE', `DATE:${date}:COUNT:${records.length}`);
    return res.json({ message: 'Daily attendance saved successfully.', date, records: await db.getDailyAttendanceByDateForFaculty(req.user!.id, date) });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to save attendance.' });
  }
});

router.get('/attendance/history', async (req: AuthRequest, res: Response) => {
  const history = await db.getAttendanceHistoryForFaculty(req.user!.id);
  return res.json({ history });
});

router.get('/attendance/history/:date', async (req: AuthRequest, res: Response) => {
  const { date } = req.params;
  const historyDetails = await db.getAttendanceHistoryByDateForFaculty(req.user!.id, date);
  return res.json({ details: historyDetails });
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
  const { studentId } = req.params;
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
  const { studentId } = req.params;
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
  const { studentId } = req.params;
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
  const { studentId } = req.params;
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
  const { studentId, recordType, recordId } = req.params;

  const targetStudent = await db.getStudentById(studentId);
  if (!targetStudent) {
    return res.status(404).json({ error: 'Student profile not found.' });
  }

  try {
    await db.deletePerformanceRecord(recordType, recordId, studentId);
    const updatedOverallScore = await recalculateAffectedStudentScore(studentId);

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
  const teamHead = await db.getTeamHeadById(req.params.id);
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
  const { id } = req.params;
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
  const { id } = req.params;
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
  const { id } = req.params;
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
  const { id, studentId } = req.params;

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

export default router;
