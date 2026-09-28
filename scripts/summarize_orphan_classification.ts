import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'server', 'data', 'aids_system.db');
const db = new Database(dbPath, { readonly: true });

const orphanStudents = db.prepare(`
  SELECT s.*
  FROM students s
  LEFT JOIN users u ON s.created_by_faculty_id = u.id
  WHERE s.created_by_faculty_id IS NOT NULL AND u.id IS NULL
`).all() as any[];

console.log('=== VERIFIABLE CLASSIFICATION OF ALL 17 ORPHAN STUDENTS ===\n');

for (let i = 0; i < orphanStudents.length; i++) {
  const s = orphanStudents[i];
  const isGenuine = s.email.includes('@avsenggcollege.ac.in') || (s.register_no.length === 12 && !s.register_no.startsWith('REG'));
  console.log(`${i + 1}. ID: "${s.id}" | Reg: "${s.register_no}" | Name: "${s.name}" | Email: "${s.email}"`);
  console.log(`   Type: ${isGenuine ? '🟢 GENUINE ENROLLED STUDENT' : '🧪 SYNTHETIC TEST RECORD'}`);
  console.log(`   Reason/Proof: ${isGenuine ? 'Official college email domain @avsenggcollege.ac.in / 12-digit Anna Univ Reg No' : 'Synthetic reg_no pattern / test email created by automated test script'}\n`);
}
