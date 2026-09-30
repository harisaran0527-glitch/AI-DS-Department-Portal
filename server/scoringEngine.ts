import {
  StudentRecord,
  AcademicRecord,
  ArrearRecord,
  SkillEdgeRecord,
  NPTELRecord,
  AttendanceRecord,
  DisciplineRecord,
  CertificateRecord,
  ParticipationRecord,
  LeetCodeRecord,
  ProjectRecord,
  ScoringConfig,
  db
} from './db.js';

// 1. Category Score Normalization Engine (0 - 100)
export function calculateCategoryScores(
  student: StudentRecord,
  academics: AcademicRecord[],
  arrears: ArrearRecord[],
  skillEdge: SkillEdgeRecord | undefined,
  nptelList: NPTELRecord[],
  attendance: AttendanceRecord | undefined,
  disciplineList: DisciplineRecord[],
  leetcode: LeetCodeRecord | undefined,
  projects: ProjectRecord[],
  certificatesList: CertificateRecord[] = [],
  participationList: ParticipationRecord[] = []
) {
  // Academic Score (0-100)
  const rawCgpa = parseFloat((student?.cgpa ?? 0) as any) || 0;
  let academicScore = (rawCgpa / 10) * 100;
  const pendingArrears = (arrears || []).filter((a) => a.status === 'PENDING').length;
  const clearedArrears = (arrears || []).filter((a) => a.status === 'CLEARED').length;
  academicScore = Math.max(0, Math.min(100, academicScore - pendingArrears * 8 + clearedArrears * 2));

  // SkillEdge Score (0-100)
  let skillEdgeScore = 0;
  if (skillEdge && skillEdge.tracks && skillEdge.tracks.length > 0) {
    const totalLevels = skillEdge.tracks.reduce((sum, t) => sum + (t.totalLevels || 1), 0);
    const completedLevels = skillEdge.tracks.reduce((sum, t) => sum + (t.completedLevels || 0), 0);
    skillEdgeScore = totalLevels > 0 ? (completedLevels / totalLevels) * 100 : 0;
  } else if (skillEdge && skillEdge.overallCompletionPct) {
    skillEdgeScore = skillEdge.overallCompletionPct;
  }

  // NPTEL Score (0-100)
  let nptelScore = 0;
  if (nptelList && nptelList.length > 0) {
    const totalNptelScore = nptelList.reduce((sum, n) => sum + (n.finalScore || n.assignmentScore || 0), 0);
    nptelScore = Math.min(100, totalNptelScore / nptelList.length);
  }

  // Attendance Score (0-100)
  const attendanceScore = attendance?.percentage || 0;

  // Discipline Score (0-100)
  let disciplineScore = 100;
  if (disciplineList && disciplineList.length > 0) {
    disciplineScore = Math.max(0, 100 - disciplineList.length * 10);
  }

  // Participation Score (0-100)
  let participationScore = 0;
  if (participationList && participationList.length > 0) {
    const prizeCount = participationList.filter((p) => (p.position || p.achievement || '').toLowerCase().includes('1st') || (p.position || p.achievement || '').toLowerCase().includes('winner')).length;
    participationScore = Math.min(100, participationList.length * 20 + prizeCount * 15);
  }

  // Certificates Score (0-100)
  let certificatesScore = 0;
  if (certificatesList && certificatesList.length > 0) {
    certificatesScore = Math.min(100, certificatesList.length * 25);
  }

  // LeetCode Score (0-100)
  let leetCodeScore = 0;
  if (leetcode) {
    const totalSolved = leetcode.totalSolved || (leetcode.easySolved + leetcode.mediumSolved + leetcode.hardSolved);
    const solvedPoints = Math.min(60, totalSolved * 1.5);
    const ratingPoints = Math.min(40, Math.max(0, (leetcode.contestRating - 1200) * 0.1));
    leetCodeScore = Math.min(100, solvedPoints + ratingPoints);
  }

  // Projects Score (0-100)
  let projectsScore = 0;
  if (projects && projects.length > 0) {
    projectsScore = Math.min(100, projects.length * 30);
  }

  return {
    academic: Math.round(academicScore * 10) / 10,
    skillEdge: Math.round(skillEdgeScore * 10) / 10,
    nptel: Math.round(nptelScore * 10) / 10,
    attendance: Math.round(attendanceScore * 10) / 10,
    discipline: Math.round(disciplineScore * 10) / 10,
    participation: Math.round(participationScore * 10) / 10,
    certificates: Math.round(certificatesScore * 10) / 10,
    leetCode: Math.round(leetCodeScore * 10) / 10,
    projects: Math.round(projectsScore * 10) / 10
  };
}

