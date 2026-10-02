export type Role = 'STUDENT' | 'FACULTY' | 'HOD' | 'ADMIN';

export type AcademicYear = '1st Year' | '2nd Year' | '3rd Year' | '4th Year';
export type Section = 'A' | 'B' | 'C';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: Role;
  registerNo?: string;
  year?: AcademicYear;
  section?: Section;
  facultyRole?: 'Class Coordinator' | 'Faculty';
  assignedYear?: AcademicYear;
  assignedSection?: Section;
}

export interface FacultyAssignment {
  id: string;
  facultyId: string;
  facultyName: string;
  email: string;
  department: string; // 'AI & DS'
  year: AcademicYear;
  section: Section;
  role: 'Class Coordinator' | 'Faculty';
  portalPasswordHash: string; // hashed password, never plain text or Gmail pass
  isActive: boolean;
}

export interface Student {
  id: string;
  registerNo: string;
  register_no?: string;
  name: string;
  email: string;
  collegeEmail?: string;
  personalEmail?: string;
  personal_email?: string;
  department: string; // 'AI & DS'
  year: AcademicYear;
  section: Section;
  batch: string; // e.g. "2023-2027"
  classCoordinatorName: string;
  cgpa: number;
  overallScore: number;
  currentRank: number;
  avatarUrl?: string;
  portalPasswordHash?: string;
  isRepresentative?: boolean;
  entryType?: 'Regular' | 'Lateral Entry';
  entry_type?: 'Regular' | 'Lateral Entry';
  linkedinUrl?: string;
  linkedin_url?: string;
  githubUrl?: string;
  github_url?: string;
  mobileNumber?: string;
  mobile_number?: string;
  address?: string;
  isActive?: boolean;
}

export interface AcademicSemester {
  id: string;
  studentId: string;
  semesterNo: number; // 1 to 8
  sgpa: number;
  cgpa: number;
  totalCredits: number;
  subjects: {
    code: string;
    name: string;
    grade: string;
    result: 'PASS' | 'FAIL';
  }[];
}

export interface ArrearRecord {
  id: string;
  studentId: string;
  semesterNo: number;
  subjectCode: string;
  subjectName: string;
  status: 'PENDING' | 'CLEARED';
  createdDate: string;
  clearedDate?: string;
}

export interface SkillEdgeTrack {
  courseName: 'C Programming' | 'Python' | 'C++' | 'Java' | 'Data Science';
  totalLevels: number;
  completedLevels: number;
  rewardPoints: number;
  status: 'In Progress' | 'Completed';
}

export interface SkillEdgeRecord {
  id: string;
  studentId: string;
  tracks: SkillEdgeTrack[];
  overallCompletionPct: number;
  totalRewardPoints: number;
  previousPoints?: number;
  earnedDelta?: number;
  status?: string;
  skilledgeHandle?: string;
  lastSyncedAt?: string;
}

export interface SkillEdgeSyncHistoryItem {
  id: string;
  student_id: string;
  previousPoints: number;
  currentPoints: number;
  earnedDelta: number;
  overallCompletionPct: number;
  tracks: SkillEdgeTrack[];
  syncedAt: string;
  syncSource: 'DAILY_AUTO' | 'MANUAL_FACULTY' | 'MANUAL_HOD';
  status: 'SUCCESS' | 'FAILED' | 'NOT_LINKED';
  errorMessage?: string;
}

export interface NPTELCourse {
  id: string;
  studentId: string;
  courseName: string;
  durationWeeks: number;
  weeksCompleted: number;
  assignmentScore: number; // out of 100
  examScore?: number;
  finalScore: number;
  status: 'In Progress' | 'Completed' | 'Certified';
}

export interface ParticipationRecord {
  id: string;
  studentId?: string;
  student_id?: string;
  eventName: string;
  eventType: string;
  category?: string;
  eventLevel?: string;
  organizer: string;
  collegeName?: string;
  date: string;
  isTeam?: boolean;
  position?: string;
  achievement?: string;
  prizeAmount?: string;
  certificateRef?: string;
  description?: string;
  proofFilePath?: string;
  file_path?: string;
  filePath?: string;
  originalFileName?: string;
  original_file_name?: string;
  uploadedAt?: string;
  uploaded_at?: string;
}

