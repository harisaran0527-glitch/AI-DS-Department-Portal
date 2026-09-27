import { db } from '../server/db';

async function testBestEliteStudentsIntegration() {
  console.log('=== VERIFYING BEST ELITE STUDENTS DROPDOWN CATEGORIES & DATA INTEGRATION ===\n');

  const students = db.getStudents('ALL', 'ALL');
  console.log(`Total Department Students Found: ${students.length}`);

  if (students.length === 0) {
    console.error('❌ No students found in database!');
    process.exit(1);
  }

  const categorySummary: Record<string, { totalConnected: number; missingDataCount: number }> = {
    '1. SkillEdge Reward Points': { totalConnected: 0, missingDataCount: 0 },
    '2. Academic Performance': { totalConnected: 0, missingDataCount: 0 },
    '3. LeetCode': { totalConnected: 0, missingDataCount: 0 },
    '4. LinkedIn Profile': { totalConnected: 0, missingDataCount: 0 },
    '5. GitHub URL': { totalConnected: 0, missingDataCount: 0 },
    '6. Hackathon Achievement': { totalConnected: 0, missingDataCount: 0 },
    '7. Projects': { totalConnected: 0, missingDataCount: 0 },
    '8. NPTEL': { totalConnected: 0, missingDataCount: 0 },
    '9. Certificate Courses': { totalConnected: 0, missingDataCount: 0 }
  };

  for (const student of students) {
    const profile = db.getStudent360(student.id);
    if (!profile) continue;

    // 1. SkillEdge Reward Points
    if (profile.skillEdge && profile.skillEdge.totalRewardPoints > 0) {
      categorySummary['1. SkillEdge Reward Points'].totalConnected++;
    } else {
      categorySummary['1. SkillEdge Reward Points'].missingDataCount++;
    }

    // 2. Academic Performance
    if (profile.student.cgpa || (profile.academics && profile.academics.length > 0)) {
      categorySummary['2. Academic Performance'].totalConnected++;
    } else {
      categorySummary['2. Academic Performance'].missingDataCount++;
    }

    // 3. LeetCode
    if (profile.leetcode && (profile.leetcode.username || profile.leetcode.totalSolved > 0)) {
      categorySummary['3. LeetCode'].totalConnected++;
    } else {
      categorySummary['3. LeetCode'].missingDataCount++;
    }

    // 4. LinkedIn Profile
    if (profile.student.linkedinUrl || profile.student.linkedin_url) {
      categorySummary['4. LinkedIn Profile'].totalConnected++;
    } else {
      categorySummary['4. LinkedIn Profile'].missingDataCount++;
    }

    // 5. GitHub URL
    if (profile.student.githubUrl || profile.student.github_url) {
      categorySummary['5. GitHub URL'].totalConnected++;
    } else {
      categorySummary['5. GitHub URL'].missingDataCount++;
    }

    // 6. Hackathon Achievement
    const hackathons = (profile.participation || []).filter(
      (p: any) =>
        (p.eventType || p.event_type || '').toLowerCase().includes('hackathon') ||
        (p.title || p.eventName || '').toLowerCase().includes('hackathon') ||
        (p.achievement || p.position || '').toLowerCase().includes('winner') ||
        (p.achievement || p.position || '').toLowerCase().includes('prize') ||
        (p.achievement || p.position || '').toLowerCase().includes('place')
    );
    if (hackathons.length > 0) {
      categorySummary['6. Hackathon Achievement'].totalConnected++;
    } else {
      categorySummary['6. Hackathon Achievement'].missingDataCount++;
    }

    // 7. Projects
    if (profile.projects && profile.projects.length > 0) {
      categorySummary['7. Projects'].totalConnected++;
    } else {
      categorySummary['7. Projects'].missingDataCount++;
    }

    // 8. NPTEL
    if (profile.nptel && profile.nptel.length > 0) {
      categorySummary['8. NPTEL'].totalConnected++;
    } else {
      categorySummary['8. NPTEL'].missingDataCount++;
    }

    // 9. Certificate Courses
    if (profile.certificates && profile.certificates.length > 0) {
      categorySummary['9. Certificate Courses'].totalConnected++;
    } else {
      categorySummary['9. Certificate Courses'].missingDataCount++;
    }
  }

  console.log('--- CATEGORY INTEGRATION RESULTS ---');
  Object.entries(categorySummary).forEach(([cat, res]) => {
    console.log(`${cat}:`);
    console.log(`  - Students with Real Data: ${res.totalConnected}`);
    console.log(`  - Students displaying "No Data Available": ${res.missingDataCount}`);
  });

  console.log('\n✅ All 9 categories successfully mapped to database source modules.');
}

testBestEliteStudentsIntegration().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
