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
} from './db';

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
    const sumScores = nptelList.reduce((sum, n) => sum + (n.finalScore || 0), 0);
    const avgScore = sumScores / nptelList.length;
    const certifiedCount = nptelList.filter((n) => n.status === 'Certified' || n.status === 'Completed').length;
    nptelScore = Math.min(100, avgScore + certifiedCount * 5);
  }

  // Participation Score (0-100)
  const participationScore = Math.min(100, (participationList ? participationList.length : 0) * 25);

  // Certificate Score (0-100)
  const certificateScore = Math.min(100, (certificatesList ? certificatesList.length : 0) * 25);

  // Attendance Score (0-100)
  const attendanceScore = attendance ? Math.min(100, Math.max(0, attendance.percentage)) : 85;

  // Discipline Score (0-100)
  const totalFines = (disciplineList || []).reduce((sum, d) => sum + ((d as any).fine_amount || (d as any).fineAmount || 0), 0);
  const disciplineDeductions = (disciplineList || []).length * 5 + totalFines * 0.5;
  const disciplineScore = Math.max(0, 100 - disciplineDeductions);

  // LeetCode Multi-Metric Score (0-100)
  let leetcodeScore = 0;
  if (leetcode) {
    const easyPts = (leetcode.easySolved || 0) * 0.3;
    const medPts = (leetcode.mediumSolved || 0) * 1.5;
    const hardPts = (leetcode.hardSolved || 0) * 3.5;
    const ratingPts = (leetcode.contestRating || 1200) > 1200 ? ((leetcode.contestRating || 1200) - 1200) * 0.08 : 0;
    const streakPts = (leetcode.streakDays || 0) * 0.5;

    leetcodeScore = Math.min(100, Math.max(0, easyPts + medPts + hardPts + ratingPts + streakPts));
  }

  // Projects Score (0-100)
  let projectScore = 0;
  (projects || []).forEach((prj) => {
    let pts = prj.status === 'Completed' ? 35 : 15;
    if (prj.prizeAwarded) pts += 20;
    if (prj.githubUrl || (prj as any).live_url) pts += 10;
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

export function computeOverallScore(breakdown: any, config: ScoringConfig): number {
  const weightedSum =
    breakdown.academic * (config.academicWeight / 100) +
    breakdown.skillEdge * (config.skillEdgeWeight / 100) +
    breakdown.nptel * (config.nptelWeight / 100) +
    breakdown.participation * (config.participationWeight / 100) +
    breakdown.certificates * (config.certificatesWeight / 100) +
    breakdown.attendance * (config.attendanceWeight / 100) +
    breakdown.discipline * (config.disciplineWeight / 100) +
    breakdown.leetCode * ((config.leetcodeWeight || 10) / 100) +
    breakdown.projects * (config.projectsWeight / 100);

  return Math.round(weightedSum * 10) / 10;
}

// Award candidate helper scores
export function computeLeetCodeAwardScore(leetcode?: LeetCodeRecord): number {
  if (!leetcode) return 0;
  const raw =
    (leetcode.easySolved || 0) * 0.3 +
    (leetcode.mediumSolved || 0) * 1.5 +
    (leetcode.hardSolved || 0) * 3.5 +
    ((leetcode.contestRating || 1200) > 1200 ? ((leetcode.contestRating || 1200) - 1200) * 0.1 : 0) +
    (leetcode.streakDays || 0) * 0.5;

  return Math.min(100, Math.round(raw * 10) / 10);
}

export function computeEliteStudentScore(breakdown: any): number {
  const score =
    breakdown.academic * 0.25 +
    breakdown.leetCode * 0.2 +
    breakdown.skillEdge * 0.15 +
    breakdown.projects * 0.15 +
    breakdown.nptel * 0.15 +
    breakdown.certificates * 0.1;

  return Math.min(100, Math.round(score * 10) / 10);
}

export function computeTeamHeadScore(student: StudentRecord, projects: ProjectRecord[]): number {
  const teams = db.getTeams().filter((t) => t.team_head_student_id === student.id);
  const teamProjects = projects.filter((p) => p.isTeam && (p.studentRole || '').toLowerCase().includes('lead'));
  const totalHeadProjects = teams.length + teamProjects.length;
  let score = totalHeadProjects * 35 + (student.cgpa / 10) * 30 + (student.overall_score || 0) * 0.35;
  return Math.min(100, Math.round(score * 10) / 10);
}

export function computeRepresentativeScore(student: StudentRecord, attendanceScore: number): number {
  const repEval = db.getRepresentativeEvaluation(student.id);
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

  if (!student.isRepresentative) return 0;
  const score = 50 + (student.cgpa / 10) * 30 + attendanceScore * 0.2;
  return Math.min(100, Math.round(score * 10) / 10);
}

// Generate Top Maximum 2 Shortlisted Students for Ranking
export function generateTop2Shortlist(students: StudentRecord[], scoringConfig: ScoringConfig) {
  const evaluated = students.map((s) => {
    const full360 = db.getStudent360(s.id);
    if (!full360) {
      return {
        student: s,
        overallScore: s.overall_score || 0,
        categoryScores: { academic: 0, skillEdge: 0, nptel: 0, participation: 0, certificates: 0, attendance: 0, discipline: 100, leetCode: 0, projects: 0 }
      };
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
    return {
      student: s,
      overallScore: overall,
      categoryScores: catScores,
      full360
    };
  });

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
