import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { executeRun, queryAll, queryOne } from './postgresAdapter.js';
import { db } from './db.js';

export type DisciplinePortalRole = 'ADMIN' | 'FACULTY';

export interface DisciplinePortalUser {
  id: string;
  email: string;
  name: string;
  role: DisciplinePortalRole;
  password_hash: string;
  is_active: number;
}

export interface DisciplineStudentImportRow {
  name: string;
  registerNo: string;
  email: string;
  year: string;
  section: string;
  department: string;
}

export async function getDisciplinePortalUserByEmail(email: string): Promise<DisciplinePortalUser | null> {
  return queryOne<DisciplinePortalUser>(
    'SELECT id, email, name, role, password_hash, is_active FROM discipline_portal_users WHERE LOWER(email) = LOWER(?)',
    [email.trim()]
  );
}

export async function getDisciplinePortalUserById(id: string): Promise<DisciplinePortalUser | null> {
  return queryOne<DisciplinePortalUser>(
    'SELECT id, email, name, role, password_hash, is_active FROM discipline_portal_users WHERE id = ?',
    [id]
  );
}

export async function createDisciplinePortalUser(input: {
  email: string;
  name: string;
  password: string;
  role: DisciplinePortalRole;
}): Promise<void> {
  const id = `discipline-${randomUUID()}`;
  const passwordHash = await bcrypt.hash(input.password, 12);
  await executeRun(
    `INSERT INTO discipline_portal_users (id, email, name, role, password_hash, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [id, input.email.trim().toLowerCase(), input.name.trim(), input.role, passwordHash, new Date().toISOString()]
  );
}

export async function listDisciplineFaculty(): Promise<Array<{
  id: string;
  email: string;
  name: string;
  is_active: number;
  student_count: number;
}>> {
  return queryAll(
    `SELECT u.id, u.email, u.name, u.is_active, COUNT(a.student_id) AS student_count
     FROM discipline_portal_users u
     LEFT JOIN discipline_portal_assignments a ON a.faculty_id = u.id
     WHERE u.role = 'FACULTY'
     GROUP BY u.id, u.email, u.name, u.is_active
     ORDER BY LOWER(u.name), LOWER(u.email)`
  );
}

export async function listDisciplineFacultyStudents(facultyId: string) {
  return queryAll(
    `SELECT s.id, s.name, s.register_no AS registerNo, s.email, s.department, s.year, s.section
     FROM discipline_portal_assignments a
     JOIN students s ON s.id = a.student_id
     WHERE a.faculty_id = ?
     ORDER BY LOWER(s.name), LOWER(s.register_no)`,
    [facultyId]
  );
}

export async function setDisciplineFacultyActive(id: string, active: boolean): Promise<boolean> {
  const result = await executeRun(
    `UPDATE discipline_portal_users SET is_active = ? WHERE id = ? AND role = 'FACULTY'`,
    [active ? 1 : 0, id]
  );
  return result.changes > 0;
}

export async function getDisciplineAssignedStudentIds(facultyId: string): Promise<Set<string>> {
  const rows = await queryAll<{ student_id: string }>(
    'SELECT student_id FROM discipline_portal_assignments WHERE faculty_id = ?',
    [facultyId]
  );
  return new Set(rows.map(row => row.student_id));
}

export async function isDisciplineStudentAssigned(facultyId: string, studentId: string): Promise<boolean> {
  return Boolean(await queryOne(
    'SELECT student_id FROM discipline_portal_assignments WHERE faculty_id = ? AND student_id = ?',
    [facultyId, studentId]
  ));
}

export async function listDisciplineAssignments(): Promise<Record<string, {
  id: string;
  faculty_id: string;
  department: string;
  year: string;
  section: string;
  role: string;
  is_active: number;
  created_at: string;
}>> {
  const rows = await queryAll<{
    id: string;
    faculty_id: string;
    department: string;
    year: string;
    section: string;
    role: string;
    is_active: number;
    created_at: string;
  }>(
    `SELECT a.faculty_id, a.faculty_id AS id, s.department, s.year, s.section, a.created_at,
            'Discipline Faculty' AS role, u.is_active
     FROM discipline_portal_assignments a
     JOIN students s ON s.id = a.student_id
     JOIN discipline_portal_users u ON u.id = a.faculty_id`
  );
  return Object.fromEntries(rows.map(row => [`${row.faculty_id}:${row.year}:${row.section}`, row]));
}

export async function getDisciplineFacultyForStudent(studentId: string): Promise<DisciplinePortalUser | null> {
  return queryOne<DisciplinePortalUser>(
    `SELECT u.id, u.email, u.name, u.role, u.password_hash, u.is_active
     FROM discipline_portal_assignments a
     JOIN discipline_portal_users u ON u.id = a.faculty_id
     WHERE a.student_id = ? AND u.is_active = 1
     ORDER BY a.created_at LIMIT 1`,
    [studentId]
  );
}

export async function assignDisciplineStudents(facultyId: string, registerNumbers: string[], assignedBy: string) {
  const faculty = await getDisciplinePortalUserById(facultyId);
  if (!faculty || faculty.role !== 'FACULTY' || Number(faculty.is_active) !== 1) {
    throw new Error('Select an active Discipline Portal faculty account.');
  }
  const assigned: string[] = [];
  const skipped: string[] = [];
  for (const registerNo of [...new Set(registerNumbers.map(value => value.trim()).filter(Boolean))]) {
    const student = await db.getStudentByRegisterNo(registerNo);
    if (!student) {
      skipped.push(registerNo);
      continue;
    }
    const exists = await isDisciplineStudentAssigned(facultyId, student.id);
    if (exists) {
      skipped.push(registerNo);
      continue;
    }
    await executeRun(
      `INSERT INTO discipline_portal_assignments (id, faculty_id, student_id, assigned_by, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [`assignment-${randomUUID()}`, facultyId, student.id, assignedBy, new Date().toISOString()]
    );
    assigned.push(registerNo);
  }
  return { assigned, skipped };
}

