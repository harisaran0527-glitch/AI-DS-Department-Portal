import type { Student, UserSession, TeamHead, Subject, Role } from '../types';

export function getApiBaseUrl(): string {
  const envBase = import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL;
  if (envBase && typeof envBase === 'string' && envBase.trim() !== '') {
    const trimmed = envBase.trim().replace(/\/$/, '');
    if (trimmed.includes('onrender.com')) {
      return '/api';
    }
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  return '/api';
}

export const API_BASE = getApiBaseUrl();

/** Fetch proof content with headers so session tokens never enter URLs or browser history. */
export async function openAuthenticatedFile(endpoint: string, role: Role, options: { download?: boolean; filename?: string } = {}): Promise<void> {
  if (!/^\/faculty\/(?:certificates|participation|nptel-proofs)\/[^/]+\/(?:view|download)$/.test(endpoint)) {
    throw new Error('Invalid proof endpoint.');
  }
  const preview = options.download ? null : window.open('about:blank', '_blank');
  if (!options.download && !preview) throw new Error('Allow pop-ups to preview this attachment.');
  if (preview) preview.opener = null;
  try {
    const token = getValidSessionToken(role);
    const response = await fetch(`${API_BASE}${endpoint}`, {
      cache: 'no-store',
      headers: { 'X-Portal-Role': role, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: 'include'
    });
    if (!response.ok) throw new Error(`Attachment could not be loaded (${response.status}).`);
    const blob = await response.blob();
    if (!options.download && !/^(?:application\/pdf|image\/(?:jpeg|png|gif|webp))$/i.test(blob.type)) {
      throw new Error('Preview is unavailable for this file type. Download the attachment instead.');
    }
    const objectUrl = URL.createObjectURL(blob);
    if (options.download) {
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = options.filename || 'attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else if (preview) {
      preview.location.replace(objectUrl);
    }
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    preview?.close();
    throw error;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isValidToken(val: string | null | undefined): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  return Boolean(trimmed && trimmed !== 'null' && trimmed !== 'undefined' && trimmed !== '""' && trimmed !== "''");
}

export function getActivePortalRole(): Role | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/admin')) return 'ADMIN';
  if (path.startsWith('/hod')) return 'HOD';
  if (path.startsWith('/faculty')) return 'FACULTY';
  if (path.startsWith('/student')) return 'STUDENT';
  const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('aids_active_role') : null;
  if (stored) return stored.toUpperCase() as Role;
  return null;
}

export function inferRoleFromEndpoint(endpoint: string): Role | null {
  const lower = endpoint.toLowerCase();
  if (lower.includes('/admin/') || lower.endsWith('/admin')) return 'ADMIN';
  if (lower.includes('/hod/') || lower.endsWith('/hod')) return 'HOD';
  if (lower.includes('/faculty/') || lower.endsWith('/faculty')) return 'FACULTY';
  if (lower.includes('/student/') || lower.endsWith('/student')) return 'STUDENT';
  return null;
}

export function getValidSessionToken(roleHint?: Role): string | null {
  if (typeof window === 'undefined') return null;
  const role = roleHint || getActivePortalRole();
  if (!role) return null;

  const roleKey = `aids_token_${role.toLowerCase()}`;

  // 1. Check tab-scoped sessionStorage for role-specific token
  if (typeof sessionStorage !== 'undefined') {
    const tabToken = sessionStorage.getItem(roleKey);
    if (isValidToken(tabToken)) return tabToken!.trim();
  }

  // 2. Check persistent role-scoped localStorage (keeps installed PWAs isolated across restarts)
  if (typeof localStorage !== 'undefined') {
    const roleToken = localStorage.getItem(roleKey);
    if (isValidToken(roleToken)) return roleToken!.trim();
  }

  // Strict isolation: Never fall back to generic aids_session_token or other roles' tokens!
  return null;
}

export function setSessionAuth(token: string, role?: string, rememberDevice = false): void {
  const normRole = (role || getActivePortalRole() || 'STUDENT').toUpperCase() as Role;
  const roleKey = `aids_token_${normRole.toLowerCase()}`;

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('aids_active_role', normRole);
    sessionStorage.setItem(roleKey, token);
  }
  if (typeof localStorage !== 'undefined') {
    if (rememberDevice) localStorage.setItem(roleKey, token);
    else localStorage.removeItem(roleKey);
    // Purge legacy shared keys to eliminate cross-portal session collisions
    localStorage.removeItem('aids_session_token');
    localStorage.removeItem('aids_token');
  }
}

export function clearSessionAuth(role?: string): void {
  const targetRole = role || getActivePortalRole();
  if (targetRole) {
    const roleKey = `aids_token_${targetRole.toLowerCase()}`;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(roleKey);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(roleKey);
    }
  } else {
    (['STUDENT', 'FACULTY', 'HOD', 'ADMIN'] as Role[]).forEach((r) => {
      const k = `aids_token_${r.toLowerCase()}`;
      sessionStorage?.removeItem(k);
      localStorage?.removeItem(k);
    });
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('aids_session_token');
    if (!targetRole || sessionStorage.getItem('aids_active_role') === targetRole.toUpperCase()) {
      sessionStorage.removeItem('aids_active_role');
    }
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('aids_session_token');
    localStorage.removeItem('aids_token');
  }
}

