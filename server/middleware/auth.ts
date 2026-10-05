import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { db, normalizeYear, normalizeSection } from '../db.js';

dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'aids_system_secure_jwt_secret_token_key_2026';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'STUDENT' | 'FACULTY' | 'HOD' | 'ADMIN';
    assignedYear?: string;
    assignedSection?: string;
    registerNo?: string;
    studentId?: string;
  };
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  let authHeader = req.headers.authorization;
  if (!authHeader && req.headers.Authorization && typeof req.headers.Authorization === 'string') {
    authHeader = req.headers.Authorization;
  }

  let tokenFromHeader: string | undefined;
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.trim().split(/\s+/);
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      const candidate = parts[1].trim();
      if (candidate && candidate !== 'null' && candidate !== 'undefined' && candidate !== '""' && candidate !== "''") {
        tokenFromHeader = candidate;
      }
    }
  }

  // Check cookie as secondary option if Bearer header was not provided
  let tokenFromCookie: string | undefined;
  const cookieCandidate = req.cookies?.aids_session_token;
  if (cookieCandidate && typeof cookieCandidate === 'string') {
    const trimmed = cookieCandidate.trim();
    if (trimmed && trimmed !== 'null' && trimmed !== 'undefined' && trimmed !== '""' && trimmed !== "''") {
      tokenFromCookie = trimmed;
    }
  }

  // Priority: 1. Authorization: Bearer token (explicit in request header)
  //           2. HttpOnly cookie aids_session_token
  const token = tokenFromHeader || tokenFromCookie;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication session token.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded && decoded.role) {
      decoded.role = String(decoded.role).trim().toUpperCase();
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }
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

  if (!targetStudentId) {
    return res.status(400).json({ error: 'Bad Request: Target Student ID missing.' });
  }

  const targetStudent = await db.getStudentById(targetStudentId);
  if (!targetStudent) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  const isCreatedByStaff = targetStudent.created_by_faculty_id === req.user.id;
  const isWorkspaceStaff = targetStudent.faculty_workspace_id === req.user.id;

  // Derived from relational faculty_assignments
  const facultyAssignment = await db.getFacultyAssignment(req.user.id);
  const assignedYear = facultyAssignment ? facultyAssignment.year : req.user.assignedYear;
  const assignedSection = facultyAssignment ? facultyAssignment.section : req.user.assignedSection;

  const cleanAssignedYear = normalizeYear(assignedYear);
  const cleanAssignedSec = normalizeSection(assignedSection);
  const cleanStudentYear = normalizeYear(targetStudent.year);
  const cleanStudentSec = normalizeSection(targetStudent.section);

  const isYearMatch = !cleanAssignedYear || cleanAssignedYear === 'ALL' || cleanStudentYear === cleanAssignedYear;
  const isSectionMatch = !cleanAssignedSec || cleanAssignedSec === 'ALL' || cleanStudentSec === cleanAssignedSec;

  if ((isYearMatch && isSectionMatch) || isCreatedByStaff || isWorkspaceStaff) {
    return next();
  }

  return res.status(403).json({
    error: `Forbidden: Access denied. Student (${targetStudent.year} Section ${targetStudent.section}) is outside your assigned workspace (${assignedYear} Section ${assignedSection}).`
  });

  next();
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
