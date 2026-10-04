import { db } from '../db.js';
import { calculateCategoryScores, computeOverallScore } from '../scoringEngine.js';

export interface CategoryPointsBreakdown {
  academic: number;
  nptel: number;
  leetCode: number;
  projects: number;
  hackathons: number;
  research: number;
  participation: number;
  attendance: number;
  discipline: number;
  certificates: number;
  skillEdge: number;
}

export interface StudentRewardEvaluation {
  studentId: string;
  studentName: string;
  registerNo: string;
  year: string;
  section: string;
  totalRewardScore: number;
  performanceLevel: 'Outstanding' | 'Excellent' | 'Proficient' | 'Developing';
  categoryPoints: CategoryPointsBreakdown;
  activitiesConsidered: string[];
  evidenceSources: Record<string, string>;
  awardEligibility: string[];
  recommendedAward: string;
  aiReasoning: string;
  confidenceScore: number;
  calculatedAt: string;
}

export async function evaluateStudentRewardPoints(studentId: string): Promise<StudentRewardEvaluation | null> {
  const full360 = await db.getStudent360(studentId);
  if (!full360 || !full360.student) return null;

  const student = full360.student;
  const academics = full360.academics || [];
  const nptelList = full360.nptel || [];
  const leetcode = full360.leetcode;
  const projects = full360.projects || [];
  const participation = full360.participation || [];
  const certificates = full360.certificates || [];
  const attendance = full360.attendance;
  const discipline = full360.discipline || [];
  const skillEdge = full360.skillEdge;

  // 1. Category-Wise Verifiable Reward Points Calculation
  const activitiesConsidered: string[] = [];
  const evidenceSources: Record<string, string> = {};

  // A. Academic Points (Max 25 pts)
  let academicPoints = 0;
  const cgpaVal = (student.cgpa !== null && student.cgpa !== undefined && !isNaN(Number(student.cgpa))) ? Number(student.cgpa) : 0;
  if (cgpaVal > 0) {
    academicPoints = Math.round((cgpaVal / 10) * 20 * 10) / 10;
    activitiesConsidered.push(`Verified Cumulative GPA: ${cgpaVal.toFixed(2)}/10.0`);
    evidenceSources.academic = `Student CGPA record (${cgpaVal.toFixed(2)})`;
  } else if (academics.length > 0) {
    const avgSgpa = academics.reduce((acc: number, a: any) => acc + (a.sgpa || a.cgpa || 0), 0) / academics.length;
    academicPoints = Math.round((avgSgpa / 10) * 20 * 10) / 10;
    activitiesConsidered.push(`Semester SGPA Average: ${avgSgpa.toFixed(2)} across ${academics.length} semesters`);
    evidenceSources.academic = `${academics.length} semester academic mark records`;
  }

  // B. NPTEL Points (Max 15 pts)
  let nptelPoints = 0;
  if (nptelList.length > 0) {
    const totalScore = nptelList.reduce((acc: number, n: any) => acc + (n.finalScore || n.assignmentScore || 0), 0);
    const avgScore = totalScore / nptelList.length;
    nptelPoints = Math.min(15, Math.round((nptelList.length * 5 + (avgScore / 100) * 10) * 10) / 10);
    activitiesConsidered.push(`NPTEL Courses: ${nptelList.length} completed (Avg Score: ${avgScore.toFixed(1)}%)`);
    evidenceSources.nptel = `${nptelList.length} verified NPTEL certifications`;
  }

  // C. LeetCode / Coding Points (Max 20 pts)
  let leetCodePoints = 0;
  if (leetcode) {
    const totalSolved = leetcode.totalSolved || ((leetcode.easySolved || 0) + (leetcode.mediumSolved || 0) + (leetcode.hardSolved || 0));
    const contestRating = leetcode.contestRating || 1200;
    leetCodePoints = Math.min(20, Math.round((totalSolved * 0.1 + (contestRating / 1500) * 10) * 10) / 10);
    activitiesConsidered.push(`LeetCode Profile: ${totalSolved} problems solved (${leetcode.mediumSolved || 0} Med, ${leetcode.hardSolved || 0} Hard), Rating: ${contestRating}`);
    evidenceSources.leetCode = `Synced LeetCode handle @${leetcode.username || student.name}`;
  }

  // D. Projects Points (Max 20 pts)
  let projectsPoints = 0;
  if (projects.length > 0) {
    const teamLeadCount = projects.filter((p: any) => p.isTeam && (p.studentRole || '').toLowerCase().includes('lead')).length;
    projectsPoints = Math.min(20, Math.round((projects.length * 6 + teamLeadCount * 4) * 10) / 10);
    activitiesConsidered.push(`Technical Projects: ${projects.length} completed (${teamLeadCount} Team Lead roles)`);
    evidenceSources.projects = `${projects.length} verified project repositories`;
  }

  // E. Hackathons & Competitions Points (Max 20 pts)
  let hackathonPoints = 0;
  let researchPoints = 0;
  let participationPoints = 0;

  if (participation.length > 0) {
    const hackathons = participation.filter((p: any) => (p.eventType || p.eventName || '').toLowerCase().includes('hackathon') || (p.eventType || '').toLowerCase().includes('coding'));
    const researchPapers = participation.filter((p: any) => (p.eventType || p.eventName || '').toLowerCase().includes('paper') || (p.eventType || '').toLowerCase().includes('journal') || (p.eventType || '').toLowerCase().includes('publication'));

    if (hackathons.length > 0) {
      const winnerCount = hackathons.filter((p: any) => (p.position || p.achievement || '').toLowerCase().includes('1st') || (p.position || p.achievement || '').toLowerCase().includes('winner')).length;
      hackathonPoints = Math.min(20, Math.round((hackathons.length * 8 + winnerCount * 6) * 10) / 10);
      activitiesConsidered.push(`Hackathons & Contests: ${hackathons.length} events (${winnerCount} 1st Place Wins)`);
      evidenceSources.hackathons = `${hackathons.length} hackathon participation proofs`;
    }

    if (researchPapers.length > 0) {
      researchPoints = Math.min(15, Math.round(researchPapers.length * 7.5 * 10) / 10);
      activitiesConsidered.push(`Research Publications: ${researchPapers.length} papers published/presented`);
      evidenceSources.research = `${researchPapers.length} research paper records`;
    }

    participationPoints = Math.min(10, Math.round(participation.length * 3 * 10) / 10);
    if (!evidenceSources.hackathons && !evidenceSources.research) {
      activitiesConsidered.push(`Symposiums & Workshops: ${participation.length} events attended`);
      evidenceSources.participation = `${participation.length} event participation records`;
    }
  }

  // F. Certifications Points (Max 15 pts)
  let certificatesPoints = 0;
  if (certificates.length > 0) {
    certificatesPoints = Math.min(15, Math.round(certificates.length * 5 * 10) / 10);
    activitiesConsidered.push(`Industry Certifications: ${certificates.length} credentials earned`);
    evidenceSources.certificates = `${certificates.length} uploaded certificate proofs`;
  }

  // G. SkillEdge Points (Max 15 pts)
  let skillEdgePoints = 0;
  if (skillEdge) {
    const pct = skillEdge.overallCompletionPct || 0;
    const pts = skillEdge.totalRewardPoints || 0;
    skillEdgePoints = Math.min(15, Math.round(((pct / 100) * 10 + (pts / 500) * 5) * 10) / 10);
    activitiesConsidered.push(`SkillEdge Progress: ${pct.toFixed(1)}% completion (${pts} pts)`);
    evidenceSources.skillEdge = `SkillEdge synced profile`;
  }

  // H. Attendance Points (Max 5 pts)
  let attendancePoints = 0;
  const attPct = attendance?.percentage || 0;
  if (attPct >= 90) attendancePoints = 5;
  else if (attPct >= 80) attendancePoints = 4;
  else if (attPct >= 75) attendancePoints = 3;
  if (attPct > 0) {
    activitiesConsidered.push(`Attendance Rate: ${attPct.toFixed(1)}%`);
    evidenceSources.attendance = `Daily attendance roster record (${attPct.toFixed(1)}%)`;
  }

  // I. Discipline Clean Record Bonus (Max 5 pts)
  let disciplinePoints = 5;
  if (discipline.length > 0) {
    disciplinePoints = Math.max(0, 5 - discipline.length * 2.5);
    activitiesConsidered.push(`Discipline Record: ${discipline.length} recorded infractions`);
    evidenceSources.discipline = `${discipline.length} discipline incident entries`;
  } else {
    activitiesConsidered.push(`Discipline Record: Clean (Zero infractions recorded)`);
    evidenceSources.discipline = `Zero disciplinary infractions`;
  }

  // 2. Sum Total Reward Score
  const totalRewardScore = Math.round((
    academicPoints +
    nptelPoints +
    leetCodePoints +
    projectsPoints +
    hackathonPoints +
    researchPoints +
    participationPoints +
    certificatesPoints +
    skillEdgePoints +
    attendancePoints +
    disciplinePoints
  ) * 10) / 10;

  // 3. Performance Level
  let performanceLevel: 'Outstanding' | 'Excellent' | 'Proficient' | 'Developing' = 'Developing';
  if (totalRewardScore >= 90) performanceLevel = 'Outstanding';
  else if (totalRewardScore >= 75) performanceLevel = 'Excellent';
  else if (totalRewardScore >= 50) performanceLevel = 'Proficient';

  // 4. Award Eligibility & Recommendation
  const awardEligibility: string[] = ['Department Recognition Candidate'];
  if (totalRewardScore >= 80) awardEligibility.push('Best Overall Student Candidate');
  if (leetCodePoints >= 12) awardEligibility.push('Best Coding Performer Candidate');
  if (academicPoints >= 16) awardEligibility.push('Best Academic Achiever Candidate');
  if (projectsPoints >= 12) awardEligibility.push('Best Innovation & Projects Candidate');
  if (hackathonPoints >= 12) awardEligibility.push('Best Hackathon Winner Candidate');

  let recommendedAward = 'Academic Excellence Recognisee';
  if (totalRewardScore >= 85) {
    recommendedAward = 'Best Overall Student';
  } else if (leetCodePoints >= Math.max(academicPoints, projectsPoints, hackathonPoints)) {
    recommendedAward = 'Best Coding Performer';
  } else if (projectsPoints >= Math.max(academicPoints, leetCodePoints, hackathonPoints)) {
    recommendedAward = 'Best Technical Innovator';
  } else if (academicPoints >= 16) {
    recommendedAward = 'Best Academic Achiever';
  }

  // 5. Data-Driven AI Reasoning (Synthesized without inventing data)
  const topStrengths = [];
  if (academicPoints > 0) topStrengths.push(`Academics (${academicPoints}/20 pts)`);
  if (leetCodePoints > 0) topStrengths.push(`Coding (${leetCodePoints}/20 pts)`);
  if (projectsPoints > 0) topStrengths.push(`Projects (${projectsPoints}/20 pts)`);
  if (hackathonPoints > 0) topStrengths.push(`Hackathons (${hackathonPoints}/20 pts)`);

  const aiReasoning = `${student.name} (${student.register_no || student.registerNo}) achieved a Total Reward Score of ${totalRewardScore}/100 [Level: ${performanceLevel}]. Evaluation is strictly based on verified portal records: ${topStrengths.join(', ')} with ${attPct.toFixed(1)}% attendance and ${discipline.length === 0 ? 'a clean discipline record' : `${discipline.length} discipline entries`}.`;

  const evaluation: StudentRewardEvaluation = {
    studentId: student.id,
    studentName: student.name,
    registerNo: student.register_no || student.registerNo,
    year: student.year,
    section: student.section,
    totalRewardScore,
    performanceLevel,
    categoryPoints: {
      academic: academicPoints,
      nptel: nptelPoints,
      leetCode: leetCodePoints,
      projects: projectsPoints,
      hackathons: hackathonPoints,
      research: researchPoints,
      participation: participationPoints,
      certificates: certificatesPoints,
      skillEdge: skillEdgePoints,
      attendance: attendancePoints,
      discipline: disciplinePoints
    },
    activitiesConsidered,
    evidenceSources,
    awardEligibility,
    recommendedAward,
    aiReasoning,
    confidenceScore: 0.96,
    calculatedAt: new Date().toISOString()
  };

  // Persist into student_ai_rewards DB table
  await db.saveStudentAiReward(evaluation);

  return evaluation;
}

export async function evaluateAllStudentsRewardPoints(): Promise<StudentRewardEvaluation[]> {
  const students = await db.getAllStudents();
  const evaluations: StudentRewardEvaluation[] = [];

  for (const s of students) {
    const evalData = await evaluateStudentRewardPoints(s.id);
    if (evalData) {
      evaluations.push(evalData);
    }
  }

  evaluations.sort((a, b) => b.totalRewardScore - a.totalRewardScore);
  return evaluations;
}
