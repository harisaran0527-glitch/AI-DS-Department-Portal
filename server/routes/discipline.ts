import { Router, Response } from 'express';
import { db } from '../db.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Protect all discipline endpoints with JWT Authentication
router.use(authenticateToken);
router.use(requireRole('FACULTY', 'HOD', 'ADMIN'));

/**
 * GET /api/discipline/lookup-student/:regNo
 * Discipline module student lookup - bypasses year/section restrictions for faculty
 * Returns student name, college email, year, section
 */
router.get('/lookup-student/:regNo', async (req: AuthRequest, res: Response) => {
  const regNo = String(req.params.regNo || '');
  if (!regNo || !regNo.trim()) {
    return res.status(400).json({ error: 'Register Number is required.' });
  }

  try {
    const student = await db.getStudentByRegisterNo(regNo.trim());
    if (!student) {
      return res.status(444).json({
        found: false,
        error: `Register Number "${regNo}" does not match any valid student in database.`
      });
    }

    return res.json({
      found: true,
      student: {
        id: student.id,
        registerNo: student.registerNo || student.register_no,
        name: student.name,
        email: student.email || student.collegeEmail || student.college_email,
        year: student.year,
        section: student.section,
        department: student.department || 'AI & DS'
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to lookup student by register number.' });
  }
});

/**
 * GET /api/discipline/students/search
 * Search suggestions for student register number / name autocomplete across all students
 */
router.get('/students/search', async (req: AuthRequest, res: Response) => {
  const query = (req.query.q as string || '').trim().toLowerCase();
  if (!query) {
    return res.json({ students: [] });
  }

  try {
    const allStudents = await db.getAllStudents();
    const matches = allStudents.filter(
      (s) =>
        (s.registerNo && s.registerNo.toLowerCase().includes(query)) ||
        (s.name && s.name.toLowerCase().includes(query))
    ).slice(0, 10);

    return res.json({
      students: matches.map((s) => ({
        id: s.id,
        registerNo: s.registerNo || s.register_no,
        name: s.name,
        email: s.email || s.collegeEmail,
        year: s.year,
        section: s.section
      }))
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to search students.' });
  }
});

/**
 * POST /api/discipline/records
 * Create a new discipline issue record
 * Enforces strict backend validation: Register Number MUST match a valid student in DB.
 */
router.post('/records', async (req: AuthRequest, res: Response) => {
  const {
    registerNo,
    issue,
    ruleViolated,
    actionTaken,
    fineAmount,
    fineDetails,
    remarks,
    date,
    time
  } = req.body;

  if (!registerNo || !registerNo.trim()) {
    return res.status(400).json({ error: 'Register Number is required.' });
  }

  if (!issue || !issue.trim()) {
    return res.status(400).json({ error: 'Discipline Issue category is required.' });
  }

  try {
    // REQUIREMENT 8 & 15: Backend validation to ensure Register Number matches valid student in DB
    const student = await db.getStudentByRegisterNo(registerNo.trim());
    if (!student) {
      return res.status(400).json({
        error: `Save rejected: Register Number "${registerNo}" does not match any valid student record in the database.`
      });
    }

    const currentDate = date && date.trim() ? date.trim() : new Date().toISOString().split('T')[0];
    const currentTime = time && time.trim() ? time.trim() : new Date().toLocaleTimeString('en-US', { hour12: false });
    const recordedBy = req.user?.name ? `${req.user.name} (${req.user.email})` : (req.user?.email || 'Staff');

    const createdRecord = await db.addDisciplineIssue({
      studentId: student.id,
      date: currentDate,
      time: currentTime,
      category: issue.trim(),
      ruleViolated: (ruleViolated || '').trim(),
      actionTaken: (actionTaken || '').trim(),
      fineAmount: Number(fineAmount) || 0,
      fineDetails: (fineDetails || '').trim(),
      remark: (remarks || '').trim(),
      recordedBy
    });

    await db.logAudit(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'CREATE_DISCIPLINE_RECORD',
      `STUDENT:${student.registerNo}`
    );

    return res.status(201).json({
      message: 'Discipline issue recorded successfully and securely attached to student record.',
      record: {
        ...createdRecord,
        registerNo: student.registerNo,
        studentName: student.name,
        collegeEmail: student.email,
        year: student.year,
        section: student.section
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save discipline issue record.' });
  }
});

/**
 * GET /api/discipline/records
 * Full view & search of all discipline records for Faculty and HOD
 */
router.get('/records', async (req: AuthRequest, res: Response) => {
  const { registerNo, year, section, issue, search } = req.query;

  try {
    const records = await db.getAllDisciplineIssues({
      registerNo: registerNo as string,
      year: year as string,
      section: section as string,
      issue: issue as string,
      search: search as string
    });

    return res.json({ records });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch discipline records.' });
  }
});

/**
 * DELETE /api/discipline/records/:id
 * Delete discipline issue record
 */
router.delete('/records/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id || '');
  if (!id) {
    return res.status(400).json({ error: 'Record ID is required.' });
  }

  try {
    const success = await db.deleteDisciplineIssue(id);
    if (!success) {
      return res.status(404).json({ error: 'Discipline record not found or already deleted.' });
    }

    await db.logAudit(
      req.user!.id,
      req.user!.email,
      req.user!.role,
      'DELETE_DISCIPLINE_RECORD',
      `RECORD:${id}`
    );

    return res.json({ message: 'Discipline record deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete discipline record.' });
  }
});

export default router;
