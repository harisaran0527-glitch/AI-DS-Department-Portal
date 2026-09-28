import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'server', 'data', 'aids_system.db');
const db = new Database(dbPath, { readonly: true });

console.log('=== COMPREHENSIVE ALL-TABLE FOREIGN KEY ORPHAN AUDIT ===\n');

const knownFks = [
  { childTable: 'students', childCol: 'created_by_faculty_id', parentTable: 'users', parentCol: 'id' },
  { childTable: 'academic_records', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'arrear_history', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'skilledge_records', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'nptel_records', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'attendance_records', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'daily_attendance_records', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'discipline_records', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'certificate_records', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'participation_records', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'leetcode_stats', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'project_records', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'achievement_records', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'finalized_awards', childCol: 'winner_student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'connected_accounts', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'external_metrics', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'skilledge_sync_history', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'nptel_proofs', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'leetcode_proofs', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'team_members', childCol: 'team_id', parentTable: 'teams', parentCol: 'id' },
  { childTable: 'team_members', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'team_head_members', childCol: 'team_head_id', parentTable: 'team_heads', parentCol: 'id' },
  { childTable: 'team_head_members', childCol: 'student_id', parentTable: 'students', parentCol: 'id' },
  { childTable: 'faculty_assignments', childCol: 'faculty_id', parentTable: 'users', parentCol: 'id' }
];

let totalOrphans = 0;

for (const fk of knownFks) {
  const query = `
    SELECT c."${fk.childCol}" as val, COUNT(*) as cnt
    FROM "${fk.childTable}" c
    LEFT JOIN "${fk.parentTable}" p ON c."${fk.childCol}" = p."${fk.parentCol}"
    WHERE c."${fk.childCol}" IS NOT NULL AND p."${fk.parentCol}" IS NULL
    GROUP BY c."${fk.childCol}"
  `;
  const orphans = db.prepare(query).all() as { val: string; cnt: number }[];
  const orphanRows = orphans.reduce((sum, o) => sum + o.cnt, 0);

  if (orphanRows > 0) {
    totalOrphans += orphanRows;
    console.log(`❌ FK Mismatch in "${fk.childTable}" ("${fk.childCol}" -> "${fk.parentTable}.${fk.parentCol}"):`);
    console.log(`   Found ${orphanRows} orphan rows across ${orphans.length} missing parent keys.`);
    for (const o of orphans) {
      console.log(`   - Missing Key: "${o.val}" (${o.cnt} child rows)`);
    }
  } else {
    console.log(`✓ FK PERFECT MATCH: "${fk.childTable}"."${fk.childCol}" -> "${fk.parentTable}.${fk.parentCol}"`);
  }
}

console.log(`\n=== AUDIT COMPLETE: Total Foreign Key Orphan Issues = ${totalOrphans} ===`);
