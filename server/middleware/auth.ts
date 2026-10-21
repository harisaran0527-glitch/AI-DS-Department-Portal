import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { db, normalizeYear, normalizeSection } from '../db.js';
import { withPrimaryDatabase } from '../databasePolicy.js';
import { isJwtConfiguredForRuntime, isSessionRole, matchesCredentialVersion, sessionTokenDigest, verifySessionToken } from '../services/sessionTokens.js';
import type { SessionClaims } from '../services/sessionTokens.js';

dotenv.config();

export { isJwtConfiguredForRuntime };

export function isJwtConfiguredForRuntime(): boolean {
  return Boolean(process.env.JWT_SECRET?.trim()) ||
    (process.env.NODE_ENV !== 'production' && !process.env.VERCEL);
}

export interface AuthRequest extends Request {
  session?: { tokenDigest: string; claims: SessionClaims };
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'STUDENT' | 'FACULTY' | 'HOD' | 'ADMIN';
    assignedYear?: string;
    assignedSection?: string;
    registerNo?: string;
    studentId?: string;
    requiresPasswordChange?: boolean;
  };
}

/** Named API parameters are scalar; Express 5 also types wildcard captures as arrays. */
export function getRouteParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !value || value.length > 256) {
    throw Object.assign(new Error('Invalid route parameter.'), { status: 400 });
  }
  return value;
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isJwtConfiguredForRuntime()) {
    return res.status(503).json({ error: 'Authentication is not configured. Please contact the portal administrator.' });
  }
  const roleHeader = req.headers['x-portal-role'];
  const portalRole = typeof roleHeader === 'string' ? roleHeader.trim().toUpperCase() : undefined;
  if (roleHeader !== undefined && !isSessionRole(portalRole)) {
    return res.status(401).json({ error: 'A valid portal role is required.' });
  }
  const path = (req.originalUrl || req.path || '').toLowerCase();
  const targetRole = portalRole || path.match(/^\/(?:api\/)?(admin|hod|faculty|student)(?:\/|$)/)?.[1]?.toUpperCase();
  const authorization = req.headers.authorization;
  let token: string | undefined;
  let cookieAuthentication = false;
  if (authorization !== undefined) {
    const match = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) return res.status(401).json({ error: 'Invalid Authorization header.' });
    token = match[1];
  } else {
    const candidates = targetRole ? [req.cookies?.[`aids_${targetRole.toLowerCase()}_token`]] :
      ['faculty', 'student', 'hod', 'admin'].map(role => req.cookies?.[`aids_${role}_token`]).filter(Boolean);
    if (candidates.length !== 1) return res.status(401).json({ error: 'Select a portal and sign in to continue.' });
    token = candidates[0];
    cookieAuthentication = true;
  }
  if (typeof token !== 'string' || !token || token.length > 8192) return res.status(401).json({ error: 'Missing or invalid session token.' });
  if (cookieAuthentication && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    // Browser cookie mutations must originate from this app or its configured frontend.
    const publicProtocol = process.env.NODE_ENV === 'production' || process.env.VERCEL ? 'https' : req.protocol;
    const trustedOrigins = new Set([new URL(`${publicProtocol}://${req.get('host')}`).origin]);
    if (process.env.FRONTEND_URL) {
      try { trustedOrigins.add(new URL(process.env.FRONTEND_URL).origin); } catch { /* fail closed */ }
    }
    if (typeof req.headers.origin !== 'string' || !trustedOrigins.has(req.headers.origin)) {
      return res.status(403).json({ error: 'A trusted application origin is required.' });
    }
  }
  let claims: SessionClaims;
  try {
    claims = verifySessionToken(token);
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }
  if (portalRole && claims.role !== portalRole) return res.status(401).json({ error: 'This session belongs to a different portal.' });
  // A cookie selected by its role name must contain a token for that same role.
  if (cookieAuthentication && targetRole && claims.role !== targetRole) return res.status(401).json({ error: 'This cookie belongs to a different portal.' });
  const tokenDigest = sessionTokenDigest(token);
  return withPrimaryDatabase(async () => {
    try {
      const user = await db.getUserById(claims.id);
      if (!user || Number(user.is_active) !== 1 || user.role.trim().toUpperCase() !== claims.role ||
          typeof user.password_hash !== 'string' || !matchesCredentialVersion(claims.credentialVersion, user.password_hash) ||
          await db.isSessionRevoked(tokenDigest)) {
        return res.status(401).json({ error: 'This session is no longer authorized. Please sign in again.' });
      }
      req.user = { id: user.id, email: user.email, name: user.name, role: claims.role,
        assignedYear: user.year, assignedSection: user.section,
        registerNo: claims.role === 'STUDENT' ? user.identifier : undefined,
        studentId: claims.role === 'STUDENT' ? user.id : undefined,
        requiresPasswordChange: claims.requiresPasswordChange === true };
      req.session = { tokenDigest, claims };
    } catch (error) {
      console.error('[Auth] Session validation unavailable', error);
      return res.status(503).json({ error: 'Session validation is temporarily unavailable. Please try again.' });
    }
    return next();
  });
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Missing authentication session token.' });
    }

    const userRole = (req.user.role || '').toString().trim().toUpperCase();
    const allowedRoles = roles.map((r) => r.trim().toUpperCase());

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: `Forbidden: Requires ${roles.join(' or ')} permissions.` });
    }

    next();
  };
}

