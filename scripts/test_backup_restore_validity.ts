import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const BACKUP_PATH = path.join(DATA_DIR, 'aids_system.db.backup');
const TEST_RESTORE_PATH = path.join(DATA_DIR, 'aids_system_restore_test.db');

async function testBackupValidity() {
  console.log('=== TESTING BACKUP FILE VALIDITY & RESTORABILITY ===\n');

  if (!fs.existsSync(BACKUP_PATH)) {
    throw new Error(`Backup file missing at: ${BACKUP_PATH}`);
  }

  // 1. Copy backup file to temporary test restore location
  fs.copyFileSync(BACKUP_PATH, TEST_RESTORE_PATH);
  console.log(`[COPY]: Copied backup file to test restore location: ${TEST_RESTORE_PATH}`);

  // 2. Open restored SQLite database
  const restoredDb = new Database(TEST_RESTORE_PATH);
  
  // 3. Run SQLite Integrity & Quick Check
  const integrityResult = restoredDb.prepare("PRAGMA integrity_check").get() as any;
  const quickCheckResult = restoredDb.prepare("PRAGMA quick_check").get() as any;

  console.log(`[INTEGRITY CHECK]: ${JSON.stringify(integrityResult)}`);
  console.log(`[QUICK CHECK]: ${JSON.stringify(quickCheckResult)}`);

  if (integrityResult.integrity_check !== 'ok' || quickCheckResult.quick_check !== 'ok') {
    restoredDb.close();
    if (fs.existsSync(TEST_RESTORE_PATH)) fs.unlinkSync(TEST_RESTORE_PATH);
    throw new Error('Database backup file integrity check FAILED!');
  }

  // 4. Query record counts from restored database
  const userCount = (restoredDb.prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
  const studentCount = (restoredDb.prepare("SELECT COUNT(*) as c FROM students").get() as any).c;

  console.log(`[QUERY RESTORED DB]: Found ${userCount} users and ${studentCount} students in restored DB.`);

  restoredDb.close();
  
  // 5. Clean up temporary test restore file
  if (fs.existsSync(TEST_RESTORE_PATH)) {
    fs.unlinkSync(TEST_RESTORE_PATH);
    console.log(`[CLEANUP]: Temporary test restore database removed.`);
  }

  console.log('\n=== BACKUP FILE IS 100% VALID, UNCORRUPTED, AND FULLY RESTORABLE! ===');
}

testBackupValidity().catch(err => {
  console.error('\n❌ BACKUP TEST FAILED:', err);
  process.exit(1);
});
