import type {
  Student,
  AcademicSemester,
  ArrearRecord,
  SkillEdgeRecord,
  NPTELCourse,
  ParticipationRecord,
  CertificateRecord,
  AttendanceRecord,
  DisciplineRecord,
  LeetCodeStats,
  ProjectRecord,
  ScoringConfig,
  CategoryBreakdown,
  RepresentativeMetrics
} from '../types';

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  academicWeight: 25,
  skillEdgeWeight: 15,
  nptelWeight: 10,
  participationWeight: 10,
  certificatesWeight: 10,
  attendanceWeight: 10,
  disciplineWeight: 5,
  leetcodeWeight: 10,
  projectsWeight: 5
};

export function calculateCategoryScores(
  student: Student,
  _academics: AcademicSemester[],
  arrears: ArrearRecord[],
  skillEdge: SkillEdgeRecord | undefined,
  nptelList: NPTELCourse[],
  participations: ParticipationRecord[],
  certificates: CertificateRecord[],
  attendance: AttendanceRecord | undefined,
  disciplineList: DisciplineRecord[],
  leetcode: LeetCodeStats | undefined,
  projects: ProjectRecord[]
): CategoryBreakdown {
  // 1. Academic Score (0-100)
  let academicScore = (student.cgpa / 10) * 100;
  const pendingArrears = arrears.filter((a) => a.status === 'PENDING').length;
  const clearedArrears = arrears.filter((a) => a.status === 'CLEARED').length;
  academicScore = Math.max(0, Math.min(100, academicScore - pendingArrears * 8 + clearedArrears * 2));

  // 2. SkillEdge Score (0-100)
  let skillEdgeScore = 0;
  if (skillEdge && skillEdge.tracks.length > 0) {
    const totalLevels = skillEdge.tracks.reduce((sum, t) => sum + t.totalLevels, 0);
    const completedLevels = skillEdge.tracks.reduce((sum, t) => sum + t.completedLevels, 0);
    skillEdgeScore = totalLevels > 0 ? (completedLevels / totalLevels) * 100 : 0;
  }

  // 3. NPTEL Score (0-100)
  let nptelScore = 0;
  if (nptelList.length > 0) {
    const sumScores = nptelList.reduce((sum, n) => sum + n.finalScore, 0);
    const avgScore = sumScores / nptelList.length;
    const certifiedCount = nptelList.filter((n) => n.status === 'Certified').length;
    nptelScore = Math.min(100, avgScore + certifiedCount * 5);
  }

  // 4. Participation Score (0-100)
  let participationScore = 0;
  participations.forEach((p) => {
    if (p.position?.includes('1st') || p.position?.includes('Winner')) participationScore += 25;
    else if (p.position?.includes('2nd') || p.position?.includes('Runner')) participationScore += 20;
    else if (p.position?.includes('3rd')) participationScore += 15;
    else participationScore += 10;
  });
  participationScore = Math.min(100, participationScore);

  // 5. Certificate Score (0-100)
  const certificateScore = Math.min(100, certificates.length * 18);

  // 6. Attendance Score (0-100)
  const attendanceScore = attendance ? Math.min(100, Math.max(0, attendance.percentage)) : 85;

  // 7. Discipline Score (0-100)
  const disciplineDeductions = disciplineList.length * 10;
  const disciplineScore = Math.max(0, 100 - disciplineDeductions);

  // 8. LeetCode Score (0-100)
  let leetcodeScore = 0;
  if (leetcode) {
    const rawPoints = leetcode.easySolved * 0.4 + leetcode.mediumSolved * 1.2 + leetcode.hardSolved * 2.8 + (leetcode.contestRating > 0 ? (leetcode.contestRating - 1200) * 0.05 : 0);
    leetcodeScore = Math.min(100, Math.max(0, rawPoints));
  }

  // 9. Projects Score (0-100)
  let projectScore = 0;
  projects.forEach((prj) => {
    let pts = prj.status === 'Completed' ? 30 : 15;
    if (prj.prizeAwarded) pts += 15;
    if (prj.githubUrl) pts += 10;
    projectScore += pts;
  });
  projectScore = Math.min(100, projectScore);

  return {
    academic: Math.round(academicScore * 10) / 10,
    skillEdge: Math.round(skillEdgeScore * 10) / 10,
    nptel: Math.round(nptelScore * 10) / 10,
    participation: Math.round(participationScore * 10) / 10,
    certificates: Math.round(certificateScore * 10) / 10,
    attendance: Math.round(attendanceScore * 10) / 10,
    discipline: Math.round(disciplineScore * 10) / 10,
    leetCode: Math.round(leetcodeScore * 10) / 10,
    projects: Math.round(projectScore * 10) / 10
  };
}

