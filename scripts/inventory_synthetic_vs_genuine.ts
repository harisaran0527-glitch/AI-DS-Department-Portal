import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'server', 'data', 'aids_system.db');
const db = new Database(dbPath, { readonly: true });

console.log('=== SEPARATE INVENTORY OF GENUINE VS SYNTHETIC TEST RECORDS ===\n');

// 1. USERS TABLE INVENTORY (76 Rows)
const users = db.prepare('SELECT id, email, identifier, name, role FROM users ORDER BY created_at ASC').all() as any[];
const genuineUsers: any[] = [];
const syntheticUsers: any[] = [];

for (const u of users) {
  const isGenuine = 
    u.id === 'admin-sys' ||
    u.id === 'hod-sys' ||
    u.id === 'fac-sys' ||
    u.id === 'stu-sys' ||
    u.email.includes('@avsenggcollege.ac.in') ||
    u.email.includes('gmail.com') ||
    u.identifier === 'STAFF_A_001' ||
    u.identifier === 'STAFF_B_002';

  if (isGenuine) {
    genuineUsers.push(u);
  } else {
    syntheticUsers.push(u);
  }
}

console.log(`1. USERS TABLE (Total: ${users.length} records):`);
console.log(` - Confirmed Genuine Users: ${genuineUsers.length}`);
console.log(` - Synthetic Test Users: ${syntheticUsers.length}`);

// 2. STUDENTS TABLE INVENTORY (51 Rows)
const students = db.prepare('SELECT id, register_no, name, email, year, section FROM students ORDER BY current_rank ASC').all() as any[];
const genuineStudents: any[] = [];
const syntheticStudents: any[] = [];

for (const s of students) {
  const isGenuine = 
    s.id === 'stu-sys' ||
    s.email.includes('@avsenggcollege.ac.in') ||
    (s.register_no.length === 12 && !s.register_no.startsWith('REG') && !s.register_no.startsWith('73763TH'));

  if (isGenuine) {
    genuineStudents.push(s);
  } else {
    syntheticStudents.push(s);
  }
}

console.log(`\n2. STUDENTS TABLE (Total: ${students.length} records):`);
console.log(` - Confirmed Genuine Students: ${genuineStudents.length}`);
for (const s of genuineStudents) {
  console.log(`   * Genuine Student: "${s.name}" (${s.register_no}, ${s.email})`);
}
console.log(` - Synthetic Test Students: ${syntheticStudents.length}`);
for (const s of syntheticStudents) {
  console.log(`   * Test Student: "${s.name}" (${s.register_no}, ${s.email})`);
}

// 3. AUDIT LOGS INVENTORY (480 Rows)
const auditLogs = db.prepare('SELECT action, count(*) as count FROM audit_logs GROUP BY action').all();
console.log(`\n3. AUDIT LOGS TABLE (Total: 480 records):`);
for (const row of auditLogs as any[]) {
  console.log(` - Action "${row.action}": ${row.count} records`);
}
