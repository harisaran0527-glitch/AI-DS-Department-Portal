import { db } from '../server/db';
import { isTestOrDemoRecord } from '../server/services/geminiRankingService';

function auditDatabase() {
  console.log('=== DATABASE STUDENT & LEETCODE AUDIT ===\n');

  const allStudents = db.getStudents('ALL', 'ALL');
  console.log(`Total Student Records in DB: ${allStudents.length}\n`);

  const genuineStudents: any[] = [];
  const testDemoStudents: any[] = [];

  allStudents.forEach((stu, i) => {
    const isTest = isTestOrDemoRecord(stu);
    const full360 = db.getStudent360(stu.id);
    const lc = full360?.leetcode;

    const record = {
      index: i + 1,
      id: stu.id,
      name: stu.name,
      registerNo: stu.registerNo || (stu as any).register_no,
      year: stu.year,
      section: stu.section,
      email: stu.email || (stu as any).collegeEmail,
      isElite: Boolean(stu.isEliteStudent || (stu as any).is_elite_student),
      isTestRecord: isTest,
      leetcode: lc ? {
        totalSolved: lc.totalSolved,
        easySolved: lc.easySolved,
        mediumSolved: lc.mediumSolved,
        hardSolved: lc.hardSolved,
        contestRating: lc.contestRating,
        inconsistent: (lc.easySolved + lc.mediumSolved + lc.hardSolved) !== lc.totalSolved
      } : null
    };

    if (isTest) {
      testDemoStudents.push(record);
    } else {
      genuineStudents.push(record);
    }
  });

  console.log('--- GENUINE STUDENTS (' + genuineStudents.length + ') ---');
  genuineStudents.forEach((s) => {
    console.log(`[${s.registerNo}] ${s.name} (${s.year} - Sec ${s.section}) | Elite: ${s.isElite}`);
    if (s.leetcode) {
      console.log(`   LeetCode: ${s.leetcode.totalSolved} total (${s.leetcode.easySolved} Easy, ${s.leetcode.mediumSolved} Med, ${s.leetcode.hardSolved} Hard) | Rating: ${s.leetcode.contestRating}${s.leetcode.inconsistent ? ' ⚠️ INCONSISTENT MATH!' : ''}`);
    } else {
      console.log('   LeetCode: No record');
    }
  });

  console.log('\n--- TEST / DEMO / SAMPLE RECORDS (' + testDemoStudents.length + ') ---');
  testDemoStudents.forEach((s) => {
    console.log(`[${s.registerNo}] ${s.name} (${s.email})`);
    if (s.leetcode) {
      console.log(`   LeetCode: ${s.leetcode.totalSolved} total (${s.leetcode.easySolved} Easy, ${s.leetcode.mediumSolved} Med, ${s.leetcode.hardSolved} Hard) | Rating: ${s.leetcode.contestRating}`);
    }
  });
}

auditDatabase();