const inFlightGetRequests = new Map<string, Promise<any>>();

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const defaultHeaders: Record<string, string> = isFormData ? {} : { 'Content-Type': 'application/json' };
  const method = (options.method || 'GET').toUpperCase();
  const isGetOrIdempotent = method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'PUT';

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

  const isLoginRequest = url.includes('/auth/login');
  // Never automatically retry password submissions per security requirements
  const isDisciplineMutation = /\/discipline\/records(?:\/|$)/.test(endpoint) && !isGetOrIdempotent;
  const isAuthenticationMutation = /\/auth\/(?:login|logout|change-password)(?:\?|$)/.test(url);
  const maxAttempts = isAuthenticationMutation || isDisciplineMutation ? 1 : 3;
  let lastError: any = null;

  // Resolve target role: explicit option header > endpoint URL path > current active portal role
  const explicitRole = (options.headers as Record<string, string>)?.[`X-Portal-Role`] as Role | undefined;
  const endpointRole = inferRoleFromEndpoint(endpoint);
  const activeRole = explicitRole || endpointRole || getActivePortalRole();

  const validToken = !isLoginRequest ? getValidSessionToken(activeRole || undefined) : null;
  const authHeader: Record<string, string> = {
    ...(validToken ? { Authorization: `Bearer ${validToken}` } : {}),
    ...(activeRole ? { 'X-Portal-Role': activeRole } : {})
  };

  const dedupKey = method === 'GET' ? `${url}:${validToken || ''}` : '';
  if (dedupKey && inFlightGetRequests.has(dedupKey)) {
    return inFlightGetRequests.get(dedupKey) as Promise<T>;
  }

  const runRequest = async (): Promise<T> => {
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
          ...authHeader,
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

      let responseBodyText = '';
      let data: any = {};
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json().catch(() => ({}));
        responseBodyText = JSON.stringify(data);
      } else {
        responseBodyText = await response.text().catch(() => '');
      }

      const errorMessage = data.error || data.message;
      const renderRouting = response.headers.get('x-render-routing') || '';
      const isRenderSuspended = renderRouting === 'suspend' || responseBodyText.toLowerCase().includes('service has been suspended');

      if (isRenderSuspended) {
        throw new Error('Backend server is suspended on Render. Please resume the service in your Render dashboard.');
      }

      // Handle 401 Unauthorized
      if (response.status === 401) {
        if (!isLoginRequest) {
          clearSessionAuth(activeRole || undefined);
        }
        const errorMsg = isLoginRequest
          ? (errorMessage || 'Invalid credentials. Please verify your email/ID and password.')
          : (errorMessage || 'Session expired. Please log in again.');
        throw Object.assign(new Error(errorMsg), { status: 401 });
      }

      // Handle 403 Forbidden
      if (response.status === 403) {
        const errorMsg = errorMessage || 'Forbidden: Insufficient permissions.';
        throw new Error(errorMsg);
      }

      // Handle 429 Rate Limit
      if (response.status === 429) {
        const errorMsg = errorMessage || 'Too many requests. Please wait a moment before trying again.';
        throw new Error(errorMsg);
      }

      // 5xx Transient Gateway Errors (502, 503, 504) - retry safe/idempotent or cold start proxy responses (NEVER login)
      const isGatewayTransient = response.status === 502 || response.status === 503 || response.status === 504;
      if (!isLoginRequest && attempt < maxAttempts && (isGetOrIdempotent || isGatewayTransient)) {
        console.warn(`⚠️ [API Resilience] Transient HTTP ${response.status} on ${method} ${url}. Retrying attempt ${attempt}/${maxAttempts}...`);
        await delay(Math.pow(2, attempt - 1) * 800);
        continue;
      }

      if (response.status === 503) {
        throw new Error(errorMessage || 'Backend server is currently waking up or unavailable (HTTP 503). Please retry in a few moments.');
      }

      if (response.status === 502 || response.status === 504) {
        throw new Error(errorMessage || `Backend gateway error (HTTP ${response.status}). The server may be starting up, please try again shortly.`);
      }

      // Do NOT retry other 4xx client errors
      if (response.status < 500 && response.status !== 408) {
        throw new Error(errorMessage || `Client Error (${response.status})`);
      }

      throw new Error(errorMessage || `Server Error (${response.status}). Please try again.`);
    } catch (err: any) {
      clearTimeout(timeoutId);

      const isAbort = err.name === 'AbortError';
      const isBrowserFetchDrop = err instanceof TypeError && (
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('NetworkError') ||
        err.message?.includes('Load failed') ||
        err.message?.includes('fetch failed')
      );
      const isNetworkOrTimeout = isAbort || isBrowserFetchDrop;

      if (!isNetworkOrTimeout) {
        throw err;
      }

      lastError = err;

      if (!isLoginRequest && attempt < maxAttempts) {
        const logMsg = isAbort ? 'Request timed out waiting for backend response' : (err.message || 'Network failure');
        console.warn(`⚠️ [API Resilience] ${logMsg} on ${method} ${url}. Retrying attempt ${attempt}/${maxAttempts}...`);
        await delay(Math.pow(2, attempt - 1) * 800);
        continue;
      }

      if (isAbort) {
        throw new Error('Request timed out waiting for server response. Please try again.');
      }

      if (isBrowserFetchDrop) {
        const isClientOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
        if (isClientOffline) {
          throw new Error('No internet connection detected. Please check your network and try again.');
        } else {
          throw new Error('Unable to connect to backend server. The server may be waking up from idle or temporarily unavailable. Please retry in a few moments.');
        }
      }

      throw err;
    }
  }

  throw lastError || new Error('Request failed after retries');
};

  if (dedupKey) {
    const promise = runRequest().finally(() => {
      inFlightGetRequests.delete(dedupKey);
    });
    inFlightGetRequests.set(dedupKey, promise);
    return promise;
  }

  return runRequest();
}

