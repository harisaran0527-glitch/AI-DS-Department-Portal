import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';
import { generateSecureRandomPassword } from '../services/security.js';

const router = Router();

router.use(authenticateToken, requireRole('ADMIN'));

function sanitizeUser(u: any) {
  if (!u) return null;
  const { password_hash: _password_hash, passwordHash: _passwordHash, ...safe } = u;
  return safe;
}

// POST Admin Self Password Change
router.post('/change-password', async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const adminUser = await db.getUserById(req.user!.id);
  if (!adminUser) {
    return res.status(404).json({ error: 'Admin account not found.' });
  }

  const isMatch = await bcrypt.compare(currentPassword, adminUser.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Incorrect current password.' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.updateUserPassword(req.user!.id, newHash);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'ADMIN_CHANGE_PASSWORD', `ADMIN:${req.user!.email}`);

  return res.json({ message: 'Admin password changed successfully.' });
});

// GET Faculty List with faculty_assignments mapping
router.get('/faculty', async (req: AuthRequest, res: Response) => {
  const facultyUsers = await db.getUsers('FACULTY');
  const enriched = [];
  for (const f of facultyUsers) {
    const assignment = await db.getFacultyAssignment(f.id);
    enriched.push(sanitizeUser({
      id: f.id,
      email: f.email,
      identifier: f.identifier,
      name: f.name,
      role: f.role,
      year: assignment ? assignment.year : f.year,
      section: assignment ? assignment.section : f.section,
      facultyRole: assignment ? assignment.role : f.faculty_role,
      department: assignment ? assignment.department : 'AI & DS',
      isActive: Boolean(f.is_active),
      createdAt: f.created_at
    }));
  }
  return res.json({ faculty: enriched });
});

// POST Create Faculty Account with separate Portal Password & faculty_assignments
router.post('/faculty', async (req: AuthRequest, res: Response) => {
  const { facultyId, facultyName, email, year, section, role, password, department: _department } = req.body;

  if (!facultyId || !facultyName || !email || !year || !section || !password) {
    return res.status(400).json({ error: 'All fields are required (facultyId, facultyName, email, year, section, password).' });
  }

  const existing = (await db.findUserByIdentifier(email, 'FACULTY')) || (await db.findUserByIdentifier(facultyId, 'FACULTY'));
  if (existing) {
    return res.status(409).json({ error: 'Faculty account with this Email or Faculty ID already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newId = `fac-${Date.now()}`;

  await db.createUser({
    id: newId,
    email,
    identifier: facultyId,
    name: facultyName,
    role: 'FACULTY',
    passwordHash,
    year,
    section,
    facultyRole: role || 'Class Coordinator',
    isActive: true
  });

  await db.updateUserAssignment(newId, year, section, role || 'Class Coordinator');
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'CREATE_FACULTY', `FACULTY:${email}`);

  const createdUser = await db.getUserById(newId);
  const assignment = await db.getFacultyAssignment(newId);

  return res.status(201).json({
    message: 'Faculty account created successfully.',
    faculty: sanitizeUser({
      ...createdUser,
      assignment
    })
  });
});

// GET Students assigned to a specific Faculty Workspace
router.get('/faculty/:id/students', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const targetUser = await db.getUserById(id);
  if (!targetUser || targetUser.role !== 'FACULTY') {
    return res.status(404).json({ error: 'Faculty account not found.' });
  }

  const assignedStudents = await db.getStudentsForFaculty(id);
  return res.json({ facultyId: id, facultyName: targetUser.name, count: assignedStudents.length, students: assignedStudents });
});

// POST Assign specific Students to a Staff Member Workspace
router.post('/assign-students', async (req: AuthRequest, res: Response) => {
  const { facultyId, studentIds } = req.body;

  if (!facultyId || !Array.isArray(studentIds)) {
    return res.status(400).json({ error: 'facultyId and studentIds array are required.' });
  }

  const targetFaculty = await db.getUserById(facultyId);
  if (!targetFaculty || targetFaculty.role !== 'FACULTY') {
    return res.status(404).json({ error: 'Faculty staff account not found.' });
  }

  await db.assignStudentsToFaculty(facultyId, studentIds);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'ASSIGN_STUDENTS_TO_STAFF', `FACULTY:${facultyId} COUNT:${studentIds.length}`);

  return res.json({
    message: `Successfully assigned ${studentIds.length} student(s) to staff member ${targetFaculty.name}.`,
    facultyId,
    assignedCount: studentIds.length
  });
});

