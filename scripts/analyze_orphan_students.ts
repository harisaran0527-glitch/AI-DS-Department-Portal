import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'server', 'data', 'aids_system.db');
const db = new Database(dbPath, { readonly: true });

const orphanStudents = db.prepare(`
  SELECT s.id, s.register_no, s.name, s.email, s.created_by_faculty_id, s.faculty_workspace_id
  FROM students s
  LEFT JOIN users u ON s.created_by_faculty_id = u.id
  WHERE s.created_by_faculty_id IS NOT NULL AND u.id IS NULL
`).all();

console.log(`TOTAL ORPHAN STUDENTS: ${orphanStudents.length}`);
console.log(JSON.stringify(orphanStudents, null, 2));

const orphanFacultyIds = db.prepare(`
  SELECT DISTINCT s.created_by_faculty_id, COUNT(*) as student_count
  FROM students s
  LEFT JOIN users u ON s.created_by_faculty_id = u.id
  WHERE s.created_by_faculty_id IS NOT NULL AND u.id IS NULL
  GROUP BY s.created_by_faculty_id
`).all();

console.log('ORPHAN FACULTY IDs SUMMARY:');
console.log(JSON.stringify(orphanFacultyIds, null, 2));
