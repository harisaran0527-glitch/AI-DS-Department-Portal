import { queryAll, pgPool } from '../server/postgresAdapter.ts';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('==================================================');
  console.log('   STEP 1: CREATING COMPLETE DATABASE BACKUP');
  console.log('==================================================\n');

  try {
    const tablesRes = await queryAll<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const fullBackup: Record<string, any[]> = {};

    for (const t of tablesRes) {
      try {
        const rows = await queryAll(`SELECT * FROM "${t.table_name}"`);
        fullBackup[t.table_name] = rows;
        console.log(`  ✓ Backed up ${t.table_name}: ${rows.length} rows`);
      } catch (err: any) {
        console.error(`  ✗ Error backing up ${t.table_name}: ${err.message}`);
      }
    }

    const backupPath = path.resolve(process.cwd(), 'server', 'data', `production_db_backup_${Date.now()}.json`);
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    fs.writeFileSync(backupPath, JSON.stringify(fullBackup, null, 2), 'utf-8');
    console.log(`\n✅ DATABASE BACKUP CREATED AT:\n${backupPath}\n`);

    console.log('==================================================');
    console.log('   STEP 2: PREVIEWING SYNTHETIC VS REAL RECORDS');
    console.log('==================================================\n');

    // 1. Users
    const allUsers = fullBackup['users'] || [];
    const realUsers = allUsers.filter((u: any) => 
      !u.email.endsWith('@aids.edu') && 
      !u.id.startsWith('admin-1790') && 
      !u.id.startsWith('hod-1790')
    );
    const syntheticUsers = allUsers.filter((u: any) => 
      u.email.endsWith('@aids.edu') || 
      u.id.startsWith('admin-1790') || 
      u.id.startsWith('hod-1790')
    );

    console.log(`USERS (${allUsers.length} total):`);
    console.log(`  - Real Users to PRESERVE (${realUsers.length}):`);
    realUsers.forEach((u: any) => console.log(`      * [${u.role}] ${u.name} <${u.email}> (ID: ${u.id})`));
    console.log(`  - Synthetic/Test Users to REMOVE (${syntheticUsers.length}):`);
    syntheticUsers.forEach((u: any) => console.log(`      * [${u.role}] ${u.name} <${u.email}> (ID: ${u.id})`));

    // 2. Students
    const allStudents = fullBackup['students'] || [];
    const realStudents = allStudents.filter((s: any) => !s.email.endsWith('@aids.edu'));
    const syntheticStudents = allStudents.filter((s: any) => s.email.endsWith('@aids.edu'));

    console.log(`\nSTUDENTS (${allStudents.length} total):`);
    console.log(`  - Real Students to PRESERVE (${realStudents.length}):`);
    realStudents.forEach((s: any) => console.log(`      * ${s.name} <${s.email}> (Year: ${s.year}, Sec: ${s.section})`));
    console.log(`  - Synthetic/Test Students to REMOVE (${syntheticStudents.length}):`);
    console.log(`      * ${syntheticStudents.length} synthetic student test accounts found.`);

    // 3. Subjects
    const allSubjects = fullBackup['subjects'] || [];
    const realSubjects = allSubjects.filter((sb: any) => sb.id.startsWith('sub-seed-'));
    const syntheticSubjects = allSubjects.filter((sb: any) => !sb.id.startsWith('sub-seed-'));

    console.log(`\nSUBJECTS (${allSubjects.length} total):`);
    console.log(`  - Real Subjects to PRESERVE (${realSubjects.length}):`);
    realSubjects.forEach((sb: any) => console.log(`      * [${sb.subject_code}] ${sb.subject_name}`));
    console.log(`  - Synthetic Subjects to REMOVE (${syntheticSubjects.length}):`);
    syntheticSubjects.forEach((sb: any) => console.log(`      * [${sb.subject_code}] ${sb.subject_name}`));

    // 4. Skilledge
    const allSkilledge = fullBackup['skilledge_records'] || [];
    const realSkilledge = allSkilledge.filter((sk: any) => {
      const student = realStudents.find((s: any) => s.id === sk.student_id);
      return Boolean(student);
    });
    const syntheticSkilledge = allSkilledge.filter((sk: any) => !realSkilledge.includes(sk));

    console.log(`\nSKILLEDGE_RECORDS (${allSkilledge.length} total):`);
    console.log(`  - Real Skilledge Records to PRESERVE: ${realSkilledge.length}`);
    console.log(`  - Synthetic Skilledge Records to REMOVE: ${syntheticSkilledge.length}`);

    // 5. External Metrics
    const allMetrics = fullBackup['external_metrics'] || [];
    const realMetrics = allMetrics.filter((m: any) => {
      const student = realStudents.find((s: any) => s.id === m.student_id);
      return Boolean(student);
    });
    const syntheticMetrics = allMetrics.filter((m: any) => !realMetrics.includes(m));

    console.log(`\nEXTERNAL_METRICS (${allMetrics.length} total):`);
    console.log(`  - Real Metrics Records to PRESERVE: ${realMetrics.length}`);
    console.log(`  - Synthetic Metrics Records to REMOVE: ${syntheticMetrics.length}`);

    // 6. Faculty Assignments
    const allFacultyAssign = fullBackup['faculty_assignments'] || [];
    const realFacultyAssign = allFacultyAssign.filter((fa: any) => {
      const fac = realUsers.find((u: any) => u.id === fa.faculty_id);
      return Boolean(fac);
    });
    const syntheticFacultyAssign = allFacultyAssign.filter((fa: any) => !realFacultyAssign.includes(fa));

    console.log(`\nFACULTY_ASSIGNMENTS (${allFacultyAssign.length} total):`);
    console.log(`  - Real Faculty Assignments to PRESERVE: ${realFacultyAssign.length}`);
    console.log(`  - Synthetic Faculty Assignments to REMOVE: ${syntheticFacultyAssign.length}`);

  } catch (error: any) {
    console.error('Preview & Backup failed:', error);
  } finally {
    if (pgPool) {
      await pgPool.end();
    }
  }
}

main();
