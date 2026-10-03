import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { isPostgresActive, queryOne, queryAll, executeRun, executeTransaction, sqliteDb } from './postgresAdapter.js';

dotenv.config();

export function safeParseJson<T = any>(val: any, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function safeStringifyJson(val: any): string {
  if (val === null || val === undefined) return '[]';
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

export function normalizeSection(s?: string | null): string {
  if (!s) return '';
  const str = String(s).trim().toUpperCase();
  if (str.startsWith('SECTION ')) return str.replace('SECTION ', '').trim();
  if (str.startsWith('SEC ')) return str.replace('SEC ', '').trim();
  if (str.startsWith('SEC.')) return str.replace('SEC.', '').trim();
  return str;
}

export function normalizeYear(y?: string | null): string {
  if (!y) return '';
  const str = String(y).trim();
  if (str === '1' || str === '1st' || str === 'I') return '1st Year';
  if (str === '2' || str === '2nd' || str === 'II') return '2nd Year';
  if (str === '3' || str === '3rd' || str === 'III') return '3rd Year';
  if (str === '4' || str === '4th' || str === 'IV') return '4th Year';
  return str;
}

const sqlite = sqliteDb;

export async function initDatabaseSchema(): Promise<void> {
  const ddl = `
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
      mobile_number TEXT,
      address TEXT,
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
    CREATE INDEX IF NOT EXISTS idx_students_created_by ON students(created_by_faculty_id);
    CREATE INDEX IF NOT EXISTS idx_students_workspace ON students(faculty_workspace_id);
    CREATE INDEX IF NOT EXISTS idx_conn_acc_stu_prov ON connected_accounts(student_id, provider);
    CREATE INDEX IF NOT EXISTS idx_nptel_proofs_stu ON nptel_proofs(student_id);
    CREATE INDEX IF NOT EXISTS idx_leetcode_proofs_stu ON leetcode_proofs(student_id);
    CREATE INDEX IF NOT EXISTS idx_subjects_code_ctx ON subjects(subject_code, year, semester, section);
    CREATE INDEX IF NOT EXISTS idx_subjects_year_sem ON subjects(year, semester, section);
  `;

  if (isPostgresActive()) {
    const { pgPool } = await import('./postgresAdapter.js');
    if (pgPool) {
      await pgPool.query(ddl);
      const alterCols = [
        `ALTER TABLE students ADD COLUMN IF NOT EXISTS created_by_faculty_id TEXT;`,
        `ALTER TABLE students ADD COLUMN IF NOT EXISTS faculty_workspace_id TEXT;`,
        `ALTER TABLE students ADD COLUMN IF NOT EXISTS personal_email TEXT;`,
        `ALTER TABLE students ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'Regular';`,
        `ALTER TABLE students ADD COLUMN IF NOT EXISTS linkedin_url TEXT;`,
        `ALTER TABLE students ADD COLUMN IF NOT EXISTS github_url TEXT;`,
        `ALTER TABLE students ADD COLUMN IF NOT EXISTS is_elite_student INTEGER DEFAULT 0;`,
        `ALTER TABLE academic_records ADD COLUMN IF NOT EXISTS exam_type TEXT DEFAULT 'Semester';`,
        `ALTER TABLE academic_records ADD COLUMN IF NOT EXISTS created_at TEXT;`,
        `ALTER TABLE discipline_records ADD COLUMN IF NOT EXISTS time TEXT;`,
        `ALTER TABLE discipline_records ADD COLUMN IF NOT EXISTS fine_amount REAL DEFAULT 0;`,
        `ALTER TABLE discipline_records ADD COLUMN IF NOT EXISTS action_taken TEXT;`,
        `ALTER TABLE discipline_records ADD COLUMN IF NOT EXISTS rule_violated TEXT;`,
        `ALTER TABLE discipline_records ADD COLUMN IF NOT EXISTS fine_details TEXT;`,
        `ALTER TABLE certificate_records ADD COLUMN IF NOT EXISTS company_name TEXT;`,
        `ALTER TABLE certificate_records ADD COLUMN IF NOT EXISTS proof_file_path TEXT;`,
        `ALTER TABLE certificate_records ADD COLUMN IF NOT EXISTS created_at TEXT;`,
        `ALTER TABLE nptel_records ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'college';`,
        `ALTER TABLE nptel_records ADD COLUMN IF NOT EXISTS connected_email TEXT;`,
        `ALTER TABLE nptel_records ADD COLUMN IF NOT EXISTS connected_at TEXT;`,
        `ALTER TABLE nptel_records ADD COLUMN IF NOT EXISTS last_verified TEXT;`,
        `ALTER TABLE certificate_records ADD COLUMN IF NOT EXISTS file_path TEXT;`,
        `ALTER TABLE certificate_records ADD COLUMN IF NOT EXISTS original_file_name TEXT;`,
        `ALTER TABLE certificate_records ADD COLUMN IF NOT EXISTS uploaded_at TEXT;`,
        `ALTER TABLE participation_records ADD COLUMN IF NOT EXISTS college_name TEXT;`,
        `ALTER TABLE participation_records ADD COLUMN IF NOT EXISTS proof_file_path TEXT;`,
        `ALTER TABLE participation_records ADD COLUMN IF NOT EXISTS event_level TEXT DEFAULT 'College';`,
        `ALTER TABLE participation_records ADD COLUMN IF NOT EXISTS achievement TEXT;`,
        `ALTER TABLE participation_records ADD COLUMN IF NOT EXISTS description TEXT;`,
        `ALTER TABLE participation_records ADD COLUMN IF NOT EXISTS original_file_name TEXT;`,
        `ALTER TABLE participation_records ADD COLUMN IF NOT EXISTS uploaded_at TEXT;`,
        `ALTER TABLE project_records ADD COLUMN IF NOT EXISTS live_url TEXT;`,
        `ALTER TABLE project_records ADD COLUMN IF NOT EXISTS product_photo_path TEXT;`,
        `ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'NPTEL';`,
        `ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS email_type TEXT DEFAULT 'COLLEGE';`,
        `ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS connected_email TEXT;`,
        `ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS provider_account_id TEXT;`,
        `ALTER TABLE connected_accounts ADD COLUMN IF NOT EXISTS connected_at TEXT;`,
        `ALTER TABLE leetcode_stats ADD COLUMN IF NOT EXISTS total_attempted INTEGER DEFAULT 0;`,
        `ALTER TABLE leetcode_stats ADD COLUMN IF NOT EXISTS acceptance_rate REAL DEFAULT 0.0;`,
        `ALTER TABLE skilledge_records ADD COLUMN IF NOT EXISTS skilledge_handle TEXT;`,
        `ALTER TABLE skilledge_records ADD COLUMN IF NOT EXISTS previous_points INTEGER DEFAULT 0;`,
        `ALTER TABLE skilledge_records ADD COLUMN IF NOT EXISTS earned_delta INTEGER DEFAULT 0;`,
        `ALTER TABLE skilledge_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'VERIFIED';`,
        `ALTER TABLE skilledge_records ADD COLUMN IF NOT EXISTS last_synced_at TEXT;`,
        `ALTER TABLE attachments ADD COLUMN IF NOT EXISTS file_data TEXT;`,
        `ALTER TABLE students ADD COLUMN IF NOT EXISTS mobile_number TEXT;`,
        `ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT;`
      ];
      for (const colSql of alterCols) {
        try { await pgPool.query(colSql); } catch {}
      }
    }
  } else if (sqlite) {
    sqlite.exec(ddl);
    const alterCols = [
      `ALTER TABLE students ADD COLUMN created_by_faculty_id TEXT;`,
      `ALTER TABLE students ADD COLUMN faculty_workspace_id TEXT;`,
      `ALTER TABLE students ADD COLUMN personal_email TEXT;`,
      `ALTER TABLE students ADD COLUMN mobile_number TEXT;`,
      `ALTER TABLE students ADD COLUMN address TEXT;`,
      `ALTER TABLE students ADD COLUMN entry_type TEXT DEFAULT 'Regular';`,
      `ALTER TABLE students ADD COLUMN linkedin_url TEXT;`,
      `ALTER TABLE students ADD COLUMN github_url TEXT;`,
      `ALTER TABLE students ADD COLUMN is_elite_student INTEGER DEFAULT 0;`,
      `ALTER TABLE academic_records ADD COLUMN exam_type TEXT DEFAULT 'Semester';`,
      `ALTER TABLE academic_records ADD COLUMN created_at TEXT;`,
      `ALTER TABLE discipline_records ADD COLUMN time TEXT;`,
      `ALTER TABLE discipline_records ADD COLUMN fine_amount REAL DEFAULT 0;`,
      `ALTER TABLE discipline_records ADD COLUMN action_taken TEXT;`,
      `ALTER TABLE discipline_records ADD COLUMN rule_violated TEXT;`,
      `ALTER TABLE discipline_records ADD COLUMN fine_details TEXT;`,
      `ALTER TABLE certificate_records ADD COLUMN company_name TEXT;`,
      `ALTER TABLE certificate_records ADD COLUMN proof_file_path TEXT;`,
      `ALTER TABLE certificate_records ADD COLUMN created_at TEXT;`,
      `ALTER TABLE nptel_records ADD COLUMN account_type TEXT DEFAULT 'college';`,
      `ALTER TABLE nptel_records ADD COLUMN connected_email TEXT;`,
      `ALTER TABLE nptel_records ADD COLUMN connected_at TEXT;`,
      `ALTER TABLE nptel_records ADD COLUMN last_verified TEXT;`,
      `ALTER TABLE certificate_records ADD COLUMN file_path TEXT;`,
      `ALTER TABLE certificate_records ADD COLUMN original_file_name TEXT;`,
      `ALTER TABLE certificate_records ADD COLUMN uploaded_at TEXT;`,
      `ALTER TABLE participation_records ADD COLUMN college_name TEXT;`,
      `ALTER TABLE participation_records ADD COLUMN proof_file_path TEXT;`,
      `ALTER TABLE participation_records ADD COLUMN event_level TEXT DEFAULT 'College';`,
      `ALTER TABLE participation_records ADD COLUMN achievement TEXT;`,
      `ALTER TABLE participation_records ADD COLUMN description TEXT;`,
      `ALTER TABLE participation_records ADD COLUMN original_file_name TEXT;`,
      `ALTER TABLE participation_records ADD COLUMN uploaded_at TEXT;`,
      `ALTER TABLE project_records ADD COLUMN live_url TEXT;`,
      `ALTER TABLE project_records ADD COLUMN product_photo_path TEXT;`,
      `ALTER TABLE connected_accounts ADD COLUMN purpose TEXT DEFAULT 'NPTEL';`,
      `ALTER TABLE connected_accounts ADD COLUMN email_type TEXT DEFAULT 'COLLEGE';`,
      `ALTER TABLE connected_accounts ADD COLUMN connected_email TEXT;`,
      `ALTER TABLE connected_accounts ADD COLUMN provider_account_id TEXT;`,
      `ALTER TABLE connected_accounts ADD COLUMN connected_at TEXT;`,
      `ALTER TABLE leetcode_stats ADD COLUMN total_attempted INTEGER DEFAULT 0;`,
      `ALTER TABLE leetcode_stats ADD COLUMN acceptance_rate REAL DEFAULT 0.0;`,
      `ALTER TABLE skilledge_records ADD COLUMN skilledge_handle TEXT;`,
      `ALTER TABLE skilledge_records ADD COLUMN previous_points INTEGER DEFAULT 0;`,
      `ALTER TABLE skilledge_records ADD COLUMN earned_delta INTEGER DEFAULT 0;`,
      `ALTER TABLE skilledge_records ADD COLUMN status TEXT DEFAULT 'VERIFIED';`,
      `ALTER TABLE skilledge_records ADD COLUMN last_synced_at TEXT;`,
      `ALTER TABLE attachments ADD COLUMN file_data TEXT;`
    ];
    for (const colSql of alterCols) {
      try { sqlite.exec(colSql); } catch {}
    }
  }

  const hasConfig = await queryOne('SELECT COUNT(*) as cnt FROM scoring_configuration');
  if (!hasConfig || Number(hasConfig.cnt) === 0) {
    await executeRun(`
      INSERT INTO scoring_configuration (id, academic_weight, skilledge_weight, nptel_weight, participation_weight, certificates_weight, attendance_weight, discipline_weight, leetcode_weight, projects_weight)
      VALUES ('default', 25, 15, 10, 10, 10, 10, 5, 10, 5)
    `);
  }

  const hasSubjects = await queryOne('SELECT COUNT(*) as cnt FROM subjects');
  if (!hasSubjects || Number(hasSubjects.cnt) === 0) {
    const defaultSubs = [
      { id: 'sub-seed-1', code: 'AD3401', name: 'Data Structures and Algorithms', dept: 'AI & Data Science', acadYear: '2023-2027', year: '2nd Year', sem: 3, sec: 'ALL', type: 'Theory', credits: 3, handler: 'Assigned Faculty' },
      { id: 'sub-seed-2', code: 'AD3402', name: 'Artificial Intelligence & Neural Networks', dept: 'AI & Data Science', acadYear: '2023-2027', year: '2nd Year', sem: 4, sec: 'ALL', type: 'Theory', credits: 4, handler: 'Class Coordinator' },
      { id: 'sub-seed-3', code: 'AD3411', name: 'Machine Learning Laboratory', dept: 'AI & Data Science', acadYear: '2023-2027', year: '2nd Year', sem: 4, sec: 'ALL', type: 'Practical', credits: 2, handler: 'Class Coordinator' },
      { id: 'sub-seed-4', code: 'AD3501', name: 'Deep Learning & Computer Vision', dept: 'AI & Data Science', acadYear: '2022-2026', year: '3rd Year', sem: 5, sec: 'ALL', type: 'Elective', credits: 3, handler: 'HOD Faculty' }
    ];
    const now = new Date().toISOString();
    for (const s of defaultSubs) {
      await executeRun(`
        INSERT INTO subjects (id, subject_code, subject_name, department, academic_year, year, semester, section, subject_type, credits, faculty_handler, created_by_user_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYSTEM', ?)
      `, [s.id, s.code, s.name, s.dept, s.acadYear, s.year, s.sem, s.sec, s.type, s.credits, s.handler, now]);
    }
  }
}

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
  mobile_number?: string | null;
  mobileNumber?: string | null;
  address?: string | null;
}

export function normalizeStudentRecord(stu: any): StudentRecord | null {
  if (!stu) return null;
  const collegeEmail = (stu.email || stu.collegeEmail || stu.college_email || '').trim();
  const personalEmail = (stu.personal_email || stu.personalEmail || '').trim();
  const mobileNumber = (stu.mobile_number || stu.mobileNumber || '').trim();
  const address = (stu.address || '').trim();
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
    mobile_number: mobileNumber || null,
    mobileNumber: mobileNumber || null,
    address: address || null,
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
  studentId?: string;
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
  file_data?: string | null;
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
    await initDatabaseSchema();
    const adminEmail = (process.env.ADMIN_EMAIL || 'departmentai&ds@gmail.com').trim().toLowerCase();
    const adminInitialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'aids@avs';

    const existingAdmin = await queryOne("SELECT id, email, password_hash FROM users WHERE role = 'ADMIN' OR id = 'admin-sys' OR email = ?", [adminEmail]);

    if (!existingAdmin) {
      const hash = await bcrypt.hash(adminInitialPassword, 10);
      await executeRun(`
        INSERT INTO users (id, email, identifier, name, role, password_hash, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      `, ['admin-sys', adminEmail, 'admin', 'System Administrator', 'ADMIN', hash, new Date().toISOString()]);
      console.log(`🔒 Secure Admin Bootstrap: Initial ADMIN account created for ${adminEmail}.`);
    } else {
      console.log(`🔒 Admin Account Verified: Existing ADMIN account (${existingAdmin.email}) retained without modification.`);
    }

    // ALWAYS ENSURE HOD ACCOUNT EXISTS
    const existingHOD = await queryOne("SELECT id FROM users WHERE role = 'HOD' OR id = 'hod-sys' OR identifier = 'hod' OR email = 'hod.aids@avsenggcollege.ac.in'");
    if (!existingHOD) {
      const hodHash = await bcrypt.hash('hod@123', 10);
      await executeRun(`
        INSERT INTO users (id, email, identifier, name, role, password_hash, is_active, created_at)
        VALUES (?, ?, ?, ?, 'HOD', ?, 1, ?)
      `, ['hod-sys', 'hod.aids@avsenggcollege.ac.in', 'hod', 'Head of Department', hodHash, new Date().toISOString()]);
      console.log('🔒 Default HOD account initialized (hod.aids@avsenggcollege.ac.in / hod).');
    }

    // BOOTSTRAP DEMO ACCOUNTS ONLY IF EXPLICITLY ENABLED
    if (process.env.INITIALIZE_DEMO_ACCOUNTS === 'true') {

      // BOOTSTRAP DEFAULT FACULTY ACCOUNT IF ABSENT
      const existingFaculty = await queryOne("SELECT id, password_hash FROM users WHERE id = 'fac-sys' OR email = 'faculty.aids@avsenggcollege.ac.in' OR identifier = 'faculty'");
      if (!existingFaculty) {
        const facHash = await bcrypt.hash('faculty@123', 10);
        await executeRun(`
          INSERT INTO users (id, email, identifier, name, role, password_hash, year, section, faculty_role, is_active, created_at)
          VALUES (?, ?, ?, ?, 'FACULTY', ?, '2nd Year', 'A', 'Class Coordinator', 1, ?)
        `, ['fac-sys', 'faculty.aids@avsenggcollege.ac.in', 'faculty', 'Assigned Faculty Member', facHash, new Date().toISOString()]);
        console.log('🔒 Default FACULTY account initialized (faculty.aids@avsenggcollege.ac.in / faculty).');
      }

      // BOOTSTRAP DEFAULT STUDENT ACCOUNT IF ABSENT
      const existingStudent = await queryOne("SELECT id, password_hash FROM users WHERE id = 'stu-sys' OR email = 'student.aids@avsenggcollege.ac.in' OR identifier = 'student'");
      if (!existingStudent) {
        const stuHash = await bcrypt.hash('student@123', 10);
        await executeRun(`
          INSERT INTO users (id, email, identifier, name, role, password_hash, year, section, is_active, created_at)
          VALUES (?, ?, ?, ?, 'STUDENT', ?, '2nd Year', 'A', 1, ?)
        `, ['stu-sys', 'student.aids@avsenggcollege.ac.in', 'student', 'Sample AI & DS Student', stuHash, new Date().toISOString()]);

        const stuProfile = await queryOne("SELECT id FROM students WHERE register_no = '730123243001' OR email = 'student.aids@avsenggcollege.ac.in'");
        if (!stuProfile) {
          await executeRun(`
            INSERT INTO students (id, register_no, name, email, department, year, section, batch, class_coordinator_name, cgpa, overall_score, current_rank, is_representative, is_elite_student)
            VALUES (?, '730123243001', 'Sample AI & DS Student', 'student.aids@avsenggcollege.ac.in', 'AI & DS', '2nd Year', 'A', '2023-2027', 'Assigned Faculty Member', 8.5, 85.0, 1, 0, 1)
          `, ['stu-sys']);
        }
        console.log('🔒 Default STUDENT account initialized (student.aids@avsenggcollege.ac.in / student / 730123243001).');
      }
    }
  }

  // USER CRUD
  public async findUserByIdentifier(identifier: string, role?: string): Promise<UserRecord | undefined> {
    const lowerId = identifier.trim().toLowerCase();
    let sql = 'SELECT * FROM users WHERE (LOWER(email) = ? OR LOWER(identifier) = ?)';
    const params: any[] = [lowerId, lowerId];
    if (role) {
      sql += ' AND UPPER(role) = ?';
      params.push(role.trim().toUpperCase());
    }
    let user = (await queryOne<UserRecord>(sql, params)) || undefined;

    if (!user && role?.toUpperCase() === 'HOD' && (lowerId === 'hod' || lowerId === 'hod.aids@avsenggcollege.ac.in')) {
      user = (await queryOne<UserRecord>("SELECT * FROM users WHERE (LOWER(email) = 'hod.aids@avsenggcollege.ac.in' OR LOWER(identifier) = 'hod') AND UPPER(role) = 'HOD'")) || undefined;
    }

    if (!user && role?.toUpperCase() === 'ADMIN' && (lowerId === 'admin' || lowerId === 'departmentai&ds@gmail.com')) {
      user = (await queryOne<UserRecord>("SELECT * FROM users WHERE (LOWER(email) = 'departmentai&ds@gmail.com' OR LOWER(identifier) = 'admin') AND UPPER(role) = 'ADMIN'")) || undefined;
    }

    if (!user && (role?.toUpperCase() === 'STUDENT' || !role)) {
      const student = await queryOne<{ email: string }>('SELECT email FROM students WHERE LOWER(register_no) = ? OR LOWER(email) = ?', [lowerId, lowerId]);
      if (student && student.email) {
        user = (await queryOne<UserRecord>("SELECT * FROM users WHERE (LOWER(email) = ? OR LOWER(identifier) = ?) AND UPPER(role) = 'STUDENT'", [student.email.toLowerCase(), student.email.toLowerCase()])) || undefined;
      }
    }

    if (!user && (role?.toUpperCase() === 'FACULTY' || !role)) {
      user = (await queryOne<UserRecord>("SELECT * FROM users WHERE (LOWER(email) = ? OR LOWER(identifier) = ?) AND UPPER(role) = 'FACULTY'", [lowerId, lowerId])) || undefined;
    }

    return user;
  }

  public async getUserById(id: string): Promise<UserRecord | undefined> {
    return (await queryOne<UserRecord>('SELECT * FROM users WHERE id = ?', [id])) || undefined;
  }

  public async getUsers(role?: string): Promise<UserRecord[]> {
    if (role) {
      return await queryAll<UserRecord>('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC', [role]);
    }
    return await queryAll<UserRecord>('SELECT * FROM users ORDER BY created_at DESC');
  }

  public async createUser(user: {
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
  }): Promise<void> {
    await executeRun(`
      INSERT INTO users (id, email, identifier, name, role, password_hash, year, section, faculty_role, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
    ]);
  }

  public async updateUserPassword(userId: string, newHash: string): Promise<void> {
    await executeRun('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);
  }

  public async updateHODNameEmail(userId: string, name: string, email: string): Promise<void> {
    await executeRun('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, userId]);
  }

  public async updateUserStatus(userId: string, isActive: boolean): Promise<void> {
    await executeRun('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, userId]);
    await executeRun('UPDATE faculty_assignments SET is_active = ? WHERE faculty_id = ?', [isActive ? 1 : 0, userId]);
  }

  public async updateUserAssignment(userId: string, year: string, section: string, facultyRole: string): Promise<void> {
    await executeRun('UPDATE users SET year = ?, section = ?, faculty_role = ? WHERE id = ?', [year, section, facultyRole, userId]);

    const existingAssign = await queryOne('SELECT id FROM faculty_assignments WHERE faculty_id = ?', [userId]);
    if (existingAssign) {
      await executeRun('UPDATE faculty_assignments SET year = ?, section = ?, role = ? WHERE faculty_id = ?', [year, section, facultyRole, userId]);
    } else {
      await executeRun(`
        INSERT INTO faculty_assignments (id, faculty_id, department, year, section, role, is_active, created_at)
        VALUES (?, ?, 'AI & DS', ?, ?, ?, 1, ?)
      `, [`fa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, userId, year, section, facultyRole, new Date().toISOString()]);
    }
  }

  public async getFacultyAssignment(facultyId: string): Promise<FacultyAssignmentRecord | undefined> {
    return (await queryOne<FacultyAssignmentRecord>('SELECT * FROM faculty_assignments WHERE faculty_id = ? AND is_active = 1', [facultyId])) || undefined;
  }

  public async getAllFacultyAssignments(): Promise<Record<string, FacultyAssignmentRecord>> {
    const rows = await queryAll<FacultyAssignmentRecord>('SELECT * FROM faculty_assignments WHERE is_active = 1');
    const map: Record<string, FacultyAssignmentRecord> = {};
    for (const r of rows) {
      map[r.faculty_id] = r;
    }
    return map;
  }

  public async assignStudentsToFaculty(facultyId: string, studentIds: string[]): Promise<void> {
    for (const sid of studentIds) {
      await executeRun(`
        UPDATE students
        SET created_by_faculty_id = ?, faculty_workspace_id = ?
        WHERE id = ?
      `, [facultyId, facultyId, sid]);
    }
  }

  // STUDENT CRUD
  public async getStudentsForFaculty(facultyId: string, year?: string, section?: string): Promise<StudentRecord[]> {
    let targetYear = year;
    let targetSection = section;

    if (facultyId && (!targetYear || !targetSection)) {
      const assignment = await this.getFacultyAssignment(facultyId);
      if (assignment) {
        if (!targetYear) targetYear = assignment.year;
        if (!targetSection) targetSection = assignment.section;
      }
    }

    const cleanYear = targetYear ? normalizeYear(targetYear) : '';
    const cleanSec = targetSection ? normalizeSection(targetSection) : '';

    let sql = 'SELECT * FROM students WHERE 1=1';
    const params: any[] = [];

    if (facultyId) {
      if (cleanYear && cleanYear !== 'ALL' && cleanSec && cleanSec !== 'ALL') {
        sql += ' AND (created_by_faculty_id = ? OR faculty_workspace_id = ? OR (LOWER(TRIM(year)) = LOWER(TRIM(?)) AND UPPER(TRIM(section)) = UPPER(TRIM(?))))';
        params.push(facultyId, facultyId, cleanYear, cleanSec);
      } else if (cleanYear && cleanYear !== 'ALL') {
        sql += ' AND (created_by_faculty_id = ? OR faculty_workspace_id = ? OR LOWER(TRIM(year)) = LOWER(TRIM(?)))';
        params.push(facultyId, facultyId, cleanYear);
      } else if (cleanSec && cleanSec !== 'ALL') {
        sql += ' AND (created_by_faculty_id = ? OR faculty_workspace_id = ? OR UPPER(TRIM(section)) = UPPER(TRIM(?)))';
        params.push(facultyId, facultyId, cleanSec);
      } else {
        sql += ' AND (created_by_faculty_id = ? OR faculty_workspace_id = ?)';
        params.push(facultyId, facultyId);
      }
    } else {
      if (cleanYear && cleanYear !== 'ALL') {
        sql += ' AND LOWER(TRIM(year)) = LOWER(TRIM(?))';
        params.push(cleanYear);
      }
      if (cleanSec && cleanSec !== 'ALL') {
        sql += ' AND UPPER(TRIM(section)) = UPPER(TRIM(?))';
        params.push(cleanSec);
      }
    }

    sql += ' ORDER BY current_rank ASC, overall_score DESC';
    const rows = await queryAll(sql, params);
    return rows.map((r) => normalizeStudentRecord(r)!);
  }

  public async getAllStudents(): Promise<StudentRecord[]> {
    return await this.getStudents('ALL', 'ALL');
  }

  public async getStudents(year?: string, section?: string, facultyId?: string): Promise<StudentRecord[]> {
    if (facultyId) {
      return await this.getStudentsForFaculty(facultyId, year, section);
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
    const rows = await queryAll(sql, params);
    return rows.map((r) => normalizeStudentRecord(r)!);
  }

  public async getEliteStudents(year?: string, section?: string, facultyId?: string): Promise<StudentRecord[]> {
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
    const rows = await queryAll(sql, params);
    return rows.map((r) => normalizeStudentRecord(r)!);
  }

  public async updateStudentEliteStatus(studentId: string, isElite: boolean): Promise<void> {
    await executeRun('UPDATE students SET is_elite_student = ? WHERE id = ?', [isElite ? 1 : 0, studentId]);
  }

  public async updateStudentProfile(
    studentId: string,
    updates: {
      linkedinUrl?: string;
      githubUrl?: string;
      leetcodeUsername?: string;
      cgpa?: number;
      skillEdgePoints?: number;
    }
  ): Promise<void> {
    const student = await this.getStudentById(studentId);
    if (!student) throw new Error('Student record not found.');

    if (updates.linkedinUrl !== undefined || updates.githubUrl !== undefined || updates.cgpa !== undefined) {
      await executeRun(`
        UPDATE students
        SET linkedin_url = ?, github_url = ?, cgpa = ?
        WHERE id = ?
      `, [
        updates.linkedinUrl !== undefined ? updates.linkedinUrl : student.linkedinUrl || null,
        updates.githubUrl !== undefined ? updates.githubUrl : student.githubUrl || null,
        updates.cgpa !== undefined ? updates.cgpa : student.cgpa,
        studentId
      ]);
    }

    if (updates.leetcodeUsername !== undefined) {
      const username = updates.leetcodeUsername.trim();
      const existingLc = await queryOne('SELECT id FROM leetcode_stats WHERE student_id = ?', [studentId]);
      if (existingLc) {
        await executeRun('UPDATE leetcode_stats SET username = ?, last_updated = ? WHERE student_id = ?', [username, new Date().toISOString(), studentId]);
      } else if (username) {
        await executeRun(`
          INSERT INTO leetcode_stats (id, student_id, username, total_solved, easy_solved, medium_solved, hard_solved, contest_rating, total_attempted, acceptance_rate, streak_days, last_updated)
          VALUES (?, ?, ?, 0, 0, 0, 0, 1200, 0, 0.0, 0, ?)
        `, [`lc-${studentId}`, studentId, username, new Date().toISOString()]);
      }
    }

    if (updates.skillEdgePoints !== undefined) {
      const points = updates.skillEdgePoints;
      const existingSe = await queryOne('SELECT id FROM skilledge_records WHERE student_id = ?', [studentId]);
      if (existingSe) {
        await executeRun('UPDATE skilledge_records SET total_reward_points = ? WHERE student_id = ?', [points, studentId]);
      } else {
        await executeRun(`
          INSERT INTO skilledge_records (id, student_id, overall_completion_pct, total_reward_points, tracks_json)
          VALUES (?, ?, 0, ?, '[]')
        `, [`se-${studentId}`, studentId, points]);
      }
    }
  }

  public async getStudentById(id: string): Promise<StudentRecord | undefined> {
    const row = await queryOne('SELECT * FROM students WHERE id = ?', [id]);
    return row ? (normalizeStudentRecord(row) as StudentRecord) : undefined;
  }

  public async getStudentByRegisterNo(regNo: string): Promise<StudentRecord | null> {
    const cleanRegNo = (regNo || '').trim();
    if (!cleanRegNo) return null;
    const row = await queryOne('SELECT * FROM students WHERE LOWER(register_no) = LOWER(?)', [cleanRegNo]);
    return row ? (normalizeStudentRecord(row) as StudentRecord) : null;
  }

  public async upsertStudentWithUserLogin(stu: {
    registerNo: string;
    name: string;
    email: string;
    mobileNumber?: string;
    personalEmail?: string;
    address?: string;
    cgpa?: number;
    year?: string;
    section?: string;
    batch?: string;
    createdByFacultyId?: string;
  }): Promise<StudentRecord> {
    const cleanRegNo = stu.registerNo.trim();
    const cleanEmail = stu.email.trim().toLowerCase();
    const cleanName = stu.name.trim();
    const cleanMobile = stu.mobileNumber ? stu.mobileNumber.trim() : null;
    const cleanPersonalEmail = stu.personalEmail ? stu.personalEmail.trim().toLowerCase() : null;
    const cleanAddress = stu.address ? stu.address.trim() : null;
    const cleanCgpa = typeof stu.cgpa === 'number' ? Math.max(0, Math.min(10, stu.cgpa)) : 0;
    const yearToUse = stu.year || '1st Year';
    const sectionToUse = stu.section || 'A';
    const batchToUse = stu.batch || '2024-2028';

    let existing = await this.getStudentByRegisterNo(cleanRegNo);
    if (!existing) {
      const rowByEmail = await queryOne('SELECT * FROM students WHERE LOWER(email) = ?', [cleanEmail]);
      if (rowByEmail) existing = normalizeStudentRecord(rowByEmail) as StudentRecord;
    }

    const studentId = existing ? existing.id : `stu-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    if (existing) {
      await executeRun(`
        UPDATE students
        SET name = ?, email = ?, personal_email = ?, mobile_number = ?, address = ?, cgpa = ?, year = ?, section = ?, batch = ?
        WHERE id = ?
      `, [cleanName, cleanEmail, cleanPersonalEmail, cleanMobile, cleanAddress, cleanCgpa, yearToUse, sectionToUse, batchToUse, existing.id]);
    } else {
      await executeRun(`
        INSERT INTO students (id, register_no, name, email, personal_email, mobile_number, address, department, year, section, batch, class_coordinator_name, cgpa, overall_score, current_rank, created_by_faculty_id, faculty_workspace_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'AI & DS', ?, ?, ?, 'Assigned Faculty', ?, 0, 99, ?, ?)
      `, [studentId, cleanRegNo, cleanName, cleanEmail, cleanPersonalEmail, cleanMobile, cleanAddress, yearToUse, sectionToUse, batchToUse, cleanCgpa, stu.createdByFacultyId || null, stu.createdByFacultyId || null]);
    }

    // AUTOMATIC STUDENT LOGIN ACCOUNT CREATION / SYNC IN users TABLE
    // Login Email = College Mail ID, Initial Password = Register Number (bcrypt hashed)
    const existingUser = await queryOne("SELECT id, password_hash FROM users WHERE (LOWER(email) = ? OR LOWER(identifier) = ?) AND UPPER(role) = 'STUDENT'", [cleanEmail, cleanRegNo.toLowerCase()]);

    if (!existingUser) {
      const initialPasswordHash = await bcrypt.hash(cleanRegNo, 10);
      const userId = `usr-stu-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await executeRun(`
        INSERT INTO users (id, email, identifier, name, role, password_hash, year, section, is_active, created_at)
        VALUES (?, ?, ?, ?, 'STUDENT', ?, ?, ?, 1, ?)
      `, [userId, cleanEmail, cleanRegNo, cleanName, initialPasswordHash, yearToUse, sectionToUse, new Date().toISOString()]);
    } else {
      await executeRun(`
        UPDATE users
        SET name = ?, email = ?, identifier = ?, year = ?, section = ?
        WHERE id = ?
      `, [cleanName, cleanEmail, cleanRegNo, yearToUse, sectionToUse, existingUser.id]);
    }

    return (await this.getStudentById(studentId))!;
  }

  public async createStudent(stu: {
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
  }): Promise<void> {
    await executeRun(`
      INSERT INTO students (id, register_no, name, email, personal_email, department, year, section, batch, class_coordinator_name, cgpa, overall_score, current_rank, created_by_faculty_id, faculty_workspace_id)
      VALUES (?, ?, ?, ?, ?, 'AI & DS', ?, ?, ?, ?, ?, ?, 99, ?, ?)
    `, [
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
    ]);
  }

  public async updateStudentCGPA(studentId: string, cgpa: number): Promise<void> {
    await executeRun('UPDATE students SET cgpa = ? WHERE id = ?', [cgpa, studentId]);
  }

  public async updateStudentScoreAndRank(studentId: string, overallScore: number, currentRank: number): Promise<void> {
    await executeRun('UPDATE students SET overall_score = ?, current_rank = ? WHERE id = ?', [overallScore, currentRank, studentId]);
  }

  // 360 DEGREE GETTER
  public async getStudent360(studentId: string) {
    const student = await this.getStudentById(studentId);
    if (!student) return null;

    const [
      academicsRaw,
      arrears,
      skillRaw,
      historyRows,
      nptelRaw,
      attRaw,
      discipline,
      certsRaw,
      partRaw,
      lcRaw,
      connLc,
      prjRaw,
      achievements,
      nptelProofs,
      leetcodeProofs,
      connectedAccounts
    ] = await Promise.all([
      queryAll('SELECT * FROM academic_records WHERE student_id = ?', [studentId]),
      queryAll<ArrearRecord>('SELECT * FROM arrear_history WHERE student_id = ?', [studentId]),
      queryOne('SELECT * FROM skilledge_records WHERE student_id = ?', [studentId]),
      queryAll('SELECT * FROM skilledge_sync_history WHERE student_id = ? ORDER BY synced_at DESC LIMIT 15', [studentId]),
      queryAll('SELECT * FROM nptel_records WHERE student_id = ?', [studentId]),
      queryOne('SELECT * FROM attendance_records WHERE student_id = ?', [studentId]),
      queryAll<DisciplineRecord>('SELECT * FROM discipline_records WHERE student_id = ?', [studentId]),
      queryAll('SELECT * FROM certificate_records WHERE student_id = ?', [studentId]),
      queryAll('SELECT * FROM participation_records WHERE student_id = ?', [studentId]),
      queryOne('SELECT * FROM leetcode_stats WHERE student_id = ?', [studentId]),
      queryOne("SELECT provider_username FROM connected_accounts WHERE student_id = ? AND LOWER(provider) = 'leetcode'", [studentId]),
      queryAll('SELECT * FROM project_records WHERE student_id = ?', [studentId]),
      queryAll<AchievementRecord>('SELECT * FROM achievement_records WHERE student_id = ?', [studentId]),
      this.getNptelProofs(studentId),
      this.getLeetcodeProofs(studentId),
      this.getConnectedAccounts(studentId)
    ]);

    const academics: AcademicRecord[] = academicsRaw.map((a) => ({
      ...a,
      subjects: safeParseJson(a.subjects_json, [])
    }));

    let skillEdge: any | undefined = undefined;
    if (skillRaw) {
      const history = historyRows.map((h) => ({
        id: h.id,
        student_id: h.student_id,
        previousPoints: h.previous_points,
        currentPoints: h.current_points,
        earnedDelta: h.earned_delta,
        overallCompletionPct: h.overall_completion_pct,
        tracks: safeParseJson(h.tracks_json, []),
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
        tracks: safeParseJson(skillRaw.tracks_json, []),
        history
      };
    }

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

    const dailyAttendanceLogs = await queryAll(
      'SELECT date, status, recorded_by, recorded_at FROM daily_attendance_records WHERE student_id = ? ORDER BY date DESC',
      [studentId]
    );

    let attendance: AttendanceRecord | undefined = undefined;
    if (attRaw || dailyAttendanceLogs.length > 0) {
      attendance = {
        id: attRaw ? attRaw.id : `att-${studentId}`,
        student_id: studentId,
        studentId: studentId,
        totalWorkingDays: attRaw ? attRaw.total_working_days : dailyAttendanceLogs.length,
        presentDays: attRaw ? attRaw.present_days : dailyAttendanceLogs.filter((d: any) => d.status === 'PRESENT').length,
        absentDays: attRaw ? attRaw.absent_days : dailyAttendanceLogs.filter((d: any) => d.status === 'ABSENT').length,
        odDays: attRaw ? attRaw.od_days : dailyAttendanceLogs.filter((d: any) => d.status === 'OD').length,
        mlDays: attRaw ? attRaw.ml_days : dailyAttendanceLogs.filter((d: any) => d.status === 'ML').length,
        percentage: attRaw ? attRaw.percentage : (dailyAttendanceLogs.length > 0 ? parseFloat((((dailyAttendanceLogs.filter((d: any) => d.status === 'PRESENT' || d.status === 'OD' || d.status === 'ML').length) / dailyAttendanceLogs.length) * 100).toFixed(2)) : 0),
        lastUpdated: attRaw ? attRaw.last_updated : new Date().toISOString(),
        historyLogs: dailyAttendanceLogs.map((d: any) => ({
          date: d.date,
          status: d.status
        }))
      };
    }

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

    const projects: ProjectRecord[] = prjRaw.map((p) => ({
      id: p.id,
      student_id: p.student_id,
      title: p.title,
      description: p.description,
      domain: p.domain,
      techStack: safeParseJson(p.tech_stack_json, []),
      isTeam: Boolean(p.is_team),
      studentRole: p.student_role,
      githubUrl: p.github_url,
      category: p.category,
      status: p.status,
      prizeAwarded: p.prize_awarded
    }));

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
  public async updateAttendance(studentId: string, presentDays: number, totalDays: number): Promise<void> {
    const absent = totalDays - presentDays;
    const pct = totalDays > 0 ? Math.round((presentDays / totalDays) * 1000) / 10 : 0;
    const existing = await queryOne('SELECT id FROM attendance_records WHERE student_id = ?', [studentId]);

    if (existing) {
      await executeRun(`
        UPDATE attendance_records SET total_working_days = ?, present_days = ?, absent_days = ?, percentage = ?, last_updated = ?
        WHERE student_id = ?
      `, [totalDays, presentDays, absent, pct, new Date().toISOString(), studentId]);
    } else {
      await executeRun(`
        INSERT INTO attendance_records (id, student_id, total_working_days, present_days, absent_days, od_days, ml_days, percentage, last_updated)
        VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
      `, [`att-${Date.now()}`, studentId, totalDays, presentDays, absent, pct, new Date().toISOString()]);
    }
  }

  public async updateLeetCode(
    studentId: string,
    arg2: string | number,
    arg3?: number,
    arg4?: number,
    arg5?: number,
    arg6?: number,
    totalAttempted = 0,
    acceptanceRate = 0,
    explicitTotalSolved?: number
  ): Promise<void> {
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
      const existingLc = await queryOne('SELECT username FROM leetcode_stats WHERE student_id = ?', [studentId]);
      const existingConn = await queryOne("SELECT provider_username FROM connected_accounts WHERE student_id = ? AND LOWER(provider) = 'leetcode'", [studentId]);

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

    const existing = await queryOne('SELECT id FROM leetcode_stats WHERE student_id = ?', [studentId]);
    const now = new Date().toISOString();

    if (existing) {
      await executeRun(`
        UPDATE leetcode_stats
        SET username = ?, total_solved = ?, easy_solved = ?, medium_solved = ?, hard_solved = ?, contest_rating = ?, total_attempted = ?, acceptance_rate = ?, last_updated = ?
        WHERE student_id = ?
      `, [username, total, easy, medium, hard, rating, totalAttempted, acceptanceRate, now, studentId]);
    } else {
      await executeRun(`
        INSERT INTO leetcode_stats (id, student_id, username, total_solved, easy_solved, medium_solved, hard_solved, contest_rating, total_attempted, acceptance_rate, streak_days, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `, [`lc-${Date.now()}`, studentId, username, total, easy, medium, hard, rating, totalAttempted, acceptanceRate, now]);
    }

    if (isValidHandleStr(username)) {
      await this.upsertConnectedAccount(studentId, 'LeetCode', username, 'Connected', 'VERIFIED');
    }
  }

  public async updateSkillEdge(studentId: string, pct: number, pts: number): Promise<void> {
    const existing = await queryOne('SELECT id FROM skilledge_records WHERE student_id = ?', [studentId]);
    if (existing) {
      await executeRun(`
        UPDATE skilledge_records SET overall_completion_pct = ?, total_reward_points = ? WHERE student_id = ?
      `, [pct, pts, studentId]);
    } else {
      await executeRun(`
        INSERT INTO skilledge_records (id, student_id, overall_completion_pct, total_reward_points, tracks_json)
        VALUES (?, ?, ?, ?, '[]')
      `, [`sk-${Date.now()}`, studentId, pct, pts]);
    }
  }

  public async addArrearRecord(rec: { studentId: string; semesterNo?: number; subjectCode: string; subjectName: string; status?: string }): Promise<string> {
    const id = `arr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await executeRun(`
      INSERT INTO arrear_history (id, student_id, semester_no, subject_code, subject_name, status, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, rec.studentId, rec.semesterNo || 3, rec.subjectCode, rec.subjectName, rec.status || 'PENDING', new Date().toISOString()]);
    return id;
  }

  public async upsertNPTELRecord(studentId: string, rec: {
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
  }): Promise<string> {
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

    const existing = await queryOne('SELECT id FROM nptel_records WHERE student_id = ? AND LOWER(course_name) = ?', [studentId, courseName.toLowerCase()]);

    if (existing) {
      await executeRun(`
        UPDATE nptel_records
        SET duration_weeks = ?, weeks_completed = ?, assignment_score = ?, exam_score = ?, final_score = ?, status = ?, account_type = ?, connected_email = ?, last_verified = ?
        WHERE id = ?
      `, [durationWeeks, weeksCompleted, assignmentScore, examScore, finalScore, status, accountType, connectedEmail, now, existing.id]);
      return existing.id;
    } else {
      const id = rec.id || `nptel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await executeRun(`
        INSERT INTO nptel_records (id, student_id, course_name, duration_weeks, weeks_completed, assignment_score, exam_score, final_score, status, account_type, connected_email, connected_at, last_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, studentId, courseName, durationWeeks, weeksCompleted, assignmentScore, examScore, finalScore, status, accountType, connectedEmail, now, now]);
      return id;
    }
  }

  public async saveNPTELRecords(studentId: string, records: any[]): Promise<void> {
    if (!Array.isArray(records)) return;
    for (const r of records) {
      const courseName = r.courseName || r.course_name;
      if (courseName && typeof courseName === 'string') {
        await this.upsertNPTELRecord(studentId, {
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

  public async addNPTELRecord(rec: { studentId: string; courseName: string; examScore?: number }): Promise<string> {
    return await this.upsertNPTELRecord(rec.studentId, {
      courseName: rec.courseName,
      examScore: rec.examScore || 75
    });
  }

  public async addDisciplineRecord(rec: { studentId: string; date?: string; time?: string; category?: string; remark: string; actionTaken?: string; recordedBy: string }): Promise<string> {
    return await this.addDisciplineRecordWithFine({
      studentId: rec.studentId,
      date: rec.date,
      time: rec.time,
      category: rec.category || 'Late Comer',
      remark: rec.remark,
      actionTaken: rec.actionTaken,
      recordedBy: rec.recordedBy
    });
  }

  public async addDisciplineRecordWithFine(rec: { studentId: string; date?: string; time?: string; category: string; remark: string; actionTaken?: string; recordedBy: string }): Promise<string> {
    const id = `disc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const date = rec.date || new Date().toISOString().split('T')[0];
    const time = rec.time || new Date().toLocaleTimeString('en-US', { hour12: true });

    const existing = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM discipline_records WHERE student_id = ? AND category = ?", [rec.studentId, rec.category]);
    const violationCount = (existing?.count || 0) + 1;
    let fineAmount = 0;
    let warningAction = rec.actionTaken || 'Warning Logged';

    if (violationCount >= 3) {
      fineAmount = 50 + (violationCount - 3) * 25;
      warningAction = `Repeated Warning — Fine Applicable (₹${fineAmount})`;
    }

    await executeRun(`
      INSERT INTO discipline_records (id, student_id, date, time, category, remark, warning_action, fine_amount, action_taken, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, rec.studentId, date, time, rec.category, rec.remark, warningAction, fineAmount, rec.actionTaken || '', rec.recordedBy]);
    return id;
  }

  public async getNptelProofs(studentId: string): Promise<any[]> {
    return await queryAll('SELECT * FROM nptel_proofs WHERE student_id = ? ORDER BY week_no ASC, uploaded_at DESC', [studentId]);
  }

  public async getNptelProofById(proofId: string): Promise<any> {
    return await queryOne('SELECT * FROM nptel_proofs WHERE id = ?', [proofId]);
  }

  public async addNptelProof(studentId: string, weekNo: number, proofFilePath: string, originalFileName: string): Promise<any> {
    const existing = await queryOne('SELECT id FROM nptel_proofs WHERE student_id = ? AND week_no = ?', [studentId, weekNo]);
    if (existing) {
      await executeRun('DELETE FROM nptel_proofs WHERE id = ?', [existing.id]);
    }

    const id = `np-proof-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    await executeRun(`
      INSERT INTO nptel_proofs (id, student_id, week_no, proof_file_path, original_file_name, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, studentId, weekNo, proofFilePath, originalFileName, now]);
    return await queryOne('SELECT * FROM nptel_proofs WHERE id = ?', [id]);
  }

  public async deleteNptelProof(proofId: string, studentId: string): Promise<void> {
    await executeRun('DELETE FROM nptel_proofs WHERE id = ? AND student_id = ?', [proofId, studentId]);
  }

  public async getLeetcodeProofs(studentId: string): Promise<any[]> {
    return await queryAll('SELECT * FROM leetcode_proofs WHERE student_id = ? ORDER BY uploaded_at DESC', [studentId]);
  }

  public async addLeetcodeProof(studentId: string, proofFilePath: string, originalFileName: string): Promise<any> {
    const id = `lc-proof-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    await executeRun(`
      INSERT INTO leetcode_proofs (id, student_id, proof_file_path, original_file_name, uploaded_at)
      VALUES (?, ?, ?, ?, ?)
    `, [id, studentId, proofFilePath, originalFileName, now]);
    return await queryOne('SELECT * FROM leetcode_proofs WHERE id = ?', [id]);
  }

  public async deleteLeetcodeProof(proofId: string, studentId: string): Promise<void> {
    await executeRun('DELETE FROM leetcode_proofs WHERE id = ? AND student_id = ?', [proofId, studentId]);
  }

  public async saveAcademicRecords(studentId: string, records: any[]): Promise<void> {
    if (!Array.isArray(records)) return;
    await executeRun('DELETE FROM academic_records WHERE student_id = ?', [studentId]);
    for (const r of records) {
      const recId = r.id || `acad-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const semNo = r.semesterNo || r.semester_no || 1;
      const sgpa = r.sgpa || 0.0;
      const cgpa = r.cgpa || 0.0;
      const credits = r.totalCredits || r.total_credits || (r.subjects ? r.subjects.length : 0);
      const subjectsJson = JSON.stringify(r.subjects || []);
      const examType = r.examType || r.exam_type || 'Internal';
      await executeRun(`
        INSERT INTO academic_records (id, student_id, semester_no, sgpa, cgpa, total_credits, subjects_json, exam_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [recId, studentId, semNo, sgpa, cgpa, credits, subjectsJson, examType]);
    }
  }

  public async saveSkillEdgeRecord(studentId: string, skilledge: any): Promise<void> {
    if (!skilledge) return;
    const existing = await queryOne('SELECT id FROM skilledge_records WHERE student_id = ?', [studentId]);
    const pct = skilledge.overallCompletionPct || skilledge.overall_completion_pct || 0;
    const pts = skilledge.totalRewardPoints || skilledge.total_reward_points || 0;
    const prevPts = skilledge.previousPoints !== undefined ? skilledge.previousPoints : (skilledge.previous_points || 0);
    const delta = skilledge.earnedDelta !== undefined ? skilledge.earnedDelta : (skilledge.earned_delta || 0);
    const status = skilledge.status || 'VERIFIED';
    const handle = skilledge.skilledgeHandle || skilledge.skilledge_handle || '';
    const syncedAt = skilledge.lastSyncedAt || skilledge.last_synced_at || new Date().toISOString();
    const tracksJson = JSON.stringify(skilledge.tracks || []);

    if (existing) {
      await executeRun(`
        UPDATE skilledge_records
        SET overall_completion_pct = ?, total_reward_points = ?, previous_points = ?, earned_delta = ?, status = ?, skilledge_handle = ?, last_synced_at = ?, tracks_json = ?
        WHERE student_id = ?
      `, [pct, pts, prevPts, delta, status, handle, syncedAt, tracksJson, studentId]);
    } else {
      await executeRun(`
        INSERT INTO skilledge_records (id, student_id, overall_completion_pct, total_reward_points, previous_points, earned_delta, status, skilledge_handle, last_synced_at, tracks_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [`sk-${Date.now()}`, studentId, pct, pts, prevPts, delta, status, handle, syncedAt, tracksJson]);
    }
  }

  public async saveSkillEdgeSyncHistory(data: {
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
  }): Promise<void> {
    const histId = `skhist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await executeRun(`
      INSERT INTO skilledge_sync_history (id, student_id, previous_points, current_points, earned_delta, overall_completion_pct, tracks_json, synced_at, sync_source, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
    ]);
  }

  public async getSkillEdgeSyncHistory(studentId: string): Promise<any[]> {
    const rows = await queryAll('SELECT * FROM skilledge_sync_history WHERE student_id = ? ORDER BY synced_at DESC LIMIT 30', [studentId]);
    return rows.map((r) => ({
      id: r.id,
      student_id: r.student_id,
      previousPoints: r.previous_points,
      currentPoints: r.current_points,
      earnedDelta: r.earned_delta,
      overallCompletionPct: r.overall_completion_pct,
      tracks: safeParseJson(r.tracks_json, []),
      syncedAt: r.synced_at,
      syncSource: r.sync_source,
      status: r.status,
      errorMessage: r.error_message
    }));
  }

  public async getSkillEdgeRecord(studentId: string): Promise<any> {
    const r = await queryOne('SELECT * FROM skilledge_records WHERE student_id = ?', [studentId]);
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
      tracks: safeParseJson(r.tracks_json, [])
    };
  }

  public async addDisciplineIssue(data: {
    studentId: string;
    date: string;
    time: string;
    category: string;
    ruleViolated: string;
    actionTaken: string;
    fineAmount: number;
    fineDetails?: string;
    remark: string;
    recordedBy: string;
  }): Promise<any> {
    const id = `disc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const date = data.date || new Date().toISOString().split('T')[0];
    const time = data.time || new Date().toTimeString().split(' ')[0];
    const fine = Number(data.fineAmount) || 0;

    await executeRun(`
      INSERT INTO discipline_records (
        id, student_id, date, time, category, rule_violated, remark, warning_action, action_taken, fine_amount, fine_details, recorded_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.studentId,
      date,
      time,
      data.category || 'Discipline Issue',
      data.ruleViolated || '',
      data.remark || '',
      data.actionTaken || '',
      data.actionTaken || '',
      fine,
      data.fineDetails || '',
      data.recordedBy || 'Faculty'
    ]);

    return {
      id,
      student_id: data.studentId,
      date,
      time,
      category: data.category,
      rule_violated: data.ruleViolated,
      remark: data.remark,
      action_taken: data.actionTaken,
      fine_amount: fine,
      fine_details: data.fineDetails,
      recorded_by: data.recordedBy
    };
  }

  public async getAllDisciplineIssues(filters?: {
    search?: string;
    registerNo?: string;
    year?: string;
    section?: string;
    issue?: string;
  }): Promise<any[]> {
    let sql = `
      SELECT 
        d.id,
        d.student_id,
        d.date,
        d.time,
        d.category,
        d.rule_violated,
        d.remark,
        d.warning_action,
        d.action_taken,
        d.fine_amount,
        d.fine_details,
        d.recorded_by,
        s.register_no,
        s.name as student_name,
        s.email as college_email,
        s.year,
        s.section,
        s.department
      FROM discipline_records d
      JOIN students s ON d.student_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.registerNo) {
      sql += ` AND LOWER(s.register_no) = LOWER(?)`;
      params.push(filters.registerNo.trim());
    }

    if (filters?.year && filters.year !== 'ALL') {
      sql += ` AND s.year = ?`;
      params.push(filters.year);
    }

    if (filters?.section && filters.section !== 'ALL') {
      sql += ` AND s.section = ?`;
      params.push(filters.section);
    }

    if (filters?.issue && filters.issue !== 'ALL') {
      sql += ` AND d.category = ?`;
      params.push(filters.issue);
    }

    if (filters?.search && filters.search.trim() !== '') {
      const q = `%${filters.search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(s.register_no) LIKE ? OR LOWER(s.name) LIKE ? OR LOWER(d.category) LIKE ? OR LOWER(d.rule_violated) LIKE ? OR LOWER(d.remark) LIKE ? OR LOWER(d.action_taken) LIKE ?)`;
      params.push(q, q, q, q, q, q);
    }

    sql += ` ORDER BY d.date DESC, d.time DESC, d.id DESC`;

    const rows = await queryAll(sql, params);
    return rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      registerNo: r.register_no,
      studentName: r.student_name,
      collegeEmail: r.college_email,
      year: r.year,
      section: r.section,
      department: r.department,
      date: r.date,
      time: r.time || '',
      issue: r.category,
      category: r.category,
      ruleViolated: r.rule_violated || '',
      actionTaken: r.action_taken || r.warning_action || '',
      fineAmount: Number(r.fine_amount) || 0,
      fineDetails: r.fine_details || '',
      remarks: r.remark || '',
      recordedBy: r.recorded_by
    }));
  }

  public async deleteDisciplineIssue(id: string): Promise<boolean> {
    const res = await executeRun('DELETE FROM discipline_records WHERE id = ?', [id]);
    return res.changes > 0;
  }

  public async saveDisciplineRecords(studentId: string, records: any[]): Promise<void> {
    if (!Array.isArray(records)) return;
    await executeRun('DELETE FROM discipline_records WHERE student_id = ?', [studentId]);
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
      await executeRun(`
        INSERT INTO discipline_records (id, student_id, date, time, category, remark, warning_action, fine_amount, action_taken, recorded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [recId, studentId, date, time, cat, remark, warningAction, fineAmount, actionTaken, recordedBy]);
    }
  }

  public async saveCertificateRecords(studentId: string, records: any[]): Promise<void> {
    if (!Array.isArray(records)) return;
    await executeRun('DELETE FROM certificate_records WHERE student_id = ?', [studentId]);
    for (const r of records) {
      const recId = r.id || `cert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const courseName = r.courseName || r.course_name || 'Certificate';
      const platform = r.platform || 'Online';
      const category = r.category || 'Certification';
      const issueDate = r.issueDate || r.issue_date || new Date().toISOString().split('T')[0];
      const certId = r.certificateId || r.certificate_id || '';
      await executeRun(`
        INSERT INTO certificate_records (id, student_id, course_name, platform, category, issue_date, certificate_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [recId, studentId, courseName, platform, category, issueDate, certId]);
    }
  }

  public async saveParticipationRecords(studentId: string, records: any[]): Promise<void> {
    if (!Array.isArray(records)) return;
    await executeRun('DELETE FROM participation_records WHERE student_id = ?', [studentId]);
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
      await executeRun(`
        INSERT INTO participation_records (id, student_id, event_name, event_type, organizer, college_name, date, is_team, position, prize_amount, certificate_ref)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [recId, studentId, eventName, eventType, organizer, collegeName, date, isTeam, position, prizeAmount, certRef]);
    }
  }

  public async saveProjectRecords(studentId: string, records: any[]): Promise<void> {
    if (!Array.isArray(records)) return;
    await executeRun('DELETE FROM project_records WHERE student_id = ?', [studentId]);
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
      await executeRun(`
        INSERT INTO project_records (id, student_id, title, description, domain, tech_stack_json, is_team, student_role, github_url, live_url, category, status, prize_awarded)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [recId, studentId, title, description, domain, techStackJson, isTeam, studentRole, githubUrl, liveUrl, category, status, prizeAwarded]);
    }
  }

  public async deleteStudent360Record(studentId: string, recordType: string, recordId: string): Promise<boolean> {
    const type = recordType.toLowerCase();
    let tableName = '';
    if (type === 'academics') tableName = 'academic_records';
    else if (type === 'discipline') tableName = 'discipline_records';
    else if (type === 'certificates' || type === 'certificate') tableName = 'certificate_records';
    else if (type === 'participation') tableName = 'participation_records';
    else if (type === 'projects' || type === 'project') tableName = 'project_records';

    if (!tableName) return false;
    const res = await executeRun(`DELETE FROM ${tableName} WHERE id = ? AND student_id = ?`, [recordId, studentId]);
    return res.changes > 0;
  }

  public async getCertificateById(certId: string): Promise<any> {
    return await queryOne('SELECT * FROM certificate_records WHERE id = ?', [certId]);
  }

  public async saveCertificateUpload(rec: {
    studentId: string;
    courseName: string;
    platform: string;
    category: string;
    issueDate: string;
    filePath?: string;
    originalFileName?: string;
  }): Promise<string> {
    const id = `cert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    await executeRun(`
      INSERT INTO certificate_records (id, student_id, course_name, platform, category, issue_date, file_path, original_file_name, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, rec.studentId, rec.courseName, rec.platform, rec.category, rec.issueDate, rec.filePath || '', rec.originalFileName || '', now]);
    return id;
  }

  public async updateCertificateUpload(
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
  ): Promise<boolean> {
    const existing = await this.getCertificateById(certId);
    if (!existing || existing.student_id !== studentId) return false;

    const filePath = rec.filePath !== undefined ? rec.filePath : existing.file_path;
    const originalFileName = rec.originalFileName !== undefined ? rec.originalFileName : existing.original_file_name;

    await executeRun(`
      UPDATE certificate_records
      SET course_name = ?, platform = ?, category = ?, issue_date = ?, file_path = ?, original_file_name = ?
      WHERE id = ? AND student_id = ?
    `, [rec.courseName, rec.platform, rec.category, rec.issueDate, filePath, originalFileName, certId, studentId]);
    return true;
  }

  public async addCertificateRecord(rec: { studentId: string; courseName: string; platform?: string }): Promise<string> {
    const id = `cert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await executeRun(`
      INSERT INTO certificate_records (id, student_id, course_name, platform, category, issue_date)
      VALUES (?, ?, ?, ?, 'Technical Certification', ?)
    `, [id, rec.studentId, rec.courseName, rec.platform || 'Online Platform', new Date().toISOString()]);
    return id;
  }

  public async getParticipationById(partId: string): Promise<any> {
    return await queryOne('SELECT * FROM participation_records WHERE id = ?', [partId]);
  }

  public async saveParticipationUpload(rec: {
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
  }): Promise<string> {
    const id = `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    await executeRun(`
      INSERT INTO participation_records (id, student_id, event_name, event_type, organizer, college_name, date, event_level, achievement, position, description, proof_file_path, original_file_name, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
    ]);
    return id;
  }

  public async updateParticipationUpload(
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
  ): Promise<boolean> {
    const existing = await this.getParticipationById(partId);
    if (!existing || existing.student_id !== studentId) return false;

    const filePath = rec.filePath !== undefined ? rec.filePath : (existing.proof_file_path || existing.file_path);
    const originalFileName = rec.originalFileName !== undefined ? rec.originalFileName : (existing.original_file_name || existing.originalFileName);

    await executeRun(`
      UPDATE participation_records
      SET event_name = ?, event_type = ?, organizer = ?, college_name = ?, date = ?, event_level = ?, achievement = ?, position = ?, description = ?, proof_file_path = ?, original_file_name = ?
      WHERE id = ? AND student_id = ?
    `, [
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
    ]);
    return true;
  }

  public async addParticipationRecord(rec: { studentId: string; eventName: string; organizer?: string }): Promise<string> {
    const id = `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await executeRun(`
      INSERT INTO participation_records (id, student_id, event_name, event_type, organizer, date, is_team)
      VALUES (?, ?, ?, 'Hackathon', ?, ?, 1)
    `, [id, rec.studentId, rec.eventName, rec.organizer || 'Institution', new Date().toISOString()]);
    return id;
  }

  public async addProjectRecord(rec: { studentId: string; title: string; description?: string }): Promise<string> {
    const id = `prj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await executeRun(`
      INSERT INTO project_records (id, student_id, title, description, domain, tech_stack_json, is_team, student_role, category, status)
      VALUES (?, ?, ?, ?, 'AI & DS', '["Python","React"]', 1, 'Lead', 'Capstone', 'Completed')
    `, [id, rec.studentId, rec.title, rec.description || 'AI & DS Project']);
    return id;
  }

  public async addAchievementRecord(rec: { studentId: string; title: string; eventName?: string }): Promise<string> {
    const id = `ach-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await executeRun(`
      INSERT INTO achievement_records (id, student_id, title, category, event_name, date, description)
      VALUES (?, ?, ?, 'Honors', ?, ?, 'Awarded for performance excellence')
    `, [id, rec.studentId, rec.title, rec.eventName || 'Department Expo', new Date().toISOString()]);
    return id;
  }

  // CONNECTED ACCOUNTS & VERIFIED EXTERNAL METRICS ENGINE
  public async getConnectedAccounts(studentId: string): Promise<any[]> {
    return await queryAll(`
      SELECT * FROM connected_accounts WHERE student_id = ? ORDER BY provider ASC
    `, [studentId]);
  }

  public async upsertConnectedAccount(studentId: string, provider: string, providerUsername: string, status = 'Connected', verificationStatus = 'VERIFIED', rawPayload?: any): Promise<void> {
    const existing = await queryOne('SELECT id FROM connected_accounts WHERE student_id = ? AND provider = ?', [studentId, provider]);
    const now = new Date().toISOString();
    const payloadStr = rawPayload ? JSON.stringify(rawPayload) : null;

    if (existing) {
      await executeRun(`
        UPDATE connected_accounts
        SET provider_username = ?, connection_status = ?, verification_status = ?, last_synced_at = ?, raw_payload_json = ?
        WHERE id = ?
      `, [providerUsername, status, verificationStatus, now, payloadStr, existing.id]);
    } else {
      const id = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await executeRun(`
        INSERT INTO connected_accounts (id, student_id, provider, provider_username, connection_status, verification_status, last_synced_at, raw_payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, studentId, provider, providerUsername, status, verificationStatus, now, payloadStr]);
    }
  }

  public async getExternalMetrics(studentId: string): Promise<any[]> {
    return await queryAll(`
      SELECT * FROM external_metrics WHERE student_id = ? ORDER BY synced_at DESC
    `, [studentId]);
  }

  public async upsertExternalMetric(studentId: string, source: string, sourceIdentifier: string, metric: string, value: any, verificationStatus = 'VERIFIED'): Promise<void> {
    const existing = await queryOne('SELECT id FROM external_metrics WHERE student_id = ? AND source = ? AND metric = ?', [studentId, source, metric]);
    const now = new Date().toISOString();
    const strVal = String(value);

    if (existing) {
      await executeRun(`
        UPDATE external_metrics
        SET source_identifier = ?, value = ?, verification_status = ?, synced_at = ?, verified_at = ?
        WHERE id = ?
      `, [sourceIdentifier, strVal, verificationStatus, now, now, existing.id]);
    } else {
      const id = `em-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await executeRun(`
        INSERT INTO external_metrics (id, student_id, source, source_identifier, metric, value, verification_status, synced_at, verified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, studentId, source, sourceIdentifier, metric, strVal, verificationStatus, now, now]);
    }
  }

  public async isClassCoordinator(facultyUserId: string): Promise<boolean> {
    const assign = await this.getFacultyAssignment(facultyUserId);
    if (assign && assign.role === 'Class Coordinator') return true;
    const user = await this.getUserById(facultyUserId);
    return Boolean(user && user.role === 'FACULTY');
  }

  public async resetStudentPasswordByFaculty(facultyUserId: string, studentId: string, newPassword: string): Promise<void> {
    const student = await this.getStudentById(studentId);
    if (!student) throw new Error('Student not found.');

    const user = await queryOne('SELECT id FROM users WHERE email = ? OR identifier = ?', [student.email, student.register_no]);
    if (!user) throw new Error('Student user account not found.');

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(newPassword, salt);

    await executeRun('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
    const facUser = await this.getUserById(facultyUserId);
    await this.logAudit(facultyUserId, facUser ? facUser.email : 'faculty@aids.edu', 'FACULTY', 'RESET_STUDENT_PASSWORD', `STUDENT:${student.register_no}`);
  }

  public async setStudentStatusByFaculty(facultyUserId: string, studentId: string, isActive: boolean): Promise<void> {
    const student = await this.getStudentById(studentId);
    if (!student) throw new Error('Student not found.');

    const user = await queryOne('SELECT id FROM users WHERE email = ? OR identifier = ?', [student.email, student.register_no]);
    if (user) {
      await executeRun('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, user.id]);
    }
    const facUser = await this.getUserById(facultyUserId);
    await this.logAudit(facultyUserId, facUser ? facUser.email : 'faculty@aids.edu', 'FACULTY', 'TOGGLE_STUDENT_STATUS', `STUDENT:${student.register_no}:ACTIVE:${isActive}`);
  }

  // TEAMS MODULE
  public async createTeam(data: { teamName: string; eventName: string; teamHeadStudentId: string; category?: string; projectName?: string; resultPosition?: string; prize?: string; proofFile?: string; members?: string[] }): Promise<any> {
    const id = `team-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    await executeRun(`
      INSERT INTO teams (id, team_name, event_name, team_head_student_id, category, project_name, result_position, prize, proof_file, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
    ]);

    if (Array.isArray(data.members)) {
      for (const stuId of data.members) {
        const memId = `tm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await executeRun('INSERT INTO team_members (id, team_id, student_id, role_in_team) VALUES (?, ?, ?, ?)', [memId, id, stuId, stuId === data.teamHeadStudentId ? 'Leader' : 'Member']);
      }
    }

    return await this.getTeamById(id);
  }

  public async getTeamById(id: string): Promise<any> {
    const team = await queryOne('SELECT * FROM teams WHERE id = ?', [id]);
    if (!team) return null;
    const members = await queryAll('SELECT student_id, role_in_team FROM team_members WHERE team_id = ?', [id]);
    return { ...team, members };
  }

  public async getTeams(): Promise<any[]> {
    const teams = await queryAll('SELECT * FROM teams ORDER BY created_date DESC');
    const result: any[] = [];
    for (const t of teams) {
      const members = await queryAll('SELECT student_id, role_in_team FROM team_members WHERE team_id = ?', [t.id]);
      result.push({ ...t, members });
    }
    return result;
  }

  // REPRESENTATIVE EVALUATIONS MODULE
  public async upsertRepresentativeEvaluation(data: any): Promise<void> {
    const existing = await queryOne('SELECT id FROM representative_evaluations WHERE student_id = ? AND evaluation_period = ?', [data.studentId, data.evaluationPeriod || 'Current Semester']);
    const now = new Date().toISOString();

    if (existing) {
      await executeRun(`
        UPDATE representative_evaluations
        SET communication_score = ?, faculty_coordination_score = ?, student_coordination_score = ?,
            attendance_followup_score = ?, late_comer_monitoring_score = ?, academic_updates_score = ?,
            discipline_support_score = ?, cleanliness_responsibility_score = ?, notice_board_score = ?,
            event_coordination_score = ?, responsibility_completion_score = ?, overall_remarks = ?,
            evaluated_by = ?, evaluated_at = ?
        WHERE id = ?
      `, [
        data.communicationScore || 8, data.facultyCoordinationScore || 8, data.studentCoordinationScore || 8,
        data.attendanceFollowupScore || 8, data.lateComerMonitoringScore || 8, data.academicUpdatesScore || 8,
        data.disciplineSupportScore || 8, data.cleanlinessResponsibilityScore || 8, data.noticeBoardScore || 8,
        data.eventCoordinationScore || 8, data.responsibilityCompletionScore || 8, data.overallRemarks || 'Satisfactory CR Performance',
        data.evaluatedBy, now, existing.id
      ]);
    } else {
      const id = `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await executeRun(`
        INSERT INTO representative_evaluations (
          id, student_id, year, section, evaluation_period, communication_score, faculty_coordination_score,
          student_coordination_score, attendance_followup_score, late_comer_monitoring_score, academic_updates_score,
          discipline_support_score, cleanliness_responsibility_score, notice_board_score, event_coordination_score,
          responsibility_completion_score, overall_remarks, evaluated_by, evaluated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, data.studentId, data.year || '2nd Year', data.section || 'A', data.evaluationPeriod || 'Current Semester',
        data.communicationScore || 8, data.facultyCoordinationScore || 8, data.studentCoordinationScore || 8,
        data.attendanceFollowupScore || 8, data.lateComerMonitoringScore || 8, data.academicUpdatesScore || 8,
        data.disciplineSupportScore || 8, data.cleanlinessResponsibilityScore || 8, data.noticeBoardScore || 8,
        data.eventCoordinationScore || 8, data.responsibilityCompletionScore || 8, data.overallRemarks || 'Satisfactory CR Performance',
        data.evaluatedBy, now
      ]);
    }
  }

  public async getRepresentativeEvaluation(studentId: string): Promise<any> {
    return await queryOne('SELECT * FROM representative_evaluations WHERE student_id = ? ORDER BY evaluated_at DESC LIMIT 1', [studentId]);
  }

  // NPTEL GOOGLE OAUTH CONNECTION DATABASE METHODS
  public async saveNptelGoogleConnection(studentId: string, data: { connectedEmail: string; emailType?: string; purpose?: string; providerAccountId?: string; connectedOn?: string; lastSynced?: string; status?: string; rawPayload?: any }): Promise<void> {
    const existing = await queryOne("SELECT id FROM connected_accounts WHERE student_id = ? AND (provider = 'GOOGLE' OR provider = 'NPTEL_GOOGLE') AND (purpose = ? OR purpose IS NULL)", [studentId, data.purpose || 'NPTEL']);
    const now = new Date().toISOString();
    const rawStr = data.rawPayload ? JSON.stringify(data.rawPayload) : null;
    const emailType = data.emailType || 'COLLEGE';
    const purpose = data.purpose || 'NPTEL';
    const providerAccountId = data.providerAccountId || `gacc-${Date.now()}`;

    if (existing) {
      await executeRun(`
        UPDATE connected_accounts
        SET provider = 'GOOGLE', purpose = ?, email_type = ?, connected_email = ?, provider_username = ?, provider_account_id = ?, connection_status = ?, verification_status = 'VERIFIED', last_synced_at = ?, raw_payload_json = ?
        WHERE id = ?
      `, [purpose, emailType, data.connectedEmail, data.connectedEmail, providerAccountId, data.status || 'CONNECTED', data.lastSynced || now, rawStr, existing.id]);
    } else {
      const id = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await executeRun(`
        INSERT INTO connected_accounts (id, student_id, provider, purpose, email_type, connected_email, provider_username, provider_account_id, connection_status, verification_status, connected_at, last_synced_at, raw_payload_json)
        VALUES (?, ?, 'GOOGLE', ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, ?, ?)
      `, [id, studentId, purpose, emailType, data.connectedEmail, data.connectedEmail, providerAccountId, data.status || 'CONNECTED', data.connectedOn || now, data.lastSynced || now, rawStr]);
    }
  }

  public async getNptelGoogleConnection(studentId: string, purpose = 'NPTEL'): Promise<any> {
    const record = await queryOne("SELECT * FROM connected_accounts WHERE student_id = ? AND (provider = 'GOOGLE' OR provider = 'NPTEL_GOOGLE') AND (purpose = ? OR purpose IS NULL OR purpose = 'NPTEL')", [studentId, purpose]);
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

  public async disconnectNptelGoogleConnection(studentId: string, purpose = 'NPTEL'): Promise<void> {
    await executeRun("DELETE FROM connected_accounts WHERE student_id = ? AND (provider = 'GOOGLE' OR provider = 'NPTEL_GOOGLE') AND (purpose = ? OR purpose IS NULL OR purpose = 'NPTEL')", [studentId, purpose]);
  }

  // CR ATTENDANCE STYLE DAILY RECORD METHODS
  public async saveDailyAttendance(date: string, records: { studentId: string; status: string }[], recordedBy: string): Promise<void> {
    const now = new Date().toISOString();

    for (const r of records) {
      if (!r.status || r.status === 'UNMARKED') {
        await executeRun('DELETE FROM daily_attendance_records WHERE student_id = ? AND date = ?', [r.studentId, date]);
      } else {
        const existing = await queryOne('SELECT id FROM daily_attendance_records WHERE student_id = ? AND date = ?', [r.studentId, date]);
        if (existing) {
          await executeRun('UPDATE daily_attendance_records SET status = ?, recorded_by = ?, recorded_at = ? WHERE id = ?', [r.status, recordedBy, now, existing.id]);
        } else {
          const id = `attd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          await executeRun('INSERT INTO daily_attendance_records (id, student_id, date, status, recorded_by, recorded_at) VALUES (?, ?, ?, ?, ?, ?)', [id, r.studentId, date, r.status, recordedBy, now]);
        }
      }
      await this.recalculateStudentAttendancePercentage(r.studentId);
    }
  }

  public async getDailyAttendanceByDateForFaculty(facultyId: string, date: string): Promise<any[]> {
    return await queryAll(`
      SELECT d.*, s.register_no, s.name, s.year, s.section
      FROM daily_attendance_records d
      JOIN students s ON d.student_id = s.id
      WHERE d.date = ? AND (s.created_by_faculty_id = ? OR s.faculty_workspace_id = ?)
    `, [date, facultyId, facultyId]);
  }

  public async getDailyAttendanceByDate(date: string): Promise<any[]> {
    return await queryAll(`
      SELECT d.*, s.register_no, s.name, s.year, s.section
      FROM daily_attendance_records d
      JOIN students s ON d.student_id = s.id
      WHERE d.date = ?
    `, [date]);
  }

  public async getClassDailyAttendanceByDate(date: string, facultyId?: string, year?: string, section?: string): Promise<any[]> {
    let studentQuery = `SELECT id, register_no, name, year, section, entry_type FROM students WHERE 1=1`;
    const params: any[] = [];
    if (facultyId) {
      studentQuery += ` AND (created_by_faculty_id = ? OR faculty_workspace_id = ?)`;
      params.push(facultyId, facultyId);
    }
    if (year && year !== 'ALL') {
      studentQuery += ` AND year = ?`;
      params.push(year);
    }
    if (section && section !== 'ALL') {
      studentQuery += ` AND section = ?`;
      params.push(section);
    }
    studentQuery += ` ORDER BY register_no ASC`;

    const students = await queryAll(studentQuery, params);

    const dailyRecords = await queryAll(
      `SELECT d.* FROM daily_attendance_records d WHERE d.date = ?`,
      [date]
    );
    const statusMap = new Map<string, any>();
    dailyRecords.forEach((r) => statusMap.set(r.student_id, r));

    return students.map((s) => {
      const rec = statusMap.get(s.id);
      return {
        studentId: s.id,
        registerNo: s.register_no,
        name: s.name,
        year: s.year,
        section: s.section,
        entryType: s.entry_type || 'Regular',
        date,
        status: rec ? rec.status : 'UNMARKED',
        recordedBy: rec ? rec.recorded_by : null,
        recordedAt: rec ? rec.recorded_at : null
      };
    });
  }

  public async getMonthlyAttendanceSummary(facultyId?: string, year?: string, section?: string): Promise<any[]> {
    let query = `
      SELECT s.id as student_id, s.register_no, s.name, s.year, s.section, s.entry_type,
             COALESCE(a.total_working_days, 0) as total_working_days,
             COALESCE(a.present_days, 0) as present_days,
             COALESCE(a.absent_days, 0) as absent_days,
             COALESCE(a.od_days, 0) as od_days,
             COALESCE(a.ml_days, 0) as ml_days,
             COALESCE(a.percentage, 0) as percentage,
             a.last_updated
      FROM students s
      LEFT JOIN attendance_records a ON s.id = a.student_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (facultyId) {
      query += ` AND (s.created_by_faculty_id = ? OR s.faculty_workspace_id = ?)`;
      params.push(facultyId, facultyId);
    }
    if (year && year !== 'ALL') {
      query += ` AND s.year = ?`;
      params.push(year);
    }
    if (section && section !== 'ALL') {
      query += ` AND s.section = ?`;
      params.push(section);
    }
    query += ` ORDER BY s.register_no ASC`;
    return await queryAll(query, params);
  }

  public async previewBulkAttendanceImport(rows: any[], facultyId?: string): Promise<{
    summary: {
      totalRowsProcessed: number;
      totalValidDailyRecords: number;
      totalMatchedStudents: number;
      totalUnmatchedRegNos: number;
      totalDuplicateEntries: number;
      totalInvalidRows: number;
    };
    validRecords: Array<{ studentId: string; registerNo: string; studentName: string; date: string; status: string; year: string; section: string }>;
    unmatchedRegisterNumbers: Array<{ registerNo: string; row: number; date?: string; status?: string; reason: string }>;
    duplicateRegisterNumbers: Array<{ registerNo: string; date: string; row: number; reason: string }>;
    invalidRows: Array<{ row: number; registerNo?: string; date?: string; status?: string; reason: string }>;
  }> {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('No attendance rows provided in input.');
    }

    let studentPool: any[] = [];
    if (facultyId) {
      studentPool = await queryAll(
        'SELECT id, register_no, name, year, section FROM students WHERE created_by_faculty_id = ? OR faculty_workspace_id = ?',
        [facultyId, facultyId]
      );
    } else {
      studentPool = await queryAll('SELECT id, register_no, name, year, section FROM students');
    }

    // STRICT MATCHING KEY: REGISTER NUMBER ONLY (trimmed & uppercase)
    const dbStudentMap = new Map<string, any>();
    studentPool.forEach((s) => {
      if (s.register_no) {
        dbStudentMap.set(s.register_no.trim().toUpperCase(), s);
      }
    });

    const validRecords: Array<{ studentId: string; registerNo: string; studentName: string; date: string; status: string; year: string; section: string }> = [];
    const unmatchedRegisterNumbers: Array<{ registerNo: string; row: number; date?: string; status?: string; reason: string }> = [];
    const duplicateRegisterNumbers: Array<{ registerNo: string; date: string; row: number; reason: string }> = [];
    const invalidRows: Array<{ row: number; registerNo?: string; date?: string; status?: string; reason: string }> = [];

    const seenFileEntries = new Map<string, number>();
    const seenFileRegNosInMatrix = new Set<string>();
    const matchedStudentIds = new Set<string>();

    const normalizeDate = (raw: string): string | null => {
      if (!raw) return null;
      const cleaned = String(raw).trim();
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(cleaned)) {
        const parts = cleaned.split(/[-/]/);
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(cleaned)) {
        const parts = cleaned.split(/[-/]/);
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
      return null;
    };

    const normalizeStatus = (raw: string): string | null => {
      if (!raw) return null;
      const s = String(raw).trim().toUpperCase();
      if (['P', 'PRESENT', '1', 'YES'].includes(s)) return 'PRESENT';
      if (['A', 'ABSENT', '0', 'NO'].includes(s)) return 'ABSENT';
      if (['OD', 'ON DUTY', 'ON_DUTY', 'ONDUTY'].includes(s)) return 'OD';
      if (['ML', 'LEAVE', 'MEDICAL LEAVE', 'L', 'MEDICAL_LEAVE'].includes(s)) return 'ML';
      if (['LA', 'LONG ABSENT', 'LONG_ABSENT'].includes(s)) return 'LONG_ABSENT';
      return null;
    };

    rows.forEach((r, idx) => {
      const rowNum = idx + 1;
      if (!r || typeof r !== 'object') {
        invalidRows.push({ row: rowNum, reason: 'Empty or invalid row object.' });
        return;
      }

      // STRICTLY USE REGISTER NUMBER ONLY
      const rawRegNo = r['Register Number'] || r['Register No'] || r.registerNo || r.register_no || r.regNo || r['REG_NO'] || r['Reg No'];
      if (!rawRegNo || String(rawRegNo).trim() === '') {
        invalidRows.push({ row: rowNum, reason: 'Missing Register Number column.' });
        return;
      }

      const regNoClean = String(rawRegNo).trim();
      const regNoKey = regNoClean.toUpperCase();
      const matchedStudent = dbStudentMap.get(regNoKey);

      const rawDate = r['Date'] || r['Attendance Date'] || r.date || r['DATE'];
      const rawStatus = r['Status'] || r['Attendance Status'] || r.status || r['STATUS'];

      if (rawDate !== undefined && rawStatus !== undefined) {
        // ROW-BASED FORMAT
        const normDate = normalizeDate(String(rawDate));
        const normStatus = normalizeStatus(String(rawStatus));

        if (!normDate) {
          invalidRows.push({ row: rowNum, registerNo: regNoClean, date: String(rawDate), status: String(rawStatus), reason: `Invalid date format: ${rawDate}` });
          return;
        }

        if (!normStatus) {
          invalidRows.push({ row: rowNum, registerNo: regNoClean, date: normDate, status: String(rawStatus), reason: `Invalid attendance status: ${rawStatus}` });
          return;
        }

        if (!matchedStudent) {
          unmatchedRegisterNumbers.push({
            registerNo: regNoClean,
            row: rowNum,
            date: normDate,
            status: normStatus,
            reason: facultyId ? 'Register Number not found in your assigned workspace/class.' : 'Register Number does not exist in student database.'
          });
          return;
        }

        const comboKey = `${regNoKey}_${normDate}`;
        if (seenFileEntries.has(comboKey)) {
          duplicateRegisterNumbers.push({
            registerNo: regNoClean,
            date: normDate,
            row: rowNum,
            reason: `Duplicate entry for Register Number ${regNoClean} on date ${normDate} (First seen at row ${seenFileEntries.get(comboKey)}).`
          });
          return;
        }
        seenFileEntries.set(comboKey, rowNum);

        matchedStudentIds.add(matchedStudent.id);
        validRecords.push({
          studentId: matchedStudent.id,
          registerNo: matchedStudent.register_no,
          studentName: matchedStudent.name,
          date: normDate,
          status: normStatus,
          year: matchedStudent.year,
          section: matchedStudent.section
        });

      } else {
        // MATRIX FORMAT
        if (seenFileRegNosInMatrix.has(regNoKey)) {
          duplicateRegisterNumbers.push({
            registerNo: regNoClean,
            date: 'ALL',
            row: rowNum,
            reason: `Duplicate Register Number ${regNoClean} row in matrix upload file.`
          });
        } else {
          seenFileRegNosInMatrix.add(regNoKey);
        }

        if (!matchedStudent) {
          unmatchedRegisterNumbers.push({
            registerNo: regNoClean,
            row: rowNum,
            reason: facultyId ? 'Register Number not found in your assigned workspace/class.' : 'Register Number does not exist in student database.'
          });
          return;
        }

        let dateCountInRow = 0;
        Object.keys(r).forEach((colName) => {
          const colDateNorm = normalizeDate(colName);
          if (colDateNorm) {
            const colStatusNorm = normalizeStatus(String(r[colName]));
            if (colStatusNorm) {
              dateCountInRow++;
              const comboKey = `${regNoKey}_${colDateNorm}`;
              if (seenFileEntries.has(comboKey)) {
                duplicateRegisterNumbers.push({
                  registerNo: regNoClean,
                  date: colDateNorm,
                  row: rowNum,
                  reason: `Duplicate attendance value for Register Number ${regNoClean} on date ${colDateNorm}.`
                });
              } else {
                seenFileEntries.set(comboKey, rowNum);
                matchedStudentIds.add(matchedStudent.id);
                validRecords.push({
                  studentId: matchedStudent.id,
                  registerNo: matchedStudent.register_no,
                  studentName: matchedStudent.name,
                  date: colDateNorm,
                  status: colStatusNorm,
                  year: matchedStudent.year,
                  section: matchedStudent.section
                });
              }
            }
          }
        });

        if (dateCountInRow === 0 && !seenFileRegNosInMatrix.has(regNoKey)) {
          invalidRows.push({
            row: rowNum,
            registerNo: regNoClean,
            reason: 'No valid date columns or daily statuses found in row.'
          });
        }
      }
    });

    return {
      summary: {
        totalRowsProcessed: rows.length,
        totalValidDailyRecords: validRecords.length,
        totalMatchedStudents: matchedStudentIds.size,
        totalUnmatchedRegNos: unmatchedRegisterNumbers.length,
        totalDuplicateEntries: duplicateRegisterNumbers.length,
        totalInvalidRows: invalidRows.length
      },
      validRecords,
      unmatchedRegisterNumbers,
      duplicateRegisterNumbers,
      invalidRows
    };
  }

  public async confirmBulkAttendanceImport(
    records: Array<{ studentId: string; date: string; status: string }>,
    recordedBy: string
  ): Promise<{ importedCount: number; updatedStudentsCount: number }> {
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('No valid records to import.');
    }

    const now = new Date().toISOString();
    const affectedStudentIds = new Set<string>();

    for (const r of records) {
      if (!r.studentId || !r.date || !r.status) continue;

      const existing = await queryOne('SELECT id FROM daily_attendance_records WHERE student_id = ? AND date = ?', [r.studentId, r.date]);
      if (existing) {
        await executeRun(
          'UPDATE daily_attendance_records SET status = ?, recorded_by = ?, recorded_at = ? WHERE id = ?',
          [r.status, recordedBy, now, existing.id]
        );
      } else {
        const id = `attd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await executeRun(
          'INSERT INTO daily_attendance_records (id, student_id, date, status, recorded_by, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
          [id, r.studentId, r.date, r.status, recordedBy, now]
        );
      }
      affectedStudentIds.add(r.studentId);
    }

    for (const stuId of affectedStudentIds) {
      await this.recalculateStudentAttendancePercentage(stuId);
    }

    return {
      importedCount: records.length,
      updatedStudentsCount: affectedStudentIds.size
    };
  }

  public async getAttendanceHistoryForFaculty(facultyId: string): Promise<any[]> {
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
    return await queryAll(query, [facultyId, facultyId]);
  }

  public async getAttendanceHistory(year?: string, section?: string): Promise<any[]> {
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

    return await queryAll(query, params);
  }

  public async getAttendanceHistoryByDateForFaculty(facultyId: string, date: string): Promise<any> {
    const query = `
      SELECT d.status, s.id, s.register_no, s.name, s.year, s.section
      FROM daily_attendance_records d
      JOIN students s ON d.student_id = s.id
      WHERE d.date = ? AND (s.created_by_faculty_id = ? OR s.faculty_workspace_id = ?)
    `;
    const rows = await queryAll(query, [date, facultyId, facultyId]);
    return {
      date,
      presentStudents: rows.filter((r) => r.status === 'PRESENT'),
      absentStudents: rows.filter((r) => r.status === 'ABSENT'),
      odStudents: rows.filter((r) => r.status === 'OD'),
      mlStudents: rows.filter((r) => r.status === 'ML'),
      longAbsentStudents: rows.filter((r) => r.status === 'LONG_ABSENT')
    };
  }

  public async getAttendanceHistoryByDate(date: string, year?: string, section?: string): Promise<any> {
    let query = `
      SELECT d.status, s.id, s.register_no, s.name, s.year, s.section
      FROM daily_attendance_records d
      JOIN students s ON d.student_id = s.id
      WHERE d.date = ?
    `;
    const params: any[] = [date];
    if (year) { query += ' AND s.year = ?'; params.push(year); }
    if (section) { query += ' AND s.section = ?'; params.push(section); }

    const rows = await queryAll(query, params);
    return {
      date,
      presentStudents: rows.filter((r) => r.status === 'PRESENT'),
      absentStudents: rows.filter((r) => r.status === 'ABSENT'),
      odStudents: rows.filter((r) => r.status === 'OD'),
      mlStudents: rows.filter((r) => r.status === 'ML'),
      longAbsentStudents: rows.filter((r) => r.status === 'LONG_ABSENT')
    };
  }

  public async getTeamsForFaculty(facultyId: string): Promise<any[]> {
    const query = `
      SELECT t.* FROM teams t
      JOIN students s ON t.team_head_student_id = s.id
      WHERE (s.created_by_faculty_id = ? OR s.faculty_workspace_id = ?)
      ORDER BY t.created_date DESC
    `;
    const teams = await queryAll(query, [facultyId, facultyId]);
    const result: any[] = [];
    for (const t of teams) {
      const members = await queryAll('SELECT student_id, role_in_team FROM team_members WHERE team_id = ?', [t.id]);
      result.push({ ...t, members });
    }
    return result;
  }

  public async recalculateStudentAttendancePercentage(studentId: string): Promise<void> {
    const stu = await this.getStudentById(studentId);
    const startDate = (stu && (stu.entry_type === 'Lateral Entry' || (stu as any).entryType === 'Lateral Entry')) ? '2026-08-11' : '2026-07-13';
    const rows = await queryAll("SELECT status FROM daily_attendance_records WHERE student_id = ? AND date >= ?", [studentId, startDate]);
    const totalWorkingDays = rows.length;
    const presentDays = rows.filter((r) => r.status === 'PRESENT').length;
    const absentDays = rows.filter((r) => r.status === 'ABSENT').length;
    const odDays = rows.filter((r) => r.status === 'OD').length;
    const mlDays = rows.filter((r) => r.status === 'ML').length;
    const attendedCount = presentDays + odDays + mlDays;
    const percentage = totalWorkingDays > 0 ? parseFloat(((attendedCount / totalWorkingDays) * 100).toFixed(2)) : 0.0;
    const now = new Date().toISOString();

    const existing = await queryOne('SELECT id FROM attendance_records WHERE student_id = ?', [studentId]);
    if (existing) {
      await executeRun(`
        UPDATE attendance_records
        SET total_working_days = ?, present_days = ?, absent_days = ?, od_days = ?, ml_days = ?, percentage = ?, last_updated = ?
        WHERE id = ?
      `, [totalWorkingDays, presentDays, absentDays, odDays, mlDays, percentage, now, existing.id]);
    } else {
      const id = `att-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await executeRun(`
        INSERT INTO attendance_records (id, student_id, total_working_days, present_days, absent_days, od_days, ml_days, percentage, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, studentId, totalWorkingDays, presentDays, absentDays, odDays, mlDays, percentage, now]);
    }
  }

  // FACULTY STUDENT CREATION
  public async createStudentForFaculty(facultyUserId: string, studentData: any, defaultPassword = 'student123'): Promise<any> {
    const assignment = await this.getFacultyAssignment(facultyUserId);
    const year = studentData.year || (assignment ? assignment.year : '2nd Year');
    const section = studentData.section || (assignment ? assignment.section : 'A');
    const facultyUser = await this.getUserById(facultyUserId);
    const coordinatorName = facultyUser ? facultyUser.name : 'Assigned Faculty';

    const cleanEmail = (studentData.email || studentData.collegeEmail || '').trim().toLowerCase();
    const cleanRegNo = (studentData.registerNo || studentData.regNo || '').trim();

    if (!cleanRegNo) {
      throw new Error('Student Register Number is required.');
    }
    if (!cleanEmail) {
      throw new Error('Student College Email ID is required.');
    }

    const existingUser = await queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(identifier) = LOWER(?)', [cleanEmail, cleanRegNo]);
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

    await executeRun(`
      INSERT INTO users (id, name, email, password_hash, role, identifier, year, section, is_active, created_at)
      VALUES (?, ?, ?, ?, 'STUDENT', ?, ?, ?, 1, ?)
    `, [userId, studentData.name, cleanEmail, passwordHash, cleanRegNo, year, section, new Date().toISOString()]);

    await executeRun(`
      INSERT INTO students (id, register_no, name, email, personal_email, department, year, section, batch, class_coordinator_name, cgpa, overall_score, current_rank, entry_type, created_by_faculty_id, faculty_workspace_id)
      VALUES (?, ?, ?, ?, ?, 'AI & DS', ?, ?, ?, ?, ?, 0.0, 1, ?, ?, ?)
    `, [
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
    ]);

    await this.logAudit(facultyUserId, facultyUser ? facultyUser.email : 'faculty@aids.edu', 'FACULTY', 'CREATE_STUDENT', `REG:${cleanRegNo}`);
    return await this.getStudentById(studentId);
  }

  // DELETION ENGINE (ROLE-BASED & AUDITED)
  public async deletePerformanceRecord(category: string, recordId: string, studentId: string): Promise<void> {
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

    await executeRun(`DELETE FROM ${tableName} WHERE id = ? AND student_id = ?`, [recordId, studentId]);
  }

  public async deleteFinalizedAward(awardId: string): Promise<void> {
    await executeRun('DELETE FROM finalized_awards WHERE id = ?', [awardId]);
  }

  // ATTACHMENT / PROOF FILE ENGINE
  public async createAttachment(att: AttachmentRecord): Promise<void> {
    await executeRun(`
      INSERT INTO attachments (id, student_id, record_type, record_id, original_file_name, stored_file_name, mime_type, file_size, uploaded_by_user_id, uploaded_by_role, uploaded_at, is_deleted, file_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `, [
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
      att.uploaded_at,
      att.file_data || null
    ]);
  }

  public async getAttachmentById(id: string): Promise<AttachmentRecord | undefined> {
    return (await queryOne<AttachmentRecord>('SELECT * FROM attachments WHERE id = ? AND is_deleted = 0', [id])) || undefined;
  }

  public async getAttachmentForRecord(studentId: string, recordType: string, recordId: string): Promise<AttachmentRecord | undefined> {
    return (await queryOne<AttachmentRecord>(`
      SELECT * FROM attachments
      WHERE student_id = ? AND record_type = ? AND record_id = ? AND is_deleted = 0
      ORDER BY uploaded_at DESC LIMIT 1
    `, [studentId, recordType, recordId])) || undefined;
  }

  public async getAttachmentsForStudent(studentId: string): Promise<AttachmentRecord[]> {
    return await queryAll<AttachmentRecord>(`
      SELECT * FROM attachments
      WHERE student_id = ? AND is_deleted = 0
      ORDER BY uploaded_at DESC
    `, [studentId]);
  }

  public async softDeleteAttachment(id: string, deletedBy: string): Promise<void> {
    await executeRun(`
      UPDATE attachments
      SET is_deleted = 1, deleted_at = ?, deleted_by = ?
      WHERE id = ?
    `, [new Date().toISOString(), deletedBy, id]);
  }

  public async deleteFacultyUser(userId: string): Promise<void> {
    await executeRun('DELETE FROM users WHERE id = ? AND role = \'FACULTY\'', [userId]);
    await executeRun('DELETE FROM faculty_assignments WHERE faculty_id = ?', [userId]);
  }

  public async deleteHODUser(userId: string): Promise<void> {
    await executeRun('DELETE FROM users WHERE id = ? AND role = \'HOD\'', [userId]);
  }

  public async deleteStudentUser(studentId: string): Promise<void> {
    const student = await this.getStudentById(studentId);
    const stuEmail = student ? (student.email || '') : '';
    const stuReg = student ? (student.registerNo || student.register_no || '') : '';

    const tables = [
      { name: 'academic_records', col: 'student_id' },
      { name: 'arrear_history', col: 'student_id' },
      { name: 'skilledge_records', col: 'student_id' },
      { name: 'nptel_records', col: 'student_id' },
      { name: 'attendance_records', col: 'student_id' },
      { name: 'discipline_records', col: 'student_id' },
      { name: 'certificate_records', col: 'student_id' },
      { name: 'participation_records', col: 'student_id' },
      { name: 'leetcode_stats', col: 'student_id' },
      { name: 'project_records', col: 'student_id' },
      { name: 'achievement_records', col: 'student_id' },
      { name: 'finalized_awards', col: 'winner_student_id' },
      { name: 'attachments', col: 'student_id' },
      { name: 'connected_accounts', col: 'student_id' },
      { name: 'external_metrics', col: 'student_id' },
      { name: 'teams', col: 'team_head_student_id' },
      { name: 'team_members', col: 'student_id' },
      { name: 'representative_evaluations', col: 'student_id' },
      { name: 'daily_attendance_records', col: 'student_id' },
      { name: 'nptel_proofs', col: 'student_id' },
      { name: 'leetcode_proofs', col: 'student_id' },
      { name: 'team_heads', col: 'head_student_id' },
      { name: 'team_head_members', col: 'student_id' },
      { name: 'skilledge_sync_history', col: 'student_id' }
    ];

    if (sqlite) {
      const deleteTx = sqlite.transaction(() => {
        for (const t of tables) {
          try {
            sqlite.prepare(`DELETE FROM ${t.name} WHERE ${t.col} = ?`).run(studentId);
          } catch (_err) {
            // Safe fallback if table or column doesn't exist
          }
        }
        sqlite.prepare('DELETE FROM students WHERE id = ?').run(studentId);
        if (student) {
          sqlite.prepare("DELETE FROM users WHERE id = ? OR (role = 'STUDENT' AND (LOWER(email) = LOWER(?) OR LOWER(identifier) = LOWER(?)))").run(studentId, stuEmail, stuReg);
        } else {
          sqlite.prepare("DELETE FROM users WHERE id = ? AND role = 'STUDENT'").run(studentId);
        }
      });
      deleteTx();
    } else {
      await executeTransaction(async () => {
        for (const t of tables) {
          try {
            await executeRun(`DELETE FROM ${t.name} WHERE ${t.col} = ?`, [studentId]);
          } catch (_err) {
            // Safe fallback if table or column doesn't exist
          }
        }
        await executeRun('DELETE FROM students WHERE id = ?', [studentId]);
        if (student) {
          await executeRun("DELETE FROM users WHERE id = ? OR (role = 'STUDENT' AND (LOWER(email) = LOWER(?) OR LOWER(identifier) = LOWER(?)))", [studentId, stuEmail, stuReg]);
        } else {
          await executeRun("DELETE FROM users WHERE id = ? AND role = 'STUDENT'", [studentId]);
        }
      });
    }
  }

  // SCORING CONFIG
  public async getScoringConfig(): Promise<ScoringConfig> {
    const cfg = await queryOne('SELECT * FROM scoring_configuration WHERE id = \'default\'');
    return {
      academicWeight: cfg?.academic_weight ?? 25,
      skillEdgeWeight: cfg?.skilledge_weight ?? 15,
      nptelWeight: cfg?.nptel_weight ?? 10,
      participationWeight: cfg?.participation_weight ?? 10,
      certificatesWeight: cfg?.certificates_weight ?? 10,
      attendanceWeight: cfg?.attendance_weight ?? 10,
      disciplineWeight: cfg?.discipline_weight ?? 5,
      leetcodeWeight: cfg?.leetcode_weight ?? 10,
      projectsWeight: cfg?.projects_weight ?? 5
    };
  }

  public async saveScoringConfig(c: ScoringConfig): Promise<void> {
    await executeRun(`
      UPDATE scoring_configuration SET academic_weight = ?, skilledge_weight = ?, nptel_weight = ?, participation_weight = ?, certificates_weight = ?, attendance_weight = ?, discipline_weight = ?, leetcode_weight = ?, projects_weight = ?
      WHERE id = 'default'
    `, [
      c.academicWeight,
      c.skillEdgeWeight,
      c.nptelWeight,
      c.participationWeight,
      c.certificatesWeight,
      c.attendanceWeight,
      c.disciplineWeight,
      c.leetcodeWeight,
      c.projectsWeight
    ]);
  }

  // FINALIZED AWARDS
  public async getFinalizedAwards(): Promise<any[]> {
    return await queryAll('SELECT * FROM finalized_awards ORDER BY finalized_at DESC');
  }

  public async finalizeAward(awd: any): Promise<void> {
    await executeRun(`
      INSERT INTO finalized_awards (id, award_key, award_title, winner_student_id, winner_student_name, register_no, year, section, overall_score, finalized_at, finalized_by_hod_name, ai_explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
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
    ]);
  }

  // TEAM HEADS REPOSITORY
  public async createTeamHead(facultyId: string, headStudentId: string, memberLimit: number): Promise<any> {
    const id = `th-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    await executeRun(`
      INSERT INTO team_heads (id, faculty_id, head_student_id, member_limit, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, facultyId, headStudentId, memberLimit, now, now]);
    return await this.getTeamHeadById(id);
  }

  public async getTeamHeadsForFaculty(facultyId: string): Promise<any[]> {
    const heads = await queryAll(`
      SELECT th.*,
             s.name as head_name,
             s.register_no as head_register_no,
             s.year as head_year,
             s.section as head_section
      FROM team_heads th
      JOIN students s ON th.head_student_id = s.id
      WHERE th.faculty_id = ?
      ORDER BY th.created_at DESC
    `, [facultyId]);

    const result: any[] = [];
    for (const h of heads) {
      const members = await queryAll(`
        SELECT thm.id as member_rel_id,
               s.id, s.register_no, s.name, s.year, s.section, s.department, s.email, s.personal_email
        FROM team_head_members thm
        JOIN students s ON thm.student_id = s.id
        WHERE thm.team_head_id = ?
        ORDER BY thm.created_at ASC
      `, [h.id]);

      const addedCount = members.length;
      const remainingSlots = Math.max(0, h.member_limit - addedCount);
      const isFull = addedCount >= h.member_limit;

      result.push({
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
      });
    }
    return result;
  }

  public async getTeamHeadById(id: string): Promise<any | null> {
    const h = await queryOne(`
      SELECT th.*,
             s.name as head_name,
             s.register_no as head_register_no,
             s.year as head_year,
             s.section as head_section
      FROM team_heads th
      JOIN students s ON th.head_student_id = s.id
      WHERE th.id = ?
    `, [id]);

    if (!h) return null;

    const members = await queryAll(`
      SELECT thm.id as member_rel_id,
             s.id, s.register_no, s.name, s.year, s.section, s.department, s.email, s.personal_email
      FROM team_head_members thm
      JOIN students s ON thm.student_id = s.id
      WHERE thm.team_head_id = ?
      ORDER BY thm.created_at ASC
    `, [h.id]);

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

  public async updateTeamHeadLimit(id: string, newLimit: number): Promise<any> {
    const now = new Date().toISOString();
    await executeRun(`
      UPDATE team_heads
      SET member_limit = ?, updated_at = ?
      WHERE id = ?
    `, [newLimit, now, id]);
    return await this.getTeamHeadById(id);
  }

  public async deleteTeamHead(id: string): Promise<void> {
    await executeRun('DELETE FROM team_heads WHERE id = ?', [id]);
  }

  public async setTeamHeadMembers(teamHeadId: string, studentIds: string[]): Promise<any> {
    const now = new Date().toISOString();
    await executeRun('DELETE FROM team_head_members WHERE team_head_id = ?', [teamHeadId]);

    for (const sId of studentIds) {
      const relId = `thm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await executeRun(`
        INSERT INTO team_head_members (id, team_head_id, student_id, created_at)
        VALUES (?, ?, ?, ?)
      `, [relId, teamHeadId, sId, now]);
    }

    return await this.getTeamHeadById(teamHeadId);
  }

  public async removeTeamHeadMember(teamHeadId: string, studentId: string): Promise<any> {
    await executeRun('DELETE FROM team_head_members WHERE team_head_id = ? AND student_id = ?', [teamHeadId, studentId]);
    return await this.getTeamHeadById(teamHeadId);
  }

  // SUBJECT MANAGEMENT METHODS
  public async getSubjects(
    filtersOrYear?: { year?: string; semester?: number; section?: string; search?: string } | string,
    semester?: number,
    section?: string,
    search?: string
  ): Promise<SubjectRecord[]> {
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
    const rows = await queryAll(query, params);

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

  public async getSubjectById(id: string): Promise<SubjectRecord | undefined> {
    const r = await queryOne('SELECT * FROM subjects WHERE id = ?', [id]);
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

  public async addSubject(sub: Partial<SubjectRecord>): Promise<SubjectRecord> {
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
    const existing = await queryOne(`
      SELECT id FROM subjects
      WHERE UPPER(subject_code) = ? AND year = ? AND semester = ? AND (section = ? OR section = 'ALL' OR ? = 'ALL')
    `, [cleanCode, cleanYear, sem, cleanSec, cleanSec]);

    if (existing) {
      throw new Error(`Subject Code "${cleanCode}" already exists for ${cleanYear} Semester ${sem} Section ${cleanSec}. Duplicate subject codes are not allowed.`);
    }

    const id = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    await executeRun(`
      INSERT INTO subjects (id, subject_code, subject_name, department, academic_year, year, semester, section, subject_type, credits, faculty_handler, created_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, cleanCode, cleanName, cleanDept, cleanAcadYear, cleanYear, sem, cleanSec, cleanType, creditsNum, cleanHandler, userId, now]);

    return (await this.getSubjectById(id))!;
  }

  public async updateSubject(id: string, sub: Partial<SubjectRecord>): Promise<SubjectRecord> {
    const existing = await this.getSubjectById(id);
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
      const dup = await queryOne(`
        SELECT id FROM subjects
        WHERE UPPER(subject_code) = ? AND year = ? AND semester = ? AND (section = ? OR section = 'ALL' OR ? = 'ALL') AND id != ?
      `, [cleanCode, cleanYear, sem, cleanSec, cleanSec, id]);

      if (dup) {
        throw new Error(`Subject Code "${cleanCode}" already exists for ${cleanYear} Semester ${sem} Section ${cleanSec}.`);
      }
    }

    await executeRun(`
      UPDATE subjects
      SET subject_code = ?, subject_name = ?, department = ?, academic_year = ?, year = ?, semester = ?, section = ?, subject_type = ?, credits = ?, faculty_handler = ?
      WHERE id = ?
    `, [cleanCode, cleanName, cleanDept, cleanAcadYear, cleanYear, sem, cleanSec, cleanType, creditsNum, cleanHandler, id]);

    return (await this.getSubjectById(id))!;
  }

  public async deleteSubject(id: string): Promise<boolean> {
    const res = await executeRun('DELETE FROM subjects WHERE id = ?', [id]);
    return res.changes > 0;
  }

  // AUDIT LOGS
  public async logAudit(userId: string, email: string, role: string, action: string, resource: string): Promise<void> {
    await executeRun(`
      INSERT INTO audit_logs (id, user_id, user_email, role, action, target_resource, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [`aud-${Date.now()}`, userId, email, role, action, resource, new Date().toISOString()]);
  }
}

export const db = new SQLiteDB();

if (!process.env.VERCEL) {
  SQLiteDB.initSystemAccounts().catch((err) => console.error('Error initializing system accounts:', err));
}
