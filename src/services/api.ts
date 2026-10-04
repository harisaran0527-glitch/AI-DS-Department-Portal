import type { Student, UserSession, TeamHead, Subject } from '../types';

export function getApiBaseUrl(): string {
  const envBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (envBase && typeof envBase === 'string' && envBase.trim() !== '') {
    let trimmed = envBase.trim().replace(/\/$/, '');
    if (trimmed.includes('aids-department-backend.onrender.com')) {
      trimmed = 'https://ai-ds-department-portal.onrender.com';
    }
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return '/api';
}

export const API_BASE = getApiBaseUrl();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const defaultHeaders: Record<string, string> = isFormData ? {} : { 'Content-Type': 'application/json' };
  const method = (options.method || 'GET').toUpperCase();
  const isGetOrIdempotent = method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'PUT';

  const maxAttempts = 3;
  let lastError: any = null;

  let cleanEndpoint = endpoint;
  if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
    if (cleanEndpoint.startsWith('/api/')) {
      cleanEndpoint = cleanEndpoint.substring(4);
    } else if (cleanEndpoint === '/api') {
      cleanEndpoint = '/';
    }
    const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
    const path = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
    cleanEndpoint = `${base}${path}`;
  }
  const url = cleanEndpoint;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutMs = 60000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const config: RequestInit = {
        ...options,
        signal: options.signal || controller.signal,
        headers: {
          ...defaultHeaders,
          ...(options.headers as Record<string, string> || {})
        },
        credentials: options.credentials || 'include'
      };

      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return data as T;
      }

      const data = await response.json().catch(() => ({}));
      const errorMessage = data.error || data.message;

      // Do NOT retry 4xx validation/auth errors
      if (response.status < 500 && response.status !== 408) {
        throw new Error(errorMessage || `Authentication/Client Error (${response.status})`);
      }

      // 5xx Transient Gateway Errors (502, 503, 504) - retry safe/idempotent or cold start proxy responses
      const isGatewayTransient = response.status === 502 || response.status === 503 || response.status === 504;
      if (attempt < maxAttempts && (isGetOrIdempotent || isGatewayTransient)) {
        console.warn(`⚠️ [API Resilience] Transient HTTP ${response.status} on ${method} ${url}. Retrying attempt ${attempt}/${maxAttempts}...`);
        await delay(Math.pow(2, attempt - 1) * 800);
        continue;
      }

      throw new Error(errorMessage || `Server Error (${response.status}). Please try again.`);
    } catch (err: any) {
      clearTimeout(timeoutId);

      const isAbort = err.name === 'AbortError';
      const isBrowserFetchDrop = err instanceof TypeError && (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('Load failed'));
      const isNetworkOrTimeout = isAbort || isBrowserFetchDrop;

      if (!isNetworkOrTimeout) {
        throw err;
      }

      lastError = err;

      if (attempt < maxAttempts) {
        const logMsg = isAbort ? 'Request timed out waiting for backend response' : (err.message || 'Network failure');
        console.warn(`⚠️ [API Resilience] ${logMsg} on ${method} ${url}. Retrying attempt ${attempt}/${maxAttempts}...`);
        await delay(Math.pow(2, attempt - 1) * 800);
        continue;
      }

      if (isAbort) {
        throw new Error('Request timed out. Please try again.');
      }

      throw err;
    }
  }

  throw lastError || new Error('Request failed after retries');
}