export async function fetchWithResilience(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const isGetOrIdempotent = method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || method === 'PUT';

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
  const isLoginRequest = targetUrl.includes('/auth/login');
  const maxAttempts = isLoginRequest ? 1 : 3;
  let lastError: any = null;

  const explicitRole = (options.headers as Record<string, string>)?.[`X-Portal-Role`] as Role | undefined;
  const endpointRole = inferRoleFromEndpoint(url);
  const activeRole = explicitRole || endpointRole || getActivePortalRole();

  const validToken = !isLoginRequest ? getValidSessionToken(activeRole || undefined) : null;
  const authHeader: Record<string, string> = {
    ...(validToken ? { Authorization: `Bearer ${validToken}` } : {}),
    ...(activeRole ? { 'X-Portal-Role': activeRole } : {})
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const config: RequestInit = {
        ...options,
        signal: options.signal || controller.signal,
        headers: {
          ...authHeader,
          ...(options.headers as Record<string, string> || {})
        },
        credentials: options.credentials || 'include'
      };

      const response = await fetch(targetUrl, config);
      clearTimeout(timeoutId);

      const renderRouting = response.headers.get('x-render-routing') || '';
      if (renderRouting === 'suspend') {
        throw new Error('Backend server is suspended on Render. Please resume the service in your Render dashboard.');
      }

      const isGatewayTransient = response.status === 502 || response.status === 503 || response.status === 504;
      if (!isLoginRequest && !response.ok && response.status >= 500 && attempt < maxAttempts && (isGetOrIdempotent || isGatewayTransient)) {
        console.warn(`⚠️ [API Resilience] Transient HTTP ${response.status} on fetch ${method} ${targetUrl}. Retrying attempt ${attempt}/${maxAttempts}...`);
        await delay(Math.pow(2, attempt - 1) * 800);
        continue;
      }

      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);

      const isAbort = err.name === 'AbortError';
      const isBrowserFetchDrop = err instanceof TypeError && (
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('NetworkError') ||
        err.message?.includes('Load failed') ||
        err.message?.includes('fetch failed')
      );
      const isNetworkOrTimeout = isAbort || isBrowserFetchDrop;

      if (!isNetworkOrTimeout) {
        throw err;
      }

      lastError = err;

      if (!isLoginRequest && attempt < maxAttempts) {
        console.warn(`⚠️ [API Resilience] Fetch drop/timeout on ${method} ${targetUrl}. Retrying attempt ${attempt}/${maxAttempts}...`);
        await delay(Math.pow(2, attempt - 1) * 800);
        continue;
      }

      if (isAbort) {
        throw new Error('Request timed out waiting for server response. Please try again.');
      }

      if (isBrowserFetchDrop) {
        const isClientOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
        if (isClientOffline) {
          throw new Error('No internet connection detected. Please check your network and try again.');
        } else {
          throw new Error('Unable to connect to backend server. The server may be waking up from idle or temporarily unavailable. Please retry in a few moments.');
        }
      }

      throw err;
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}

