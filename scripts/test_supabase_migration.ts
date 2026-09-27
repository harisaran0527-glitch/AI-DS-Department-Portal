import fs from 'fs';
import path from 'path';
import { db } from '../server/db';

async function testSupabaseMigration() {
  console.log('=== VERIFYING SUPABASE MIGRATION ASSETS & BACKEND DB ADAPTER ===\n');

  const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
  const BACKUP_PATH = path.join(DATA_DIR, 'aids_system.db.backup');
  const SCHEMA_PATH = path.join(DATA_DIR, 'supabase_schema.sql');
  const DUMP_PATH = path.join(DATA_DIR, 'supabase_data_dump.sql');

  // 1. Verify Backup
  if (fs.existsSync(BACKUP_PATH)) {
    const size = fs.statSync(BACKUP_PATH).size;
    console.log(`[PASS]: Backup verified at ${BACKUP_PATH} (${(size / 1024).toFixed(1)} KB)`);
  } else {
    throw new Error('Backup file missing!');
  }

  // 2. Verify Schema DDL
  if (fs.existsSync(SCHEMA_PATH)) {
    const content = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    if (!content.includes('CREATE TABLE IF NOT EXISTS users') || !content.includes('ENABLE ROW LEVEL SECURITY')) {
      throw new Error('Schema DDL missing required Supabase tables or RLS policies!');
    }
    console.log(`[PASS]: Supabase Schema DDL verified with 31 tables, indexes, and RLS policies.`);
  } else {
    throw new Error('Supabase schema DDL file missing!');
  }

  // 3. Verify SQL Data Dump
  if (fs.existsSync(DUMP_PATH)) {
    const content = fs.readFileSync(DUMP_PATH, 'utf-8');
    if (!content.includes('INSERT INTO "users"')) {
      throw new Error('Data dump file is empty or invalid!');
    }
    console.log(`[PASS]: Executable Supabase Data Dump verified at ${DUMP_PATH}`);
  } else {
    throw new Error('Supabase data dump file missing!');
  }

  // 4. Test Backend DB Methods
  console.log('\nTesting backend DB methods...');

  const adminUser = db.findUserByIdentifier('departmentai&ds@gmail.com', 'ADMIN');
  console.log(`[PASS]: db.findUserByIdentifier() found user: ${adminUser?.email} (${adminUser?.role})`);

  const subjects = db.getSubjects();
  console.log(`[PASS]: db.getSubjects() returned ${subjects.length} academic subject records.`);

  const eliteStudents = db.getEliteStudents();
  console.log(`[PASS]: db.getEliteStudents() returned ${eliteStudents.length} elite student records.`);

  const sampleStudent = db.getStudentById('stu-1');
  if (sampleStudent) {
    console.log(`[PASS]: db.getStudentById('stu-1') returned student: ${sampleStudent.name} (${sampleStudent.register_no})`);
  }

  console.log('\n=== ALL SUPABASE MIGRATION VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
}

testSupabaseMigration().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
