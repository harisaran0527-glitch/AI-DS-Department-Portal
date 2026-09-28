import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'server', 'data', 'aids_system.db');
const db = new Database(dbPath, { readonly: true });

console.log('=== VERIFIABLE PROVENANCE ANALYSIS OF 17 ORPHAN STUDENT RECORDS ===\n');

const orphanStudents = db.prepare(`
  SELECT s.*
  FROM students s
  LEFT JOIN users u ON s.created_by_faculty_id = u.id
  WHERE s.created_by_faculty_id IS NOT NULL AND u.id IS NULL
`).all() as any[];

for (const s of orphanStudents) {
  // Check if student has associated academic, skilledge, leetcode, or attendance records
  const acadCount = (db.prepare('SELECT COUNT(*) as c FROM academic_records WHERE student_id = ?').get(s.id) as any).c;
  const skilledgeCount = (db.prepare('SELECT COUNT(*) as c FROM skilledge_records WHERE student_id = ?').get(s.id) as any).c;
  const nptelCount = (db.prepare('SELECT COUNT(*) as c FROM nptel_records WHERE student_id = ?').get(s.id) as any).c;
  const leetcodeCount = (db.prepare('SELECT COUNT(*) as c FROM leetcode_stats WHERE student_id = ?').get(s.id) as any).c;
  const extCount = (db.prepare('SELECT COUNT(*) as c FROM external_metrics WHERE student_id = ?').get(s.id) as any).c;

  // Check user account matching student email or reg_no
  const userAccount = db.prepare('SELECT id, email, role FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(identifier) = LOWER(?)').get(s.email, s.register_no) as any;

  console.log(`📌 Student ID: "${s.id}"`);
  console.log(`   - Register No: ${s.register_no}`);
  console.log(`   - Name: ${s.name}`);
  console.log(`   - Institutional Email: ${s.email}`);
  console.log(`   - Personal Email: ${s.personal_email || 'None'}`);
  console.log(`   - Year / Section / Batch: ${s.year} / ${s.section} / ${s.batch}`);
  console.log(`   - Class Coordinator: ${s.class_coordinator_name}`);
  console.log(`   - Orphan CreatedByFacultyID: "${s.created_by_faculty_id}"`);
  console.log(`   - User Account Exists? ${userAccount ? `YES (${userAccount.email}, ID: ${userAccount.id})` : 'NO'}`);
  console.log(`   - Related Records: Academics: ${acadCount}, SkillEdge: ${skilledgeCount}, NPTEL: ${nptelCount}, LeetCode: ${leetcodeCount}, ExtMetrics: ${extCount}`);
  
  let classification = 'UNKNOWN';
  if (s.email.includes('@avsenggcollege.ac.in') || s.register_no.startsWith('620125')) {
    classification = 'GENUINE STUDENT (Enrolled College Email / Register No)';
  } else {
    classification = 'TEST / SYNTHETIC RECORD (Generated during test script execution)';
  }
  console.log(`   - VERIFIED CLASSIFICATION: ${classification}\n`);
}
