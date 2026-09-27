import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.join(DATA_DIR, 'aids_system.db');
const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

function initSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      identifier TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      year TEXT,
      section TEXT,
      faculty_role TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS faculty_assignments (
      id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'AI & DS',
      year TEXT NOT NULL,
      section TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Class Coordinator',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      register_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      department TEXT NOT NULL DEFAULT 'AI & DS',
      year TEXT NOT NULL,
      section TEXT NOT NULL,
      batch TEXT NOT NULL,
      class_coordinator_name TEXT NOT NULL DEFAULT 'Assigned Faculty',
      cgpa REAL NOT NULL DEFAULT 0.0,
      overall_score REAL NOT NULL DEFAULT 0.0,
      current_rank INTEGER NOT NULL DEFAULT 99,
      is_representative INTEGER NOT NULL DEFAULT 0,
      created_by_faculty_id TEXT,
      faculty_workspace_id TEXT,
      personal_email TEXT,
      FOREIGN KEY (created_by_faculty_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS academic_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      semester_no INTEGER NOT NULL,
      sgpa REAL NOT NULL,
      cgpa REAL NOT NULL,
      total_credits INTEGER NOT NULL,
      subjects_json TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS arrear_history (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      semester_no INTEGER NOT NULL,
      subject_code TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_date TEXT NOT NULL,
      cleared_date TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS skilledge_records (
      id TEXT PRIMARY KEY,
      student_id TEXT UNIQUE NOT NULL,
      overall_completion_pct REAL NOT NULL,
      total_reward_points INTEGER NOT NULL,
      tracks_json TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS nptel_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      course_name TEXT NOT NULL,
      duration_weeks INTEGER NOT NULL,
      weeks_completed INTEGER NOT NULL,
      assignment_score REAL NOT NULL,
      exam_score REAL,
      final_score REAL NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      student_id TEXT UNIQUE NOT NULL,
      total_working_days INTEGER NOT NULL,
      present_days INTEGER NOT NULL,
      absent_days INTEGER NOT NULL,
      od_days INTEGER NOT NULL DEFAULT 0,
      ml_days INTEGER NOT NULL DEFAULT 0,
      percentage REAL NOT NULL,
      last_updated TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_attendance_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      recorded_by TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(student_id, date)
    );

    CREATE TABLE IF NOT EXISTS discipline_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      remark TEXT NOT NULL,
      warning_action TEXT NOT NULL,
      recorded_by TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS certificate_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      course_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      category TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      certificate_id TEXT,
      file_path TEXT,
      original_file_name TEXT,
      uploaded_at TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS participation_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      organizer TEXT NOT NULL,
      date TEXT NOT NULL,
      is_team INTEGER NOT NULL DEFAULT 0,
      position TEXT,
      prize_amount TEXT,
      certificate_ref TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS leetcode_stats (
      id TEXT PRIMARY KEY,
      student_id TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      total_solved INTEGER NOT NULL,
      easy_solved INTEGER NOT NULL,
      medium_solved INTEGER NOT NULL,
      hard_solved INTEGER NOT NULL,
      contest_rating INTEGER NOT NULL,
      total_attempted INTEGER DEFAULT 0,
      acceptance_rate REAL DEFAULT 0.0,
      streak_days INTEGER NOT NULL DEFAULT 0,
      last_updated TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      domain TEXT NOT NULL,
      tech_stack_json TEXT NOT NULL,
      is_team INTEGER NOT NULL DEFAULT 0,
      student_role TEXT NOT NULL,
      github_url TEXT,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      prize_awarded TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS achievement_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      event_name TEXT NOT NULL,
      date TEXT NOT NULL,
      position TEXT,
      description TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scoring_configuration (
      id TEXT PRIMARY KEY DEFAULT 'default',
      academic_weight REAL NOT NULL DEFAULT 25,
      skilledge_weight REAL NOT NULL DEFAULT 15,
      nptel_weight REAL NOT NULL DEFAULT 10,
      participation_weight REAL NOT NULL DEFAULT 10,
      certificates_weight REAL NOT NULL DEFAULT 10,
      attendance_weight REAL NOT NULL DEFAULT 10,
      discipline_weight REAL NOT NULL DEFAULT 5,
      leetcode_weight REAL NOT NULL DEFAULT 10,
      projects_weight REAL NOT NULL DEFAULT 5
    );

    CREATE TABLE IF NOT EXISTS finalized_awards (
      id TEXT PRIMARY KEY,
      award_key TEXT NOT NULL,
      award_title TEXT NOT NULL,
      winner_student_id TEXT NOT NULL,
      winner_student_name TEXT NOT NULL,
      register_no TEXT NOT NULL,
      year TEXT NOT NULL,
      section TEXT NOT NULL,
      overall_score REAL NOT NULL,
      finalized_at TEXT NOT NULL,
      finalized_by_hod_name TEXT NOT NULL,
      ai_explanation TEXT NOT NULL,
      FOREIGN KEY (winner_student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      subject_code TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'AI & Data Science',
      academic_year TEXT NOT NULL,
      year TEXT NOT NULL,
      semester INTEGER NOT NULL,
      section TEXT NOT NULL DEFAULT 'ALL',
      subject_type TEXT NOT NULL DEFAULT 'Theory',
      credits INTEGER NOT NULL DEFAULT 3,
      faculty_handler TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL DEFAULT 'SYSTEM',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions_revocation (
      token_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      revoked_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_resource TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      record_id TEXT NOT NULL,
      original_file_name TEXT NOT NULL,
      stored_file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_by_user_id TEXT NOT NULL,
      uploaded_by_role TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT,
      deleted_by TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS connected_accounts (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'GOOGLE',
      purpose TEXT NOT NULL DEFAULT 'NPTEL',
      email_type TEXT NOT NULL DEFAULT 'COLLEGE',
      connected_email TEXT NOT NULL,
      provider_username TEXT NOT NULL,
      provider_account_id TEXT,
      connection_status TEXT NOT NULL DEFAULT 'CONNECTED',
      verification_status TEXT NOT NULL DEFAULT 'VERIFIED',
      connected_at TEXT NOT NULL,
      last_synced_at TEXT NOT NULL,
      raw_payload_json TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS external_metrics (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      source TEXT NOT NULL,
      source_identifier TEXT NOT NULL,
      metric TEXT NOT NULL,
      value TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'VERIFIED',
      synced_at TEXT NOT NULL,
      verified_at TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      team_name TEXT NOT NULL,
      event_name TEXT NOT NULL,
      team_head_student_id TEXT NOT NULL,
      category TEXT NOT NULL,
      project_name TEXT NOT NULL,
      result_position TEXT NOT NULL,
      prize TEXT,
      proof_file TEXT,
      created_date TEXT NOT NULL,
      FOREIGN KEY (team_head_student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      role_in_team TEXT NOT NULL DEFAULT 'Member',
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS representative_evaluations (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      year TEXT NOT NULL,
      section TEXT NOT NULL,
      evaluation_period TEXT NOT NULL,
      communication_score REAL NOT NULL DEFAULT 8.0,
      faculty_coordination_score REAL NOT NULL DEFAULT 8.0,
      student_coordination_score REAL NOT NULL DEFAULT 8.0,
      attendance_followup_score REAL NOT NULL DEFAULT 8.0,
      late_comer_monitoring_score REAL NOT NULL DEFAULT 8.0,
      academic_updates_score REAL NOT NULL DEFAULT 8.0,
      discipline_support_score REAL NOT NULL DEFAULT 8.0,
      cleanliness_responsibility_score REAL NOT NULL DEFAULT 8.0,
      notice_board_score REAL NOT NULL DEFAULT 8.0,
      event_coordination_score REAL NOT NULL DEFAULT 8.0,
      responsibility_completion_score REAL NOT NULL DEFAULT 8.0,
      overall_remarks TEXT,
      evaluated_by TEXT NOT NULL,
      evaluated_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_heads (
      id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL,
      head_student_id TEXT NOT NULL,
      member_limit INTEGER NOT NULL DEFAULT 5,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (head_student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(faculty_id, head_student_id)
    );

    CREATE TABLE IF NOT EXISTS team_head_members (
      id TEXT PRIMARY KEY,
      team_head_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (team_head_id) REFERENCES team_heads(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(team_head_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS skilledge_sync_history (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      previous_points INTEGER NOT NULL DEFAULT 0,
      current_points INTEGER NOT NULL DEFAULT 0,
      earned_delta INTEGER NOT NULL DEFAULT 0,
      overall_completion_pct REAL NOT NULL DEFAULT 0.0,
      tracks_json TEXT NOT NULL DEFAULT '[]',
      synced_at TEXT NOT NULL,
      sync_source TEXT NOT NULL DEFAULT 'DAILY_AUTO',
      status TEXT NOT NULL DEFAULT 'SUCCESS',
      error_message TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    -- INDEXES FOR FAST QUERY EXECUTION
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_identifier ON users(identifier);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_faculty_assign ON faculty_assignments(faculty_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_students_reg_no ON students(register_no);
    CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
    CREATE INDEX IF NOT EXISTS idx_students_year_sec ON students(year, section);
    CREATE INDEX IF NOT EXISTS idx_students_score ON students(overall_score DESC);
    CREATE INDEX IF NOT EXISTS idx_students_rank ON students(current_rank ASC);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_attachments_student ON attachments(student_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(record_type, record_id);
    CREATE INDEX IF NOT EXISTS idx_team_heads_fac ON team_heads(faculty_id);
    CREATE INDEX IF NOT EXISTS idx_team_head_members_th ON team_head_members(team_head_id);
    CREATE INDEX IF NOT EXISTS idx_skilledge_sync_history_stu ON skilledge_sync_history(student_id, synced_at DESC);
  `);

  try { sqlite.exec(`ALTER TABLE students ADD COLUMN created_by_faculty_id TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE students ADD COLUMN faculty_workspace_id TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE students ADD COLUMN personal_email TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE students ADD COLUMN entry_type TEXT DEFAULT 'Regular';`); } catch {}
  try { sqlite.exec(`ALTER TABLE students ADD COLUMN linkedin_url TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE students ADD COLUMN github_url TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE students ADD COLUMN is_elite_student INTEGER DEFAULT 0;`); } catch {}

  try { sqlite.exec(`ALTER TABLE academic_records ADD COLUMN exam_type TEXT DEFAULT 'Semester';`); } catch {}
  try { sqlite.exec(`ALTER TABLE academic_records ADD COLUMN created_at TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE discipline_records ADD COLUMN time TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE discipline_records ADD COLUMN fine_amount REAL DEFAULT 0;`); } catch {}
  try { sqlite.exec(`ALTER TABLE discipline_records ADD COLUMN action_taken TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE certificate_records ADD COLUMN company_name TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE certificate_records ADD COLUMN proof_file_path TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE certificate_records ADD COLUMN created_at TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE nptel_records ADD COLUMN account_type TEXT DEFAULT 'college';`); } catch {}
  try { sqlite.exec(`ALTER TABLE nptel_records ADD COLUMN connected_email TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE nptel_records ADD COLUMN connected_at TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE nptel_records ADD COLUMN last_verified TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE certificate_records ADD COLUMN file_path TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE certificate_records ADD COLUMN original_file_name TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE certificate_records ADD COLUMN uploaded_at TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE participation_records ADD COLUMN college_name TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE participation_records ADD COLUMN proof_file_path TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE participation_records ADD COLUMN event_level TEXT DEFAULT 'College';`); } catch {}
  try { sqlite.exec(`ALTER TABLE participation_records ADD COLUMN achievement TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE participation_records ADD COLUMN description TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE participation_records ADD COLUMN original_file_name TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE participation_records ADD COLUMN uploaded_at TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE project_records ADD COLUMN live_url TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE project_records ADD COLUMN product_photo_path TEXT;`); } catch {}

  try { sqlite.exec(`ALTER TABLE connected_accounts ADD COLUMN purpose TEXT DEFAULT 'NPTEL';`); } catch {}
  try { sqlite.exec(`ALTER TABLE connected_accounts ADD COLUMN email_type TEXT DEFAULT 'COLLEGE';`); } catch {}
  try { sqlite.exec(`ALTER TABLE connected_accounts ADD COLUMN connected_email TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE connected_accounts ADD COLUMN provider_account_id TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE connected_accounts ADD COLUMN connected_at TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE leetcode_stats ADD COLUMN total_attempted INTEGER DEFAULT 0;`); } catch {}
  try { sqlite.exec(`ALTER TABLE leetcode_stats ADD COLUMN acceptance_rate REAL DEFAULT 0.0;`); } catch {}

  try { sqlite.exec(`ALTER TABLE skilledge_records ADD COLUMN skilledge_handle TEXT;`); } catch {}
  try { sqlite.exec(`ALTER TABLE skilledge_records ADD COLUMN previous_points INTEGER DEFAULT 0;`); } catch {}
  try { sqlite.exec(`ALTER TABLE skilledge_records ADD COLUMN earned_delta INTEGER DEFAULT 0;`); } catch {}
  try { sqlite.exec(`ALTER TABLE skilledge_records ADD COLUMN status TEXT DEFAULT 'VERIFIED';`); } catch {}
  try { sqlite.exec(`ALTER TABLE skilledge_records ADD COLUMN last_synced_at TEXT;`); } catch {}

  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS nptel_proofs (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        week_no INTEGER NOT NULL,
        proof_file_path TEXT NOT NULL,
        original_file_name TEXT,
        uploaded_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS leetcode_proofs (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        proof_file_path TEXT NOT NULL,
        original_file_name TEXT,
        uploaded_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      );
    `);
  } catch {}

  try {
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_students_created_by ON students(created_by_faculty_id);
      CREATE INDEX IF NOT EXISTS idx_students_workspace ON students(faculty_workspace_id);
      CREATE INDEX IF NOT EXISTS idx_conn_acc_stu_prov ON connected_accounts(student_id, provider);
      CREATE INDEX IF NOT EXISTS idx_nptel_proofs_stu ON nptel_proofs(student_id);
      CREATE INDEX IF NOT EXISTS idx_leetcode_proofs_stu ON leetcode_proofs(student_id);
      CREATE INDEX IF NOT EXISTS idx_subjects_code_ctx ON subjects(subject_code, year, semester, section);
      CREATE INDEX IF NOT EXISTS idx_subjects_year_sem ON subjects(year, semester, section);
    `);
  } catch {}

  const hasConfig = sqlite.prepare('SELECT COUNT(*) as cnt FROM scoring_configuration').get() as { cnt: number };
  if (hasConfig.cnt === 0) {
    sqlite.prepare(`
      INSERT INTO scoring_configuration (id, academic_weight, skilledge_weight, nptel_weight, participation_weight, certificates_weight, attendance_weight, discipline_weight, leetcode_weight, projects_weight)
      VALUES ('default', 25, 15, 10, 10, 10, 10, 5, 10, 5)
    `).run();
  }

  const hasSubjects = sqlite.prepare('SELECT COUNT(*) as cnt FROM subjects').get() as { cnt: number };
  if (hasSubjects.cnt === 0) {
    const defaultSubs = [
      { id: 'sub-seed-1', code: 'AD3401', name: 'Data Structures and Algorithms', dept: 'AI & Data Science', acadYear: '2023-2027', year: '2nd Year', sem: 3, sec: 'ALL', type: 'Theory', credits: 3, handler: 'Assigned Faculty' },
      { id: 'sub-seed-2', code: 'AD3402', name: 'Artificial Intelligence & Neural Networks', dept: 'AI & Data Science', acadYear: '2023-2027', year: '2nd Year', sem: 4, sec: 'ALL', type: 'Theory', credits: 4, handler: 'Class Coordinator' },
      { id: 'sub-seed-3', code: 'AD3411', name: 'Machine Learning Laboratory', dept: 'AI & Data Science', acadYear: '2023-2027', year: '2nd Year', sem: 4, sec: 'ALL', type: 'Practical', credits: 2, handler: 'Class Coordinator' },
      { id: 'sub-seed-4', code: 'AD3501', name: 'Deep Learning & Computer Vision', dept: 'AI & Data Science', acadYear: '2022-2026', year: '3rd Year', sem: 5, sec: 'ALL', type: 'Elective', credits: 3, handler: 'HOD Faculty' }
    ];
    const stmt = sqlite.prepare(`
      INSERT INTO subjects (id, subject_code, subject_name, department, academic_year, year, semester, section, subject_type, credits, faculty_handler, created_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYSTEM', ?)
    `);
    const now = new Date().toISOString();
    for (const s of defaultSubs) {
      stmt.run(s.id, s.code, s.name, s.dept, s.acadYear, s.year, s.sem, s.sec, s.type, s.credits, s.handler, now);
    }
  }
}

initSchema();

export interface SubjectRecord {
  id: string;
  subjectCode: string;
  subject_code?: string;
  subjectName: string;
  subject_name?: string;
  department: string;
  academicYear: string;
  academic_year?: string;
  year: string;
  semester: number;
  section: string;
  subjectType: 'Theory' | 'Practical' | 'Elective';
  subject_type?: string;
  credits: number;
  facultyHandler: string;
  faculty_handler?: string;
  createdByUserId?: string;
  created_by_user_id?: string;
  createdAt?: string;
  created_at?: string;
}

export interface UserRecord {
  id: string;
  email: string;
  identifier: string;
  name: string;
  role: 'ADMIN' | 'HOD' | 'FACULTY' | 'STUDENT';
  password_hash: string;
  year?: string;
  section?: string;
  faculty_role?: string;
  is_active: number;
  created_at: string;
}

export interface FacultyAssignmentRecord {
  id: string;
  faculty_id: string;
  department: string;
  year: string;
  section: string;
  role: string;
  is_active: number;
  created_at: string;
}

export interface StudentRecord {
  id: string;
  register_no: string;
  registerNo?: string;
  name: string;
  email: string;
  collegeEmail?: string;
  college_email?: string;
  personal_email?: string | null;
  personalEmail?: string | null;
  department: string;
  year: string;
  section: string;
  batch: string;
  class_coordinator_name: string;
  classCoordinatorName?: string;
  cgpa: number;
  overall_score: number;
  overallScore?: number;
  current_rank: number;
  currentRank?: number;
  is_representative: number;
  entry_type?: string;
  entryType?: string;
  linkedin_url?: string | null;
  linkedinUrl?: string | null;
  github_url?: string | null;
  githubUrl?: string | null;
  is_elite_student?: number;
  isEliteStudent?: boolean;
  created_by_faculty_id?: string;
  faculty_workspace_id?: string;
}

export function normalizeStudentRecord(stu: any): StudentRecord | null {
  if (!stu) return null;
  const collegeEmail = (stu.email || stu.collegeEmail || stu.college_email || '').trim();
  const personalEmail = (stu.personal_email || stu.personalEmail || '').trim();
  const registerNo = (stu.register_no || stu.registerNo || '').trim();
  const entryType = stu.entry_type || stu.entryType || 'Regular';
  const linkedinUrl = (stu.linkedin_url || stu.linkedinUrl || '').trim();
  const githubUrl = (stu.github_url || stu.githubUrl || '').trim();
  const isEliteStudent = Boolean(stu.is_elite_student === 1 || stu.isEliteStudent === true);

  return {
    ...stu,
    id: stu.id,
    register_no: registerNo,
    registerNo: registerNo,
    name: stu.name,
    email: collegeEmail,
    collegeEmail: collegeEmail,
    college_email: collegeEmail,
    personal_email: personalEmail || null,
    personalEmail: personalEmail || null,
    linkedin_url: linkedinUrl || null,
    linkedinUrl: linkedinUrl || null,
    github_url: githubUrl || null,
    githubUrl: githubUrl || null,
    is_elite_student: isEliteStudent ? 1 : 0,
    isEliteStudent: isEliteStudent,
    department: stu.department || 'AI & DS',
    year: stu.year,
    section: stu.section,
    batch: stu.batch,
    class_coordinator_name: stu.class_coordinator_name || stu.classCoordinatorName || 'Assigned Faculty',
    classCoordinatorName: stu.class_coordinator_name || stu.classCoordinatorName || 'Assigned Faculty',
    cgpa: stu.cgpa || 0,
    overall_score: stu.overall_score !== undefined ? stu.overall_score : (stu.overallScore || 0),
    overallScore: stu.overall_score !== undefined ? stu.overall_score : (stu.overallScore || 0),
    current_rank: stu.current_rank !== undefined ? stu.current_rank : (stu.currentRank || 99),
    currentRank: stu.current_rank !== undefined ? stu.current_rank : (stu.currentRank || 99),
    entry_type: entryType,
    entryType: entryType,
    is_active: stu.is_active !== undefined ? stu.is_active : (stu.isActive !== false ? 1 : 0),
    isActive: stu.is_active !== 0 && stu.isActive !== false
  };
}

export interface AcademicRecord {
  id: string;
  student_id: string;
  semester_no: number;
  sgpa: number;
  cgpa: number;
  total_credits: number;
  subjects: any[];
}

export interface ArrearRecord {
  id: string;
  student_id: string;
  semester_no: number;
  subject_code: string;
  subject_name: string;
  status: 'PENDING' | 'CLEARED';
  created_date: string;
  cleared_date?: string;
}

export interface SkillEdgeRecord {
  id: string;
  student_id: string;
  overallCompletionPct: number;
  totalRewardPoints: number;
  tracks: Array<{
    skillName: string;
    totalLevels: number;
    completedLevels: number;
    pendingLevels: number;
    rewardPoints: number;
    completionPct: number;
  }>;
}

export interface NPTELRecord {
  id: string;
  student_id: string;
  courseName: string;
  durationWeeks: number;
  weeksCompleted: number;
  assignmentScore: number;
  examScore?: number;
  finalScore: number;
  status: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  odDays: number;
  mlDays: number;
  percentage: number;
  lastUpdated: string;
}

export interface DisciplineRecord {
  id: string;
  student_id: string;
  date: string;
  category: string;
  remark: string;
  warningAction: string;
  recordedBy: string;
}

export interface CertificateRecord {
  id: string;
  student_id: string;
  courseName: string;
  platform: string;
  category: string;
  issueDate: string;
  certificateId?: string;
}

export interface ParticipationRecord {
  id: string;
  student_id: string;
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

export interface LeetCodeRecord {
  id: string;
  student_id: string;
  username: string;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  contestRating: number;
  totalAttempted?: number;
  acceptanceRate?: number;
  streakDays: number;
  lastUpdated: string;
}

export interface ProjectRecord {
  id: string;
  student_id: string;
  title: string;
  description: string;
  domain: string;
  techStack: string[];
  isTeam: boolean;
  studentRole: string;
  githubUrl?: string;
  category: string;
  status: string;
  prizeAwarded?: string;
}

export interface AchievementRecord {
  id: string;
  student_id: string;
  title: string;
  category: string;
  eventName: string;
  date: string;
  position?: string;
  description: string;
}

export interface AttachmentRecord {
  id: string;
  student_id: string;
  record_type: string;
  record_id: string;
  original_file_name: string;
  stored_file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_by_user_id: string;
  uploaded_by_role: string;
  uploaded_at: string;
  is_deleted: number;
  deleted_at?: string;
  deleted_by?: string;
}

export interface ScoringConfig {
  academicWeight: number;
  skillEdgeWeight: number;
  nptelWeight: number;
  participationWeight: number;
  certificatesWeight: number;
  attendanceWeight: number;
  disciplineWeight: number;
  leetcodeWeight: number;
  projectsWeight: number;
}

export class SQLiteDB {
  // ONE-TIME SECURE ADMIN BOOTSTRAP FLOW FROM ENVIRONMENT VARIABLES (.env)
  public static async initSystemAccounts(): Promise<void> {
    const adminEmail = (process.env.ADMIN_EMAIL || 'departmentai&ds@gmail.com').trim().toLowerCase();
    const adminInitialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs';
    const hash = await bcrypt.hash(adminInitialPassword, 10);

    const existingAdmin = sqlite.prepare("SELECT id, email, password_hash FROM users WHERE role = 'ADMIN'").get() as any;

    if (!existingAdmin) {
      sqlite.prepare(`
        INSERT INTO users (id, email, identifier, name, role, password_hash, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      `).run('admin-sys', adminEmail, 'admin', 'System Administrator', 'ADMIN', hash, new Date().toISOString());
      console.log(`🔒 Secure Admin Bootstrap: Initial ADMIN account created for ${adminEmail}.`);
    } else {
      const isPassMatch = await bcrypt.compare(adminInitialPassword, existingAdmin.password_hash);
      if (existingAdmin.email !== adminEmail || !isPassMatch) {
        sqlite.prepare(`
          UPDATE users SET email = ?, identifier = 'admin', password_hash = ? WHERE id = ?
        `).run(adminEmail, hash, existingAdmin.id);
        console.log(`🔒 Secure Admin Bootstrap: Updated existing ADMIN account credentials to ${adminEmail}.`);
      }
    }

    // BOOTSTRAP DEFAULT HOD ACCOUNT IF ABSENT
    const existingHOD = sqlite.prepare("SELECT id FROM users WHERE role = 'HOD' OR id = 'hod-sys' OR identifier = 'hod' OR email = 'hod.aids@avsenggcollege.ac.in'").get() as any;
    const hodHash = await bcrypt.hash('hod@123', 10);
    if (!existingHOD) {
      sqlite.prepare(`
        INSERT INTO users (id, email, identifier, name, role, password_hash, is_active, created_at)
        VALUES (?, ?, ?, ?, 'HOD', ?, 1, ?)
      `).run('hod-sys', 'hod.aids@avsenggcollege.ac.in', 'hod', 'Head of Department', hodHash, new Date().toISOString());
      console.log('🔒 Default HOD account initialized (hod.aids@avsenggcollege.ac.in / hod).');
    } else {
      sqlite.prepare("UPDATE users SET password_hash = ?, is_active = 1 WHERE id = ?").run(hodHash, existingHOD.id);
    }

    // BOOTSTRAP DEFAULT FACULTY ACCOUNT IF ABSENT
    const existingFaculty = sqlite.prepare("SELECT id, password_hash FROM users WHERE id = 'fac-sys' OR email = 'faculty.aids@avsenggcollege.ac.in' OR identifier = 'faculty'").get() as any;
    const facHash = await bcrypt.hash('faculty@123', 10);
    if (!existingFaculty) {
      sqlite.prepare(`
        INSERT INTO users (id, email, identifier, name, role, password_hash, year, section, faculty_role, is_active, created_at)
        VALUES (?, ?, ?, ?, 'FACULTY', ?, '2nd Year', 'A', 'Class Coordinator', 1, ?)
      `).run('fac-sys', 'faculty.aids@avsenggcollege.ac.in', 'faculty', 'Assigned Faculty Member', facHash, new Date().toISOString());
      console.log('🔒 Default FACULTY account initialized (faculty.aids@avsenggcollege.ac.in / faculty).');
    } else {
      sqlite.prepare("UPDATE users SET password_hash = ?, is_active = 1 WHERE id = ?").run(facHash, existingFaculty.id);
    }

    // BOOTSTRAP DEFAULT STUDENT ACCOUNT IF ABSENT
    const existingStudent = sqlite.prepare("SELECT id, password_hash FROM users WHERE id = 'stu-sys' OR email = 'student.aids@avsenggcollege.ac.in' OR identifier = 'student'").get() as any;
    const stuHash = await bcrypt.hash('student@123', 10);
    if (!existingStudent) {
      sqlite.prepare(`
        INSERT INTO users (id, email, identifier, name, role, password_hash, year, section, is_active, created_at)
        VALUES (?, ?, ?, ?, 'STUDENT', ?, '2nd Year', 'A', 1, ?)
      `).run('stu-sys', 'student.aids@avsenggcollege.ac.in', 'student', 'Sample AI & DS Student', stuHash, new Date().toISOString());

      // Ensure corresponding student profile in students table
      const stuProfile = sqlite.prepare("SELECT id FROM students WHERE register_no = '730123243001' OR email = 'student.aids@avsenggcollege.ac.in'").get() as any;
      if (!stuProfile) {
        sqlite.prepare(`
          INSERT INTO students (id, register_no, name, email, department, year, section, batch, class_coordinator_name, cgpa, overall_score, current_rank, is_representative, is_elite_student)
          VALUES (?, '730123243001', 'Sample AI & DS Student', 'student.aids@avsenggcollege.ac.in', 'AI & DS', '2nd Year', 'A', '2023-2027', 'Assigned Faculty Member', 8.5, 85.0, 1, 0, 1)
        `).run('stu-sys');
      }
      console.log('🔒 Default STUDENT account initialized (student.aids@avsenggcollege.ac.in / student / 730123243001).');
    } else {
      sqlite.prepare("UPDATE users SET password_hash = ?, is_active = 1 WHERE id = ?").run(stuHash, existingStudent.id);
    }
  }

  // USER CRUD
  public findUserByIdentifier(identifier: string, role?: string): UserRecord | undefined {
    const lowerId = identifier.trim().toLowerCase();
    let sql = 'SELECT * FROM users WHERE (LOWER(email) = ? OR LOWER(identifier) = ?)';
    const params: any[] = [lowerId, lowerId];
    if (role) {
      sql += ' AND UPPER(role) = ?';
      params.push(role.trim().toUpperCase());
    }
    let user = sqlite.prepare(sql).get(...params) as UserRecord | undefined;

    if (!user && (role?.toUpperCase() === 'STUDENT' || !role)) {
      const student = sqlite.prepare('SELECT email FROM students WHERE LOWER(register_no) = ? OR LOWER(email) = ?').get(lowerId, lowerId) as any;
      if (student && student.email) {
        user = sqlite.prepare('SELECT * FROM users WHERE (LOWER(email) = ? OR LOWER(identifier) = ?) AND UPPER(role) = \'STUDENT\'').get(student.email.toLowerCase(), student.email.toLowerCase()) as UserRecord | undefined;
      }
    }

    return user;
  }

  public getUserById(id: string): UserRecord | undefined {
    return sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRecord | undefined;
  }

  public getUsers(role?: string): UserRecord[] {
    if (role) {
      return sqlite.prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC').all(role) as UserRecord[];
    }
    return sqlite.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as UserRecord[];
  }

  public createUser(user: {
    id: string;
    email: string;
    identifier: string;
    name: string;
    role: string;
    passwordHash: string;
    year?: string;
    section?: string;
    facultyRole?: string;
    isActive?: boolean;
  }): void {
    const stmt = sqlite.prepare(`
      INSERT INTO users (id, email, identifier, name, role, password_hash, year, section, faculty_role, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      user.id,
      user.email,
      user.identifier,
      user.name,
      user.role,
      user.passwordHash,
      user.year || null,
      user.section || null,
      user.facultyRole || null,
      user.isActive !== false ? 1 : 0,
      new Date().toISOString()
    );
  }

  public updateUserPassword(userId: string, newHash: string): void {
    sqlite.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);
  }

  public updateHODNameEmail(userId: string, name: string, email: string): void {
    sqlite.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, userId);
  }

  public updateUserStatus(userId: string, isActive: boolean): void {
    sqlite.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, userId);
    sqlite.prepare('UPDATE faculty_assignments SET is_active = ? WHERE faculty_id = ?').run(isActive ? 1 : 0, userId);
  }

  public updateUserAssignment(userId: string, year: string, section: string, facultyRole: string): void {
    sqlite.prepare('UPDATE users SET year = ?, section = ?, faculty_role = ? WHERE id = ?').run(year, section, facultyRole, userId);

    const existingAssign = sqlite.prepare('SELECT id FROM faculty_assignments WHERE faculty_id = ?').get(userId);
    if (existingAssign) {
      sqlite.prepare('UPDATE faculty_assignments SET year = ?, section = ?, role = ? WHERE faculty_id = ?').run(year, section, facultyRole, userId);
    } else {
      sqlite.prepare(`
        INSERT INTO faculty_assignments (id, faculty_id, department, year, section, role, is_active, created_at)
        VALUES (?, ?, 'AI & DS', ?, ?, ?, 1, ?)
      `).run(`fa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, userId, year, section, facultyRole, new Date().toISOString());
    }
  }

  public getFacultyAssignment(facultyId: string): FacultyAssignmentRecord | undefined {
    return sqlite.prepare('SELECT * FROM faculty_assignments WHERE faculty_id = ? AND is_active = 1').get(facultyId) as FacultyAssignmentRecord | undefined;
  }

  public assignStudentsToFaculty(facultyId: string, studentIds: string[]): void {
    const stmt = sqlite.prepare(`
      UPDATE students
      SET created_by_faculty_id = ?, faculty_workspace_id = ?
      WHERE id = ?
    `);
    for (const sid of studentIds) {
      stmt.run(facultyId, facultyId, sid);
    }
  }

  // STUDENT CRUD
  public getStudentsForFaculty(facultyId: string, year?: string, section?: string): StudentRecord[] {
    let sql = 'SELECT * FROM students WHERE (created_by_faculty_id = ? OR faculty_workspace_id = ?)';
    const params: any[] = [facultyId, facultyId];
    if (year && year !== 'ALL') {
      sql += ' AND year = ?';
      params.push(year);
    }
    if (section && section !== 'ALL') {
      sql += ' AND section = ?';
      params.push(section);
    }
    sql += ' ORDER BY current_rank ASC, overall_score DESC';
    const rows = sqlite.prepare(sql).all(...params) as any[];
    return rows.map((r) => normalizeStudentRecord(r)!);
  }

  public getStudents(year?: string, section?: string, facultyId?: string): StudentRecord[] {
    if (facultyId) {
      return this.getStudentsForFaculty(facultyId, year, section);
    }
    let sql = 'SELECT * FROM students';
    const params: any[] = [];
    if (year && year !== 'ALL') {
      sql += ' WHERE year = ?';
      params.push(year);
      if (section && section !== 'ALL') {
        sql += ' AND section = ?';
        params.push(section);
      }
    } else if (section && section !== 'ALL') {
      sql += ' WHERE section = ?';
      params.push(section);
    }

    sql += ' ORDER BY current_rank ASC, overall_score DESC';
    const rows = sqlite.prepare(sql).all(...params) as any[];
    return rows.map((r) => normalizeStudentRecord(r)!);
  }

  public getEliteStudents(year?: string, section?: string, facultyId?: string): StudentRecord[] {
    let sql = 'SELECT * FROM students WHERE is_elite_student = 1';
    const params: any[] = [];
    if (facultyId) {
      sql += ' AND (created_by_faculty_id = ? OR faculty_workspace_id = ?)';
      params.push(facultyId, facultyId);
    }
    if (year && year !== 'ALL') {
      sql += ' AND year = ?';
      params.push(year);
    }
    if (section && section !== 'ALL') {
      sql += ' AND section = ?';
      params.push(section);
    }
    sql += ' ORDER BY current_rank ASC, overall_score DESC';
    const rows = sqlite.prepare(sql).all(...params) as any[];
    return rows.map((r) => normalizeStudentRecord(r)!);
  }

  public updateStudentEliteStatus(studentId: string, isElite: boolean): void {
    sqlite.prepare('UPDATE students SET is_elite_student = ? WHERE id = ?').run(isElite ? 1 : 0, studentId);
  }

  public updateStudentProfile(
    studentId: string,
    updates: {
      linkedinUrl?: string;
      githubUrl?: string;
      leetcodeUsername?: string;
      cgpa?: number;
      skillEdgePoints?: number;
    }
  ): void {
    const student = this.getStudentById(studentId);
    if (!student) throw new Error('Student record not found.');

    if (updates.linkedinUrl !== undefined || updates.githubUrl !== undefined || updates.cgpa !== undefined) {
      sqlite.prepare(`
        UPDATE students
        SET linkedin_url = ?, github_url = ?, cgpa = ?
        WHERE id = ?
      `).run(
        updates.linkedinUrl !== undefined ? updates.linkedinUrl : student.linkedinUrl || null,
        updates.githubUrl !== undefined ? updates.githubUrl : student.githubUrl || null,
        updates.cgpa !== undefined ? updates.cgpa : student.cgpa,
        studentId
      );
    }

    if (updates.leetcodeUsername !== undefined) {
      const username = updates.leetcodeUsername.trim();
      const existingLc = sqlite.prepare('SELECT id FROM leetcode_stats WHERE student_id = ?').get(studentId);
      if (existingLc) {
        sqlite.prepare('UPDATE leetcode_stats SET username = ?, last_updated = ? WHERE student_id = ?').run(username, new Date().toISOString(), studentId);
      } else if (username) {
        sqlite.prepare(`
          INSERT INTO leetcode_stats (id, student_id, username, total_solved, easy_solved, medium_solved, hard_solved, contest_rating, total_attempted, acceptance_rate, streak_days, last_updated)
          VALUES (?, ?, ?, 0, 0, 0, 0, 1200, 0, 0.0, 0, ?)
        `).run(`lc-${studentId}`, studentId, username, new Date().toISOString());
      }
    }

    if (updates.skillEdgePoints !== undefined) {
      const points = updates.skillEdgePoints;
      const existingSe = sqlite.prepare('SELECT id FROM skilledge_records WHERE student_id = ?').get(studentId);
      if (existingSe) {
        sqlite.prepare('UPDATE skilledge_records SET total_reward_points = ? WHERE student_id = ?').run(points, studentId);
      } else {
        sqlite.prepare(`
          INSERT INTO skilledge_records (id, student_id, overall_completion_pct, total_reward_points, tracks_json)
          VALUES (?, ?, 0, ?, '[]')
        `).run(`se-${studentId}`, studentId, points);
      }
    }
  }

  public getStudentById(id: string): StudentRecord | undefined {
    const row = sqlite.prepare('SELECT * FROM students WHERE id = ?').get(id);
    return row ? (normalizeStudentRecord(row) as StudentRecord) : undefined;
  }

  public getStudentByRegisterNo(regNo: string): StudentRecord | undefined {
    const row = sqlite.prepare('SELECT * FROM students WHERE register_no = ?').get(regNo);
    return row ? (normalizeStudentRecord(row) as StudentRecord) : undefined;
  }

  public createStudent(stu: {
    id: string;
    registerNo: string;
    name: string;
    email: string;
    personalEmail?: string;
    year: string;
    section: string;
    batch: string;
    classCoordinatorName?: string;
    cgpa?: number;
    overallScore?: number;
    createdByFacultyId?: string;
    facultyWorkspaceId?: string;
  }): void {
    const stmt = sqlite.prepare(`
      INSERT INTO students (id, register_no, name, email, personal_email, department, year, section, batch, class_coordinator_name, cgpa, overall_score, current_rank, created_by_faculty_id, faculty_workspace_id)
      VALUES (?, ?, ?, ?, ?, 'AI & DS', ?, ?, ?, ?, ?, ?, 99, ?, ?)
    `);
    stmt.run(
      stu.id,
      stu.registerNo,
      stu.name,
      stu.email,
      stu.personalEmail ? stu.personalEmail.trim() : null,
      stu.year,
      stu.section,
      stu.batch,
      stu.classCoordinatorName || 'Assigned Faculty',
      stu.cgpa || 0,
      stu.overallScore || 0,
      stu.createdByFacultyId || null,
      stu.facultyWorkspaceId || stu.createdByFacultyId || null
    );
  }

  public updateStudentCGPA(studentId: string, cgpa: number): void {
    sqlite.prepare('UPDATE students SET cgpa = ? WHERE id = ?').run(cgpa, studentId);
  }

  public updateStudentScoreAndRank(studentId: string, overallScore: number, currentRank: number): void {
    sqlite.prepare('UPDATE students SET overall_score = ?, current_rank = ? WHERE id = ?').run(overallScore, currentRank, studentId);
  }

  // 360 DEGREE GETTER
  public getStudent360(studentId: string) {
    const student = this.getStudentById(studentId);
    if (!student) return null;

    const academicsRaw = sqlite.prepare('SELECT * FROM academic_records WHERE student_id = ?').all(studentId) as any[];
    const academics: AcademicRecord[] = academicsRaw.map((a) => ({
      ...a,
      subjects: JSON.parse(a.subjects_json || '[]')
    }));

    const arrears = sqlite.prepare('SELECT * FROM arrear_history WHERE student_id = ?').all(studentId) as ArrearRecord[];

    const skillRaw = sqlite.prepare('SELECT * FROM skilledge_records WHERE student_id = ?').get(studentId) as any;
    let skillEdge: any | undefined = undefined;
    if (skillRaw) {
      const historyRows = sqlite.prepare('SELECT * FROM skilledge_sync_history WHERE student_id = ? ORDER BY synced_at DESC LIMIT 15').all(studentId) as any[];
      const history = historyRows.map((h) => ({
        id: h.id,
        student_id: h.student_id,
        previousPoints: h.previous_points,
        currentPoints: h.current_points,
        earnedDelta: h.earned_delta,
        overallCompletionPct: h.overall_completion_pct,
        tracks: JSON.parse(h.tracks_json || '[]'),
        syncedAt: h.synced_at,
        syncSource: h.sync_source,
        status: h.status,
        errorMessage: h.error_message
      }));

      skillEdge = {
        id: skillRaw.id,
        student_id: skillRaw.student_id,
        studentId: skillRaw.student_id,
        overallCompletionPct: skillRaw.overall_completion_pct,
        totalRewardPoints: skillRaw.total_reward_points,
        previousPoints: skillRaw.previous_points || 0,
        earnedDelta: skillRaw.earned_delta || 0,
        status: skillRaw.status || 'VERIFIED',
        skilledgeHandle: skillRaw.skilledge_handle || '',
        lastSyncedAt: skillRaw.last_synced_at || '',
        tracks: JSON.parse(skillRaw.tracks_json || '[]'),
        history
      };
    }

    const nptelRaw = sqlite.prepare('SELECT * FROM nptel_records WHERE student_id = ?').all(studentId) as any[];
    const nptel: NPTELRecord[] = nptelRaw.map((n) => ({
      id: n.id,
      student_id: n.student_id,
      courseName: n.course_name,
      durationWeeks: n.duration_weeks,
      weeksCompleted: n.weeks_completed,
      assignmentScore: n.assignment_score,
      examScore: n.exam_score,
      finalScore: n.final_score,
      status: n.status
    }));

    const attRaw = sqlite.prepare('SELECT * FROM attendance_records WHERE student_id = ?').get(studentId) as any;
    let attendance: AttendanceRecord | undefined = undefined;
    if (attRaw) {
      attendance = {
        id: attRaw.id,
        student_id: attRaw.student_id,
        totalWorkingDays: attRaw.total_working_days,
        presentDays: attRaw.present_days,
        absentDays: attRaw.absent_days,
        odDays: attRaw.od_days,
        mlDays: attRaw.ml_days,
        percentage: attRaw.percentage,
        lastUpdated: attRaw.last_updated
      };
    }

    const discipline = sqlite.prepare('SELECT * FROM discipline_records WHERE student_id = ?').all(studentId) as DisciplineRecord[];

    const certsRaw = sqlite.prepare('SELECT * FROM certificate_records WHERE student_id = ?').all(studentId) as any[];
    const certificates: CertificateRecord[] = certsRaw.map((c) => ({
      id: c.id,
      student_id: c.student_id,
      courseName: c.course_name,
      platform: c.platform,
      category: c.category,
      issueDate: c.issue_date,
      certificateId: c.certificate_id,
      filePath: c.file_path,
      originalFileName: c.original_file_name,
      uploadedAt: c.uploaded_at
    }));

    const partRaw = sqlite.prepare('SELECT * FROM participation_records WHERE student_id = ?').all(studentId) as any[];
    const participation: ParticipationRecord[] = partRaw.map((p) => ({
      id: p.id,
      student_id: p.student_id,
      eventName: p.event_name,
      eventType: p.event_type || p.category || 'Symposium',
      category: p.event_type || p.category || 'Symposium',
      eventLevel: p.event_level || 'College',
      organizer: p.organizer || p.college_name || 'Institution',
      collegeName: p.college_name || p.organizer || 'Institution',
      date: p.date,
      isTeam: Boolean(p.is_team),
      position: p.position || p.achievement || 'Participant',
      achievement: p.achievement || p.position || 'Participant',
      prizeAmount: p.prize_amount,
      certificateRef: p.certificate_ref,
      description: p.description || '',
      proofFilePath: p.proof_file_path || p.file_path,
      file_path: p.proof_file_path || p.file_path,
      originalFileName: p.original_file_name || p.originalFileName,
      original_file_name: p.original_file_name || p.originalFileName,
      uploadedAt: p.uploaded_at,
      uploaded_at: p.uploaded_at
    }));

    const lcRaw = sqlite.prepare('SELECT * FROM leetcode_stats WHERE student_id = ?').get(studentId) as any;
    const connLc = sqlite.prepare("SELECT provider_username FROM connected_accounts WHERE student_id = ? AND LOWER(provider) = 'leetcode'").get(studentId) as any;

    const isValidHandle = (u: any) => {
      if (!u || typeof u !== 'string') return false;
      const clean = u.trim().toLowerCase();
      if (!clean || clean === 'student' || clean === 'leetcode_user' || clean === 'null' || clean === 'undefined') return false;
      if (/^\d+$/.test(clean)) return false;
      return true;
    };

    let trueUsername = '';
    if (lcRaw && isValidHandle(lcRaw.username)) {
      trueUsername = lcRaw.username.trim();
    } else if (connLc && isValidHandle(connLc.provider_username)) {
      trueUsername = connLc.provider_username.trim();
    }

    let leetcode: LeetCodeRecord | undefined = undefined;
    if (lcRaw) {
      leetcode = {
        id: lcRaw.id,
        student_id: lcRaw.student_id,
        username: trueUsername || lcRaw.username,
        totalSolved: lcRaw.total_solved,
        easySolved: lcRaw.easy_solved,
        mediumSolved: lcRaw.medium_solved,
        hardSolved: lcRaw.hard_solved,
        contestRating: lcRaw.contest_rating,
        totalAttempted: lcRaw.total_attempted || 0,
        acceptanceRate: lcRaw.acceptance_rate || 0,
        streakDays: lcRaw.streak_days || 0,
        lastUpdated: lcRaw.last_updated
      };
    } else if (trueUsername) {
      leetcode = {
        id: `lc-${Date.now()}`,
        student_id: studentId,
        username: trueUsername,
        totalSolved: 0,
        easySolved: 0,
        mediumSolved: 0,
        hardSolved: 0,
        contestRating: 1200,
        totalAttempted: 0,
        acceptanceRate: 0,
        streakDays: 0,
        lastUpdated: new Date().toISOString()
      };
    }

    const prjRaw = sqlite.prepare('SELECT * FROM project_records WHERE student_id = ?').all(studentId) as any[];
    const projects: ProjectRecord[] = prjRaw.map((p) => ({
      id: p.id,
      student_id: p.student_id,
      title: p.title,
      description: p.description,
      domain: p.domain,
      techStack: JSON.parse(p.tech_stack_json || '[]'),
      isTeam: Boolean(p.is_team),
      studentRole: p.student_role,
      githubUrl: p.github_url,
      category: p.category,
      status: p.status,
      prizeAwarded: p.prize_awarded
    }));

    const achievements = sqlite.prepare('SELECT * FROM achievement_records WHERE student_id = ?').all(studentId) as AchievementRecord[];
    const nptelProofs = this.getNptelProofs(studentId);
    const leetcodeProofs = this.getLeetcodeProofs(studentId);
    const connectedAccounts = this.getConnectedAccounts(studentId);

    return {
      student,
      academics,
      arrears,
      skillEdge,
      nptel,
      nptelProofs,
      attendance,
      discipline,
      certificates,
      participation,
      leetcode,
      leetcodeProofs,
      projects,
      achievements,
      connectedAccounts
    };
  }

  // 360 UPDATERS
  public updateAttendance(studentId: string, presentDays: number, totalDays: number): void {
    const absent = totalDays - presentDays;
    const pct = totalDays > 0 ? Math.round((presentDays / totalDays) * 1000) / 10 : 0;
    const existing = sqlite.prepare('SELECT id FROM attendance_records WHERE student_id = ?').get(studentId);

    if (existing) {
      sqlite.prepare(`
        UPDATE attendance_records SET total_working_days = ?, present_days = ?, absent_days = ?, percentage = ?, last_updated = ?
        WHERE student_id = ?
      `).run(totalDays, presentDays, absent, pct, new Date().toISOString(), studentId);
    } else {
      sqlite.prepare(`
        INSERT INTO attendance_records (id, student_id, total_working_days, present_days, absent_days, od_days, ml_days, percentage, last_updated)
        VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
      `).run(`att-${Date.now()}`, studentId, totalDays, presentDays, absent, pct, new Date().toISOString());
    }
  }

  public updateLeetCode(
    studentId: string,
    arg2: string | number,
    arg3?: number,
    arg4?: number,
    arg5?: number,
    arg6?: number,
    totalAttempted = 0,
    acceptanceRate = 0,
    explicitTotalSolved?: number
  ): void {
    let username = '';
    let easy = 0;
    let medium = 0;
    let hard = 0;
    let rating = 1200;

    const isValidHandleStr = (s: any) => {
      if (typeof s !== 'string') return false;
      const c = s.trim().toLowerCase();
      if (!c || c === 'student' || c === 'leetcode_user' || c === 'null' || c === 'undefined') return false;
      if (/^\d+$/.test(c)) return false;
      return true;
    };

    if (isValidHandleStr(arg2)) {
      username = (arg2 as string).trim();
      easy = typeof arg3 === 'number' ? arg3 : 0;
      medium = typeof arg4 === 'number' ? arg4 : 0;
      hard = typeof arg5 === 'number' ? arg5 : 0;
      rating = typeof arg6 === 'number' ? arg6 : 1200;
    } else {
      easy = typeof arg2 === 'number' ? arg2 : parseInt(String(arg2)) || 0;
      medium = typeof arg3 === 'number' ? arg3 : 0;
      hard = typeof arg4 === 'number' ? arg4 : 0;
      rating = typeof arg5 === 'number' ? arg5 : 1200;
    }

    if (!isValidHandleStr(username)) {
      const existingLc = sqlite.prepare('SELECT username FROM leetcode_stats WHERE student_id = ?').get(studentId) as any;
      const existingConn = sqlite.prepare("SELECT provider_username FROM connected_accounts WHERE student_id = ? AND LOWER(provider) = 'leetcode'").get(studentId) as any;

      if (existingLc && isValidHandleStr(existingLc.username)) {
        username = existingLc.username.trim();
      } else if (existingConn && isValidHandleStr(existingConn.provider_username)) {
        username = existingConn.provider_username.trim();
      } else {
        username = '';
      }
    }

    const sumSolved = easy + medium + hard;
    const total = (typeof explicitTotalSolved === 'number' && explicitTotalSolved > 0)
      ? Math.max(explicitTotalSolved, sumSolved)
      : sumSolved;

    const existing = sqlite.prepare('SELECT id FROM leetcode_stats WHERE student_id = ?').get(studentId);
    const now = new Date().toISOString();

    if (existing) {
      sqlite.prepare(`
        UPDATE leetcode_stats
        SET username = ?, total_solved = ?, easy_solved = ?, medium_solved = ?, hard_solved = ?, contest_rating = ?, total_attempted = ?, acceptance_rate = ?, last_updated = ?
        WHERE student_id = ?
      `).run(username, total, easy, medium, hard, rating, totalAttempted, acceptanceRate, now, studentId);
    } else {
      sqlite.prepare(`
        INSERT INTO leetcode_stats (id, student_id, username, total_solved, easy_solved, medium_solved, hard_solved, contest_rating, total_attempted, acceptance_rate, streak_days, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(`lc-${Date.now()}`, studentId, username, total, easy, medium, hard, rating, totalAttempted, acceptanceRate, now);
    }

    if (isValidHandleStr(username)) {
      this.upsertConnectedAccount(studentId, 'LeetCode', username, 'Connected', 'VERIFIED');
    }
  }

  public updateSkillEdge(studentId: string, pct: number, pts: number): void {
    const existing = sqlite.prepare('SELECT id FROM skilledge_records WHERE student_id = ?').get(studentId);
    if (existing) {
      sqlite.prepare(`
        UPDATE skilledge_records SET overall_completion_pct = ?, total_reward_points = ? WHERE student_id = ?
      `).run(pct, pts, studentId);
    } else {
      sqlite.prepare(`
        INSERT INTO skilledge_records (id, student_id, overall_completion_pct, total_reward_points, tracks_json)
        VALUES (?, ?, ?, ?, '[]')
      `).run(`sk-${Date.now()}`, studentId, pct, pts);
    }
  }

  public addArrearRecord(rec: { studentId: string; semesterNo?: number; subjectCode: string; subjectName: string; status?: string }): string {
    const id = `arr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    sqlite.prepare(`
      INSERT INTO arrear_history (id, student_id, semester_no, subject_code, subject_name, status, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, rec.studentId, rec.semesterNo || 3, rec.subjectCode, rec.subjectName, rec.status || 'PENDING', new Date().toISOString());
    return id;
  }

  public upsertNPTELRecord(studentId: string, rec: {
    id?: string;
    courseName: string;
    durationWeeks?: number;
    weeksCompleted?: number;
    assignmentScore?: number;
    examScore?: number;
    finalScore?: number;
    status?: string;
    accountType?: string;
    connectedEmail?: string;
  }): string {
    const courseName = rec.courseName.trim();
    const durationWeeks = Number(rec.durationWeeks) || 12;
    const weeksCompleted = rec.weeksCompleted !== undefined ? Number(rec.weeksCompleted) : durationWeeks;
    const assignmentScore = rec.assignmentScore !== undefined ? Number(rec.assignmentScore) : 80;
    const examScore = rec.examScore !== undefined ? Number(rec.examScore) : 75;
    const finalScore = rec.finalScore !== undefined ? Number(rec.finalScore) : Math.round((assignmentScore * 0.25) + (examScore * 0.75));
    let status = rec.status;
    if (!status) {
      status = finalScore >= 75 ? 'ELITE' : finalScore >= 60 ? 'SUCCESS' : finalScore >= 40 ? 'COMPLETED' : 'IN_PROGRESS';
    }
    const accountType = rec.accountType || 'college';
    const connectedEmail = rec.connectedEmail || null;
    const now = new Date().toISOString();

    const existing = sqlite.prepare('SELECT id FROM nptel_records WHERE student_id = ? AND LOWER(course_name) = ?').get(studentId, courseName.toLowerCase()) as any;

    if (existing) {
      sqlite.prepare(`
        UPDATE nptel_records
        SET duration_weeks = ?, weeks_completed = ?, assignment_score = ?, exam_score = ?, final_score = ?, status = ?, account_type = ?, connected_email = ?, last_verified = ?
        WHERE id = ?
      `).run(durationWeeks, weeksCompleted, assignmentScore, examScore, finalScore, status, accountType, connectedEmail, now, existing.id);
      return existing.id;
    } else {
      const id = rec.id || `nptel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sqlite.prepare(`
        INSERT INTO nptel_records (id, student_id, course_name, duration_weeks, weeks_completed, assignment_score, exam_score, final_score, status, account_type, connected_email, connected_at, last_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, studentId, courseName, durationWeeks, weeksCompleted, assignmentScore, examScore, finalScore, status, accountType, connectedEmail, now, now);
      return id;
    }
  }

  public saveNPTELRecords(studentId: string, records: any[]): void {
    if (!Array.isArray(records)) return;
    for (const r of records) {
      const courseName = r.courseName || r.course_name;
      if (courseName && typeof courseName === 'string') {
        this.upsertNPTELRecord(studentId, {
          id: r.id,
          courseName,
          durationWeeks: Number(r.durationWeeks || r.duration_weeks) || 12,
          weeksCompleted: Number(r.weeksCompleted || r.weeks_completed) || 12,
          assignmentScore: Number(r.assignmentScore || r.assignment_score) || 80,
          examScore: Number(r.examScore || r.exam_score) || 75,
          finalScore: Number(r.finalScore || r.final_score) || 75,
          status: r.status,
          accountType: r.accountType || r.account_type,
          connectedEmail: r.connectedEmail || r.connected_email
        });
      }
    }
  }

  public addNPTELRecord(rec: { studentId: string; courseName: string; examScore?: number }): string {
    return this.upsertNPTELRecord(rec.studentId, {
      courseName: rec.courseName,
      examScore: rec.examScore || 75
    });
  }

  public addDisciplineRecord(rec: { studentId: string; date?: string; time?: string; category?: string; remark: string; actionTaken?: string; recordedBy: string }): string {
    return this.addDisciplineRecordWithFine({
      studentId: rec.studentId,
      date: rec.date,
      time: rec.time,
      category: rec.category || 'Late Comer',
      remark: rec.remark,
      actionTaken: rec.actionTaken,
      recordedBy: rec.recordedBy
    });
  }

  public addDisciplineRecordWithFine(rec: { studentId: string; date?: string; time?: string; category: string; remark: string; actionTaken?: string; recordedBy: string }): string {
    const id = `disc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const date = rec.date || new Date().toISOString().split('T')[0];
    const time = rec.time || new Date().toLocaleTimeString('en-US', { hour12: true });

    const existing = sqlite.prepare("SELECT COUNT(*) as count FROM discipline_records WHERE student_id = ? AND category = ?").get(rec.studentId, rec.category) as { count: number };
    const violationCount = (existing?.count || 0) + 1;
    let fineAmount = 0;
    let warningAction = rec.actionTaken || 'Warning Logged';

    if (violationCount >= 3) {
      fineAmount = 50 + (violationCount - 3) * 25;
      warningAction = `Repeated Warning — Fine Applicable (₹${fineAmount})`;
    }

    sqlite.prepare(`
      INSERT INTO discipline_records (id, student_id, date, time, category, remark, warning_action, fine_amount, action_taken, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, rec.studentId, date, time, rec.category, rec.remark, warningAction, fineAmount, rec.actionTaken || '', rec.recordedBy);
    return id;
  }

  public getNptelProofs(studentId: string): any[] {
    return sqlite.prepare('SELECT * FROM nptel_proofs WHERE student_id = ? ORDER BY week_no ASC, uploaded_at DESC').all(studentId);
  }

  public getNptelProofById(proofId: string): any {
    return sqlite.prepare('SELECT * FROM nptel_proofs WHERE id = ?').get(proofId);
  }

  public addNptelProof(studentId: string, weekNo: number, proofFilePath: string, originalFileName: string): any {
    // If proof for this week already exists, delete old one
    const existing = sqlite.prepare('SELECT id FROM nptel_proofs WHERE student_id = ? AND week_no = ?').get(studentId, weekNo) as any;
    if (existing) {
      sqlite.prepare('DELETE FROM nptel_proofs WHERE id = ?').run(existing.id);
    }

    const id = `np-proof-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO nptel_proofs (id, student_id, week_no, proof_file_path, original_file_name, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, studentId, weekNo, proofFilePath, originalFileName, now);
    return sqlite.prepare('SELECT * FROM nptel_proofs WHERE id = ?').get(id);
  }

  public deleteNptelProof(proofId: string, studentId: string): void {
    sqlite.prepare('DELETE FROM nptel_proofs WHERE id = ? AND student_id = ?').run(proofId, studentId);
  }

  public getLeetcodeProofs(studentId: string): any[] {
    return sqlite.prepare('SELECT * FROM leetcode_proofs WHERE student_id = ? ORDER BY uploaded_at DESC').all(studentId);
  }

  public addLeetcodeProof(studentId: string, proofFilePath: string, originalFileName: string): any {
    const id = `lc-proof-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO leetcode_proofs (id, student_id, proof_file_path, original_file_name, uploaded_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, studentId, proofFilePath, originalFileName, now);
    return sqlite.prepare('SELECT * FROM leetcode_proofs WHERE id = ?').get(id);
  }

  public deleteLeetcodeProof(proofId: string, studentId: string): void {
    sqlite.prepare('DELETE FROM leetcode_proofs WHERE id = ? AND student_id = ?').run(proofId, studentId);
  }

  public saveAcademicRecords(studentId: string, records: any[]): void {
    if (!Array.isArray(records)) return;
    sqlite.prepare('DELETE FROM academic_records WHERE student_id = ?').run(studentId);
    const stmt = sqlite.prepare(`
      INSERT INTO academic_records (id, student_id, semester_no, sgpa, cgpa, total_credits, subjects_json, exam_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of records) {
      const recId = r.id || `acad-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const semNo = r.semesterNo || r.semester_no || 1;
      const sgpa = r.sgpa || 0.0;
      const cgpa = r.cgpa || 0.0;
      const credits = r.totalCredits || r.total_credits || (r.subjects ? r.subjects.length : 0);
      const subjectsJson = JSON.stringify(r.subjects || []);
      const examType = r.examType || r.exam_type || 'Internal';
      stmt.run(recId, studentId, semNo, sgpa, cgpa, credits, subjectsJson, examType);
    }
  }

  public saveSkillEdgeRecord(studentId: string, skilledge: any): void {
    if (!skilledge) return;
    const existing = sqlite.prepare('SELECT id FROM skilledge_records WHERE student_id = ?').get(studentId);
    const pct = skilledge.overallCompletionPct || skilledge.overall_completion_pct || 0;
    const pts = skilledge.totalRewardPoints || skilledge.total_reward_points || 0;
    const prevPts = skilledge.previousPoints !== undefined ? skilledge.previousPoints : (skilledge.previous_points || 0);
    const delta = skilledge.earnedDelta !== undefined ? skilledge.earnedDelta : (skilledge.earned_delta || 0);
    const status = skilledge.status || 'VERIFIED';
    const handle = skilledge.skilledgeHandle || skilledge.skilledge_handle || '';
    const syncedAt = skilledge.lastSyncedAt || skilledge.last_synced_at || new Date().toISOString();
    const tracksJson = JSON.stringify(skilledge.tracks || []);

    if (existing) {
      sqlite.prepare(`
        UPDATE skilledge_records
        SET overall_completion_pct = ?, total_reward_points = ?, previous_points = ?, earned_delta = ?, status = ?, skilledge_handle = ?, last_synced_at = ?, tracks_json = ?
        WHERE student_id = ?
      `).run(pct, pts, prevPts, delta, status, handle, syncedAt, tracksJson, studentId);
    } else {
      sqlite.prepare(`
        INSERT INTO skilledge_records (id, student_id, overall_completion_pct, total_reward_points, previous_points, earned_delta, status, skilledge_handle, last_synced_at, tracks_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(`sk-${Date.now()}`, studentId, pct, pts, prevPts, delta, status, handle, syncedAt, tracksJson);
    }
  }

  public saveSkillEdgeSyncHistory(data: {
    student_id: string;
    previousPoints: number;
    currentPoints: number;
    earnedDelta: number;
    overallCompletionPct: number;
    tracks: any[];
    syncedAt: string;
    syncSource: string;
    status: string;
    errorMessage?: string;
  }): void {
    const histId = `skhist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    sqlite.prepare(`
      INSERT INTO skilledge_sync_history (id, student_id, previous_points, current_points, earned_delta, overall_completion_pct, tracks_json, synced_at, sync_source, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      histId,
      data.student_id,
      data.previousPoints || 0,
      data.currentPoints || 0,
      data.earnedDelta || 0,
      data.overallCompletionPct || 0,
      JSON.stringify(data.tracks || []),
      data.syncedAt || new Date().toISOString(),
      data.syncSource || 'DAILY_AUTO',
      data.status || 'SUCCESS',
      data.errorMessage || null
    );
  }

  public getSkillEdgeSyncHistory(studentId: string): any[] {
    const rows = sqlite.prepare('SELECT * FROM skilledge_sync_history WHERE student_id = ? ORDER BY synced_at DESC LIMIT 30').all(studentId) as any[];
    return rows.map((r) => ({
      id: r.id,
      student_id: r.student_id,
      previousPoints: r.previous_points,
      currentPoints: r.current_points,
      earnedDelta: r.earned_delta,
      overallCompletionPct: r.overall_completion_pct,
      tracks: JSON.parse(r.tracks_json || '[]'),
      syncedAt: r.synced_at,
      syncSource: r.sync_source,
      status: r.status,
      errorMessage: r.error_message
    }));
  }

  public getSkillEdgeRecord(studentId: string): any {
    const r = sqlite.prepare('SELECT * FROM skilledge_records WHERE student_id = ?').get(studentId) as any;
    if (!r) return undefined;
    return {
      id: r.id,
      student_id: r.student_id,
      overallCompletionPct: r.overall_completion_pct,
      totalRewardPoints: r.total_reward_points,
      previousPoints: r.previous_points || 0,
      earnedDelta: r.earned_delta || 0,
      status: r.status || 'VERIFIED',
      skilledgeHandle: r.skilledge_handle || '',
      lastSyncedAt: r.last_synced_at || '',
      tracks: JSON.parse(r.tracks_json || '[]')
    };
  }

  public saveDisciplineRecords(studentId: string, records: any[]): void {
    if (!Array.isArray(records)) return;
    sqlite.prepare('DELETE FROM discipline_records WHERE student_id = ?').run(studentId);
    const stmt = sqlite.prepare(`
      INSERT INTO discipline_records (id, student_id, date, time, category, remark, warning_action, fine_amount, action_taken, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of records) {
      const recId = r.id || `disc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const date = r.date || new Date().toISOString().split('T')[0];
      const time = r.time || '';
      const cat = r.category || 'Late Comer';
      const remark = r.remark || '';
      const warningAction = r.warningAction || r.warning_action || '';
      const fineAmount = r.fineAmount || r.fine_amount || 0;
      const actionTaken = r.actionTaken || r.action_taken || '';
      const recordedBy = r.recordedBy || r.recorded_by || 'Faculty';
      stmt.run(recId, studentId, date, time, cat, remark, warningAction, fineAmount, actionTaken, recordedBy);
    }
  }

  public saveCertificateRecords(studentId: string, records: any[]): void {
    if (!Array.isArray(records)) return;
    sqlite.prepare('DELETE FROM certificate_records WHERE student_id = ?').run(studentId);
    const stmt = sqlite.prepare(`
      INSERT INTO certificate_records (id, student_id, course_name, platform, category, issue_date, certificate_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of records) {
      const recId = r.id || `cert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const courseName = r.courseName || r.course_name || 'Certificate';
      const platform = r.platform || 'Online';
      const category = r.category || 'Certification';
      const issueDate = r.issueDate || r.issue_date || new Date().toISOString().split('T')[0];
      const certId = r.certificateId || r.certificate_id || '';
      stmt.run(recId, studentId, courseName, platform, category, issueDate, certId);
    }
  }

  public saveParticipationRecords(studentId: string, records: any[]): void {
    if (!Array.isArray(records)) return;
    sqlite.prepare('DELETE FROM participation_records WHERE student_id = ?').run(studentId);
    const stmt = sqlite.prepare(`
      INSERT INTO participation_records (id, student_id, event_name, event_type, organizer, college_name, date, is_team, position, prize_amount, certificate_ref)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of records) {
      const recId = r.id || `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const eventName = r.eventName || r.event_name || 'Event';
      const eventType = r.eventType || r.event_type || 'Symposium';
      const organizer = r.collegeName || r.organizer || 'College';
      const collegeName = r.collegeName || r.organizer || 'College';
      const date = r.date || new Date().toISOString().split('T')[0];
      const isTeam = r.isTeam ? 1 : 0;
      const position = r.position || 'Participant';
      const prizeAmount = r.prizeAmount || r.prize_amount || '';
      const certRef = r.certificateRef || r.certificate_ref || '';
      stmt.run(recId, studentId, eventName, eventType, organizer, collegeName, date, isTeam, position, prizeAmount, certRef);
    }
  }

  public saveProjectRecords(studentId: string, records: any[]): void {
    if (!Array.isArray(records)) return;
    sqlite.prepare('DELETE FROM project_records WHERE student_id = ?').run(studentId);
    const stmt = sqlite.prepare(`
      INSERT INTO project_records (id, student_id, title, description, domain, tech_stack_json, is_team, student_role, github_url, live_url, category, status, prize_awarded)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of records) {
      const recId = r.id || `proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const title = r.title || 'Project Title';
      const description = r.description || '';
      const domain = r.domain || 'AI & ML';
      const techStackJson = JSON.stringify(r.techStack || r.tech_stack || []);
      const isTeam = r.isTeam ? 1 : 0;
      const studentRole = r.studentRole || r.student_role || 'Developer';
      const githubUrl = r.githubUrl || r.github_url || '';
      const liveUrl = r.liveUrl || r.live_url || '';
      const category = r.category || 'Software';
      const status = r.status || 'Completed';
      const prizeAwarded = r.prizeAwarded || r.prize_awarded || '';
      stmt.run(recId, studentId, title, description, domain, techStackJson, isTeam, studentRole, githubUrl, liveUrl, category, status, prizeAwarded);
    }
  }

  public deleteStudent360Record(studentId: string, recordType: string, recordId: string): boolean {
    const type = recordType.toLowerCase();
    let tableName = '';
    if (type === 'academics') tableName = 'academic_records';
    else if (type === 'discipline') tableName = 'discipline_records';
    else if (type === 'certificates' || type === 'certificate') tableName = 'certificate_records';
    else if (type === 'participation') tableName = 'participation_records';
    else if (type === 'projects' || type === 'project') tableName = 'project_records';

    if (!tableName) return false;
    sqlite.prepare(`DELETE FROM ${tableName} WHERE id = ? AND student_id = ?`).run(recordId, studentId);
    return true;
  }

  public getCertificateById(certId: string): any {
    return sqlite.prepare('SELECT * FROM certificate_records WHERE id = ?').get(certId);
  }

  public saveCertificateUpload(rec: {
    studentId: string;
    courseName: string;
    platform: string;
    category: string;
    issueDate: string;
    filePath?: string;
    originalFileName?: string;
  }): string {
    const id = `cert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO certificate_records (id, student_id, course_name, platform, category, issue_date, file_path, original_file_name, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, rec.studentId, rec.courseName, rec.platform, rec.category, rec.issueDate, rec.filePath || '', rec.originalFileName || '', now);
    return id;
  }

  public updateCertificateUpload(
    certId: string,
    studentId: string,
    rec: {
      courseName: string;
      platform: string;
      category: string;
      issueDate: string;
      filePath?: string;
      originalFileName?: string;
    }
  ): boolean {
    const existing = this.getCertificateById(certId);
    if (!existing || existing.student_id !== studentId) return false;

    const filePath = rec.filePath !== undefined ? rec.filePath : existing.file_path;
    const originalFileName = rec.originalFileName !== undefined ? rec.originalFileName : existing.original_file_name;

    sqlite.prepare(`
      UPDATE certificate_records
      SET course_name = ?, platform = ?, category = ?, issue_date = ?, file_path = ?, original_file_name = ?
      WHERE id = ? AND student_id = ?
    `).run(rec.courseName, rec.platform, rec.category, rec.issueDate, filePath, originalFileName, certId, studentId);
    return true;
  }

  public addCertificateRecord(rec: { studentId: string; courseName: string; platform?: string }): string {
    const id = `cert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    sqlite.prepare(`
      INSERT INTO certificate_records (id, student_id, course_name, platform, category, issue_date)
      VALUES (?, ?, ?, ?, 'Technical Certification', ?)
    `).run(id, rec.studentId, rec.courseName, rec.platform || 'Online Platform', new Date().toISOString());
    return id;
  }

  public getParticipationById(partId: string): any {
    return sqlite.prepare('SELECT * FROM participation_records WHERE id = ?').get(partId);
  }

  public saveParticipationUpload(rec: {
    studentId: string;
    eventName: string;
    category: string;
    eventLevel: string;
    organizer: string;
    date: string;
    achievement?: string;
    description?: string;
    filePath?: string;
    originalFileName?: string;
  }): string {
    const id = `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO participation_records (id, student_id, event_name, event_type, organizer, college_name, date, event_level, achievement, position, description, proof_file_path, original_file_name, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      rec.studentId,
      rec.eventName,
      rec.category,
      rec.organizer,
      rec.organizer,
      rec.date,
      rec.eventLevel || 'College',
      rec.achievement || 'Participant',
      rec.achievement || 'Participant',
      rec.description || '',
      rec.filePath || '',
      rec.originalFileName || '',
      now
    );
    return id;
  }

  public updateParticipationUpload(
    partId: string,
    studentId: string,
    rec: {
      eventName: string;
      category: string;
      eventLevel: string;
      organizer: string;
      date: string;
      achievement?: string;
      description?: string;
      filePath?: string;
      originalFileName?: string;
    }
  ): boolean {
    const existing = this.getParticipationById(partId);
    if (!existing || existing.student_id !== studentId) return false;

    const filePath = rec.filePath !== undefined ? rec.filePath : (existing.proof_file_path || existing.file_path);
    const originalFileName = rec.originalFileName !== undefined ? rec.originalFileName : (existing.original_file_name || existing.originalFileName);

    sqlite.prepare(`
      UPDATE participation_records
      SET event_name = ?, event_type = ?, organizer = ?, college_name = ?, date = ?, event_level = ?, achievement = ?, position = ?, description = ?, proof_file_path = ?, original_file_name = ?
      WHERE id = ? AND student_id = ?
    `).run(
      rec.eventName,
      rec.category,
      rec.organizer,
      rec.organizer,
      rec.date,
      rec.eventLevel || 'College',
      rec.achievement || 'Participant',
      rec.achievement || 'Participant',
      rec.description || '',
      filePath || '',
      originalFileName || '',
      partId,
      studentId
    );
    return true;
  }

  public addParticipationRecord(rec: { studentId: string; eventName: string; organizer?: string }): string {
    const id = `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    sqlite.prepare(`
      INSERT INTO participation_records (id, student_id, event_name, event_type, organizer, date, is_team)
      VALUES (?, ?, ?, 'Hackathon', ?, ?, 1)
    `).run(id, rec.studentId, rec.eventName, rec.organizer || 'Institution', new Date().toISOString());
    return id;
  }

  public addProjectRecord(rec: { studentId: string; title: string; description?: string }): string {
    const id = `prj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    sqlite.prepare(`
      INSERT INTO project_records (id, student_id, title, description, domain, tech_stack_json, is_team, student_role, category, status)
      VALUES (?, ?, ?, ?, 'AI & DS', '["Python","React"]', 1, 'Lead', 'Capstone', 'Completed')
    `).run(id, rec.studentId, rec.title, rec.description || 'AI & DS Project');
    return id;
  }

  public addAchievementRecord(rec: { studentId: string; title: string; eventName?: string }): string {
    const id = `ach-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    sqlite.prepare(`
      INSERT INTO achievement_records (id, student_id, title, category, event_name, date, description)
      VALUES (?, ?, ?, 'Honors', ?, ?, 'Awarded for performance excellence')
    `).run(id, rec.studentId, rec.title, rec.eventName || 'Department Expo', new Date().toISOString());
    return id;
  }

  // CONNECTED ACCOUNTS & VERIFIED EXTERNAL METRICS ENGINE
  public getConnectedAccounts(studentId: string): any[] {
    return sqlite.prepare(`
      SELECT * FROM connected_accounts WHERE student_id = ? ORDER BY provider ASC
    `).all(studentId);
  }

  public upsertConnectedAccount(studentId: string, provider: string, providerUsername: string, status = 'Connected', verificationStatus = 'VERIFIED', rawPayload?: any): void {
    const existing = sqlite.prepare('SELECT id FROM connected_accounts WHERE student_id = ? AND provider = ?').get(studentId, provider) as any;
    const now = new Date().toISOString();
    const payloadStr = rawPayload ? JSON.stringify(rawPayload) : null;

    if (existing) {
      sqlite.prepare(`
        UPDATE connected_accounts
        SET provider_username = ?, connection_status = ?, verification_status = ?, last_synced_at = ?, raw_payload_json = ?
        WHERE id = ?
      `).run(providerUsername, status, verificationStatus, now, payloadStr, existing.id);
    } else {
      const id = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sqlite.prepare(`
        INSERT INTO connected_accounts (id, student_id, provider, provider_username, connection_status, verification_status, last_synced_at, raw_payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, studentId, provider, providerUsername, status, verificationStatus, now, payloadStr);
    }
  }

  public getExternalMetrics(studentId: string): any[] {
    return sqlite.prepare(`
      SELECT * FROM external_metrics WHERE student_id = ? ORDER BY synced_at DESC
    `).all(studentId);
  }

  public upsertExternalMetric(studentId: string, source: string, sourceIdentifier: string, metric: string, value: any, verificationStatus = 'VERIFIED'): void {
    const existing = sqlite.prepare('SELECT id FROM external_metrics WHERE student_id = ? AND source = ? AND metric = ?').get(studentId, source, metric) as any;
    const now = new Date().toISOString();
    const strVal = String(value);

    if (existing) {
      sqlite.prepare(`
        UPDATE external_metrics
        SET source_identifier = ?, value = ?, verification_status = ?, synced_at = ?, verified_at = ?
        WHERE id = ?
      `).run(sourceIdentifier, strVal, verificationStatus, now, now, existing.id);
    } else {
      const id = `em-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sqlite.prepare(`
        INSERT INTO external_metrics (id, student_id, source, source_identifier, metric, value, verification_status, synced_at, verified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, studentId, source, sourceIdentifier, metric, strVal, verificationStatus, now, now);
    }
  }

  public isClassCoordinator(facultyUserId: string): boolean {
    const assign = this.getFacultyAssignment(facultyUserId);
    if (assign && assign.role === 'Class Coordinator') return true;
    const user = this.getUserById(facultyUserId);
    return Boolean(user && user.role === 'FACULTY'); // Fallback if assigned
  }

  public resetStudentPasswordByFaculty(facultyUserId: string, studentId: string, newPassword: string): void {
    const student = this.getStudentById(studentId);
    if (!student) throw new Error('Student not found.');

    const user = sqlite.prepare('SELECT id FROM users WHERE email = ? OR identifier = ?').get(student.email, student.register_no) as any;
    if (!user) throw new Error('Student user account not found.');

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(newPassword, salt);

    sqlite.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
    const facUser = this.getUserById(facultyUserId);
    this.logAudit(facultyUserId, facUser ? facUser.email : 'faculty@aids.edu', 'FACULTY', 'RESET_STUDENT_PASSWORD', `STUDENT:${student.register_no}`);
  }

  public setStudentStatusByFaculty(facultyUserId: string, studentId: string, isActive: boolean): void {
    const student = this.getStudentById(studentId);
    if (!student) throw new Error('Student not found.');

    const user = sqlite.prepare('SELECT id FROM users WHERE email = ? OR identifier = ?').get(student.email, student.register_no) as any;
    if (user) {
      sqlite.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, user.id);
    }
    const facUser = this.getUserById(facultyUserId);
    this.logAudit(facultyUserId, facUser ? facUser.email : 'faculty@aids.edu', 'FACULTY', 'TOGGLE_STUDENT_STATUS', `STUDENT:${student.register_no}:ACTIVE:${isActive}`);
  }

  // TEAMS MODULE
  public createTeam(data: { teamName: string; eventName: string; teamHeadStudentId: string; category?: string; projectName?: string; resultPosition?: string; prize?: string; proofFile?: string; members?: string[] }): any {
    const id = `team-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    sqlite.prepare(`
      INSERT INTO teams (id, team_name, event_name, team_head_student_id, category, project_name, result_position, prize, proof_file, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.teamName,
      data.eventName,
      data.teamHeadStudentId,
      data.category || 'Hackathon',
      data.projectName || data.eventName,
      data.resultPosition || '1st Place',
      data.prize || 'Award Winner',
      data.proofFile || null,
      now
    );

    if (Array.isArray(data.members)) {
      data.members.forEach((stuId) => {
        const memId = `tm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        sqlite.prepare('INSERT INTO team_members (id, team_id, student_id, role_in_team) VALUES (?, ?, ?, ?)').run(memId, id, stuId, stuId === data.teamHeadStudentId ? 'Leader' : 'Member');
      });
    }

    return this.getTeamById(id);
  }

  public getTeamById(id: string): any {
    const team = sqlite.prepare('SELECT * FROM teams WHERE id = ?').get(id) as any;
    if (!team) return null;
    const members = sqlite.prepare('SELECT student_id, role_in_team FROM team_members WHERE team_id = ?').all(id);
    return { ...team, members };
  }

  public getTeams(): any[] {
    const teams = sqlite.prepare('SELECT * FROM teams ORDER BY created_date DESC').all() as any[];
    return teams.map((t) => {
      const members = sqlite.prepare('SELECT student_id, role_in_team FROM team_members WHERE team_id = ?').all(t.id);
      return { ...t, members };
    });
  }

  // REPRESENTATIVE EVALUATIONS MODULE
  public upsertRepresentativeEvaluation(data: any): void {
    const existing = sqlite.prepare('SELECT id FROM representative_evaluations WHERE student_id = ? AND evaluation_period = ?').get(data.studentId, data.evaluationPeriod || 'Current Semester') as any;
    const now = new Date().toISOString();

    if (existing) {
      sqlite.prepare(`
        UPDATE representative_evaluations
        SET communication_score = ?, faculty_coordination_score = ?, student_coordination_score = ?,
            attendance_followup_score = ?, late_comer_monitoring_score = ?, academic_updates_score = ?,
            discipline_support_score = ?, cleanliness_responsibility_score = ?, notice_board_score = ?,
            event_coordination_score = ?, responsibility_completion_score = ?, overall_remarks = ?,
            evaluated_by = ?, evaluated_at = ?
        WHERE id = ?
      `).run(
        data.communicationScore || 8, data.facultyCoordinationScore || 8, data.studentCoordinationScore || 8,
        data.attendanceFollowupScore || 8, data.lateComerMonitoringScore || 8, data.academicUpdatesScore || 8,
        data.disciplineSupportScore || 8, data.cleanlinessResponsibilityScore || 8, data.noticeBoardScore || 8,
        data.eventCoordinationScore || 8, data.responsibilityCompletionScore || 8, data.overallRemarks || 'Satisfactory CR Performance',
        data.evaluatedBy, now, existing.id
      );
    } else {
      const id = `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sqlite.prepare(`
        INSERT INTO representative_evaluations (
          id, student_id, year, section, evaluation_period, communication_score, faculty_coordination_score,
          student_coordination_score, attendance_followup_score, late_comer_monitoring_score, academic_updates_score,
          discipline_support_score, cleanliness_responsibility_score, notice_board_score, event_coordination_score,
          responsibility_completion_score, overall_remarks, evaluated_by, evaluated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, data.studentId, data.year || '2nd Year', data.section || 'A', data.evaluationPeriod || 'Current Semester',
        data.communicationScore || 8, data.facultyCoordinationScore || 8, data.studentCoordinationScore || 8,
        data.attendanceFollowupScore || 8, data.lateComerMonitoringScore || 8, data.academicUpdatesScore || 8,
        data.disciplineSupportScore || 8, data.cleanlinessResponsibilityScore || 8, data.noticeBoardScore || 8,
        data.eventCoordinationScore || 8, data.responsibilityCompletionScore || 8, data.overallRemarks || 'Satisfactory CR Performance',
        data.evaluatedBy, now
      );
    }
  }

  public getRepresentativeEvaluation(studentId: string): any {
    return sqlite.prepare('SELECT * FROM representative_evaluations WHERE student_id = ? ORDER BY evaluated_at DESC LIMIT 1').get(studentId);
  }

  // NPTEL GOOGLE OAUTH CONNECTION DATABASE METHODS
  public saveNptelGoogleConnection(studentId: string, data: { connectedEmail: string; emailType?: string; purpose?: string; providerAccountId?: string; connectedOn?: string; lastSynced?: string; status?: string; rawPayload?: any }): void {
    const existing = sqlite.prepare("SELECT id FROM connected_accounts WHERE student_id = ? AND (provider = 'GOOGLE' OR provider = 'NPTEL_GOOGLE') AND (purpose = ? OR purpose IS NULL)").get(studentId, data.purpose || 'NPTEL') as any;
    const now = new Date().toISOString();
    const rawStr = data.rawPayload ? JSON.stringify(data.rawPayload) : null;
    const emailType = data.emailType || 'COLLEGE';
    const purpose = data.purpose || 'NPTEL';
    const providerAccountId = data.providerAccountId || `gacc-${Date.now()}`;

    if (existing) {
      sqlite.prepare(`
        UPDATE connected_accounts
        SET provider = 'GOOGLE', purpose = ?, email_type = ?, connected_email = ?, provider_username = ?, provider_account_id = ?, connection_status = ?, verification_status = 'VERIFIED', last_synced_at = ?, raw_payload_json = ?
        WHERE id = ?
      `).run(purpose, emailType, data.connectedEmail, data.connectedEmail, providerAccountId, data.status || 'CONNECTED', data.lastSynced || now, rawStr, existing.id);
    } else {
      const id = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sqlite.prepare(`
        INSERT INTO connected_accounts (id, student_id, provider, purpose, email_type, connected_email, provider_username, provider_account_id, connection_status, verification_status, connected_at, last_synced_at, raw_payload_json)
        VALUES (?, ?, 'GOOGLE', ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, ?, ?)
      `).run(id, studentId, purpose, emailType, data.connectedEmail, data.connectedEmail, providerAccountId, data.status || 'CONNECTED', data.connectedOn || now, data.lastSynced || now, rawStr);
    }
  }

  public getNptelGoogleConnection(studentId: string, purpose = 'NPTEL'): any {
    const record = sqlite.prepare("SELECT * FROM connected_accounts WHERE student_id = ? AND (provider = 'GOOGLE' OR provider = 'NPTEL_GOOGLE') AND (purpose = ? OR purpose IS NULL OR purpose = 'NPTEL')").get(studentId, purpose) as any;
    if (!record) return null;
    return {
      id: record.id,
      studentId: record.student_id,
      provider: record.provider || 'GOOGLE',
      purpose: record.purpose || 'NPTEL',
      emailType: record.email_type || 'COLLEGE',
      connectedEmail: record.connected_email || record.provider_username,
      providerUsername: record.provider_username,
      providerAccountId: record.provider_account_id || `gacc-${record.id}`,
      status: record.connection_status || 'CONNECTED',
      verificationStatus: record.verification_status || 'VERIFIED',
      connectedAt: record.connected_at || record.last_synced_at,
      lastSynced: record.last_synced_at
    };
  }

  public disconnectNptelGoogleConnection(studentId: string, purpose = 'NPTEL'): void {
    sqlite.prepare("DELETE FROM connected_accounts WHERE student_id = ? AND (provider = 'GOOGLE' OR provider = 'NPTEL_GOOGLE') AND (purpose = ? OR purpose IS NULL OR purpose = 'NPTEL')").run(studentId, purpose);
  }

  // CR ATTENDANCE STYLE DAILY RECORD METHODS
  public saveDailyAttendance(date: string, records: { studentId: string; status: string }[], recordedBy: string): void {
    if (date < '2026-07-13') {
      throw new Error('Attendance dates before 13 July 2026 are not valid or selectable.');
    }
    const now = new Date().toISOString();

    for (const r of records) {
      if (!r.status || r.status === 'UNMARKED') {
        sqlite.prepare('DELETE FROM daily_attendance_records WHERE student_id = ? AND date = ?').run(r.studentId, date);
      } else {
        const existing = sqlite.prepare('SELECT id FROM daily_attendance_records WHERE student_id = ? AND date = ?').get(r.studentId, date) as any;
        if (existing) {
          sqlite.prepare('UPDATE daily_attendance_records SET status = ?, recorded_by = ?, recorded_at = ? WHERE id = ?')
            .run(r.status, recordedBy, now, existing.id);
        } else {
          const id = `attd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          sqlite.prepare('INSERT INTO daily_attendance_records (id, student_id, date, status, recorded_by, recorded_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(id, r.studentId, date, r.status, recordedBy, now);
        }
      }
      this.recalculateStudentAttendancePercentage(r.studentId);
    }
  }

  public getDailyAttendanceByDateForFaculty(facultyId: string, date: string): any[] {
    return sqlite.prepare(`
      SELECT d.*, s.register_no, s.name, s.year, s.section
      FROM daily_attendance_records d
      JOIN students s ON d.student_id = s.id
      WHERE d.date = ? AND (s.created_by_faculty_id = ? OR s.faculty_workspace_id = ?)
    `).all(date, facultyId, facultyId) as any[];
  }

  public getDailyAttendanceByDate(date: string): any[] {
    return sqlite.prepare(`
      SELECT d.*, s.register_no, s.name, s.year, s.section
      FROM daily_attendance_records d
      JOIN students s ON d.student_id = s.id
      WHERE d.date = ?
    `).all(date) as any[];
  }

  public getAttendanceHistoryForFaculty(facultyId: string): any[] {
    const query = `
      SELECT d.date,
        SUM(CASE WHEN d.status = 'PRESENT' THEN 1 ELSE 0 END) as presentCount,
        SUM(CASE WHEN d.status = 'ABSENT' THEN 1 ELSE 0 END) as absentCount,
        SUM(CASE WHEN d.status = 'OD' THEN 1 ELSE 0 END) as odCount,
        SUM(CASE WHEN d.status = 'ML' THEN 1 ELSE 0 END) as mlCount,
        SUM(CASE WHEN d.status = 'LONG_ABSENT' THEN 1 ELSE 0 END) as longAbsentCount,
        COUNT(d.id) as totalMarked
      FROM daily_attendance_records d
      JOIN students s ON d.student_id = s.id
      WHERE d.date >= '2026-07-13' AND (s.created_by_faculty_id = ? OR s.faculty_workspace_id = ?)
      GROUP BY d.date ORDER BY d.date DESC
    `;
    return sqlite.prepare(query).all(facultyId, facultyId) as any[];
  }

  public getAttendanceHistory(year?: string, section?: string): any[] {
    let query = `
      SELECT d.date,
        SUM(CASE WHEN d.status = 'PRESENT' THEN 1 ELSE 0 END) as presentCount,
        SUM(CASE WHEN d.status = 'ABSENT' THEN 1 ELSE 0 END) as absentCount,
        SUM(CASE WHEN d.status = 'OD' THEN 1 ELSE 0 END) as odCount,
        SUM(CASE WHEN d.status = 'ML' THEN 1 ELSE 0 END) as mlCount,
        SUM(CASE WHEN d.status = 'LONG_ABSENT' THEN 1 ELSE 0 END) as longAbsentCount,
        COUNT(d.id) as totalMarked
      FROM daily_attendance_records d
      JOIN students s ON d.student_id = s.id
      WHERE d.date >= '2026-07-13'
    `;
    const params: any[] = [];
    if (year) { query += ' AND s.year = ?'; params.push(year); }
    if (section) { query += ' AND s.section = ?'; params.push(section); }
    query += ' GROUP BY d.date ORDER BY d.date DESC';

    return sqlite.prepare(query).all(...params) as any[];
  }

  public getAttendanceHistoryByDateForFaculty(facultyId: string, date: string): any {
    const query = `
      SELECT d.status, s.id, s.register_no, s.name, s.year, s.section
      FROM daily_attendance_records d
      JOIN students s ON d.student_id = s.id
      WHERE d.date = ? AND (s.created_by_faculty_id = ? OR s.faculty_workspace_id = ?)
    `;
    const rows = sqlite.prepare(query).all(date, facultyId, facultyId) as any[];
    return {
      date,
      presentStudents: rows.filter((r) => r.status === 'PRESENT'),
      absentStudents: rows.filter((r) => r.status === 'ABSENT'),
      odStudents: rows.filter((r) => r.status === 'OD'),
      mlStudents: rows.filter((r) => r.status === 'ML'),
      longAbsentStudents: rows.filter((r) => r.status === 'LONG_ABSENT')
    };
  }

  public getAttendanceHistoryByDate(date: string, year?: string, section?: string): any {
    let query = `
      SELECT d.status, s.id, s.register_no, s.name, s.year, s.section
      FROM daily_attendance_records d
      JOIN students s ON d.student_id = s.id
      WHERE d.date = ?
    `;
    const params: any[] = [date];
    if (year) { query += ' AND s.year = ?'; params.push(year); }
    if (section) { query += ' AND s.section = ?'; params.push(section); }

    const rows = sqlite.prepare(query).all(...params) as any[];
    return {
      date,
      presentStudents: rows.filter((r) => r.status === 'PRESENT'),
      absentStudents: rows.filter((r) => r.status === 'ABSENT'),
      odStudents: rows.filter((r) => r.status === 'OD'),
      mlStudents: rows.filter((r) => r.status === 'ML'),
      longAbsentStudents: rows.filter((r) => r.status === 'LONG_ABSENT')
    };
  }

  public getTeamsForFaculty(facultyId: string): any[] {
    const query = `
      SELECT t.* FROM teams t
      JOIN students s ON t.team_head_student_id = s.id
      WHERE (s.created_by_faculty_id = ? OR s.faculty_workspace_id = ?)
      ORDER BY t.created_date DESC
    `;
    const teams = sqlite.prepare(query).all(facultyId, facultyId) as any[];
    return teams.map((t) => {
      const members = sqlite.prepare('SELECT student_id, role_in_team FROM team_members WHERE team_id = ?').all(t.id);
      return { ...t, members };
    });
  }

  public recalculateStudentAttendancePercentage(studentId: string): void {
    const stu = this.getStudentById(studentId);
    const startDate = (stu && (stu.entry_type === 'Lateral Entry' || (stu as any).entryType === 'Lateral Entry')) ? '2026-08-11' : '2026-07-13';
    const rows = sqlite.prepare("SELECT status FROM daily_attendance_records WHERE student_id = ? AND date >= ?").all(studentId, startDate) as any[];
    const totalWorkingDays = rows.length;
    const presentDays = rows.filter((r) => r.status === 'PRESENT').length;
    const absentDays = rows.filter((r) => r.status === 'ABSENT').length;
    const odDays = rows.filter((r) => r.status === 'OD').length;
    const mlDays = rows.filter((r) => r.status === 'ML').length;
    const attendedCount = presentDays + odDays + mlDays;
    const percentage = totalWorkingDays > 0 ? parseFloat(((attendedCount / totalWorkingDays) * 100).toFixed(2)) : 0.0;
    const now = new Date().toISOString();

    const existing = sqlite.prepare('SELECT id FROM attendance_records WHERE student_id = ?').get(studentId) as any;
    if (existing) {
      sqlite.prepare(`
        UPDATE attendance_records
        SET total_working_days = ?, present_days = ?, absent_days = ?, od_days = ?, ml_days = ?, percentage = ?, last_updated = ?
        WHERE id = ?
      `).run(totalWorkingDays, presentDays, absentDays, odDays, mlDays, percentage, now, existing.id);
    } else {
      const id = `att-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      sqlite.prepare(`
        INSERT INTO attendance_records (id, student_id, total_working_days, present_days, absent_days, od_days, ml_days, percentage, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, studentId, totalWorkingDays, presentDays, absentDays, odDays, mlDays, percentage, now);
    }
  }

  // FACULTY STUDENT CREATION
  public createStudentForFaculty(facultyUserId: string, studentData: any, defaultPassword = 'student123'): any {
    const assignment = this.getFacultyAssignment(facultyUserId);
    const year = studentData.year || (assignment ? assignment.year : '2nd Year');
    const section = studentData.section || (assignment ? assignment.section : 'A');
    const facultyUser = this.getUserById(facultyUserId);
    const coordinatorName = facultyUser ? facultyUser.name : 'Assigned Faculty';

    const cleanEmail = (studentData.email || studentData.collegeEmail || '').trim().toLowerCase();
    const cleanRegNo = (studentData.registerNo || studentData.regNo || '').trim();

    if (!cleanRegNo) {
      throw new Error('Student Register Number is required.');
    }
    if (!cleanEmail) {
      throw new Error('Student College Email ID is required.');
    }

    const existingUser = sqlite.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(identifier) = LOWER(?)').get(cleanEmail, cleanRegNo);
    if (existingUser) {
      throw new Error(`Student account with email ${cleanEmail} or register number ${cleanRegNo} already exists.`);
    }

    const rawPassword = studentData.password || studentData.portalPassword || studentData.collegePortalPassword || defaultPassword;
    if (!rawPassword || String(rawPassword).trim().length === 0) {
      throw new Error('College Portal Password is required.');
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(String(rawPassword).trim(), salt);
    const userId = `user-stu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const studentId = `stu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const entryType = studentData.entryType || studentData.entry_type || 'Regular';

    sqlite.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, identifier, year, section, is_active, created_at)
      VALUES (?, ?, ?, ?, 'STUDENT', ?, ?, ?, 1, ?)
    `).run(userId, studentData.name, cleanEmail, passwordHash, cleanRegNo, year, section, new Date().toISOString());

    sqlite.prepare(`
      INSERT INTO students (id, register_no, name, email, personal_email, department, year, section, batch, class_coordinator_name, cgpa, overall_score, current_rank, entry_type, created_by_faculty_id, faculty_workspace_id)
      VALUES (?, ?, ?, ?, ?, 'AI & DS', ?, ?, ?, ?, ?, 0.0, 1, ?, ?, ?)
    `).run(
      studentId,
      cleanRegNo,
      studentData.name,
      cleanEmail,
      (studentData.personalEmail || studentData.personal_email) ? String(studentData.personalEmail || studentData.personal_email).trim() : null,
      year,
      section,
      studentData.batch || '2023-2027',
      coordinatorName,
      parseFloat(studentData.cgpa) || 0,
      entryType,
      facultyUserId,
      facultyUserId
    );

    this.logAudit(facultyUserId, facultyUser ? facultyUser.email : 'faculty@aids.edu', 'FACULTY', 'CREATE_STUDENT', `REG:${cleanRegNo}`);
    return this.getStudentById(studentId);
  }

  // DELETION ENGINE (ROLE-BASED & AUDITED)
  public deletePerformanceRecord(category: string, recordId: string, studentId: string): void {
    const tableMap: Record<string, string> = {
      academics: 'academic_records',
      arrears: 'arrear_history',
      nptel: 'nptel_records',
      discipline: 'discipline_records',
      certificates: 'certificate_records',
      participation: 'participation_records',
      projects: 'project_records',
      achievements: 'achievement_records',
      skilledge: 'skilledge_records',
      attendance: 'attendance_records',
      leetcode: 'leetcode_stats'
    };

    const tableName = tableMap[category.toLowerCase()];
    if (!tableName) {
      throw new Error(`Invalid performance category: ${category}`);
    }

    sqlite.prepare(`DELETE FROM ${tableName} WHERE id = ? AND student_id = ?`).run(recordId, studentId);
  }

  public deleteFinalizedAward(awardId: string): void {
    sqlite.prepare('DELETE FROM finalized_awards WHERE id = ?').run(awardId);
  }

  // ATTACHMENT / PROOF FILE ENGINE
  public createAttachment(att: AttachmentRecord): void {
    sqlite.prepare(`
      INSERT INTO attachments (id, student_id, record_type, record_id, original_file_name, stored_file_name, mime_type, file_size, uploaded_by_user_id, uploaded_by_role, uploaded_at, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      att.id,
      att.student_id,
      att.record_type,
      att.record_id,
      att.original_file_name,
      att.stored_file_name,
      att.mime_type,
      att.file_size,
      att.uploaded_by_user_id,
      att.uploaded_by_role,
      att.uploaded_at
    );
  }

  public getAttachmentById(id: string): AttachmentRecord | undefined {
    return sqlite.prepare('SELECT * FROM attachments WHERE id = ? AND is_deleted = 0').get(id) as AttachmentRecord | undefined;
  }

  public getAttachmentForRecord(studentId: string, recordType: string, recordId: string): AttachmentRecord | undefined {
    return sqlite.prepare(`
      SELECT * FROM attachments
      WHERE student_id = ? AND record_type = ? AND record_id = ? AND is_deleted = 0
      ORDER BY uploaded_at DESC LIMIT 1
    `).get(studentId, recordType, recordId) as AttachmentRecord | undefined;
  }

  public getAttachmentsForStudent(studentId: string): AttachmentRecord[] {
    return sqlite.prepare(`
      SELECT * FROM attachments
      WHERE student_id = ? AND is_deleted = 0
      ORDER BY uploaded_at DESC
    `).all(studentId) as AttachmentRecord[];
  }

  public softDeleteAttachment(id: string, deletedBy: string): void {
    sqlite.prepare(`
      UPDATE attachments
      SET is_deleted = 1, deleted_at = ?, deleted_by = ?
      WHERE id = ?
    `).run(new Date().toISOString(), deletedBy, id);
  }

  public deleteFacultyUser(userId: string): void {
    sqlite.prepare('DELETE FROM users WHERE id = ? AND role = \'FACULTY\'').run(userId);
    sqlite.prepare('DELETE FROM faculty_assignments WHERE faculty_id = ?').run(userId);
  }

  public deleteHODUser(userId: string): void {
    sqlite.prepare('DELETE FROM users WHERE id = ? AND role = \'HOD\'').run(userId);
  }

  public deleteStudentUser(studentId: string): void {
    const student = this.getStudentById(studentId);
    const stuEmail = student ? (student.email || '') : '';
    const stuReg = student ? (student.registerNo || '') : '';

    sqlite.prepare('DELETE FROM students WHERE id = ?').run(studentId);
    if (student) {
      sqlite.prepare("DELETE FROM users WHERE id = ? OR (role = 'STUDENT' AND (LOWER(email) = LOWER(?) OR LOWER(identifier) = LOWER(?)))").run(studentId, stuEmail, stuReg);
    } else {
      sqlite.prepare("DELETE FROM users WHERE id = ? AND role = 'STUDENT'").run(studentId);
    }

    const tables = [
      'academic_records', 'arrear_history', 'nptel_records', 'nptel_courses',
      'discipline_records', 'certificate_records', 'participation_records',
      'project_records', 'achievement_records', 'skilledge_records',
      'skilledge_history', 'attendance_records', 'leetcode_stats',
      'connected_accounts', 'external_metrics', 'attachments'
    ];
    for (const t of tables) {
      try {
        sqlite.prepare(`DELETE FROM ${t} WHERE student_id = ?`).run(studentId);
      } catch (_err) {
        // Safe fallback if table or column doesn't exist
      }
    }
  }

  // SCORING CONFIG
  public getScoringConfig(): ScoringConfig {
    const cfg = sqlite.prepare('SELECT * FROM scoring_configuration WHERE id = \'default\'').get() as any;
    return {
      academicWeight: cfg.academic_weight,
      skillEdgeWeight: cfg.skilledge_weight,
      nptelWeight: cfg.nptel_weight,
      participationWeight: cfg.participation_weight,
      certificatesWeight: cfg.certificates_weight,
      attendanceWeight: cfg.attendance_weight,
      disciplineWeight: cfg.discipline_weight,
      leetcodeWeight: cfg.leetcode_weight,
      projectsWeight: cfg.projects_weight
    };
  }

  public saveScoringConfig(c: ScoringConfig): void {
    sqlite.prepare(`
      UPDATE scoring_configuration SET academic_weight = ?, skilledge_weight = ?, nptel_weight = ?, participation_weight = ?, certificates_weight = ?, attendance_weight = ?, discipline_weight = ?, leetcode_weight = ?, projects_weight = ?
      WHERE id = 'default'
    `).run(
      c.academicWeight,
      c.skillEdgeWeight,
      c.nptelWeight,
      c.participationWeight,
      c.certificatesWeight,
      c.attendanceWeight,
      c.disciplineWeight,
      c.leetcodeWeight,
      c.projectsWeight
    );
  }

  // FINALIZED AWARDS
  public getFinalizedAwards(): any[] {
    return sqlite.prepare('SELECT * FROM finalized_awards ORDER BY finalized_at DESC').all();
  }

  public finalizeAward(awd: any): void {
    sqlite.prepare(`
      INSERT INTO finalized_awards (id, award_key, award_title, winner_student_id, winner_student_name, register_no, year, section, overall_score, finalized_at, finalized_by_hod_name, ai_explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      awd.id || `awd-${Date.now()}`,
      awd.awardKey || awd.award_key || 'BEST_STUDENT',
      awd.awardTitle || awd.award_title || awd.awardName || 'Best Student of Department',
      awd.winnerStudentId || awd.winner_student_id,
      awd.winnerStudentName || awd.winner_student_name || 'Student',
      awd.registerNo || awd.register_no || '',
      awd.year || '2nd Year',
      awd.section || 'A',
      awd.overallScore || awd.overall_score || 0,
      awd.finalizedAt || awd.finalized_at || new Date().toISOString().split('T')[0],
      awd.finalizedByHODName || awd.finalized_by_hod_name || 'HOD AI & DS',
      awd.aiExplanation || awd.ai_explanation || ''
    );
  }

  // TEAM HEADS REPOSITORY
  public createTeamHead(facultyId: string, headStudentId: string, memberLimit: number): any {
    const id = `th-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO team_heads (id, faculty_id, head_student_id, member_limit, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, facultyId, headStudentId, memberLimit, now, now);
    return this.getTeamHeadById(id);
  }

  public getTeamHeadsForFaculty(facultyId: string): any[] {
    const heads = sqlite.prepare(`
      SELECT th.*,
             s.name as head_name,
             s.register_no as head_register_no,
             s.year as head_year,
             s.section as head_section
      FROM team_heads th
      JOIN students s ON th.head_student_id = s.id
      WHERE th.faculty_id = ?
      ORDER BY th.created_at DESC
    `).all(facultyId) as any[];

    return heads.map((h) => {
      const members = sqlite.prepare(`
        SELECT thm.id as member_rel_id,
               s.id, s.register_no, s.name, s.year, s.section, s.department, s.email, s.personal_email
        FROM team_head_members thm
        JOIN students s ON thm.student_id = s.id
        WHERE thm.team_head_id = ?
        ORDER BY thm.created_at ASC
      `).all(h.id) as any[];

      const addedCount = members.length;
      const remainingSlots = Math.max(0, h.member_limit - addedCount);
      const isFull = addedCount >= h.member_limit;

      return {
        id: h.id,
        facultyId: h.faculty_id,
        headStudentId: h.head_student_id,
        headName: h.head_name,
        headRegisterNo: h.head_register_no,
        headYear: h.head_year,
        headSection: h.head_section,
        memberLimit: h.member_limit,
        addedCount,
        remainingSlots,
        teamStatus: isFull ? `Complete (${addedCount}/${h.member_limit})` : `Incomplete (${addedCount}/${h.member_limit})`,
        members: members.map((m) => ({
          id: m.id,
          registerNo: m.register_no,
          name: m.name,
          year: m.year,
          section: m.section,
          department: m.department,
          email: m.email,
          personalEmail: m.personal_email
        })),
        createdAt: h.created_at,
        updatedAt: h.updated_at
      };
    });
  }

  public getTeamHeadById(id: string): any | null {
    const h = sqlite.prepare(`
      SELECT th.*,
             s.name as head_name,
             s.register_no as head_register_no,
             s.year as head_year,
             s.section as head_section
      FROM team_heads th
      JOIN students s ON th.head_student_id = s.id
      WHERE th.id = ?
    `).get(id) as any;

    if (!h) return null;

    const members = sqlite.prepare(`
      SELECT thm.id as member_rel_id,
             s.id, s.register_no, s.name, s.year, s.section, s.department, s.email, s.personal_email
      FROM team_head_members thm
      JOIN students s ON thm.student_id = s.id
      WHERE thm.team_head_id = ?
      ORDER BY thm.created_at ASC
    `).all(h.id) as any[];

    const addedCount = members.length;
    const remainingSlots = Math.max(0, h.member_limit - addedCount);
    const isFull = addedCount >= h.member_limit;

    return {
      id: h.id,
      facultyId: h.faculty_id,
      headStudentId: h.head_student_id,
      headName: h.head_name,
      headRegisterNo: h.head_register_no,
      headYear: h.head_year,
      headSection: h.head_section,
      memberLimit: h.member_limit,
      addedCount,
      remainingSlots,
      teamStatus: isFull ? `Complete (${addedCount}/${h.member_limit})` : `Incomplete (${addedCount}/${h.member_limit})`,
      members: members.map((m) => ({
        id: m.id,
        registerNo: m.register_no,
        name: m.name,
        year: m.year,
        section: m.section,
        department: m.department,
        email: m.email,
        personalEmail: m.personal_email
      })),
      createdAt: h.created_at,
      updatedAt: h.updated_at
    };
  }

  public updateTeamHeadLimit(id: string, newLimit: number): any {
    const now = new Date().toISOString();
    sqlite.prepare(`
      UPDATE team_heads
      SET member_limit = ?, updated_at = ?
      WHERE id = ?
    `).run(newLimit, now, id);
    return this.getTeamHeadById(id);
  }

  public deleteTeamHead(id: string): void {
    sqlite.prepare('DELETE FROM team_heads WHERE id = ?').run(id);
  }

  public setTeamHeadMembers(teamHeadId: string, studentIds: string[]): any {
    const now = new Date().toISOString();
    sqlite.prepare('DELETE FROM team_head_members WHERE team_head_id = ?').run(teamHeadId);

    const insertStmt = sqlite.prepare(`
      INSERT INTO team_head_members (id, team_head_id, student_id, created_at)
      VALUES (?, ?, ?, ?)
    `);

    for (const sId of studentIds) {
      const relId = `thm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      insertStmt.run(relId, teamHeadId, sId, now);
    }

    return this.getTeamHeadById(teamHeadId);
  }

  public removeTeamHeadMember(teamHeadId: string, studentId: string): any {
    sqlite.prepare('DELETE FROM team_head_members WHERE team_head_id = ? AND student_id = ?').run(teamHeadId, studentId);
    return this.getTeamHeadById(teamHeadId);
  }

  // SUBJECT MANAGEMENT METHODS
  public getSubjects(
    filtersOrYear?: { year?: string; semester?: number; section?: string; search?: string } | string,
    semester?: number,
    section?: string,
    search?: string
  ): SubjectRecord[] {
    let yearFilter: string | undefined;
    let semesterFilter: number | undefined;
    let sectionFilter: string | undefined;
    let searchFilter: string | undefined;

    if (filtersOrYear && typeof filtersOrYear === 'object') {
      yearFilter = filtersOrYear.year;
      semesterFilter = filtersOrYear.semester;
      sectionFilter = filtersOrYear.section;
      searchFilter = filtersOrYear.search;
    } else {
      yearFilter = filtersOrYear as string | undefined;
      semesterFilter = semester;
      sectionFilter = section;
      searchFilter = search;
    }

    let query = 'SELECT * FROM subjects WHERE 1=1';
    const params: any[] = [];

    if (yearFilter && yearFilter !== 'ALL') {
      query += ' AND year = ?';
      params.push(yearFilter);
    }
    if (semesterFilter && Number(semesterFilter) > 0) {
      query += ' AND semester = ?';
      params.push(Number(semesterFilter));
    }
    if (sectionFilter && sectionFilter !== 'ALL') {
      query += " AND (section = ? OR section = 'ALL')";
      params.push(sectionFilter);
    }
    if (searchFilter && String(searchFilter).trim()) {
      const q = `%${String(searchFilter).trim().toLowerCase()}%`;
      query += ' AND (LOWER(subject_code) LIKE ? OR LOWER(subject_name) LIKE ? OR LOWER(faculty_handler) LIKE ?)';
      params.push(q, q, q);
    }

    query += ' ORDER BY year ASC, semester ASC, subject_code ASC';
    const rows = sqlite.prepare(query).all(...params) as any[];

    return rows.map((r) => ({
      id: r.id,
      subjectCode: r.subject_code,
      subject_code: r.subject_code,
      subjectName: r.subject_name,
      subject_name: r.subject_name,
      department: r.department || 'AI & Data Science',
      academicYear: r.academic_year,
      academic_year: r.academic_year,
      year: r.year,
      semester: r.semester,
      section: r.section,
      subjectType: (r.subject_type as any) || 'Theory',
      subject_type: r.subject_type || 'Theory',
      credits: r.credits || 3,
      facultyHandler: r.faculty_handler,
      faculty_handler: r.faculty_handler,
      createdByUserId: r.created_by_user_id,
      created_by_user_id: r.created_by_user_id,
      createdAt: r.created_at,
      created_at: r.created_at
    }));
  }

  public getSubjectById(id: string): SubjectRecord | undefined {
    const r = sqlite.prepare('SELECT * FROM subjects WHERE id = ?').get(id) as any;
    if (!r) return undefined;
    return {
      id: r.id,
      subjectCode: r.subject_code,
      subject_code: r.subject_code,
      subjectName: r.subject_name,
      subject_name: r.subject_name,
      department: r.department || 'AI & Data Science',
      academicYear: r.academic_year,
      academic_year: r.academic_year,
      year: r.year,
      semester: r.semester,
      section: r.section,
      subjectType: (r.subject_type as any) || 'Theory',
      subject_type: r.subject_type || 'Theory',
      credits: r.credits || 3,
      facultyHandler: r.faculty_handler,
      faculty_handler: r.faculty_handler,
      createdByUserId: r.created_by_user_id,
      created_by_user_id: r.created_by_user_id,
      createdAt: r.created_at,
      created_at: r.created_at
    };
  }

  public addSubject(sub: Partial<SubjectRecord>): SubjectRecord {
    const code = sub.subjectCode || (sub as any).subject_code || '';
    const name = sub.subjectName || (sub as any).subject_name || '';
    const dept = sub.department || 'AI & Data Science';
    const acadYear = sub.academicYear || (sub as any).academic_year || '2025-2026';
    const yr = sub.year || (sub as any).year || '2nd Year';
    const sem = Number(sub.semester) || 1;
    const sec = sub.section || (sub as any).section || 'ALL';
    const type = sub.subjectType || (sub as any).subject_type || 'Theory';
    const creditsNum = Number(sub.credits) || 3;
    const handler = sub.facultyHandler || (sub as any).faculty_handler || 'TBD';
    const userId = sub.createdByUserId || (sub as any).created_by_user_id || 'SYSTEM';

    const cleanCode = String(code).trim().toUpperCase();
    const cleanName = String(name).trim();
    const cleanDept = String(dept).trim();
    const cleanAcadYear = String(acadYear).trim();
    const cleanYear = String(yr).trim();
    const cleanSec = String(sec).trim();
    const cleanType = String(type).trim();
    const cleanHandler = String(handler).trim();

    // Duplicate prevention check
    const existing = sqlite.prepare(`
      SELECT id FROM subjects
      WHERE UPPER(subject_code) = ? AND year = ? AND semester = ? AND (section = ? OR section = 'ALL' OR ? = 'ALL')
    `).get(cleanCode, cleanYear, sem, cleanSec, cleanSec) as any;

    if (existing) {
      throw new Error(`Subject Code "${cleanCode}" already exists for ${cleanYear} Semester ${sem} Section ${cleanSec}. Duplicate subject codes are not allowed.`);
    }

    const id = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    sqlite.prepare(`
      INSERT INTO subjects (id, subject_code, subject_name, department, academic_year, year, semester, section, subject_type, credits, faculty_handler, created_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, cleanCode, cleanName, cleanDept, cleanAcadYear, cleanYear, sem, cleanSec, cleanType, creditsNum, cleanHandler, userId, now);

    return this.getSubjectById(id)!;
  }

  public updateSubject(id: string, sub: Partial<SubjectRecord>): SubjectRecord {
    const existing = this.getSubjectById(id);
    if (!existing) {
      throw new Error('Subject record not found.');
    }

    const codeInput = sub.subjectCode || (sub as any).subject_code;
    const nameInput = sub.subjectName || (sub as any).subject_name;
    const deptInput = sub.department;
    const acadYearInput = sub.academicYear || (sub as any).academic_year;
    const yrInput = sub.year;
    const secInput = sub.section;
    const typeInput = sub.subjectType || (sub as any).subject_type;
    const handlerInput = sub.facultyHandler || (sub as any).faculty_handler;

    const cleanCode = codeInput ? String(codeInput).trim().toUpperCase() : existing.subjectCode;
    const cleanName = nameInput ? String(nameInput).trim() : existing.subjectName;
    const cleanDept = deptInput ? String(deptInput).trim() : existing.department;
    const cleanAcadYear = acadYearInput ? String(acadYearInput).trim() : existing.academicYear;
    const cleanYear = yrInput ? String(yrInput).trim() : existing.year;
    const sem = sub.semester !== undefined ? Number(sub.semester) : existing.semester;
    const cleanSec = secInput ? String(secInput).trim().toUpperCase() : existing.section;
    const cleanType = typeInput ? String(typeInput).trim() as any : existing.subjectType;
    const creditsNum = sub.credits !== undefined ? Number(sub.credits) : existing.credits;
    const cleanHandler = handlerInput ? String(handlerInput).trim() : existing.facultyHandler;

    // Check duplicate code if code/year/sem/sec is changing
    if (cleanCode !== existing.subjectCode || cleanYear !== existing.year || sem !== existing.semester || cleanSec !== existing.section) {
      const dup = sqlite.prepare(`
        SELECT id FROM subjects
        WHERE UPPER(subject_code) = ? AND year = ? AND semester = ? AND (section = ? OR section = 'ALL' OR ? = 'ALL') AND id != ?
      `).get(cleanCode, cleanYear, sem, cleanSec, cleanSec, id) as any;

      if (dup) {
        throw new Error(`Subject Code "${cleanCode}" already exists for ${cleanYear} Semester ${sem} Section ${cleanSec}.`);
      }
    }

    sqlite.prepare(`
      UPDATE subjects
      SET subject_code = ?, subject_name = ?, department = ?, academic_year = ?, year = ?, semester = ?, section = ?, subject_type = ?, credits = ?, faculty_handler = ?
      WHERE id = ?
    `).run(cleanCode, cleanName, cleanDept, cleanAcadYear, cleanYear, sem, cleanSec, cleanType, creditsNum, cleanHandler, id);

    return this.getSubjectById(id)!;
  }

  public deleteSubject(id: string): boolean {
    const res = sqlite.prepare('DELETE FROM subjects WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // AUDIT LOGS
  public logAudit(userId: string, email: string, role: string, action: string, resource: string): void {
    sqlite.prepare(`
      INSERT INTO audit_logs (id, user_id, user_email, role, action, target_resource, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(`aud-${Date.now()}`, userId, email, role, action, resource, new Date().toISOString());
  }
}

export const db = new SQLiteDB();
SQLiteDB.initSystemAccounts();
