import type { Student, UserSession, TeamHead, Subject } from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const defaultHeaders: Record<string, string> = isFormData ? {} : { 'Content-Type': 'application/json' };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers as Record<string, string>)
    },
    credentials: 'include'
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP Error ${response.status}`);
  }

  return data as T;
}

export const API = {
  // Auth
  login: async (identifier: string, password: string, role: string) => {
    return request<{ message: string; user: UserSession }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, role })
    });
  },

  logout: async () => {
    return request<{ message: string }>('/auth/logout', {
      method: 'POST'
    });
  },

  getMe: async () => {
    return request<{ user: UserSession }>('/auth/me');
  },

  // Admin
  getFacultyList: async () => {
    return request<{ faculty: any[] }>('/admin/faculty');
  },

  addFaculty: async (facultyData: any) => {
    return request<{ message: string; faculty: any }>('/admin/faculty', {
      method: 'POST',
      body: JSON.stringify(facultyData)
    });
  },

  updateFacultyAssignment: async (id: string, assignmentData: any) => {
    return request<{ message: string }>(`/admin/faculty/${id}`, {
      method: 'PUT',
      body: JSON.stringify(assignmentData)
    });
  },

  resetFacultyPassword: async (id: string, newPassword: string) => {
    return request<{ message: string }>(`/admin/faculty/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword })
    });
  },

  updateFacultyStatus: async (id: string, isActive: boolean) => {
    return request<{ message: string }>(`/admin/faculty/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isActive })
    });
  },

  deleteFacultyAccount: async (id: string) => {
    return request<{ message: string }>(`/admin/faculty/${id}`, {
      method: 'DELETE'
    });
  },

  deleteStudentAccount: async (id: string) => {
    return request<{ message: string }>(`/admin/students/${id}`, {
      method: 'DELETE'
    });
  },

  importStudents: async (students: any[], defaultPassword?: string) => {
    return request<{ message: string; importedCount: number; skippedCount: number; errors: string[] }>('/admin/students/import', {
      method: 'POST',
      body: JSON.stringify({ students, defaultPassword })
    });
  },

  changeAdminPassword: async (currentPassword: string, newPassword: string) => {
    return request<{ message: string }>('/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  // Admin - HOD Management
  getHODList: async () => {
    return request<{ hodList: any[] }>('/admin/hod');
  },

  addHOD: async (hodData: any) => {
    return request<{ message: string; hod: any }>('/admin/hod', {
      method: 'POST',
      body: JSON.stringify(hodData)
    });
  },

  updateHOD: async (id: string, hodData: any) => {
    return request<{ message: string }>(`/admin/hod/${id}`, {
      method: 'PUT',
      body: JSON.stringify(hodData)
    });
  },

  updateHODStatus: async (id: string, isActive: boolean) => {
    return request<{ message: string }>(`/admin/hod/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ isActive })
    });
  },

  resetHODPassword: async (id: string, password: string) => {
    return request<{ message: string }>(`/admin/hod/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  },

  deleteHODAccount: async (id: string) => {
    return request<{ message: string }>(`/admin/hod/${id}`, {
      method: 'DELETE'
    });
  },

  // Faculty
  getAssignedRoster: async () => {
    return request<{ assignedYear: string; assignedSection: string; count: number; students: Student[] }>('/faculty/students');
  },

  getStudent360ForFaculty: async (studentId: string) => {
    return request<any>(`/faculty/students/${studentId}/360`);
  },

  updateStudent360: async (studentId: string, updates: any) => {
    return request<{ message: string; overallScore: number; profile?: any }>(`/faculty/students/${studentId}/360`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  deletePerformanceRecordForFaculty: async (studentId: string, recordType: string, recordId: string) => {
    return request<{ message: string; overallScore: number }>(`/faculty/students/${studentId}/records/${recordType}/${recordId}`, {
      method: 'DELETE'
    });
  },

  // HOD
  getDepartmentStudents: async (year?: string, section?: string) => {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (section) params.append('section', section);
    return request<{ count: number; students: any[] }>(`/hod/students?${params.toString()}`);
  },

  getAIAwardCandidates: async (year?: string) => {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    return request<{ candidates: any }>(`/hod/awards/candidates?${params.toString()}`);
  },

  getScoringConfig: async () => {
    return request<{ config: any }>('/hod/scoring-config');
  },

  saveScoringConfig: async (config: any) => {
    return request<{ message: string; config: any }>('/hod/scoring-config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  },

  finalizeAward: async (awardData: any) => {
    return request<{ message: string; award: any }>('/hod/awards/finalize', {
      method: 'POST',
      body: JSON.stringify(awardData)
    });
  },

  deletePerformanceRecordForHOD: async (studentId: string, recordType: string, recordId: string) => {
    return request<{ message: string; overallScore: number }>(`/hod/students/${studentId}/records/${recordType}/${recordId}`, {
      method: 'DELETE'
    });
  },

  deleteFinalizedAwardForHOD: async (awardId: string) => {
    return request<{ message: string }>(`/hod/awards/${awardId}`, {
      method: 'DELETE'
    });
  },

  getHodFacultyList: async () => {
    return request<{ count: number; faculty: any[] }>('/hod/faculty');
  },

  getHodFacultyWorkspace: async (facultyId: string) => {
    return request<{ faculty: any; students: any[]; workspace360: any[]; summary: any }>(`/hod/faculty/${facultyId}`);
  },

  // Student (Strictly View-Only)
  getStudentSelfProfile: async () => {
    return request<any>('/student/me');
  },

  // Proof File Management
  uploadProofFile: async (studentId: string, recordType: string, recordId: string, file: File) => {
    const formData = new FormData();
    formData.append('studentId', studentId);
    formData.append('recordType', recordType);
    formData.append('recordId', recordId);
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `HTTP Error ${response.status}`);
    }
    return data as { message: string; attachment: any };
  },

  getRecordAttachment: async (studentId: string, recordType: string, recordId: string) => {
    return request<{ attachment: any }>(`/files/record/${studentId}/${recordType}/${recordId}`);
  },

  deleteProofFile: async (fileId: string) => {
    return request<{ message: string }>(`/files/${fileId}`, {
      method: 'DELETE'
    });
  },

  // Faculty Certificate Upload & File Management
  uploadCertificateForFaculty: async (studentId: string, formData: FormData) => {
    return request<{ message: string; certId: string; certificates: any[]; overallScore?: number }>(`/faculty/students/${studentId}/certificates/upload`, {
      method: 'POST',
      body: formData
    });
  },

  updateCertificateForFaculty: async (studentId: string, certId: string, formData: FormData) => {
    return request<{ message: string; certificates: any[]; overallScore?: number }>(`/faculty/students/${studentId}/certificates/${certId}`, {
      method: 'PUT',
      body: formData
    });
  },

  deleteCertificateForFaculty: async (studentId: string, certId: string) => {
    return request<{ message: string; certificates: any[]; overallScore?: number }>(`/faculty/students/${studentId}/certificates/${certId}`, {
      method: 'DELETE'
    });
  },

  // Faculty Participation Upload & File Management
  uploadParticipationForFaculty: async (studentId: string, formData: FormData) => {
    return request<{ message: string; partId: string; participation: any[]; overallScore?: number }>(`/faculty/students/${studentId}/participation/upload`, {
      method: 'POST',
      body: formData
    });
  },

  updateParticipationForFaculty: async (studentId: string, partId: string, formData: FormData) => {
    return request<{ message: string; participation: any[]; overallScore?: number }>(`/faculty/students/${studentId}/participation/${partId}`, {
      method: 'PUT',
      body: formData
    });
  },

  deleteParticipationForFaculty: async (studentId: string, partId: string) => {
    return request<{ message: string; participation: any[]; overallScore?: number }>(`/faculty/students/${studentId}/participation/${partId}`, {
      method: 'DELETE'
    });
  },

  // Faculty Student Creation & Import
  createStudentForFaculty: async (studentData: any) => {
    return request<{ message: string; student: any }>('/faculty/students', {
      method: 'POST',
      body: JSON.stringify(studentData)
    });
  },

  importStudentsForFaculty: async (students: any[], defaultPassword?: string) => {
    return request<{ message: string; count: number; errors?: string[] }>('/faculty/students/import', {
      method: 'POST',
      body: JSON.stringify({ students, defaultPassword })
    });
  },

  deleteStudentForFaculty: async (studentId: string) => {
    return request<{ message: string; studentId: string }>(`/faculty/students/${studentId}`, {
      method: 'DELETE'
    });
  },

  syncLeetCodeForFaculty: async (studentId: string, username: string) => {
    return request<{ message: string; result: any }>(`/faculty/students/${studentId}/sync-leetcode`, {
      method: 'POST',
      body: JSON.stringify({ username })
    });
  },

  syncLeetCodeForStudent: async () => {
    return request<{ message: string; result: any }>('/student/sync-leetcode', {
      method: 'POST'
    });
  },

  syncSkillEdgeForFaculty: async (studentId: string) => {
    return request<{ message: string; result: any }>(`/faculty/students/${studentId}/sync-skilledge`, {
      method: 'POST'
    });
  },

  syncSkillEdgeAllForFaculty: async () => {
    return request<{ message: string; summary: any }>('/faculty/sync-skilledge-all', {
      method: 'POST'
    });
  },

  syncSkillEdgeAllForHod: async () => {
    return request<{ message: string; summary: any }>('/hod/sync-skilledge-all', {
      method: 'POST'
    });
  },

  linkSkillEdgeHandleForFaculty: async (studentId: string, skilledgeHandle: string) => {
    return request<{ message: string }>(`/faculty/students/${studentId}/link-skilledge`, {
      method: 'POST',
      body: JSON.stringify({ skilledgeHandle })
    });
  },

  connectAccountForFaculty: async (studentId: string, provider: string, username: string) => {
    return request<{ message: string; result?: any }>(`/faculty/students/${studentId}/connect-account`, {
      method: 'POST',
      body: JSON.stringify({ provider, username })
    });
  },

  resetStudentPasswordByFaculty: async (studentId: string, password: string, confirmPassword: string) => {
    return request<{ message: string }>(`/faculty/students/${studentId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password, confirmPassword })
    });
  },

  setStudentStatusByFaculty: async (studentId: string, isActive: boolean) => {
    return request<{ message: string }>(`/faculty/students/${studentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive })
    });
  },

  // Teams & Representative Evaluations
  createTeam: async (teamData: any) => {
    return request<{ message: string; team: any }>('/faculty/teams', {
      method: 'POST',
      body: JSON.stringify(teamData)
    });
  },

  getTeams: async () => {
    return request<{ count: number; teams: any[] }>('/faculty/teams');
  },

  saveRepresentativeEvaluation: async (evalData: any) => {
    return request<{ message: string }>('/faculty/representative', {
      method: 'POST',
      body: JSON.stringify(evalData)
    });
  },

  // Student Connected Accounts (READ-ONLY FOR STUDENT)
  getConnectedAccounts: async () => {
    return request<{ connectedAccounts: any[]; externalMetrics: any[] }>('/student/connected-accounts');
  },

  // NPTEL Proof API
  getNptelProofs: async (studentId: string) => {
    return request<{ proofs: any[] }>(`/faculty/students/${studentId}/nptel-proofs`);
  },

  uploadNptelProof: async (studentId: string, weekNo: number, file: File) => {
    const formData = new FormData();
    formData.append('weekNo', String(weekNo));
    formData.append('file', file);

    const res = await fetch(`/api/faculty/students/${studentId}/nptel-proofs`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload NPTEL proof file.');
    }
    return data as { message: string; proof: any };
  },

  deleteNptelProof: async (studentId: string, proofId: string) => {
    return request<{ message: string }>(`/faculty/students/${studentId}/nptel-proofs/${proofId}`, {
      method: 'DELETE'
    });
  },

  // Best Team Head API
  getTeamHeads: async () => {
    return request<{ teamHeads: TeamHead[] }>('/faculty/team-heads');
  },

  createTeamHead: async (headStudentId: string, memberLimit: number) => {
    return request<{ teamHead: TeamHead; message: string }>('/faculty/team-heads', {
      method: 'POST',
      body: JSON.stringify({ headStudentId, memberLimit })
    });
  },

  updateTeamHeadLimit: async (id: string, memberLimit: number) => {
    return request<{ teamHead: TeamHead; message: string }>(`/faculty/team-heads/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ memberLimit })
    });
  },

  deleteTeamHead: async (id: string) => {
    return request<{ message: string }>(`/faculty/team-heads/${id}`, {
      method: 'DELETE'
    });
  },

  updateTeamHeadMembers: async (id: string, studentIds: string[]) => {
    return request<{ teamHead: TeamHead; message: string }>(`/faculty/team-heads/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ studentIds })
    });
  },

  removeTeamHeadMember: async (id: string, studentId: string) => {
    return request<{ teamHead: TeamHead; message: string }>(`/faculty/team-heads/${id}/members/${studentId}`, {
      method: 'DELETE'
    });
  },

  // Subjects Management
  getSubjects: async (filters?: { year?: string; semester?: number; section?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.year) params.append('year', filters.year);
    if (filters?.semester) params.append('semester', filters.semester.toString());
    if (filters?.section) params.append('section', filters.section);
    if (filters?.search) params.append('search', filters.search);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request<{ subjects: Subject[] }>(`/subjects${queryString}`);
  },

  addSubject: async (subjectData: Partial<Subject>) => {
    return request<{ message: string; subject: Subject }>('/subjects', {
      method: 'POST',
      body: JSON.stringify(subjectData)
    });
  },

  updateSubject: async (id: string, subjectData: Partial<Subject>) => {
    return request<{ message: string; subject: Subject }>(`/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(subjectData)
    });
  },

  deleteSubject: async (id: string) => {
    return request<{ message: string }>(`/subjects/${id}`, {
      method: 'DELETE'
    });
  },

  // Elite Students Designation & Dedicated Profile Edits
  setStudentEliteStatus: async (studentId: string, isElite: boolean, role: 'HOD' | 'FACULTY' = 'HOD') => {
    const base = role === 'HOD' ? '/hod' : '/faculty';
    return request<{ message: string; studentId: string; isElite: boolean }>(`${base}/students/${studentId}/elite-status`, {
      method: 'POST',
      body: JSON.stringify({ isElite })
    });
  },

  updateStudentProfile: async (
    studentId: string,
    profileData: {
      linkedinUrl?: string;
      githubUrl?: string;
      leetcodeUsername?: string;
      cgpa?: number;
      skillEdgePoints?: number;
    },
    role: 'HOD' | 'FACULTY' = 'HOD'
  ) => {
    const base = role === 'HOD' ? '/hod' : '/faculty';
    return request<{ message: string; profile: any }>(`${base}/students/${studentId}/update-profile`, {
      method: 'POST',
      body: JSON.stringify(profileData)
    });
  },

  // Gemini AI Top Recognition Rankings (4 Categories - 1st & 2nd Place Only)
  getTopRecognitionRankings: async (year?: string, section?: string) => {
    const params = new URLSearchParams();
    if (year && year !== 'ALL') params.append('year', year);
    if (section && section !== 'ALL') params.append('section', section);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request<any>(`/rankings/top-recognition${queryString}`);
  },

  // Gemini AI Category-Specific Best Performers across ALL 14 department categories
  getAllCategoryRankings: async (year?: string, section?: string) => {
    const params = new URLSearchParams();
    if (year && year !== 'ALL') params.append('year', year);
    if (section && section !== 'ALL') params.append('section', section);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request<any>(`/rankings/all-categories${queryString}`);
  },

  // Gemini AI Full-Page LeetCode Analytics Dashboard Data
  getLeetCodeFullAnalytics: async (year?: string, section?: string) => {
    const params = new URLSearchParams();
    if (year && year !== 'ALL') params.append('year', year);
    if (section && section !== 'ALL') params.append('section', section);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request<any>(`/rankings/leetcode-full${queryString}`);
  }
};
