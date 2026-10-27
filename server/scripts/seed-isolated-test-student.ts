// Set isolated test environment variables BEFORE importing any application modules
process.env.USE_SQLITE = 'true';
process.env.DATABASE_PATH = 'server/data/isolated_test_system.db';
delete process.env.DATABASE_URL;
delete process.env.SUPABASE_DB_URL;
delete process.env.NEON_DB_URL;

import bcryptjs from 'bcryptjs';

async function main() {
  console.log('[Seed] Initializing isolated SQLite database at:', process.env.DATABASE_PATH);
  
  const { initDatabaseSchema, db } = await import('../db.js');
  const { executeRun, queryOne } = await import('../postgresAdapter.js');

  await initDatabaseSchema();

  const studentReg = '91762114999';
  const existingStudent = await queryOne('SELECT * FROM students WHERE register_no = ?', [studentReg]);

  if (!existingStudent) {
    console.log('[Seed] Creating designated synthetic student in isolated database...');
    await executeRun(`
      INSERT INTO students (
        id, register_no, name, email, department, year, section, batch,
        class_coordinator_name, cgpa, overall_score, current_rank, is_representative
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'stu-synthetic-test-360',
      studentReg,
      'SYNTHETIC TEST STUDENT (FORM BUILDER)',
      'synthetic.test.360@avsec.invalid',
      'AI & DS',
      '3rd Year',
      'A',
      '2023-2027',
      'Assigned Faculty',
      8.5,
      45.0,
      1,
      0
    ]);

    // Insert pre-existing certificate to verify append safety & non-overwrite
    await executeRun(`
      INSERT INTO certificate_records (
        id, student_id, course_name, platform, category, issue_date, certificate_id,
        file_path, original_file_name, uploaded_at, created_at, mime_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'cert-pre-existing-001',
      'stu-synthetic-test-360',
      'Pre-existing Legacy Certification',
      'NPTEL',
      'Technical Certification',
      '2025-01-15',
      'NPTEL-LEGACY-001',
      '',
      '',
      '2025-01-15T10:00:00.000Z',
      '2025-01-15T10:00:00.000Z',
      'application/pdf'
    ]);

    // Insert pre-existing project to verify append safety & non-overwrite
    await executeRun(`
      INSERT INTO project_records (
        id, student_id, title, description, domain, tech_stack_json, is_team,
        student_role, github_url, live_url, category, status, product_photo_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'proj-pre-existing-001',
      'stu-synthetic-test-360',
      'Pre-existing Legacy Prototype',
      'Initial prototype developed prior to Form Builder integration',
      'Software Engineering',
      JSON.stringify(['Python', 'SQLite']),
      0,
      'Developer',
      null,
      null,
      'Software',
      'Completed',
      ''
    ]);

    console.log('[Seed] Created pre-existing certificate and project records.');
  } else {
    console.log('[Seed] Synthetic test student already exists in isolated database.');
  }

  // Ensure test HOD account exists
  const existingHod = await queryOne("SELECT * FROM users WHERE email = 'hod@aids.test'");
  if (!existingHod) {
    const hash = await bcryptjs.hash('HodTestPassword@2026', 10);
    await executeRun(`
      INSERT INTO users (id, email, identifier, name, role, password_hash, is_active, created_at)
      VALUES (?, ?, ?, ?, 'HOD', ?, 1, ?)
    `, [
      'user-test-hod',
      'hod@aids.test',
      'hod@aids.test',
      'HOD Test Head',
      hash,
      new Date().toISOString()
    ]);
    console.log('[Seed] Created HOD test account (hod@aids.test).');
  }

  const s = await db.getStudentByRegisterNo(studentReg);
  console.log(`[Seed] Synthetic student verified: ${s?.name} (${s?.register_no}), Overall Score: ${s?.overall_score}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
