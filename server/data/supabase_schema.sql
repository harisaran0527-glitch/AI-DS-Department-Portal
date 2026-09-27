-- ====================================================================
-- AI & DATA SCIENCE DEPARTMENT PORTAL - SUPABASE POSTGRESQL SCHEMA
-- ====================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  identifier TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'HOD', 'FACULTY', 'STUDENT')),
  password_hash TEXT NOT NULL,
  year TEXT,
  section TEXT,
  faculty_role TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. FACULTY ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS faculty_assignments (
  id TEXT PRIMARY KEY,
  faculty_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department TEXT NOT NULL DEFAULT 'AI & DS',
  year TEXT NOT NULL,
  section TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Class Coordinator',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  register_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  personal_email TEXT,
  department TEXT NOT NULL DEFAULT 'AI & DS',
  year TEXT NOT NULL,
  section TEXT NOT NULL,
  batch TEXT NOT NULL,
  entry_type TEXT DEFAULT 'Regular',
  class_coordinator_name TEXT NOT NULL DEFAULT 'Assigned Faculty',
  cgpa DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  overall_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  current_rank INTEGER NOT NULL DEFAULT 99,
  is_representative INTEGER NOT NULL DEFAULT 0,
  is_elite_student INTEGER NOT NULL DEFAULT 0,
  linkedin_url TEXT,
  github_url TEXT,
  created_by_faculty_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  faculty_workspace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ACADEMIC RECORDS TABLE
CREATE TABLE IF NOT EXISTS academic_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  semester_no INTEGER NOT NULL,
  sgpa DOUBLE PRECISION NOT NULL,
  cgpa DOUBLE PRECISION NOT NULL,
  total_credits INTEGER NOT NULL,
  subjects_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  exam_type TEXT DEFAULT 'Semester',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ARREAR HISTORY TABLE
CREATE TABLE IF NOT EXISTS arrear_history (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  semester_no INTEGER NOT NULL,
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_date TEXT NOT NULL,
  cleared_date TEXT
);

-- 6. SKILLEDGE RECORDS TABLE
CREATE TABLE IF NOT EXISTS skilledge_records (
  id TEXT PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  overall_completion_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  total_reward_points INTEGER NOT NULL DEFAULT 0,
  tracks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  skilledge_handle TEXT,
  previous_points INTEGER DEFAULT 0,
  earned_delta INTEGER DEFAULT 0,
  status TEXT DEFAULT 'VERIFIED',
  last_synced_at TIMESTAMPTZ
);

-- 7. NPTEL RECORDS TABLE
CREATE TABLE IF NOT EXISTS nptel_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  duration_weeks INTEGER NOT NULL,
  weeks_completed INTEGER NOT NULL,
  assignment_score DOUBLE PRECISION NOT NULL,
  exam_score DOUBLE PRECISION,
  final_score DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL,
  account_type TEXT DEFAULT 'college',
  connected_email TEXT,
  connected_at TIMESTAMPTZ,
  last_verified TIMESTAMPTZ
);

-- 8. ATTENDANCE RECORDS TABLE
CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  total_working_days INTEGER NOT NULL DEFAULT 0,
  present_days INTEGER NOT NULL DEFAULT 0,
  absent_days INTEGER NOT NULL DEFAULT 0,
  od_days INTEGER NOT NULL DEFAULT 0,
  ml_days INTEGER NOT NULL DEFAULT 0,
  percentage DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. DAILY ATTENDANCE RECORDS TABLE
CREATE TABLE IF NOT EXISTS daily_attendance_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- 10. DISCIPLINE RECORDS TABLE
CREATE TABLE IF NOT EXISTS discipline_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT,
  category TEXT NOT NULL,
  remark TEXT NOT NULL,
  warning_action TEXT NOT NULL,
  action_taken TEXT,
  fine_amount DOUBLE PRECISION DEFAULT 0.0,
  recorded_by TEXT NOT NULL
);

-- 11. CERTIFICATE RECORDS TABLE
CREATE TABLE IF NOT EXISTS certificate_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  category TEXT NOT NULL,
  issue_date DATE NOT NULL,
  certificate_id TEXT,
  company_name TEXT,
  proof_file_path TEXT,
  file_path TEXT,
  original_file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. PARTICIPATION RECORDS TABLE
