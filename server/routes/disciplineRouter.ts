import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { SQLiteDB, StudentRecord } from '../db.js';
import type { AuthRequest } from '../middleware/auth.js';

type DisciplineDatabase = Pick<SQLiteDB, 'getUserById' | 'getFacultyAssignment' | 'getAllFacultyAssignments' |
  'getAllStudents' | 'getStudentByRegisterNo' | 'getAllDisciplineIssues' | 'addDisciplineIssue' |
  'deleteDisciplineIssue' | 'logAudit'>;

interface Dependencies {
  db: DisciplineDatabase;
  authenticateToken: RequestHandler;
  requireRole: (...roles: string[]) => RequestHandler;
  normalizeYear: (value?: string | null) => string;
  normalizeSection: (value?: string | null) => string;
  primaryDatabaseOnly: RequestHandler;
}

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

/** No database/bootstrap imports at runtime: tests supply an isolated repository. */
export function createDisciplineRouter({ db, authenticateToken, requireRole, normalizeYear, normalizeSection, primaryDatabaseOnly }: Dependencies) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(primaryDatabaseOnly, authenticateToken, requireRole('FACULTY', 'HOD', 'ADMIN'));
  router.use(async (req: AuthRequest, res, next) => {
    if (!text(req.user?.id)) return res.status(401).json({ error: 'A valid staff session is required.' });
    try {
      const user = await db.getUserById(req.user!.id);
      if (!user || Number(user.is_active) !== 1 || text(user.role).toUpperCase() !== req.user!.role) {
        return res.status(403).json({ error: 'This staff session is no longer authorized.' });
      }
      // Use current authoritative identity for audit attribution, not stale token display fields.
      req.user!.name = user.name;
      req.user!.email = user.email;
      next();
    } catch (error) {
      console.error('[Discipline] Staff authorization failed', error);
      return res.status(503).json({ error: 'Staff access could not be verified. Please try again.' });
    }
  });

  async function canAccessStudent(req: AuthRequest, student: StudentRecord) {
    if (req.user?.role === 'HOD' || req.user?.role === 'ADMIN') return true;
    const facultyId = req.user?.id;
    if (!facultyId || req.user?.role !== 'FACULTY') return false;
    if (student.created_by_faculty_id === facultyId || student.faculty_workspace_id === facultyId) return true;
    const assignment = await db.getFacultyAssignment(facultyId, { fresh: true });
    if (!assignment || Number(assignment.is_active) !== 1) return false;
    const year = normalizeYear(assignment.year);
    const section = normalizeSection(assignment.section);
    // Missing or wildcard assignments must not turn into unrestricted access.
    return Boolean(year && section && year !== 'ALL' && section !== 'ALL' &&
      year === normalizeYear(student.year) && section === normalizeSection(student.section));
  }

  async function resolveFacultyAssignmentForStudent(student: StudentRecord) {
    const assignedYear = student.year || '';
    const assignedSection = student.section || '';
    const creatorId = student.created_by_faculty_id || student.faculty_workspace_id;
    if (creatorId) {
      const creator = await db.getUserById(creatorId);
      if (creator?.role === 'FACULTY' && creator.is_active) {
        return { assignedFacultyId: creator.id, assignedStaffName: creator.name, assignedYear, assignedSection };
      }
    }
    const assignments = await db.getAllFacultyAssignments();
    const assignment = Object.values(assignments).find(a => a.is_active && a.year && a.section &&
      assignedYear && assignedSection && normalizeYear(a.year) === normalizeYear(assignedYear) &&
      normalizeSection(a.section) === normalizeSection(assignedSection));
    const faculty = assignment ? await db.getUserById(assignment.faculty_id) : undefined;
    // A coordinator name can be displayed but cannot establish an identity or permission.
    return { assignedFacultyId: faculty?.role === 'FACULTY' && faculty.is_active ? faculty.id : null,
      assignedStaffName: faculty?.role === 'FACULTY' && faculty.is_active ? faculty.name :
        text(student.classCoordinatorName || student.class_coordinator_name) || 'No Staff Assigned',
      assignedYear, assignedSection };
  }

  const studentDetails = async (student: StudentRecord) => ({
    id: student.id, registerNo: student.registerNo || student.register_no,
    name: student.name, email: student.email || student.collegeEmail || student.college_email,
    year: student.year, section: student.section, department: student.department,
    ...await resolveFacultyAssignmentForStudent(student)
  });

  router.get('/lookup-student/:regNo', async (req: AuthRequest, res) => {
    const registerNo = text(req.params.regNo);
    if (!registerNo || registerNo.length > 100) return res.status(400).json({ error: 'A valid Register Number is required.' });
    try {
      const student = await db.getStudentByRegisterNo(registerNo);
      if (!student || !await canAccessStudent(req, student)) {
        return res.json({ found: false, error: 'No matching student in your authorized workspace.' });
      }
      return res.json({ found: true, student: await studentDetails(student) });
    } catch (error) {
      console.error('[Discipline] Student lookup failed', error);
      return res.status(503).json({ error: 'Student lookup is unavailable. Please try again.' });
    }
  });

  router.get('/students/search', async (req: AuthRequest, res) => {
    const query = text(req.query.q).toLowerCase();
    if (!query) return res.json({ students: [] });
    if (query.length > 100) return res.status(400).json({ error: 'Search must be at most 100 characters.' });
    try {
      const candidates = (await db.getAllStudents()).filter(s =>
        (s.registerNo || s.register_no || '').toLowerCase().includes(query) || s.name.toLowerCase().includes(query));
      const students = [];
      for (const student of candidates) {
        if (await canAccessStudent(req, student)) students.push(await studentDetails(student));
        if (students.length === 10) break;
      }
      return res.json({ students });
    } catch (error) {
      console.error('[Discipline] Student search failed', error);
      return res.status(503).json({ error: 'Student search is unavailable. Please try again.' });
    }
  });

  router.get('/records', async (req: AuthRequest, res) => {
    const fields = ['registerNo', 'year', 'section', 'issue', 'search'];
    if (fields.some(key => req.query[key] !== undefined &&
      (typeof req.query[key] !== 'string' || String(req.query[key]).length > 500))) {
      return res.status(400).json({ error: 'Record filters must be text of at most 500 characters.' });
    }
    try {
      const records = await db.getAllDisciplineIssues({
        registerNo: text(req.query.registerNo), year: text(req.query.year),
        section: text(req.query.section), issue: text(req.query.issue), search: text(req.query.search),
        facultyId: req.user!.id, role: req.user!.role
      });
      return res.json({ records });
    } catch (error) {
      console.error('[Discipline] Record query failed', error);
      return res.status(503).json({ error: 'Discipline records are unavailable. Please try again.' });
    }
  });

  router.post('/records', async (req: AuthRequest, res) => {
    const body = req.body || {};
    if (!text(body.registerNo) || !text(body.issue)) {
      return res.status(400).json({ error: 'Register Number and Discipline Issue category are required.' });
    }
    const stringFields = ['registerNo', 'issue', 'ruleViolated', 'actionTaken', 'fineDetails', 'remarks', 'date', 'time'];
    if (stringFields.some(key => body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > 5000))) {
      return res.status(400).json({ error: 'Text fields must contain valid text of at most 5000 characters.' });
    }
    const fine = body.fineAmount === undefined ? 0 : Number(body.fineAmount);
    if (!Number.isFinite(fine) || fine < 0 ||
        (body.fineAmount !== undefined && typeof body.fineAmount !== 'number' && typeof body.fineAmount !== 'string')) {
      return res.status(400).json({ error: 'Fine amount must be a finite, non-negative number.' });
    }
    const date = text(body.date) || new Date().toISOString().slice(0, 10);
    const time = text(body.time) || new Date().toISOString().slice(11, 19);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) {
      return res.status(400).json({ error: 'Provide a valid incident date and time.' });
    }
    try {
      const student = await db.getStudentByRegisterNo(text(body.registerNo));
      if (!student) return res.status(400).json({ error: 'Register Number does not match an existing student.' });
      if (!await canAccessStudent(req, student)) {
        return res.status(403).json({ error: 'Student is outside your authorized workspace.' });
      }
      const assignment = await resolveFacultyAssignmentForStudent(student);
      const createdRecord = await db.addDisciplineIssue({
        studentId: student.id, date, time, category: text(body.issue),
        ruleViolated: text(body.ruleViolated), actionTaken: text(body.actionTaken),
        fineAmount: fine, fineDetails: text(body.fineDetails), remark: text(body.remarks),
        recordedBy: `${req.user!.name} (${req.user!.email})`, ...assignment
      });
      // An audit outage must not make a committed insert appear to have failed.
      try {
        await db.logAudit(req.user!.id, req.user!.email, req.user!.role,
          'CREATE_DISCIPLINE_RECORD', `STUDENT:${student.registerNo || student.register_no}`);
      } catch (error) { console.error('[Discipline] Audit write failed after persistence', error); }
      return res.status(201).json({
        message: 'Discipline issue recorded successfully.',
        record: { ...createdRecord, registerNo: student.registerNo || student.register_no, studentName: student.name,
          collegeEmail: student.email, year: student.year, section: student.section, ...assignment }
      });
    } catch (error) {
      console.error('[Discipline] Record save failed', error);
      return res.status(503).json({ error: 'The discipline record could not be saved. Refresh records before retrying.' });
    }
  });

  router.delete('/records/:id', async (req: AuthRequest, res) => {
    try {
      const id = text(req.params.id);
      const visibleRecords = await db.getAllDisciplineIssues({ facultyId: req.user!.id, role: req.user!.role });
      if (!visibleRecords.some(record => record.id === id)) {
        return res.status(404).json({ error: 'Discipline record not found in your authorized workspace.' });
      }
      if (!await db.deleteDisciplineIssue(id, { facultyId: req.user!.id, role: req.user!.role })) return res.status(404).json({ error: 'Discipline record not found.' });
      try {
        await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'DELETE_DISCIPLINE_RECORD', `RECORD:${id}`);
      } catch (error) { console.error('[Discipline] Audit write failed after deletion', error); }
      return res.json({ message: 'Discipline record deleted successfully.' });
    } catch (error) {
      console.error('[Discipline] Record deletion failed', error);
      return res.status(503).json({ error: 'The discipline record could not be deleted. Please try again.' });
    }
  });

  return { router, resolveFacultyAssignmentForStudent };
}