// 2. Weighted Overall Score Calculator (0 - 100)
export function computeOverallScore(breakdown: ReturnType<typeof calculateCategoryScores>, config: ScoringConfig): number {
  const totalWeight =
    (config?.academicWeight || 25) +
    (config?.skillEdgeWeight || 15) +
    (config?.nptelWeight || 10) +
    (config?.participationWeight || 10) +
    (config?.certificatesWeight || 10) +
    (config?.attendanceWeight || 10) +
    (config?.disciplineWeight || 5) +
    (config?.leetcodeWeight || 10) +
    (config?.projectsWeight || 5);

  if (totalWeight <= 0) return 0;

  const weightedSum =
    breakdown.academic * (config?.academicWeight || 25) +
    breakdown.skillEdge * (config?.skillEdgeWeight || 15) +
    breakdown.nptel * (config?.nptelWeight || 10) +
    breakdown.participation * (config?.participationWeight || 10) +
    breakdown.certificates * (config?.certificatesWeight || 10) +
    breakdown.attendance * (config?.attendanceWeight || 10) +
    breakdown.discipline * (config?.disciplineWeight || 5) +
    breakdown.leetCode * (config?.leetcodeWeight || 10) +
    breakdown.projects * (config?.projectsWeight || 5);

  const rawScore = weightedSum / totalWeight;
  return Math.min(100, Math.round(rawScore * 10) / 10);
}

export function computeEliteScore(breakdown: ReturnType<typeof calculateCategoryScores>): number {
  const score =
    breakdown.academic * 0.35 +
    breakdown.leetCode * 0.25 +
    breakdown.skillEdge * 0.15 +
    breakdown.nptel * 0.15 +
    breakdown.certificates * 0.1;

  return Math.min(100, Math.round(score * 10) / 10);
}

export const computeEliteStudentScore = computeEliteScore;

export function computeLeetCodeAwardScore(leetcode: any): number {
  if (!leetcode) return 0;
  const totalSolved = leetcode.totalSolved || ((leetcode.easySolved || 0) + (leetcode.mediumSolved || 0) + (leetcode.hardSolved || 0));
  const rating = leetcode.contestRating || 1200;
  return Math.min(100, Math.round((totalSolved * 0.2 + (rating / 3000) * 80) * 10) / 10);
}

export async function computeTeamHeadScore(student: StudentRecord, projects: ProjectRecord[]): Promise<number> {
  const allTeams = await db.getTeams();
  const teams = allTeams.filter((t) => t.team_head_student_id === student.id);
  const teamProjects = projects.filter((p) => p.isTeam && (p.studentRole || '').toLowerCase().includes('lead'));
  const totalHeadProjects = teams.length + teamProjects.length;
  let score = totalHeadProjects * 35 + (student.cgpa / 10) * 30 + (student.overall_score || 0) * 0.35;
  return Math.min(100, Math.round(score * 10) / 10);
}

export async function computeRepresentativeScore(student: StudentRecord, attendanceScore: number): Promise<number> {
  const repEval = await db.getRepresentativeEvaluation(student.id);
  if (repEval) {
    const avgScore = (
      repEval.communication_score +
      repEval.faculty_coordination_score +
      repEval.student_coordination_score +
      repEval.attendance_followup_score +
      repEval.late_comer_monitoring_score +
      repEval.academic_updates_score +
      repEval.discipline_support_score +
      repEval.cleanliness_responsibility_score +
      repEval.notice_board_score +
      repEval.event_coordination_score +
      repEval.responsibility_completion_score
    ) / 11;
    const score = avgScore * 7 + (student.cgpa / 10) * 20 + attendanceScore * 0.1;
    return Math.min(100, Math.round(score * 10) / 10);
  }

  if (!student.is_representative && !(student as any).isRepresentative) return 0;
  const score = 50 + (student.cgpa / 10) * 30 + attendanceScore * 0.2;
  return Math.min(100, Math.round(score * 10) / 10);
}