// Server-Side Authorization: Faculty Workspace & Staff-Wise Data Isolation Check
export async function verifyFacultySectionAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // HOD & Admin have elevated department-wide permissions
  if (req.user.role === 'HOD' || req.user.role === 'ADMIN') {
    return next();
  }

  if (req.user.role !== 'FACULTY') {
    return res.status(403).json({ error: 'Forbidden: Faculty access required.' });
  }

  const targetStudentId =
    req.params.studentId ||
    req.params.id ||
    req.body?.studentId ||
    req.body?.id ||
    (req.query?.studentId as string) ||
    (req.query?.id as string);

  if (typeof targetStudentId !== 'string' || !targetStudentId || targetStudentId.length > 256) {
    return res.status(400).json({ error: 'Bad Request: Target Student ID missing.' });
  }

  const targetStudent = await db.getStudentById(targetStudentId);
  if (!targetStudent) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  const isCreatedByStaff = targetStudent.created_by_faculty_id === req.user.id;
  const isWorkspaceStaff = targetStudent.faculty_workspace_id === req.user.id;

  // Derived from relational faculty_assignments
  const facultyAssignment = await db.getFacultyAssignment(req.user.id, { fresh: true });
  const assignedYear = facultyAssignment?.is_active ? facultyAssignment.year : undefined;
  const assignedSection = facultyAssignment?.is_active ? facultyAssignment.section : undefined;

  const cleanAssignedYear = normalizeYear(assignedYear);
  const cleanAssignedSec = normalizeSection(assignedSection);
  const cleanStudentYear = normalizeYear(targetStudent.year);
  const cleanStudentSec = normalizeSection(targetStudent.section);

  const isYearMatch = Boolean(cleanAssignedYear && cleanAssignedYear !== 'ALL' && cleanStudentYear === cleanAssignedYear);
  const isSectionMatch = Boolean(cleanAssignedSec && cleanAssignedSec !== 'ALL' && cleanStudentSec === cleanAssignedSec);

  if ((isYearMatch && isSectionMatch) || isCreatedByStaff || isWorkspaceStaff) {
    return next();
  }

  return res.status(403).json({
    error: `Forbidden: Access denied. Student (${targetStudent.year} Section ${targetStudent.section}) is outside your assigned workspace (${assignedYear} Section ${assignedSection}).`
  });

}

// Server-Side Authorization: Lockout Student Mutation Attempts (100% View-Only)
export function verifyStudentSelfAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.user.role === 'STUDENT') {
    return res.status(403).json({
      error: 'Forbidden: Student Portal is strictly VIEW-ONLY. Mutation operations are disabled.'
    });
  }

  next();
}