CREATE TABLE IF NOT EXISTS participation_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  organizer TEXT NOT NULL,
  date DATE NOT NULL,
  is_team INTEGER NOT NULL DEFAULT 0,
  position TEXT,
  prize_amount TEXT,
  certificate_ref TEXT,
  college_name TEXT,
  proof_file_path TEXT,
  event_level TEXT DEFAULT 'College',
  achievement TEXT,
  description TEXT,
  original_file_name TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. LEETCODE STATS TABLE
CREATE TABLE IF NOT EXISTS leetcode_stats (
  id TEXT PRIMARY KEY,
  student_id TEXT UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  total_solved INTEGER NOT NULL DEFAULT 0,
  easy_solved INTEGER NOT NULL DEFAULT 0,
  medium_solved INTEGER NOT NULL DEFAULT 0,
  hard_solved INTEGER NOT NULL DEFAULT 0,
  contest_rating INTEGER NOT NULL DEFAULT 0,
  total_attempted INTEGER DEFAULT 0,
  acceptance_rate DOUBLE PRECISION DEFAULT 0.0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. PROJECT RECORDS TABLE
CREATE TABLE IF NOT EXISTS project_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  domain TEXT NOT NULL,
  tech_stack_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_team INTEGER NOT NULL DEFAULT 0,
  student_role TEXT NOT NULL,
  github_url TEXT,
  live_url TEXT,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  prize_awarded TEXT,
  product_photo_path TEXT
);

-- 15. ACHIEVEMENT RECORDS TABLE
CREATE TABLE IF NOT EXISTS achievement_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  event_name TEXT NOT NULL,
  date DATE NOT NULL,
  position TEXT,
  description TEXT NOT NULL
);

-- 16. SCORING CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS scoring_configuration (
  id TEXT PRIMARY KEY DEFAULT 'default',
  academic_weight DOUBLE PRECISION NOT NULL DEFAULT 25,
  skilledge_weight DOUBLE PRECISION NOT NULL DEFAULT 15,
  nptel_weight DOUBLE PRECISION NOT NULL DEFAULT 10,
  participation_weight DOUBLE PRECISION NOT NULL DEFAULT 10,
  certificates_weight DOUBLE PRECISION NOT NULL DEFAULT 10,
  attendance_weight DOUBLE PRECISION NOT NULL DEFAULT 10,
  discipline_weight DOUBLE PRECISION NOT NULL DEFAULT 5,
  leetcode_weight DOUBLE PRECISION NOT NULL DEFAULT 10,
  projects_weight DOUBLE PRECISION NOT NULL DEFAULT 5
);

-- 17. FINALIZED AWARDS TABLE
CREATE TABLE IF NOT EXISTS finalized_awards (
  id TEXT PRIMARY KEY,
  award_key TEXT NOT NULL,
  award_title TEXT NOT NULL,
  winner_student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  winner_student_name TEXT NOT NULL,
  register_no TEXT NOT NULL,
  year TEXT NOT NULL,
  section TEXT NOT NULL,
  overall_score DOUBLE PRECISION NOT NULL,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_by_hod_name TEXT NOT NULL,
  ai_explanation TEXT NOT NULL
);

-- 18. SUBJECTS TABLE
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. SESSIONS REVOCATION TABLE
CREATE TABLE IF NOT EXISTS sessions_revocation (
  token_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_resource TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. ATTACHMENTS TABLE
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  stored_file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by_user_id TEXT NOT NULL,
  uploaded_by_role TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT
);

-- 22. CONNECTED ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS connected_accounts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'GOOGLE',
  purpose TEXT NOT NULL DEFAULT 'NPTEL',
  email_type TEXT NOT NULL DEFAULT 'COLLEGE',
  connected_email TEXT NOT NULL,
  provider_username TEXT NOT NULL,
  provider_account_id TEXT,
  connection_status TEXT NOT NULL DEFAULT 'CONNECTED',
  verification_status TEXT NOT NULL DEFAULT 'VERIFIED',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload_json JSONB
);

-- 23. EXTERNAL METRICS TABLE
CREATE TABLE IF NOT EXISTS external_metrics (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_identifier TEXT NOT NULL,
  metric TEXT NOT NULL,
  value TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'VERIFIED',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

-- 24. TEAMS TABLE
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  team_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  team_head_student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  project_name TEXT NOT NULL,
  result_position TEXT NOT NULL,
  prize TEXT,
  proof_file TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 25. TEAM MEMBERS TABLE
CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  role_in_team TEXT NOT NULL DEFAULT 'Member'
);

