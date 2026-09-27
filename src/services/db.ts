import type {
  UserSession,
  FacultyAssignment,
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
  AchievementRecord,
  RepresentativeMetrics,
  ScoringConfig,
  FinalizedAward,
  StudentScoreBreakdown,
  AcademicYear,
  Section
} from '../types';
import {
  DEFAULT_SCORING_CONFIG,
  calculateCategoryScores,
  computeOverallScore,
  generateAIExplanation
} from './scoringEngine';
import { hashPassword, verifyPassword } from '../utils/crypto';

// Local Storage Keys
const KEYS = {
  ADMIN_ACCOUNT: 'aids_secure_admin_v2',
  HOD_ACCOUNT: 'aids_secure_hod_v2',
  FACULTY_ASSIGNMENTS: 'aids_secure_faculty_v2',
  STUDENTS: 'aids_secure_students_v2',
  ACADEMICS: 'aids_secure_academics_v2',
  ARREARS: 'aids_secure_arrears_v2',
  SKILLEDGE: 'aids_secure_skilledge_v2',
  NPTEL: 'aids_secure_nptel_v2',
  PARTICIPATION: 'aids_secure_participation_v2',
  CERTIFICATES: 'aids_secure_certificates_v2',
  ATTENDANCE: 'aids_secure_attendance_v2',
  DISCIPLINE: 'aids_secure_discipline_v2',
  LEETCODE: 'aids_secure_leetcode_v2',
  PROJECTS: 'aids_secure_projects_v2',
  ACHIEVEMENTS: 'aids_secure_achievements_v2',
  TEAMS: 'aids_secure_teams_v2',
  REP_METRICS: 'aids_secure_rep_metrics_v2',
  SCORING_CONFIG: 'aids_secure_scoring_config_v2',
  FINALIZED_AWARDS: 'aids_secure_finalized_awards_v2',
  LOGIN_ATTEMPTS: 'aids_secure_login_attempts_v2'
};

interface LoginAttemptTracker {
  count: number;
  lockedUntil?: number;
}