export async function fetchWithResilience(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const isGetOrIdempotent = method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'PUT';

  const maxAttempts = 3;
  let lastError: any = null;

  let cleanEndpoint = url;
  if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
    if (cleanEndpoint.startsWith('/api/')) {
      cleanEndpoint = cleanEndpoint.substring(4);
    } else if (cleanEndpoint === '/api') {
      cleanEndpoint = '/';
    }
    const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
    const path = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
    cleanEndpoint = `${base}${path}`;
  }
  const targetUrl = cleanEndpoint;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const config: RequestInit = {
        ...options,
        signal: options.signal || controller.signal,
        credentials: options.credentials || 'include'
      };

      const response = await fetch(targetUrl, config);
      clearTimeout(timeoutId);

      const isGatewayTransient = response.status === 502 || response.status === 503 || response.status === 504;
      if (!response.ok && response.status >= 500 && attempt < maxAttempts && (isGetOrIdempotent || isGatewayTransient)) {
        console.warn(`⚠️ [API Resilience] Transient HTTP ${response.status} on fetch ${method} ${targetUrl}. Retrying attempt ${attempt}/${maxAttempts}...`);
        await delay(Math.pow(2, attempt - 1) * 800);
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);

      const isAbort = err.name === 'AbortError';
      const isBrowserFetchDrop = err instanceof TypeError && (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('Load failed'));
      const isNetworkOrTimeout = isAbort || isBrowserFetchDrop;

      if (!isNetworkOrTimeout) {
        throw err;
      }

      lastError = err;

      if (attempt < maxAttempts) {
        console.warn(`⚠️ [API Resilience] Fetch drop/timeout on ${method} ${targetUrl}. Retrying attempt ${attempt}/${maxAttempts}...`);
        await delay(Math.pow(2, attempt - 1) * 800);
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error('Fetch failed after retries');
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

  getAllStudents: async () => {
    return request<{ count: number; students: any[] }>('/admin/students');
  },

  importStudents: async (students: any[], defaultPassword?: string) => {
    return request<{ message: string; importedCount: number; skippedCount: number; errors: string[] }>('/admin/students/import', {
      method: 'POST',
      body: JSON.stringify({ students, defaultPassword })
    });
  },

  previewStudentExcelImport: async (rows: any[]) => {
    return request<{
      totalRows: number;
      validRowsCount: number;
      updateRowsCount: number;
      errorRowsCount: number;
      canImport: boolean;
      preview: Array<{
        rowNumber: number;
        status: 'VALID_NEW' | 'UPDATE_EXISTING' | 'ERROR';
        errors: string[];
        parsedData: {
          name: string;
          registerNo: string;
          mobileNumber: string | null;
          collegeEmail: string;
          personalEmail: string | null;
          address: string | null;
          cgpa: number | null;
        };
      }>;
    }>('/admin/students/import-preview', {
      method: 'POST',
      body: JSON.stringify({ rows })
    });
  },

  confirmStudentExcelImport: async (students: any[], defaultYear?: string, defaultSection?: string, defaultBatch?: string) => {
    return request<{ message: string; importedCount: number; students: any[] }>('/admin/students/import-confirm', {
      method: 'POST',
      body: JSON.stringify({ students, defaultYear, defaultSection, defaultBatch })
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

  getFacultyStudentById: async (id: string) => {
    return request<{ student: Student }>(`/faculty/students/${id}`);
  },

  updateFacultyStudentDetails: async (id: string, details: Partial<Student>) => {
    return request<{ message: string; student: Student }>(`/faculty/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(details)
    });
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

    return request<{ message: string; attachment: any }>('/files/upload', {
      method: 'POST',
      body: formData
    });
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

    return request<{ message: string; proof: any }>(`/faculty/students/${studentId}/nptel-proofs`, {
      method: 'POST',
      body: formData
    });
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
  },

  // Attendance API Methods
  previewAttendanceImport: async (rows: any[], role: 'FACULTY' | 'ADMIN' = 'FACULTY') => {
    const endpoint = role === 'ADMIN' ? '/admin/attendance/import-preview' : '/faculty/attendance/import-preview';
    return request<{
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
    }>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ rows })
    });
  },

  confirmAttendanceImport: async (records: Array<{ studentId: string; date: string; status: string }>, role: 'FACULTY' | 'ADMIN' = 'FACULTY') => {
    const endpoint = role === 'ADMIN' ? '/admin/attendance/import-confirm' : '/faculty/attendance/import-confirm';
    return request<{ message: string; importedCount: number; updatedStudentsCount: number }>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ records })
    });
  },

  getDailyAttendance: async (date: string, role: 'FACULTY' | 'ADMIN' = 'FACULTY', year?: string, section?: string) => {
    const params = new URLSearchParams();
    params.append('date', date);
    if (year && year !== 'ALL') params.append('year', year);
    if (section && section !== 'ALL') params.append('section', section);
    const endpoint = role === 'ADMIN' ? `/admin/attendance/daily?${params.toString()}` : `/faculty/attendance/daily?${params.toString()}`;
    return request<{ date: string; records: any[] }>(endpoint);
  },

  getMonthlyAttendanceSummary: async (role: 'FACULTY' | 'ADMIN' = 'FACULTY', year?: string, section?: string) => {
    const params = new URLSearchParams();
    if (year && year !== 'ALL') params.append('year', year);
    if (section && section !== 'ALL') params.append('section', section);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const endpoint = role === 'ADMIN' ? `/admin/attendance/summary${queryString}` : `/faculty/attendance/summary${queryString}`;
    return request<{ summary: any[] }>(endpoint);
  },

  // Discipline Issue Module API Methods
  lookupDisciplineStudent: async (regNo: string) => {
    return request<{
      found: boolean;
      student?: {
        id: string;
        registerNo: string;
        name: string;
        email: string;
        year: string;
        section: string;
        department: string;
      };
      error?: string;
    }>(`/discipline/lookup-student/${encodeURIComponent(regNo)}`);
  },

  searchDisciplineStudents: async (query: string) => {
    return request<{ students: any[] }>(`/discipline/students/search?q=${encodeURIComponent(query)}`);
  },

  getDisciplineRecords: async (params?: { registerNo?: string; year?: string; section?: string; issue?: string; search?: string }) => {
    const qParams = new URLSearchParams();
    if (params?.registerNo) qParams.append('registerNo', params.registerNo);
    if (params?.year && params.year !== 'ALL') qParams.append('year', params.year);
    if (params?.section && params.section !== 'ALL') qParams.append('section', params.section);
    if (params?.issue && params.issue !== 'ALL') qParams.append('issue', params.issue);
    if (params?.search) qParams.append('search', params.search);
    const queryString = qParams.toString() ? `?${qParams.toString()}` : '';
    return request<{ records: any[] }>(`/discipline/records${queryString}`);
  },

  createDisciplineRecord: async (recordData: {
    registerNo: string;
    issue: string;
    ruleViolated?: string;
    actionTaken?: string;
    fineAmount?: number;
    fineDetails?: string;
    remarks?: string;
    date?: string;
    time?: string;
  }) => {
    return request<{ message: string; record: any }>('/discipline/records', {
      method: 'POST',
      body: JSON.stringify(recordData)
    });
  },

  deleteDisciplineRecord: async (id: string) => {
    return request<{ message: string }>(`/discipline/records/${id}`, {
      method: 'DELETE'
    });
  }
};
