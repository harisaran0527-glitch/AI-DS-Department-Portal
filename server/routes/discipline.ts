import { Router, Request, Response } from 'express';
import { db, normalizeYear, normalizeSection } from '../db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Middleware to attempt JWT authentication if token exists, but allow standalone access if not present
const optionalAuth = (req: Request, res: Response, next: () => void) => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.token;
  if (authHeader || cookieToken) {
    return authenticateToken(req as AuthRequest, res, () => next());
  }
  next();
};

router.use(optionalAuth);

/**
 * Helper to resolve Assigned Faculty ID & Staff Name for a student from database assignment
 */
export async function resolveFacultyAssignmentForStudent(student: any): Promise<{
  assignedFacultyId: string | null;
  assignedStaffName: string;
  assignedYear: string;
  assignedSection: string;
}> {
  const assignedYear = student.year || '2nd Year';
  const assignedSection = student.section || 'A';
  let assignedFacultyId: string | null = null;
  let assignedStaffName = 'No Staff Assigned';

  try {
    // 1. Check created_by_faculty_id / faculty_workspace_id
    const creatorId = student.createdByFacultyId || student.created_by_faculty_id || student.faculty_workspace_id;
    if (creatorId) {
      const creator = await db.getUserById(creatorId);
      if (creator && creator.name) {
        assignedFacultyId = creator.id;
        assignedStaffName = creator.name;
        return { assignedFacultyId, assignedStaffName, assignedYear, assignedSection };
      }
    }

    // 2. Check faculty_assignments by year and section
    if (student.year && student.section) {
      const assignmentsMap = await db.getAllFacultyAssignments();
      const activeAssignment = Object.values(assignmentsMap).find(
        (fa: any) =>
          fa.is_active &&
          fa.year &&
          fa.section &&
          normalizeYear(fa.year) === normalizeYear(student.year) &&
          normalizeSection(fa.section) === normalizeSection(student.section)
      );

      if (activeAssignment) {
        const facUser = await db.getUserById(activeAssignment.faculty_id);
        if (facUser && facUser.name) {
          assignedFacultyId = facUser.id;
          assignedStaffName = facUser.name;
          return { assignedFacultyId, assignedStaffName, assignedYear, assignedSection };
        }
      }
    }

    // 3. Check class_coordinator_name column
    const cc = String(student.classCoordinatorName || student.class_coordinator_name || '').trim();
    if (cc && cc.toLowerCase() !== 'assigned faculty' && cc.toLowerCase() !== 'assigned faculty member') {
      assignedStaffName = cc;
      const facUsers = await db.getUsers('FACULTY');
      const matchedUser = facUsers.find((u) => u.name.trim().toLowerCase() === cc.toLowerCase());
      if (matchedUser) {
        assignedFacultyId = matchedUser.id;
      }
    }
  } catch (_err) {}

  return { assignedFacultyId, assignedStaffName, assignedYear, assignedSection };
}

/**
 * GET /api/discipline/lookup-student/:regNo
 * Discipline module student lookup - Returns student name, college email, year, section, and assigned staff name
 */
router.get('/lookup-student/:regNo', async (req: Request, res: Response) => {
  const regNo = String(req.params.regNo || '');
  if (!regNo || !regNo.trim()) {
    return res.status(400).json({ error: 'Register Number is required.' });
  }

  try {
    const student = await db.getStudentByRegisterNo(regNo.trim());
    if (!student) {
      return res.status(200).json({
        found: false,
        error: `Register Number "${regNo.trim()}" does not match any valid student record in database.`
      });
    }

    const { assignedFacultyId, assignedStaffName } = await resolveFacultyAssignmentForStudent(student);

    return res.json({
      found: true,
      student: {
        id: student.id,
        registerNo: student.registerNo || (student as any).register_no,
        name: student.name,
        email: student.email || student.collegeEmail || (student as any).college_email,
        year: student.year,
        section: student.section,
        department: student.department || 'AI & DS',
        assignedFacultyId,
        assignedStaffName
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
router.get('/students/search', async (req: Request, res: Response) => {
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

    const enrichedMatches = await Promise.all(
      matches.map(async (s) => {
        const { assignedFacultyId, assignedStaffName } = await resolveFacultyAssignmentForStudent(s);
        return {
          id: s.id,
          registerNo: s.registerNo || (s as any).register_no,
          name: s.name,
          email: s.email || s.collegeEmail || (s as any).college_email,
          year: s.year,
          section: s.section,
          assignedFacultyId,
          assignedStaffName
        };
      })
    );

    return res.json({ students: enrichedMatches });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to search students.' });
  }
});

/**
 * POST /api/discipline/records
 * Create a new discipline issue record & auto-sync to assigned Faculty Portal
 */
router.post('/records', async (req: Request, res: Response) => {
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
    const student = await db.getStudentByRegisterNo(registerNo.trim());
    if (!student) {
      return res.status(400).json({
        error: `Save rejected: Register Number "${registerNo}" does not match any valid student record in the database.`
      });
    }

    const { assignedFacultyId, assignedStaffName } = await resolveFacultyAssignmentForStudent(student);
    const currentDate = date && date.trim() ? date.trim() : new Date().toISOString().split('T')[0];
    const currentTime = time && time.trim() ? time.trim() : new Date().toLocaleTimeString('en-US', { hour12: false });
    
    const authReq = req as AuthRequest;
    const recordedBy = authReq.user?.name
      ? `${authReq.user.name} (${authReq.user.email})`
      : (assignedStaffName !== 'No Staff Assigned' ? assignedStaffName : 'Faculty Staff');

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
      recordedBy,
      assignedFacultyId,
      assignedStaffName
    });

    if (authReq.user?.id) {
      await db.logAudit(
        authReq.user.id,
        authReq.user.email,
        authReq.user.role,
        'CREATE_DISCIPLINE_RECORD',
        `STUDENT:${student.registerNo}`
      );
    }

    return res.status(201).json({
      message: 'Discipline issue recorded successfully and automatically synced to assigned Faculty Portal & Student Portal.',
      record: {
        ...createdRecord,
        registerNo: student.registerNo,
        studentName: student.name,
        collegeEmail: student.email,
        year: student.year,
        section: student.section,
        assignedFacultyId,
        assignedStaffName
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to save discipline issue record.' });
  }
});

/**
 * GET /api/discipline/records
 * Full view & search of all discipline records (Enforces Faculty roster isolation)
 */
router.get('/records', async (req: Request, res: Response) => {
  const { registerNo, year, section, issue, search } = req.query;
  const authReq = req as AuthRequest;
  const facultyId = authReq.user?.id;
  const role = authReq.user?.role;

  try {
    const records = await db.getAllDisciplineIssues({
      registerNo: registerNo as string,
      year: year as string,
      section: section as string,
      issue: issue as string,
      search: search as string,
      facultyId,
      role
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
router.delete('/records/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id || '');
  if (!id) {
    return res.status(400).json({ error: 'Record ID is required.' });
  }

  try {
    const success = await db.deleteDisciplineIssue(id);
    if (!success) {
      return res.status(404).json({ error: 'Discipline record not found or already deleted.' });
    }

    const authReq = req as AuthRequest;
    if (authReq.user?.id) {
      await db.logAudit(
        authReq.user.id,
        authReq.user.email,
        authReq.user.role,
        'DELETE_DISCIPLINE_RECORD',
        `RECORD:${id}`
      );
    }

    return res.json({ message: 'Discipline record deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete discipline record.' });
  }
});

export default router;