// Generate Top Maximum 2 Shortlisted Students for Ranking
export async function generateTop2Shortlist(students: StudentRecord[], scoringConfig: ScoringConfig) {
  const evaluated = [];
  for (const s of students) {
    const full360 = await db.getStudent360(s.id);
    if (!full360) {
      evaluated.push({
        student: s,
        overallScore: s.overall_score || 0,
        categoryScores: { academic: 0, skillEdge: 0, nptel: 0, participation: 0, certificates: 0, attendance: 0, discipline: 100, leetCode: 0, projects: 0 }
      });
      continue;
    }
    const catScores = calculateCategoryScores(
      full360.student as any,
      full360.academics,
      full360.arrears,
      full360.skillEdge,
      full360.nptel,
      full360.attendance,
      full360.discipline,
      full360.leetcode,
      full360.projects,
      full360.certificates,
      full360.participation
    );
    const overall = computeOverallScore(catScores, scoringConfig);
    evaluated.push({
      student: s,
      overallScore: overall,
      categoryScores: catScores,
      full360
    });
  }

  evaluated.sort((a, b) => b.overallScore - a.overallScore);

  // Return a maximum of 2 shortlisted students
  return evaluated.slice(0, 2);
}

// Generate Single Winner Candidate from Top 2 Shortlist
export function generateFinalCandidateRecommendation(shortlisted: any[]) {
  if (!shortlisted || shortlisted.length === 0) return null;

  const winner = shortlisted[0];
  const runnerUp = shortlisted.length > 1 ? shortlisted[1] : null;

  const winnerCats = winner.categoryScores || winner.breakdown || {};
  const runnerCats = runnerUp ? (runnerUp.categoryScores || runnerUp.breakdown || {}) : {};

  let explanation = '';
  if (runnerUp) {
    const diff = (winner.overallScore - runnerUp.overallScore).toFixed(1);
    explanation = `Recommended as the Final Best Student Candidate because ${winner.student.name} (${winner.student.register_no || winner.student.registerNo}) scored ${winner.overallScore}/100 outperforming runner-up ${runnerUp.student.name} (${runnerUp.student.register_no || runnerUp.student.registerNo}, ${runnerUp.overallScore}/100) by +${diff} points across academic consistency (${winnerCats.academic || 0} vs ${runnerCats.academic || 0}), SkillEdge completion (${winnerCats.skillEdge || 0}% vs ${runnerCats.skillEdge || 0}%), and Attendance (${winnerCats.attendance || 0}% vs ${runnerCats.attendance || 0}%).`;
  } else {
    explanation = `Recommended as the Final Best Student Candidate because ${winner.student.name} (${winner.student.register_no || winner.student.registerNo}) holds top performance metrics with an overall score of ${winner.overallScore}/100 and CGPA of ${(winner.student.cgpa || 0).toFixed(2)}.`;
  }

  return {
    student: winner.student,
    overallScore: winner.overallScore,
    categoryScores: winnerCats,
    rank: 1,
    runnerUp: runnerUp ? { student: runnerUp.student, overallScore: runnerUp.overallScore } : null,
    explanation,
    isAIGenerated: false // Label: Data-Driven Analysis
  };
}

export function generateAIExplanation(awardKey: string, student: StudentRecord, breakdown: any, score: number, leetcode?: LeetCodeRecord) {
  let explanation = '';

  if (awardKey === 'BEST_STUDENT') {
    explanation = `Recommended because ${student.name} (${student.register_no || student.registerNo}) ranks top in overall department metrics with score ${score.toFixed(1)}/100, CGPA: ${student.cgpa.toFixed(2)}, SkillEdge: ${breakdown.skillEdge}%, and Attendance: ${breakdown.attendance}%. [Data-Driven Analysis]`;
  } else if (awardKey === 'BEST_LEETCODE') {
    explanation = `Recommended because ${student.name} (${student.register_no || student.registerNo}) demonstrates top algorithmic problem-solving: ${leetcode?.totalSolved || 0} Total Solved (Easy: ${leetcode?.easySolved || 0}, Med: ${leetcode?.mediumSolved || 0}, Hard: ${leetcode?.hardSolved || 0}) with Contest Rating of ${leetcode?.contestRating || 1200}. [Data-Driven Analysis]`;
  } else if (awardKey === 'ELITE_STUDENT') {
    explanation = `Recommended because ${student.name} (${student.register_no || student.registerNo}) exhibits balanced excellence across Academics (${student.cgpa.toFixed(2)} CGPA), LeetCode (${breakdown.leetCode}), SkillEdge (${breakdown.skillEdge}%), and Projects (${breakdown.projects}). [Data-Driven Analysis]`;
  } else {
    explanation = `Recommended because ${student.name} (${student.register_no || student.registerNo}) achieves top performance metrics across department evaluation modules. [Data-Driven Analysis]`;
  }

  return explanation;
}
