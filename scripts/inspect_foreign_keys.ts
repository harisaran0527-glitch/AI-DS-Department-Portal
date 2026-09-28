import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'server', 'data', 'aids_system.db');
const db = new Database(dbPath, { readonly: true });

console.log('=== INSPECTING FOREIGN KEY REFERENCES IN SQLITE DATABASE ===');

// 1. Check student records where created_by_faculty_id is not null and not in users(id)
const orphanCreatedBy = db.prepare(`
  SELECT s.id, s.register_no, s.name, s.email, s.created_by_faculty_id, s.faculty_workspace_id
  FROM students s
  LEFT JOIN users u ON s.created_by_faculty_id = u.id
  WHERE s.created_by_faculty_id IS NOT NULL AND u.id IS NULL
`).all();

console.log(`\n1. Students with invalid created_by_faculty_id (not in users table): ${orphanCreatedBy.length}`);
for (const s of orphanCreatedBy) {
  console.log(` - Student ID: ${s.id}, Reg: ${s.register_no}, Name: "${s.name}", CreatedByFacultyID: "${s.created_by_faculty_id}", WorkspaceID: "${s.faculty_workspace_id}"`);
}

// 2. Check student records where faculty_workspace_id is not null and not in users(id)
const orphanWorkspace = db.prepare(`
  SELECT s.id, s.register_no, s.name, s.email, s.created_by_faculty_id, s.faculty_workspace_id
  FROM students s
  LEFT JOIN users u ON s.faculty_workspace_id = u.id
  WHERE s.faculty_workspace_id IS NOT NULL AND u.id IS NULL
`).all();

console.log(`\n2. Students with invalid faculty_workspace_id (not in users table): ${orphanWorkspace.length}`);
console.dir(orphanWorkspace, { depth: null });

// 3. Check distinct created_by_faculty_id values in students table vs users table
const distinctFacultyIdsInStudents = db.prepare(`
  SELECT DISTINCT created_by_faculty_id FROM students WHERE created_by_faculty_id IS NOT NULL
`).all() as { created_by_faculty_id: string }[];

console.log(`\n3. Total distinct created_by_faculty_id values in students table: ${distinctFacultyIdsInStudents.length}`);
for (const item of distinctFacultyIdsInStudents) {
  const fid = item.created_by_faculty_id;
  const userMatch = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(fid) as any;
  const faMatch = db.prepare('SELECT id, faculty_id FROM faculty_assignments WHERE id = ? OR faculty_id = ?').get(fid, fid) as any;
  console.log(` - ID "${fid}": User Match? ${userMatch ? `${userMatch.email} (${userMatch.role})` : 'NO MATCH IN USERS'}, FacultyAssignment Match? ${faMatch ? `FA ID: ${faMatch.id}` : 'NO MATCH IN FA'}`);
}

// 4. Check all users with role FACULTY
const facultyUsers = db.prepare("SELECT id, email, identifier, name, role FROM users WHERE role = 'FACULTY' OR role = 'HOD'").all();
console.log(`\n4. Faculty/HOD Users count in users table: ${facultyUsers.length}`);
console.dir(facultyUsers, { depth: null });
