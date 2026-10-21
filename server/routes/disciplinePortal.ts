import { Router } from 'express';
import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { db, normalizeSection, normalizeYear } from '../db.js';
import { withPrimaryDatabase } from '../databasePolicy.js';
import { createDisciplineRouter } from './disciplineRouter.js';
import type { AuthRequest } from '../middleware/auth.js';
import {
  authenticateDisciplinePortal,
  clearDisciplinePortalSession,
  publicDisciplinePortalUser,
  requireDisciplinePortalRole,
  setDisciplinePortalSession,
  type DisciplinePortalRequest
} from '../middleware/disciplinePortalAuth.js';
import {
  assignDisciplineStudents,
  createDisciplinePortalUser,
  getDisciplineAssignedStudentIds,
  getDisciplineFacultyForStudent,
  getDisciplinePortalUserByEmail,
  getDisciplinePortalUserById,
  importDisciplineStudents,
  listDisciplineAssignments,
  listDisciplineFaculty,
  listDisciplineFacultyStudents,
  previewDisciplineStudentImport,
  setDisciplineFacultyActive,
  type DisciplineStudentImportRow
} from '../disciplinePortalStore.js';

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const allowedRoles = ['ADMIN', 'FACULTY'] as const;

function normalizeImportRows(value: unknown): DisciplineStudentImportRow[] | null {
  if (!Array.isArray(value) || value.length > 5000) return null;
  return value.map((entry) => {
    const row = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    const field = (keys: string[]) => {
      const match = Object.keys(row).find(key => keys.includes(key.trim().toLowerCase()));
      const raw = match ? row[match] : '';
      return typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';
    };
    return {
      name: field(['name']),
      registerNo: field(['register number', 'register no', 'register_no', 'reg no']),
      email: field(['college mail id', 'college email', 'email']),
      year: field(['year', 'academic year']),
      section: field(['section']),
      department: field(['department'])
    };
  });
}

export const disciplinePortalAuthRouter = Router();
disciplinePortalAuthRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
disciplinePortalAuthRouter.post('/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}), async (req, res) => {
  const email = text(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const role = text(req.body?.role).toUpperCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || !allowedRoles.includes(role as typeof allowedRoles[number])) {
    return res.status(400).json({ error: 'A registered email, password, and valid Discipline Portal role are required.' });
  }
  try {
    const user = await getDisciplinePortalUserByEmail(email);
    if (!user || Number(user.is_active) !== 1 || user.role !== role || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid Discipline Portal credentials.' });
    }
    setDisciplinePortalSession(res, req, user);
    return res.json({ message: 'Sign in successful.', user: publicDisciplinePortalUser(user) });
  } catch (error) {
    console.error('[Discipline Portal] Login failed', error);
    return res.status(503).json({ error: 'Discipline Portal sign in is temporarily unavailable.' });
  }
});