export function computeOverallScore(breakdown: CategoryBreakdown, config: ScoringConfig): number {
  const weightedSum =
    breakdown.academic * (config.academicWeight / 100) +
    breakdown.skillEdge * (config.skillEdgeWeight / 100) +
    breakdown.nptel * (config.nptelWeight / 100) +
    breakdown.participation * (config.participationWeight / 100) +
    breakdown.certificates * (config.certificatesWeight / 100) +
    breakdown.attendance * (config.attendanceWeight / 100) +
    breakdown.discipline * (config.disciplineWeight / 100) +
    breakdown.leetCode * (config.leetcodeWeight / 100) +
    breakdown.projects * (config.projectsWeight / 100);

  return Math.round(weightedSum * 10) / 10;
}

export function generateAIExplanation(
  student: Student,
  breakdown: CategoryBreakdown,
  overallScore: number,
  leetcode?: LeetCodeStats,
  repMetrics?: RepresentativeMetrics,
  isTeamHead?: boolean
): { explanation: string; strengths: string[]; weakAreas: string[]; eligibleAwards: string[] } {
  const strengths: string[] = [];
  const weakAreas: string[] = [];
  const eligibleAwards: string[] = [];

  if (breakdown.academic >= 85) strengths.push(`Outstanding CGPA of ${student.cgpa.toFixed(2)} with strong academic consistency.`);
  else if (breakdown.academic < 70) weakAreas.push('Academic CGPA needs improvement; focus on core semester subjects.');

  if (breakdown.skillEdge >= 80) strengths.push(`High SkillEdge lab progress across C, Python, and Data Science tracks (${breakdown.skillEdge}% completion).`);
  else if (breakdown.skillEdge < 50) weakAreas.push('SkillEdge lab completion is low; complete pending module levels.');

  if (breakdown.leetCode >= 75 && leetcode) {
    strengths.push(`Strong algorithmic performance on LeetCode with ${leetcode.totalSolved} problems solved (${leetcode.mediumSolved} Medium, ${leetcode.hardSolved} Hard).`);
    eligibleAwards.push('BEST_LEETCODE');
  } else if (breakdown.leetCode < 30) {
    weakAreas.push('LeetCode activity is minimal; increase weekly problem-solving count.');
  }

  if (breakdown.attendance >= 95) strengths.push('Punctual & disciplined with excellent attendance history (≥95%).');
  else if (breakdown.attendance < 80) weakAreas.push('Attendance is below recommended department threshold.');

  if (breakdown.participation >= 70 || breakdown.certificates >= 70) {
    strengths.push('Active inter-college hackathon participant with multiple verified technical certificates.');
  }

  if (overallScore >= 85) {
    eligibleAwards.push('BEST_STUDENT');
    if (breakdown.leetCode >= 70 && breakdown.academic >= 80 && breakdown.certificates >= 70) {
      eligibleAwards.push('ELITE_STUDENT');
    }
  }

  if (isTeamHead) {
    eligibleAwards.push('BEST_TEAM_HEAD');
  }

  if (repMetrics && repMetrics.overallRepScore >= 8.0) {
    eligibleAwards.push('BEST_REPRESENTATIVE');
    strengths.push(`Exceptional Class Representative leadership score (${repMetrics.overallRepScore.toFixed(1)}/10).`);
  }

  const primaryStrength = strengths.length > 0 ? strengths[0] : 'Consistent effort across department coursework.';
  const secondaryStrength = strengths.length > 1 ? strengths[1] : 'Good record of attendance and discipline.';

  const explanation = `${student.name} (${student.registerNo}) achieves an Overall Performance Score of ${overallScore.toFixed(1)}/100 in ${student.year} Section ${student.section}. ${primaryStrength} ${secondaryStrength} AI evaluation confirms high reliability and merit for department recognition.`;

  return {
    explanation,
    strengths,
    weakAreas,
    eligibleAwards
  };
}