export const API = {
  // Auth
  login: async (identifier: string, password: string, role: string, rememberDevice = false) => {
    const cleanRole = role.trim().toUpperCase() as Role;
    // 1. Clear stale authentication state for this role only
    clearSessionAuth(cleanRole);

    const res = await request<{ message: string; user: UserSession; token?: string }>('/auth/login', {
      method: 'POST',
      headers: {
        'X-Portal-Role': cleanRole
      },
      body: JSON.stringify({
        identifier: identifier.trim(),
        password,
        role: cleanRole
      })
    });

    // 2. Store authoritative token in role-isolated storage
    if (res && res.token) {
      setSessionAuth(res.token, cleanRole, rememberDevice);
    }
    return res;
  },

  logout: async (role?: string) => {
    const cleanRole = role || getActivePortalRole();
    let result;
    try {
      result = await request<{ message: string }>('/auth/logout', {
        method: 'POST',
        headers: cleanRole ? { 'X-Portal-Role': cleanRole } : {}
      });
    } catch (error) {
      if (!(error instanceof Error) || !('status' in error) || error.status !== 401) throw error;
      // An expired/revoked session is already signed out; a 503 must remain retryable.
      result = { message: 'Session has ended.' };
    }
    clearSessionAuth(cleanRole || undefined);
    return result;
  },

  getMe: async (roleHint?: Role) => {
    const role = roleHint || getActivePortalRole();
    const token = getValidSessionToken(role || undefined);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (role) headers['X-Portal-Role'] = role;
    return request<{ user: UserSession }>('/auth/me', { headers });
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
      body: JSON.stringify({ newPassword, password: newPassword })
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

  previewHodStudentExcelImport: async (facultyId: string, year: string, section: string, rows: any[]) => {
    return request<{
      faculty: { id: string; name: string; email: string };
      year: string;
      section: string;
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
    }>('/hod/students/import-preview', {
      method: 'POST',
      body: JSON.stringify({ facultyId, year, section, rows })
    });
  },

  confirmHodStudentExcelImport: async (facultyId: string, year: string, section: string, students: any[], batch?: string) => {
    return request<{ message: string; importedCount: number; students: any[] }>('/hod/students/import-confirm', {
      method: 'POST',
      body: JSON.stringify({ facultyId, year, section, batch, students })
    });
  },

  changeAdminPassword: async (currentPassword: string, newPassword: string) => {
    return request<{ message: string }>('/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const result = await request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    clearSessionAuth();
    return result;
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
      body: JSON.stringify({ password, newPassword: password })
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

  // Proof & Project File Management
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

  // Alias for backward and forward compatibility and direct project uploads
  uploadFile: async (studentId: string, recordType: string, recordId: string, file: File) => {
    return API.uploadProofFile(studentId, recordType, recordId, file);
  },

  getRecordAttachment: async (studentId: string, recordType: string, recordId: string) => {
    return request<{ attachment: any }>(`/files/record/${studentId}/${recordType}/${recordId}`);
  },

  deleteProofFile: async (fileId: string) => {
    return request<{ message: string }>(`/files/${fileId}`, {
      method: 'DELETE'
    });
  },

  getFileBlob: async (fileId: string): Promise<{ blob: Blob; contentType: string; fileName: string }> => {
    const activeRole = getActivePortalRole();
    const token = getValidSessionToken(activeRole || undefined);
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeRole ? { 'X-Portal-Role': activeRole } : {})
    };

    const res = await fetch(`${API_BASE}/files/${fileId}`, {
      method: 'GET',
      cache: 'no-store',
      headers,
      credentials: 'include'
    });

    if (!res.ok) {
      let errMsg = `Failed to fetch file (${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson?.error) errMsg = errJson.error;
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }

    const contentType = res.headers.get('Content-Type') || 'application/octet-stream';
    let fileName = 'attachment';
    const disposition = res.headers.get('Content-Disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        fileName = decodeURIComponent(match[1]);
      }
    }
    const blob = await res.blob();
    return { blob, contentType, fileName };
  },

  downloadFileBlob: async (fileId: string, suggestedFileName?: string): Promise<void> => {
    const { blob, fileName } = await API.getFileBlob(fileId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedFileName || fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1000);
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

  previewFacultyStudentExcelImport: async (rows: any[]) => {
    return request<{
      faculty: { id: string; name: string; email: string; assignedYear: string; assignedSection: string };
      assignedYear: string;
      assignedSection: string;
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
    }>('/faculty/students/import-preview', {
      method: 'POST',
      body: JSON.stringify({ rows })
    });
  },

  confirmFacultyStudentExcelImport: async (students: any[], batch?: string) => {
    return request<{ message: string; count: number; importedCount: number; students: any[] }>('/faculty/students/import-confirm', {
      method: 'POST',
      body: JSON.stringify({ students, batch })
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

  previewSubjectImport: async (rows: any[], year?: string, section?: string) => {
    return request<{
      summary: { totalRowsProcessed: number; validCount: number; invalidCount: number };
      validRows: any[];
      invalidRows: any[];
    }>('/subjects/import-preview', {
      method: 'POST',
      body: JSON.stringify({ rows, year, section })
    });
  },

  confirmSubjectImport: async (subjects: any[], year?: string, section?: string) => {
    return request<{ message: string; importedCount: number; subjects: any[] }>('/subjects/import-confirm', {
      method: 'POST',
      body: JSON.stringify({ subjects, year, section })
    });
  },

  // Bulk Academic Marks Upload & Validation
  previewAcademicMarksImport: async (rows: any[], examType?: string, year?: string, section?: string) => {
    return request<{
      summary: { totalRowsProcessed: number; validCount: number; invalidCount: number };
      validRows: Array<{ rowNumber: number; studentId: string; studentName: string; registerNo: string; year: string; section: string; examType?: string; subjectCode: string; subjectTitle: string; subjectAbbreviation?: string; semester: number; marks: number }>;
      invalidRows: Array<{ rowNumber: number; rawData: any; reason: string }>;
    }>('/faculty/academics/import-preview', {
      method: 'POST',
      body: JSON.stringify({ rows, examType, year, section })
    });
  },

  confirmAcademicMarksImport: async (marks: any[], examType?: string, year?: string, section?: string) => {
    return request<{ message: string; importedCount: number; updatedStudentsCount: number }>('/faculty/academics/import-confirm', {
      method: 'POST',
      body: JSON.stringify({ marks, examType, year, section })
    });
  },

  getAcademicRecords: async (filters: { year?: string; section?: string; examType?: string; studentId?: string; subjectCode?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.year && filters.year !== 'ALL') params.append('year', filters.year);
    if (filters.section && filters.section !== 'ALL') params.append('section', filters.section);
    if (filters.examType && filters.examType !== 'ALL') params.append('examType', filters.examType);
    if (filters.studentId) params.append('studentId', filters.studentId);
    if (filters.subjectCode && filters.subjectCode !== 'ALL') params.append('subjectCode', filters.subjectCode);
    const qs = params.toString();
    return request<{ records: any[] }>(`/faculty/academics/records${qs ? `?${qs}` : ''}`);
  },

  // Gemini Central Student Recognition & Reward Engine API
  getStudentAiReward: async (studentId?: string) => {
    const endpoint = studentId ? `/student/${studentId}/ai-reward` : '/student/ai-reward';
    return request<{ reward: any; rewardScore?: any }>(endpoint);
  },

  getHodAwardCandidatesV2: async (year?: string, section?: string) => {
    const params = new URLSearchParams();
    if (year && year !== 'ALL') params.append('year', year);
    if (section && section !== 'ALL') params.append('section', section);
    const qs = params.toString();
    return request<{ count: number; candidates: any[] }>(`/hod/award-candidates-v2${qs ? `?${qs}` : ''}`);
  },

  previewStudentExcelImport: async (rows: any[]) => {
    return request<{ preview: any[]; summary?: any }>('/admin/students/import-preview', {
      method: 'POST',
      body: JSON.stringify({ rows })
    });
  },

  confirmStudentExcelImport: async (students: any[]) => {
    return request<{ message: string; importedCount: number }>('/admin/students/import-confirm', {
      method: 'POST',
      body: JSON.stringify({ students })
    });
  },

  postHodAwardAction: async (
    studentId: string,
    actionOrPayload: 'APPROVE' | 'REJECT' | { action: 'APPROVE' | 'REJECT'; remarks?: string; reason?: string; awardTitle?: string },
    awardTitle?: string,
    reason?: string
  ) => {
    const payload = typeof actionOrPayload === 'object'
      ? actionOrPayload
      : { action: actionOrPayload, awardTitle, reason };
    return request<{ message: string; award: any }>(`/hod/awards/${studentId}/action`, {
      method: 'POST',
      body: JSON.stringify(payload)
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
    return request<{ students: Array<{
      id: string;
      registerNo: string;
      name: string;
      email: string;
      year: string;
      section: string;
      department: string;
      assignedStaffName?: string;
    }> }>(`/discipline/students/search?q=${encodeURIComponent(query)}`);
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
    status?: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED';
  }) => {
    return request<{ message: string; record: any }>('/discipline/records', {
      method: 'POST',
      body: JSON.stringify(recordData)
    });
  },

  updateDisciplineRecord: async (id: string, recordData: {
    issue: string;
    ruleViolated: string;
    actionTaken: string;
    fineAmount: number;
    fineDetails: string;
    remarks: string;
    date: string;
    time: string;
    status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED';
  }) => {
    return request<{ message: string }>(`/discipline/records/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(recordData)
    });
  },

  deleteDisciplineRecord: async (id: string) => {
    return request<{ message: string }>(`/discipline/records/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  }
};