// PUT Edit Faculty Details & Assignment
router.put('/faculty/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { year, section, role, isActive } = req.body;

  const targetUser = await db.getUserById(id);
  if (!targetUser || targetUser.role !== 'FACULTY') {
    return res.status(404).json({ error: 'Faculty account not found.' });
  }

  if (year && section && role) {
    await db.updateUserAssignment(id, year, section, role);
  }

  if (isActive !== undefined) {
    await db.updateUserStatus(id, Boolean(isActive));
  }

  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPDATE_FACULTY', `FACULTY:${targetUser.email}`);
  return res.json({ message: 'Faculty details and assignment updated successfully.' });
});

// DELETE Faculty Account & Assignment by Admin
router.delete('/faculty/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const targetUser = await db.getUserById(id);
  if (!targetUser || targetUser.role !== 'FACULTY') {
    return res.status(404).json({ error: 'Faculty account not found.' });
  }

  await db.deleteFacultyUser(id);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'DELETE_FACULTY_ACCOUNT', `FACULTY:${targetUser.email}`);
  return res.json({ message: 'Faculty account deleted successfully.' });
});

// DELETE Student Account & All Records by Admin
router.delete('/students/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const targetStudent = await db.getStudentById(id);
  if (!targetStudent) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  await db.deleteStudentUser(id);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'DELETE_STUDENT_ACCOUNT', `STUDENT:${targetStudent.register_no}`);
  return res.json({ message: 'Student account and all associated records deleted successfully.' });
});

// POST Reset Faculty Portal Password
router.post('/faculty/:id/reset-password', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const targetUser = await db.getUserById(id);
  if (!targetUser || targetUser.role !== 'FACULTY') {
    return res.status(404).json({ error: 'Faculty account not found.' });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await db.updateUserPassword(id, hash);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'RESET_FACULTY_PASSWORD', `FACULTY:${targetUser.email}`);

  return res.json({ message: 'Faculty portal password reset successfully.' });
});

// PUT Toggle Faculty Active Status
router.put('/faculty/:id/status', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { isActive } = req.body;

  const targetUser = await db.getUserById(id);
  if (!targetUser || targetUser.role !== 'FACULTY') {
    return res.status(404).json({ error: 'Faculty account not found.' });
  }

  await db.updateUserStatus(id, Boolean(isActive));
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, isActive ? 'ENABLE_ACCOUNT' : 'DISABLE_ACCOUNT', `FACULTY:${targetUser.email}`);

  return res.json({ message: `Faculty account ${isActive ? 'enabled' : 'disabled'} successfully.` });
});

