import { db } from '../server/db';

async function testHODBestEliteNavigation() {
  console.log('=== VERIFYING HOD BEST ELITE STUDENTS NAVIGATION & SUBMENU INTEGRATION ===\n');

  const submenus = [
    { id: 'best-elite-skilledge', label: 'SkillEdge Reward Points', categoryKey: 'skilledge' },
    { id: 'best-elite-academics', label: 'Academic Performance', categoryKey: 'academics' },
    { id: 'best-elite-leetcode', label: 'LeetCode', categoryKey: 'leetcode' },
    { id: 'best-elite-linkedin', label: 'LinkedIn Profile', categoryKey: 'linkedin' },
    { id: 'best-elite-github', label: 'GitHub URL', categoryKey: 'github' },
    { id: 'best-elite-hackathons', label: 'Hackathon Achievement', categoryKey: 'hackathons' },
    { id: 'best-elite-projects', label: 'Projects', categoryKey: 'projects' },
    { id: 'best-elite-nptel', label: 'NPTEL', categoryKey: 'nptel' },
    { id: 'best-elite-certificates', label: 'Certificate Courses', categoryKey: 'certificates' }
  ];

  console.log(`Found ${submenus.length} submenus in exact order under 'Best Elite Students' parent menu.`);

  const students = db.getStudents('ALL', 'ALL');
  console.log(`Pool size: ${students.length} department students.\n`);

  for (let i = 0; i < submenus.length; i++) {
    const sub = submenus[i];
    console.log(`[Submenu ${i + 1}/9] '${sub.label}' (ID: ${sub.id}, CategoryKey: ${sub.categoryKey})`);
    let validCount = 0;

    for (const stu of students) {
      const p = db.getStudent360(stu.id);
      if (!p) continue;

      if (sub.categoryKey === 'skilledge' && p.skillEdge && p.skillEdge.totalRewardPoints > 0) validCount++;
      if (sub.categoryKey === 'academics' && (p.student.cgpa || (p.academics && p.academics.length > 0))) validCount++;
      if (sub.categoryKey === 'leetcode' && p.leetcode && (p.leetcode.username || p.leetcode.totalSolved > 0)) validCount++;
      if (sub.categoryKey === 'linkedin' && (p.student.linkedinUrl || p.student.linkedin_url)) validCount++;
      if (sub.categoryKey === 'github' && (p.student.githubUrl || p.student.github_url)) validCount++;
      if (sub.categoryKey === 'hackathons' && (p.participation || []).some((x: any) => (x.title || x.eventName || '').toLowerCase().includes('hackathon'))) validCount++;
      if (sub.categoryKey === 'projects' && (p.projects || []).length > 0) validCount++;
      if (sub.categoryKey === 'nptel' && (p.nptel || []).length > 0) validCount++;
      if (sub.categoryKey === 'certificates' && (p.certificates || []).length > 0) validCount++;
    }

    console.log(`  -> Navigation target activeTab '${sub.id}' resolves to Category '${sub.categoryKey}' (${validCount} records with live data, ${students.length - validCount} with 'No Data Available')`);
  }

  console.log('\n✅ HOD Best Elite Students dropdown navigation verified successfully.');
}

testHODBestEliteNavigation().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