disciplinePortalAuthRouter.get('/me', authenticateDisciplinePortal, (req: DisciplinePortalRequest, res) => {
  const user = req.disciplineUser;
  if (!user) return res.status(401).json({ error: 'Sign in to continue.' });
  return res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

disciplinePortalAuthRouter.post('/logout', authenticateDisciplinePortal, (req, res) => {
  clearDisciplinePortalSession(res, req);
  return res.json({ message: 'Sign out successful.' });
});

const withPrimary: RequestHandler = (_req, _res, next) => withPrimaryDatabase(next);
const bridgeIdentity: RequestHandler = (req: DisciplinePortalRequest, res, next) => {
  if (!req.disciplineUser) return res.status(401).json({ error: 'Sign in to continue.' });
  (req as AuthRequest).user = {
    id: req.disciplineUser.id,
    email: req.disciplineUser.email,
    name: req.disciplineUser.name,
    role: req.disciplineUser.role
  };
  next();
};
const standardRoleGuard = (...roles: string[]): RequestHandler => (req, res, next) => {
  if (!(req as AuthRequest).user || !roles.includes((req as AuthRequest).user!.role)) {
    return res.status(403).json({ error: 'This role cannot access that Discipline Portal operation.' });
  }
  next();
};

const portalDb = {
  getUserById: async (id: string) => {
    const user = await getDisciplinePortalUserById(id);
    return user ? { ...user, identifier: user.email, created_at: '' } : undefined;
  },
  getFacultyAssignment: async () => undefined,
  getAllFacultyAssignments: listDisciplineAssignments,
  getAllStudents: db.getAllStudents.bind(db),
  getStudentByRegisterNo: db.getStudentByRegisterNo.bind(db),
  getAllDisciplineIssues: async (filters?: Parameters<typeof db.getAllDisciplineIssues>[0]) => {
    const records = await db.getAllDisciplineIssues(
      filters?.role === 'FACULTY' ? { ...filters, role: 'ADMIN' } : filters
    );
    if (filters?.role !== 'FACULTY' || !filters.facultyId) return records;
    const assignedIds = await getDisciplineAssignedStudentIds(filters.facultyId);
    return records.filter(record => assignedIds.has(record.studentId));
  },
  addDisciplineIssue: db.addDisciplineIssue.bind(db),
  updateDisciplineIssue: (id: string, data: Parameters<typeof db.updateDisciplineIssue>[1], scope?: { facultyId: string; role: string }) =>
    db.updateDisciplineIssue(id, data, scope ? { ...scope, role: 'ADMIN' } : scope),
  deleteDisciplineIssue: (id: string, scope?: { facultyId: string; role: string }) =>
    db.deleteDisciplineIssue(id, scope ? { ...scope, role: 'ADMIN' } : scope),
  logAudit: db.logAudit.bind(db),
  isDisciplineStudentAssigned: async (facultyId: string, studentId: string) =>
    (await getDisciplineAssignedStudentIds(facultyId)).has(studentId),
  getDisciplineFacultyForStudent
};

export const disciplinePortalRouter = Router();
disciplinePortalRouter.use(withPrimary, authenticateDisciplinePortal, bridgeIdentity);
disciplinePortalRouter.get('/faculty', requireDisciplinePortalRole('ADMIN'), async (_req, res) => {
  try { return res.json({ faculty: await listDisciplineFaculty() }); }
  catch (error) {
    console.error('[Discipline Portal] Faculty list failed', error);
    return res.status(503).json({ error: 'Faculty accounts are unavailable.' });
  }
});
disciplinePortalRouter.post('/faculty', requireDisciplinePortalRole('ADMIN'), async (req: DisciplinePortalRequest, res) => {
  const name = text(req.body?.name);
  const email = text(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 12 || password.length > 256) {
    return res.status(400).json({ error: 'Provide a faculty name, valid email, and password of at least 12 characters.' });
  }
  try {
    if (await getDisciplinePortalUserByEmail(email)) return res.status(409).json({ error: 'That Discipline Portal email is already registered.' });
    await createDisciplinePortalUser({ name, email, password, role: 'FACULTY' });
    return res.status(201).json({ message: 'Faculty account created. The password is not returned by the server.' });
  } catch (error) {
    console.error('[Discipline Portal] Faculty account creation failed', error);
    return res.status(503).json({ error: 'Faculty account could not be created.' });
  }
});
disciplinePortalRouter.put('/faculty/:id/status', requireDisciplinePortalRole('ADMIN'), async (req, res) => {
  const id = text(req.params.id);
  if (!id) return res.status(400).json({ error: 'A faculty account ID is required.' });
  try {
    const updated = await setDisciplineFacultyActive(id, req.body?.isActive === true);
    return updated ? res.json({ message: 'Faculty status updated.' }) : res.status(404).json({ error: 'Faculty account not found.' });
  } catch (error) {
    console.error('[Discipline Portal] Faculty status update failed', error);
    return res.status(503).json({ error: 'Faculty status could not be updated.' });
  }
});
disciplinePortalRouter.get('/faculty/:id/students', requireDisciplinePortalRole('ADMIN'), async (req, res) => {
  try { return res.json({ students: await listDisciplineFacultyStudents(text(req.params.id)) }); }
  catch (error) {
    console.error('[Discipline Portal] Faculty assignments unavailable', error);
    return res.status(503).json({ error: 'Faculty student assignments are unavailable.' });
  }
});
disciplinePortalRouter.post('/assignments', requireDisciplinePortalRole('ADMIN'), async (req: DisciplinePortalRequest, res) => {
  const facultyId = text(req.body?.facultyId);
  const registerNumbers = req.body?.registerNumbers;
  if (!facultyId || !Array.isArray(registerNumbers) || registerNumbers.length > 5000 ||
      registerNumbers.some(value => typeof value !== 'string' || value.trim().length > 100)) {
    return res.status(400).json({ error: 'Select a faculty member and provide valid Register Numbers.' });
  }
  try {
    const faculty = await getDisciplinePortalUserById(facultyId);
    if (!faculty || faculty.role !== 'FACULTY' || Number(faculty.is_active) !== 1) {
      return res.status(400).json({ error: 'Select an active Discipline Portal faculty account.' });
    }
    const result = await assignDisciplineStudents(facultyId, registerNumbers, req.disciplineUser!.id);
    return res.json({ message: 'Student assignments updated.', ...result });
  } catch (error) {
    console.error('[Discipline Portal] Student assignment failed', error);
    return res.status(503).json({ error: 'Student assignment could not be completed.' });
  }
});
disciplinePortalRouter.post('/students/import-preview', requireDisciplinePortalRole('ADMIN'), async (req, res) => {
  const rows = normalizeImportRows(req.body?.rows);
  const facultyId = text(req.body?.facultyId);
  if (!rows || !facultyId) return res.status(400).json({ error: 'Select a faculty member and provide a valid workbook preview.' });
  try {
    const faculty = await getDisciplinePortalUserById(facultyId);
    if (!faculty || faculty.role !== 'FACULTY' || Number(faculty.is_active) !== 1) {
      return res.status(400).json({ error: 'Select an active Discipline Portal faculty member.' });
    }
    return res.json({ preview: await previewDisciplineStudentImport(rows) });
  } catch (error) {
    console.error('[Discipline Portal] Student import preview failed', error);
    return res.status(503).json({ error: 'Student import preview is unavailable.' });
  }
});
disciplinePortalRouter.post('/students/import-confirm', requireDisciplinePortalRole('ADMIN'), async (req: DisciplinePortalRequest, res) => {
  const rows = normalizeImportRows(req.body?.rows);
  const facultyId = text(req.body?.facultyId);
  if (!rows || !facultyId) return res.status(400).json({ error: 'Select a faculty member and provide valid import rows.' });
  try {
    const faculty = await getDisciplinePortalUserById(facultyId);
    if (!faculty || faculty.role !== 'FACULTY' || Number(faculty.is_active) !== 1) {
      return res.status(400).json({ error: 'Select an active Discipline Portal faculty member.' });
    }
    const result = await importDisciplineStudents(facultyId, rows, req.disciplineUser!.id);
    return res.json({ message: 'Student import processed.', ...result });
  } catch (error) {
    console.error('[Discipline Portal] Student import failed', error);
    return res.status(503).json({ error: 'Student import could not be completed.' });
  }
});

const incidents = createDisciplineRouter({
  db: portalDb,
  authenticateToken: bridgeIdentity,
  requireRole: standardRoleGuard,
  normalizeYear,
  normalizeSection,
  primaryDatabaseOnly: withPrimary
});
disciplinePortalRouter.use(incidents.router);