// POST Bulk Import Students via CSV data
router.post('/students/import', async (req: AuthRequest, res: Response) => {
  const { students: rawStudents, defaultPassword } = req.body;

  if (!Array.isArray(rawStudents) || rawStudents.length === 0) {
    return res.status(400).json({ error: 'No student records provided for import.' });
  }

  let importedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];
  const generatedCredentials: any[] = [];

  for (let i = 0; i < rawStudents.length; i++) {
    const s = rawStudents[i];
    const rowNum = i + 1;

    if (!s.registerNo || !s.name) {
      errors.push(`Row ${rowNum}: Missing required fields (registerNo or name).`);
      skippedCount++;
      continue;
    }

    const regNo = String(s.registerNo).trim();
    const existing = await db.getStudentByRegisterNo(regNo);
    if (existing) {
      errors.push(`Row ${rowNum}: Register number ${regNo} already exists in database.`);
      skippedCount++;
      continue;
    }

    const studentId = `stu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const stuEmail = s.email ? String(s.email).trim() : `${regNo.toLowerCase()}@aids.edu`;
    let isTemp = false;
    let studentPass = s.password || s.portalPassword || s.collegePortalPassword;
    if (!studentPass || typeof studentPass !== 'string' || studentPass.trim().length < 6) {
      if (defaultPassword && typeof defaultPassword === 'string' && defaultPassword.trim().length >= 6) {
        studentPass = defaultPassword.trim();
      } else {
        studentPass = generateSecureRandomPassword(12);
        isTemp = true;
      }
    }
    const studentPasswordHash = await bcrypt.hash(studentPass, 10);

    try {
      await db.createStudent({
        id: studentId,
        registerNo: regNo,
        name: String(s.name).trim(),
        email: stuEmail,
        year: s.year ? String(s.year).trim() : '2nd Year',
        section: s.section ? String(s.section).trim() : 'A',
        batch: s.batch ? String(s.batch).trim() : '2023-2027',
        classCoordinatorName: s.classCoordinatorName || 'Assigned Faculty',
        cgpa: parseFloat(s.cgpa) || 0,
        overallScore: (parseFloat(s.cgpa) || 0) * 8.5
      });

      await db.createUser({
        id: studentId,
        email: stuEmail,
        identifier: regNo,
        name: String(s.name).trim(),
        role: 'STUDENT',
        passwordHash: studentPasswordHash,
        year: s.year ? String(s.year).trim() : '2nd Year',
        section: s.section ? String(s.section).trim() : 'A',
        isActive: true
      });

      importedCount++;
      if (isTemp) {
        generatedCredentials.push({ registerNo: regNo, tempPassword: studentPass });
      }
    } catch (err: any) {
      errors.push(`Row ${rowNum}: Failed to import ${regNo} - ${err.message}`);
      skippedCount++;
    }
  }

  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'BULK_IMPORT_STUDENTS', `IMPORTED:${importedCount},SKIPPED:${skippedCount}`);

  return res.status(201).json({
    message: `Bulk import completed: ${importedCount} imported, ${skippedCount} skipped.`,
    importedCount,
    skippedCount,
    generatedCredentials: generatedCredentials.length > 0 ? generatedCredentials : undefined,
    errors
  });
});

// GET HOD Users List
router.get('/hod', async (req: AuthRequest, res: Response) => {
  const hodUsers = await db.getUsers('HOD');
  const sanitized = hodUsers.map((h) =>
    sanitizeUser({
      id: h.id,
      email: h.email,
      identifier: h.identifier,
      name: h.name,
      role: 'HOD',
      department: 'AI & DS',
      isActive: Boolean(h.is_active),
      createdAt: h.created_at
    })
  );
  return res.json({ hodList: sanitized });
});

// POST Create HOD Account with Single Active HOD Guard for AI & DS
router.post('/hod', async (req: AuthRequest, res: Response) => {
  const { hodId, hodName, email, password, isActive } = req.body;

  if (!hodId || !hodName || !email || !password) {
    return res.status(400).json({ error: 'HOD ID, Name, Email, and Portal Password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanId = hodId.trim();

  // Rule: Only ONE active HOD account for AI & DS
  if (isActive !== false) {
    const hodUsers = await db.getUsers('HOD');
    const existingActive = hodUsers.find((u) => Boolean(u.is_active));
    if (existingActive) {
      return res.status(400).json({ error: 'An active HOD account already exists for AI & DS.' });
    }
  }

  const existing = (await db.findUserByIdentifier(cleanEmail, 'HOD')) || (await db.findUserByIdentifier(cleanId, 'HOD'));
  if (existing) {
    return res.status(409).json({ error: 'An HOD account with this Email or HOD ID already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newId = `hod-${Date.now()}`;

  await db.createUser({
    id: newId,
    email: cleanEmail,
    identifier: cleanId,
    name: hodName.trim(),
    role: 'HOD',
    passwordHash,
    isActive: isActive !== false
  });

  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'CREATE_HOD', `HOD:${cleanEmail}`);

  const createdHOD = await db.getUserById(newId);
  return res.status(201).json({
    message: 'HOD account created successfully.',
    hod: sanitizeUser({
      id: createdHOD!.id,
      email: createdHOD!.email,
      identifier: createdHOD!.identifier,
      name: createdHOD!.name,
      role: 'HOD',
      department: 'AI & DS',
      isActive: Boolean(createdHOD!.is_active),
      createdAt: createdHOD!.created_at
    })
  });
});

// PUT Update HOD Account
router.put('/hod/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { hodName, email, isActive } = req.body;

  const targetHOD = await db.getUserById(id);
  if (!targetHOD || targetHOD.role !== 'HOD') {
    return res.status(404).json({ error: 'HOD account not found.' });
  }

  if (isActive === true) {
    const hodUsers = await db.getUsers('HOD');
    const existingActive = hodUsers.find((u) => Boolean(u.is_active) && u.id !== id);
    if (existingActive) {
      return res.status(400).json({ error: 'An active HOD account already exists for AI & DS.' });
    }
  }

  const nameToUse = hodName ? hodName.trim() : targetHOD.name;
  const emailToUse = email ? email.trim().toLowerCase() : targetHOD.email;
  const activeStatus = typeof isActive === 'boolean' ? isActive : Boolean(targetHOD.is_active);

  await db.updateHODNameEmail(id, nameToUse, emailToUse);
  await db.updateUserStatus(id, activeStatus);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPDATE_HOD', `HOD:${id}`);

  return res.json({ message: 'HOD account updated successfully.' });
});

// POST Enable/Disable HOD Account
router.post('/hod/:id/status', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { isActive } = req.body;

  const targetHOD = await db.getUserById(id);
  if (!targetHOD || targetHOD.role !== 'HOD') {
    return res.status(404).json({ error: 'HOD account not found.' });
  }

  if (isActive === true) {
    const hodUsers = await db.getUsers('HOD');
    const existingActive = hodUsers.find((u) => Boolean(u.is_active) && u.id !== id);
    if (existingActive) {
      return res.status(400).json({ error: 'An active HOD account already exists for AI & DS.' });
    }
  }

  await db.updateUserStatus(id, Boolean(isActive));
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'UPDATE_HOD_STATUS', `HOD:${id} Status:${isActive}`);

  return res.json({ message: `HOD account ${isActive ? 'enabled' : 'disabled'} successfully.` });
});

// POST Reset HOD Portal Password
router.post('/hod/:id/reset-password', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Portal password must be at least 6 characters long.' });
  }

  const targetHOD = await db.getUserById(id);
  if (!targetHOD || targetHOD.role !== 'HOD') {
    return res.status(404).json({ error: 'HOD account not found.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.updateUserPassword(id, passwordHash);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'RESET_HOD_PASSWORD', `HOD:${targetHOD.email}`);

  return res.json({ message: `Portal password reset successfully for HOD ${targetHOD.name}.` });
});

// DELETE HOD Account
router.delete('/hod/:id', async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;

  const targetHOD = await db.getUserById(id);
  if (!targetHOD || targetHOD.role !== 'HOD') {
    return res.status(404).json({ error: 'HOD account not found.' });
  }

  await db.deleteHODUser(id);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'DELETE_HOD', `HOD:${targetHOD.email}`);

  return res.json({ message: `HOD account ${targetHOD.name} deleted successfully.` });
});

export default router;