export async function previewDisciplineStudentImport(rows: DisciplineStudentImportRow[]) {
  const existingStudents = await db.getAllStudents();
  const registerNumbers = new Set(existingStudents.map(student => (student.registerNo || student.register_no || '').toLowerCase()));
  const emailAddresses = new Set(existingStudents.map(student => (student.email || student.collegeEmail || student.college_email || '').toLowerCase()));
  const seenRegisters = new Set<string>();
  const seenEmails = new Set<string>();
  return rows.map((row, index) => {
    const errors: string[] = [];
    for (const [label, value] of [
      ['Name', row.name], ['Register Number', row.registerNo], ['College Mail ID', row.email],
      ['Year', row.year], ['Section', row.section], ['Department', row.department]
    ]) {
      if (!value.trim()) errors.push(`${label} is required.`);
    }
    const registerNo = row.registerNo.trim().toLowerCase();
    const email = row.email.trim().toLowerCase();
    if (registerNumbers.has(registerNo) || seenRegisters.has(registerNo)) errors.push('Register Number already exists or is duplicated in this file.');
    if (emailAddresses.has(email) || seenEmails.has(email)) errors.push('College Mail ID already exists or is duplicated in this file.');
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) errors.push('College Mail ID is invalid.');
    seenRegisters.add(registerNo);
    seenEmails.add(email);
    return { rowNumber: index + 2, row, errors, valid: errors.length === 0 };
  });
}

export async function importDisciplineStudents(facultyId: string, rows: DisciplineStudentImportRow[], importedBy: string) {
  const preview = await previewDisciplineStudentImport(rows);
  const imported: string[] = [];
  const failed: Array<{ registerNo: string; error: string }> = [];
  for (const item of preview.filter(result => result.valid)) {
    const row = item.row;
    try {
      const studentId = `discipline-student-${randomUUID()}`;
      await db.createStudent({
        id: studentId,
        registerNo: row.registerNo.trim(),
        name: row.name.trim(),
        email: row.email.trim().toLowerCase(),
        department: row.department.trim(),
        year: row.year.trim(),
        section: row.section.trim(),
        batch: ''
      });
      await executeRun(
        `INSERT INTO discipline_portal_assignments (id, faculty_id, student_id, assigned_by, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [`assignment-${randomUUID()}`, facultyId, studentId, importedBy, new Date().toISOString()]
      );
      imported.push(row.registerNo);
    } catch (error) {
      console.error('[Discipline Portal] Student row import failed', error);
      failed.push({ registerNo: row.registerNo, error: 'The row could not be imported.' });
    }
  }
  return {
    imported,
    skipped: preview.filter(result => !result.valid).map(result => ({ rowNumber: result.rowNumber, errors: result.errors })),
    failed
  };
}