-- 26. REPRESENTATIVE EVALUATIONS TABLE
CREATE TABLE IF NOT EXISTS representative_evaluations (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  section TEXT NOT NULL,
  evaluation_period TEXT NOT NULL,
  communication_score DOUBLE PRECISION NOT NULL DEFAULT 8.0,
  faculty_coordination_score DOUBLE PRECISION NOT NULL DEFAULT 8.0,
  student_coordination_score DOUBLE PRECISION NOT NULL DEFAULT 8.0,
  attendance_followup_score DOUBLE PRECISION NOT NULL DEFAULT 8.0,
  late_comer_monitoring_score DOUBLE PRECISION NOT NULL DEFAULT 8.0,
  academic_updates_score DOUBLE PRECISION NOT NULL DEFAULT 8.0,
  discipline_support_score DOUBLE PRECISION NOT NULL DEFAULT 8.0,
  cleanliness_responsibility_score DOUBLE PRECISION NOT NULL DEFAULT 8.0,
  notice_board_score DOUBLE PRECISION NOT NULL DEFAULT 8.0,
  event_coordination_score DOUBLE PRECISION NOT NULL DEFAULT 8.0,
  responsibility_completion_score DOUBLE PRECISION NOT NULL DEFAULT 8.0,
  overall_remarks TEXT,
  evaluated_by TEXT NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 27. TEAM HEADS TABLE
CREATE TABLE IF NOT EXISTS team_heads (
  id TEXT PRIMARY KEY,
  faculty_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  head_student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  member_limit INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(faculty_id, head_student_id)
);

-- 28. TEAM HEAD MEMBERS TABLE
CREATE TABLE IF NOT EXISTS team_head_members (
  id TEXT PRIMARY KEY,
  team_head_id TEXT NOT NULL REFERENCES team_heads(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_head_id, student_id)
);

-- 29. SKILLEDGE SYNC HISTORY TABLE
CREATE TABLE IF NOT EXISTS skilledge_sync_history (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  previous_points INTEGER NOT NULL DEFAULT 0,
  current_points INTEGER NOT NULL DEFAULT 0,
  earned_delta INTEGER NOT NULL DEFAULT 0,
  overall_completion_pct DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  tracks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_source TEXT NOT NULL DEFAULT 'DAILY_AUTO',
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  error_message TEXT
);

-- 30. NPTEL PROOFS TABLE
CREATE TABLE IF NOT EXISTS nptel_proofs (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  week_no INTEGER NOT NULL,
  proof_file_path TEXT NOT NULL,
  original_file_name TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 31. LEETCODE PROOFS TABLE
CREATE TABLE IF NOT EXISTS leetcode_proofs (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  proof_file_path TEXT NOT NULL,
  original_file_name TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- PERFORMANCE INDEXES
-- ====================================================================
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
CREATE INDEX IF NOT EXISTS idx_subjects_code_ctx ON subjects(subject_code, year, semester, section);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE skilledge_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE nptel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE participation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE leetcode_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_records ENABLE ROW LEVEL SECURITY;

-- Service Role Full Bypass Policy
CREATE POLICY "Service Role Full Access Users" ON users FOR ALL USING (true);
CREATE POLICY "Service Role Full Access Students" ON students FOR ALL USING (true);
CREATE POLICY "Service Role Full Access Academic" ON academic_records FOR ALL USING (true);
CREATE POLICY "Service Role Full Access SkillEdge" ON skilledge_records FOR ALL USING (true);
CREATE POLICY "Service Role Full Access NPTEL" ON nptel_records FOR ALL USING (true);
CREATE POLICY "Service Role Full Access Attendance" ON attendance_records FOR ALL USING (true);
CREATE POLICY "Service Role Full Access Certificates" ON certificate_records FOR ALL USING (true);
CREATE POLICY "Service Role Full Access Participation" ON participation_records FOR ALL USING (true);
CREATE POLICY "Service Role Full Access LeetCode" ON leetcode_stats FOR ALL USING (true);
CREATE POLICY "Service Role Full Access Projects" ON project_records FOR ALL USING (true);

-- ====================================================================
-- SUPABASE STORAGE BUCKET CONFIGURATION
-- ====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('department-proofs', 'department-proofs', true)
ON CONFLICT (id) DO NOTHING;
