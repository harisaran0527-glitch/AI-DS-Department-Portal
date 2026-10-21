import crypto from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret, isJwtConfiguredForRuntime } from '../services/sessionTokens.js';
import { getDisciplinePortalUserById, type DisciplinePortalRole, type DisciplinePortalUser } from '../disciplinePortalStore.js';

const issuer = 'avsec-discipline-portal';
const audience = 'discipline-portal';
const sessionCookieName = 'discipline_portal_session';

export interface DisciplinePortalRequest extends Request {
  disciplineUser?: Omit<DisciplinePortalUser, 'password_hash'>;
}

function credentialVersion(passwordHash: string) {
  return crypto.createHmac('sha256', getJwtSecret()).update(passwordHash).digest('hex');
}

function issueToken(user: DisciplinePortalUser) {
  return jwt.sign({
    id: user.id,
    role: user.role,
    credentialVersion: credentialVersion(user.password_hash)
  }, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: '8h',
    issuer,
    audience,
    subject: user.id,
    jwtid: crypto.randomUUID()
  });
}

function validCredentialVersion(actual: unknown, expected: string) {
  if (typeof actual !== 'string' || !/^[a-f0-9]{64}$/.test(actual)) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function trustedOrigin(req: Request) {
  const origin = req.headers.origin;
  if (typeof origin !== 'string') return false;
  const allowed = new Set([
    `http://${req.get('host')}`,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3102',
    'http://127.0.0.1:3102'
  ]);
  if (process.env.FRONTEND_URL) {
    try { allowed.add(new URL(process.env.FRONTEND_URL).origin); } catch { return false; }
  }
  return allowed.has(origin);
}

export const authenticateDisciplinePortal: RequestHandler = async (req: DisciplinePortalRequest, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isJwtConfiguredForRuntime()) {
    return res.status(503).json({ error: 'Discipline authentication is not configured.' });
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !trustedOrigin(req)) {
    return res.status(403).json({ error: 'A trusted Discipline Portal origin is required.' });
  }
  const token = req.cookies?.[sessionCookieName];
  if (typeof token !== 'string' || !token || token.length > 8192) {
    return res.status(401).json({ error: 'Sign in to the Discipline Portal to continue.' });
  }
  try {
    const claims = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer,
      audience,
      maxAge: '8h'
    });
    if (typeof claims === 'string' || !claims || typeof claims.id !== 'string' ||
        !['ADMIN', 'FACULTY'].includes(String(claims.role)) || claims.sub !== claims.id ||
        typeof claims.jti !== 'string' || typeof claims.iat !== 'number' || typeof claims.exp !== 'number' ||
        claims.exp <= claims.iat) {
      return res.status(401).json({ error: 'The Discipline Portal session is invalid.' });
    }
    const user = await getDisciplinePortalUserById(claims.id);
    if (!user || Number(user.is_active) !== 1 || user.role !== claims.role ||
        !validCredentialVersion(claims.credentialVersion, credentialVersion(user.password_hash))) {
      return res.status(401).json({ error: 'The Discipline Portal session is no longer authorized.' });
    }
    req.disciplineUser = {
      id: user.id, email: user.email, name: user.name, role: user.role, is_active: user.is_active
    };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'The Discipline Portal session is invalid or expired.' });
    }
    console.error('[Discipline Portal] Session validation failed', error);
    return res.status(503).json({ error: 'Discipline Portal session validation is unavailable.' });
  }
};

export function requireDisciplinePortalRole(...roles: DisciplinePortalRole[]): RequestHandler {
  return (req: DisciplinePortalRequest, res, next) => {
    if (!req.disciplineUser) return res.status(401).json({ error: 'Sign in to continue.' });
    if (!roles.includes(req.disciplineUser.role)) return res.status(403).json({ error: 'This role cannot access that Discipline Portal operation.' });
    next();
  };
}

export function setDisciplinePortalSession(res: Response, req: Request, user: DisciplinePortalUser) {
  const token = issueToken(user);
  res.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || req.secure,
    sameSite: 'strict',
    path: '/api/discipline-portal',
    maxAge: 8 * 60 * 60 * 1000
  });
}

export function clearDisciplinePortalSession(res: Response, req: Request) {
  res.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || req.secure,
    sameSite: 'strict',
    path: '/api/discipline-portal'
  });
}

export function publicDisciplinePortalUser(user: DisciplinePortalUser) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