export interface CertificateRecord {
  id: string;
  studentId: string;
  courseName: string;
  platform: 'NPTEL' | 'Cisco' | 'Google' | 'IBM' | 'Infosys' | 'Coursera' | 'Great Learning' | 'Other';
  category: string;
  issueDate: string;
  certificateId?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  odDays: number; // On-Duty
  mlDays: number; // Medical Leave
  percentage: number; // auto-calculated
  lastUpdated: string;
  historyLogs?: {
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'OD' | 'ML' | 'LONG_ABSENT';
    remark?: string;
  }[];
}

export interface DisciplineRecord {
  id: string;
  studentId: string;
  date: string;
  category: 'Late Comer' | 'Dress Code' | 'ID Card' | 'Haircut / Grooming' | 'Behaviour' | 'Classroom Discipline' | 'Remarks';
  remark: string;
  warningAction: string;
  recordedBy: string;
}

export interface LeetCodeStats {
  id: string;
  studentId: string;
  username: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  contestRating: number;
  contestsAttended: number;
  streakDays: number;
  lastUpdated: string;
}

export interface ProjectRecord {
  id: string;
  studentId: string;
  title: string;
  description: string;
  domain: string; // AI, Machine Learning, Web Dev, IoT, Data Science
  techStack: string[];
  isTeam: boolean;
  teamMembers?: string[];
  studentRole: string;
  githubUrl?: string;
  demoUrl?: string;
  category: 'Mini Project' | 'Main Project' | 'Hackathon Project' | 'Research Project';
  status: 'Planning' | 'In Progress' | 'Completed';
  prizeAwarded?: string;
}

export interface AchievementRecord {
  id: string;
  studentId: string;
  title: string;
  category: string;
  event: string;
  date: string;
  position: string;
  description: string;
}

export interface TeamRecord {
  id: string;
  teamName: string;
  teamHeadStudentId: string;
  teamMembersStudentIds: string[];
  projectTitle: string;
  score: number;
}

export interface RepresentativeMetrics {
  id: string;
  studentId: string;
  communicationRating: number; // 1-10
  coordinationRating: number; // 1-10
  attendanceFollowupRating: number; // 1-10
  lateComerMonitoringRating: number; // 1-10
  classroomDisciplineRating: number; // 1-10
  facultyRating: number; // 1-10
  overallRepScore: number;
}

export interface ScoringConfig {
  academicWeight: number; // default 25
  skillEdgeWeight: number; // default 15
  nptelWeight: number; // default 10
  participationWeight: number; // default 10
  certificatesWeight: number; // default 10
  attendanceWeight: number; // default 10
  disciplineWeight: number; // default 5
  leetcodeWeight: number; // default 10
  projectsWeight: number; // default 5
}

export interface CategoryBreakdown {
  academic: number;
  skillEdge: number;
  nptel: number;
  participation: number;
  certificates: number;
  attendance: number;
  discipline: number;
  leetCode: number;
  projects: number;
}

export interface StudentScoreBreakdown {
  studentId: string;
  overallScore: number;
  categoryScores: CategoryBreakdown;
  rank: number;
  aiExplanation: string;
  strengths: string[];
  weakAreas: string[];
  eligibleAwards: string[];
}

export interface FinalizedAward {
  id: string;
  awardKey: 'BEST_STUDENT' | 'BEST_LEETCODE' | 'ELITE_STUDENT' | 'BEST_TEAM_HEAD' | 'BEST_REPRESENTATIVE';
  awardTitle: string;
  winnerStudentId: string;
  winnerStudentName: string;
  registerNo: string;
  year: AcademicYear;
  section: Section;
  overallScore: number;
  finalizedAt: string;
  finalizedByHODName: string;
  aiExplanation: string;
}

export interface TeamHeadMember {
  id: string;
  registerNo: string;
  name: string;
  year: AcademicYear;
  section: Section;
  department: string;
  email: string;
  personalEmail?: string;
}

export interface TeamHead {
  id: string;
  facultyId: string;
  headStudentId: string;
  headName: string;
  headRegisterNo: string;
  headYear: AcademicYear;
  headSection: Section;
  memberLimit: number;
  addedCount: number;
  remainingSlots: number;
  teamStatus: string;
  members: TeamHeadMember[];
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  subjectCode: string;
  subjectName: string;
  department: string;
  academicYear: string;
  year: string;
  semester: number;
  section: string;
  subjectType: 'Theory' | 'Practical' | 'Elective';
  credits: number;
  facultyHandler: string;
  createdByUserId?: string;
  createdAt?: string;
  subject_code?: string;
  subject_name?: string;
  academic_year?: string;
  subject_type?: 'Theory' | 'Practical' | 'Elective';
  faculty_handler?: string;
}