export class DBService {
  private static getItem<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.error(`Error reading ${key} from localStorage`, e);
      return defaultValue;
    }
  }

  private static setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new Event('aids_db_updated'));
    } catch (e) {
      console.error(`Error writing ${key} to localStorage`, e);
    }
  }

  // Initializing Clean Database with zero fake or hardcoded example records
  public static async initialize(): Promise<void> {
    if (!localStorage.getItem(KEYS.SCORING_CONFIG)) {
      this.setItem(KEYS.SCORING_CONFIG, DEFAULT_SCORING_CONFIG);
    }

    if (!localStorage.getItem(KEYS.FACULTY_ASSIGNMENTS)) {
      this.setItem(KEYS.FACULTY_ASSIGNMENTS, []);
    }

    if (!localStorage.getItem(KEYS.STUDENTS)) {
      this.setItem(KEYS.STUDENTS, []);
    }

    if (!localStorage.getItem(KEYS.FINALIZED_AWARDS)) {
      this.setItem(KEYS.FINALIZED_AWARDS, []);
    }

    // Default hashed password setup for Admin and HOD system accounts
    if (!localStorage.getItem(KEYS.ADMIN_ACCOUNT)) {
      const adminHash = await hashPassword('admin123');
      this.setItem(KEYS.ADMIN_ACCOUNT, {
        id: 'sys-admin-1',
        name: 'System Administrator',
        email: 'admin@aids.edu',
        passwordHash: adminHash
      });
    }

    if (!localStorage.getItem(KEYS.HOD_ACCOUNT)) {
      const hodHash = await hashPassword('hod123');
      this.setItem(KEYS.HOD_ACCOUNT, {
        id: 'sys-hod-1',
        name: 'Head of Department',
        email: 'hod@aids.edu',
        passwordHash: hodHash
      });
    }
  }

  // --- Rate Limiting & Account Enumeration Defense ---
  private static checkRateLimit(cleanId: string): boolean {
    const attempts = this.getItem<Record<string, LoginAttemptTracker>>(KEYS.LOGIN_ATTEMPTS, {});
    const record = attempts[cleanId];
    if (record && record.lockedUntil && Date.now() < record.lockedUntil) {
      return false; // Locked out
    }
    return true;
  }

  private static recordFailedAttempt(cleanId: string): void {
    const attempts = this.getItem<Record<string, LoginAttemptTracker>>(KEYS.LOGIN_ATTEMPTS, {});
    const current = attempts[cleanId] || { count: 0 };
    current.count += 1;
    if (current.count >= 5) {
      current.lockedUntil = Date.now() + 5 * 60 * 1000; // 5 minute lockout
    }
    attempts[cleanId] = current;
    this.setItem(KEYS.LOGIN_ATTEMPTS, attempts);
  }

  private static clearFailedAttempt(cleanId: string): void {
    const attempts = this.getItem<Record<string, LoginAttemptTracker>>(KEYS.LOGIN_ATTEMPTS, {});
    delete attempts[cleanId];
    this.setItem(KEYS.LOGIN_ATTEMPTS, attempts);
  }

  // --- Secure Authentication Service ---
  public static async authenticateUser(identifier: string, pass: string, expectedRole: string): Promise<UserSession | null> {
    await this.initialize();
    const cleanId = identifier.trim().toLowerCase();

    if (!this.checkRateLimit(cleanId)) {
      throw new Error('Account temporarily locked due to repeated failed attempts. Please try again in 5 minutes.');
    }

    if (expectedRole === 'ADMIN') {
      const adminAcc = this.getItem<{ id: string; name: string; email: string; passwordHash: string }>(KEYS.ADMIN_ACCOUNT, null as any);
      if (adminAcc && (cleanId === 'admin' || cleanId === adminAcc.email.toLowerCase())) {
        const isMatch = await verifyPassword(pass, adminAcc.passwordHash);
        if (isMatch) {
          this.clearFailedAttempt(cleanId);
          return { id: adminAcc.id, name: adminAcc.name, email: adminAcc.email, role: 'ADMIN' };
        }
      }
      this.recordFailedAttempt(cleanId);
      return null;
    }

    if (expectedRole === 'HOD') {
      const hodAcc = this.getItem<{ id: string; name: string; email: string; passwordHash: string }>(KEYS.HOD_ACCOUNT, null as any);
      if (hodAcc && (cleanId === 'hod' || cleanId === hodAcc.email.toLowerCase())) {
        const isMatch = await verifyPassword(pass, hodAcc.passwordHash);
        if (isMatch) {
          this.clearFailedAttempt(cleanId);
          return { id: hodAcc.id, name: hodAcc.name, email: hodAcc.email, role: 'HOD' };
        }
      }
      this.recordFailedAttempt(cleanId);
      return null;
    }

    if (expectedRole === 'FACULTY') {
      const facultyList = this.getItem<FacultyAssignment[]>(KEYS.FACULTY_ASSIGNMENTS, []);
      const match = facultyList.find(
        (f) => f.isActive && (f.email.toLowerCase() === cleanId || f.facultyId.toLowerCase() === cleanId)
      );

      if (match) {
        const isMatch = await verifyPassword(pass, match.portalPasswordHash);
        if (isMatch) {
          this.clearFailedAttempt(cleanId);
          return {
            id: match.id,
            name: match.facultyName,
            email: match.email,
            role: 'FACULTY',
            assignedYear: match.year,
            assignedSection: match.section,
            facultyRole: match.role
          };
        }
      }
      this.recordFailedAttempt(cleanId);
      return null;
    }

    if (expectedRole === 'STUDENT') {
      const students = this.getItem<Student[]>(KEYS.STUDENTS, []);
      const match = students.find(
        (s) => s.email.toLowerCase() === cleanId || s.registerNo.toLowerCase() === cleanId
      );

      if (match) {
        const isMatch = await verifyPassword(pass, match.portalPasswordHash || '');
        if (isMatch) {
          this.clearFailedAttempt(cleanId);
          return {
            id: match.id,
            name: match.name,
            email: match.email,
            role: 'STUDENT',
            registerNo: match.registerNo,
            year: match.year,
            section: match.section
          };
        }
      }
      this.recordFailedAttempt(cleanId);
      return null;
    }

    return null;
  }

  // --- Faculty Management (Admin only) ---
  public static getFacultyAssignments(): FacultyAssignment[] {
    return this.getItem<FacultyAssignment[]>(KEYS.FACULTY_ASSIGNMENTS, []);
  }

  public static async addFaculty(faculty: Omit<FacultyAssignment, 'id' | 'portalPasswordHash'>, rawPassword: string): Promise<FacultyAssignment> {
    const list = this.getFacultyAssignments();
    const passwordHash = await hashPassword(rawPassword);

    const newFac: FacultyAssignment = {
      ...faculty,
      id: `fac-${Date.now()}`,
      portalPasswordHash: passwordHash
    };
    list.push(newFac);
    this.setItem(KEYS.FACULTY_ASSIGNMENTS, list);
    return newFac;
  }

  public static async updateFacultyPassword(facultyId: string, newPassword: string): Promise<void> {
    const list = this.getFacultyAssignments();
    const idx = list.findIndex((f) => f.id === facultyId);
    if (idx !== -1) {
      list[idx].portalPasswordHash = await hashPassword(newPassword);
      this.setItem(KEYS.FACULTY_ASSIGNMENTS, list);
    }
  }

  public static updateFaculty(id: string, updates: Partial<FacultyAssignment>): void {
    const list = this.getFacultyAssignments();
    const idx = list.findIndex((f) => f.id === id);
    if (idx !== -1) {
      // Omit sensitive fields from generic updates
      const { portalPasswordHash: _portalPasswordHash, ...safeUpdates } = updates as any;
      list[idx] = { ...list[idx], ...safeUpdates };
      this.setItem(KEYS.FACULTY_ASSIGNMENTS, list);
    }
  }

  // --- Student Management & Server-Side Authorization ---
  public static getStudents(year?: AcademicYear, section?: Section): Student[] {
    let list = this.getItem<Student[]>(KEYS.STUDENTS, []);
    if (year) list = list.filter((s) => s.year === year);
    if (section) list = list.filter((s) => s.section === section);
    return list;
  }

  public static getStudentById(id: string): Student | undefined {
    return this.getItem<Student[]>(KEYS.STUDENTS, []).find((s) => s.id === id);
  }

  // Server-side authorization check for faculty class access
  public static verifyFacultyAccess(facultySession: UserSession, studentId: string): boolean {
    if (facultySession.role !== 'FACULTY') return false;
    const targetStudent = this.getStudentById(studentId);
    if (!targetStudent) return false;
    return targetStudent.year === facultySession.assignedYear && targetStudent.section === facultySession.assignedSection;
  }

  public static async bulkImportStudents(newStudents: Omit<Student, 'id' | 'overallScore' | 'currentRank' | 'portalPasswordHash'>[], defaultPass = 'student123'): Promise<number> {
    const list = this.getStudents();
    const defaultHash = await hashPassword(defaultPass);
    let imported = 0;

    newStudents.forEach((ns) => {
      if (!list.some((s) => s.registerNo === ns.registerNo)) {
        const created: Student = {
          ...ns,
          id: `stu-imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          cgpa: ns.cgpa || 0,
          overallScore: ns.cgpa ? (ns.cgpa / 10) * 85 : 0,
          currentRank: 99,
          portalPasswordHash: defaultHash
        };
        list.push(created);
        imported++;
      }
    });

    this.setItem(KEYS.STUDENTS, list);
    return imported;
  }

  public static updateStudent(id: string, updates: Partial<Student>): void {
    const list = this.getStudents();
    const idx = list.findIndex((s) => s.id === id);
    if (idx !== -1) {
      const { portalPasswordHash: _portalPasswordHash, ...safeUpdates } = updates as any;
      list[idx] = { ...list[idx], ...safeUpdates };
      this.setItem(KEYS.STUDENTS, list);
      this.recalculateStudentScore(id);
    }
  }

  // --- Student 360 Full Profile Data ---
  public static getStudent360(studentId: string) {
    const student = this.getStudentById(studentId);
    if (!student) return null;

    const academics = this.getItem<AcademicSemester[]>(KEYS.ACADEMICS, []).filter((a) => a.studentId === studentId);
    const arrears = this.getItem<ArrearRecord[]>(KEYS.ARREARS, []).filter((a) => a.studentId === studentId);
    const skillEdge = this.getItem<SkillEdgeRecord[]>(KEYS.SKILLEDGE, []).find((s) => s.studentId === studentId);
    const nptel = this.getItem<NPTELCourse[]>(KEYS.NPTEL, []).filter((n) => n.studentId === studentId);
    const participations = this.getItem<ParticipationRecord[]>(KEYS.PARTICIPATION, []).filter((p) => p.studentId === studentId);
    const certificates = this.getItem<CertificateRecord[]>(KEYS.CERTIFICATES, []).filter((c) => c.studentId === studentId);
    const attendance = this.getItem<AttendanceRecord[]>(KEYS.ATTENDANCE, []).find((a) => a.studentId === studentId);
    const discipline = this.getItem<DisciplineRecord[]>(KEYS.DISCIPLINE, []).filter((d) => d.studentId === studentId);
    const leetcode = this.getItem<LeetCodeStats[]>(KEYS.LEETCODE, []).find((l) => l.studentId === studentId);
    const projects = this.getItem<ProjectRecord[]>(KEYS.PROJECTS, []).filter((p) => p.studentId === studentId);
    const achievements = this.getItem<AchievementRecord[]>(KEYS.ACHIEVEMENTS, []).filter((a) => a.studentId === studentId);
    const repMetrics = this.getItem<RepresentativeMetrics[]>(KEYS.REP_METRICS, []).find((r) => r.studentId === studentId);

    const config = this.getScoringConfig();
    const categoryScores = calculateCategoryScores(
      student,
      academics,
      arrears,
      skillEdge,
      nptel,
      participations,
      certificates,
      attendance,
      discipline,
      leetcode,
      projects
    );

    const overallScore = computeOverallScore(categoryScores, config);
    const aiInsight = generateAIExplanation(student, categoryScores, overallScore, leetcode, repMetrics);

    const breakdown: StudentScoreBreakdown = {
      studentId,
      overallScore,
      categoryScores,
      rank: student.currentRank,
      aiExplanation: aiInsight.explanation,
      strengths: aiInsight.strengths,
      weakAreas: aiInsight.weakAreas,
      eligibleAwards: aiInsight.eligibleAwards
    };

    return {
      student,
      academics,
      arrears,
      skillEdge,
      nptel,
      participations,
      certificates,
      attendance,
      discipline,
      leetcode,
      projects,
      achievements,
      repMetrics,
      breakdown
    };
  }

  // --- Score Recalculation Engine ---
  public static recalculateStudentScore(studentId: string): number {
    const data = this.getStudent360(studentId);
    if (!data) return 0;

    const list = this.getStudents();
    const idx = list.findIndex((s) => s.id === studentId);
    if (idx !== -1) {
      list[idx].overallScore = data.breakdown.overallScore;
      this.setItem(KEYS.STUDENTS, list);
    }
    return data.breakdown.overallScore;
  }

  public static recalculateAllScores(): void {
    const students = this.getStudents();
    students.forEach((stu) => {
      this.recalculateStudentScore(stu.id);
    });

    const updated = this.getStudents();
    const yearGroups: Record<string, Student[]> = {};

    updated.forEach((s) => {
      const key = `${s.year}_${s.section}`;
      if (!yearGroups[key]) yearGroups[key] = [];
      yearGroups[key].push(s);
    });

    Object.values(yearGroups).forEach((group) => {
      group.sort((a, b) => b.overallScore - a.overallScore);
      group.forEach((s, rIdx) => {
        s.currentRank = rIdx + 1;
      });
    });

    this.setItem(KEYS.STUDENTS, updated);
  }

  // --- Updates for Authorized Faculty/HOD ---
  public static updateAttendance(studentId: string, presentDays: number, totalDays: number): void {
    const list = this.getItem<AttendanceRecord[]>(KEYS.ATTENDANCE, []);
    const idx = list.findIndex((a) => a.studentId === studentId);
    const pct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100 * 10) / 10 : 0;
    if (idx !== -1) {
      list[idx].presentDays = presentDays;
      list[idx].totalWorkingDays = totalDays;
      list[idx].percentage = pct;
      list[idx].lastUpdated = new Date().toISOString().split('T')[0];
    } else {
      list.push({
        id: `att-${studentId}`,
        studentId,
        totalWorkingDays: totalDays,
        presentDays,
        absentDays: Math.max(0, totalDays - presentDays),
        odDays: 0,
        mlDays: 0,
        percentage: pct,
        lastUpdated: new Date().toISOString().split('T')[0]
      });
    }
    this.setItem(KEYS.ATTENDANCE, list);
    this.recalculateStudentScore(studentId);
  }

  public static updateLeetCode(studentId: string, easy: number, medium: number, hard: number, rating: number): void {
    const list = this.getItem<LeetCodeStats[]>(KEYS.LEETCODE, []);
    const idx = list.findIndex((l) => l.studentId === studentId);
    const total = easy + medium + hard;
    if (idx !== -1) {
      list[idx].easySolved = easy;
      list[idx].mediumSolved = medium;
      list[idx].hardSolved = hard;
      list[idx].totalSolved = total;
      list[idx].contestRating = rating;
      list[idx].lastUpdated = new Date().toISOString().split('T')[0];
    } else {
      list.push({
        id: `lc-${studentId}`,
        studentId,
        username: `student_${studentId}`,
        totalSolved: total,
        easySolved: easy,
        mediumSolved: medium,
        hardSolved: hard,
        contestRating: rating,
        contestsAttended: 0,
        streakDays: 0,
        lastUpdated: new Date().toISOString().split('T')[0]
      });
    }
    this.setItem(KEYS.LEETCODE, list);
    this.recalculateStudentScore(studentId);
  }

  public static addArrear(studentId: string, semesterNo: number, subjectCode: string, subjectName: string): void {
    const list = this.getItem<ArrearRecord[]>(KEYS.ARREARS, []);
    list.push({
      id: `arr-${Date.now()}`,
      studentId,
      semesterNo,
      subjectCode,
      subjectName,
      status: 'PENDING',
      createdDate: new Date().toISOString().split('T')[0]
    });
    this.setItem(KEYS.ARREARS, list);
    this.recalculateStudentScore(studentId);
  }

  public static clearArrear(arrearId: string): void {
    const list = this.getItem<ArrearRecord[]>(KEYS.ARREARS, []);
    const match = list.find((a) => a.id === arrearId);
    if (match) {
      match.status = 'CLEARED';
      match.clearedDate = new Date().toISOString().split('T')[0];
      this.setItem(KEYS.ARREARS, list);
      this.recalculateStudentScore(match.studentId);
    }
  }

  // --- Scoring Config (HOD) ---
  public static getScoringConfig(): ScoringConfig {
    return this.getItem<ScoringConfig>(KEYS.SCORING_CONFIG, DEFAULT_SCORING_CONFIG);
  }

  public static saveScoringConfig(config: ScoringConfig): void {
    this.setItem(KEYS.SCORING_CONFIG, config);
    this.recalculateAllScores();
  }

  // --- Awards Finalization ---
  public static getFinalizedAwards(): FinalizedAward[] {
    return this.getItem<FinalizedAward[]>(KEYS.FINALIZED_AWARDS, []);
  }

  public static finalizeAward(
    awardKey: 'BEST_STUDENT' | 'BEST_LEETCODE' | 'ELITE_STUDENT' | 'BEST_TEAM_HEAD' | 'BEST_REPRESENTATIVE',
    awardTitle: string,
    student: Student,
    aiExplanation: string,
    hodName: string
  ): FinalizedAward {
    const awards = this.getFinalizedAwards();
    const existingIdx = awards.findIndex((a) => a.awardKey === awardKey && a.year === student.year);
    const newAward: FinalizedAward = {
      id: `awd-${Date.now()}`,
      awardKey,
      awardTitle,
      winnerStudentId: student.id,
      winnerStudentName: student.name,
      registerNo: student.registerNo,
      year: student.year,
      section: student.section,
      overallScore: student.overallScore,
      finalizedAt: new Date().toISOString().split('T')[0],
      finalizedByHODName: hodName,
      aiExplanation
    };

    if (existingIdx !== -1) {
      awards[existingIdx] = newAward;
    } else {
      awards.push(newAward);
    }

    this.setItem(KEYS.FINALIZED_AWARDS, awards);
    return newAward;
  }
}
