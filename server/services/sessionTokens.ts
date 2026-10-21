import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

export const SESSION_ROLES = ['STUDENT', 'FACULTY', 'HOD', 'ADMIN'] as const;
export type SessionRole = typeof SESSION_ROLES[number];
export const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const issuer = 'avsec-salem';
const audience = 'department-portal';

export function isSessionRole(value: unknown): value is SessionRole {
  return typeof value === 'string' && SESSION_ROLES.includes(value as SessionRole);
}

export function isJwtConfiguredForRuntime(): boolean {
  const secret = process.env.JWT_SECRET;
  return typeof secret === 'string' && Buffer.byteLength(secret.trim()) >= 32 &&
    !/^(?:your_|change_me|changeme)/i.test(secret.trim()) &&
    secret.trim() !== 'aids_system_secure_jwt_secret_token_key_2026';
}

export function getJwtSecret(): string {
  if (!isJwtConfiguredForRuntime()) throw new Error('A private JWT_SECRET of at least 32 bytes is required.');
  return process.env.JWT_SECRET!;
}

export function credentialVersion(passwordHash: string): string {
  return crypto.createHmac('sha256', getJwtSecret()).update(passwordHash).digest('hex');
}

export function signSessionToken(user: { id: string; role: string; password_hash: string }, requiresPasswordChange = false): string {
  if (!user.id || !isSessionRole(user.role) || !user.password_hash) throw new Error('Invalid session identity.');
  return jwt.sign({ id: user.id, role: user.role, credentialVersion: credentialVersion(user.password_hash), requiresPasswordChange }, getJwtSecret(), {
    algorithm: 'HS256', expiresIn: SESSION_DURATION_SECONDS, issuer, audience,
    subject: user.id, jwtid: crypto.randomUUID()
  });
}

export interface SessionClaims extends JwtPayload {
  id: string;
  role: SessionRole;
  credentialVersion: string;
  jti: string;
  iat: number;
  exp: number;
}

export function verifySessionToken(token: string): SessionClaims {
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'], issuer, audience, maxAge: SESSION_DURATION_SECONDS
  });
  if (typeof decoded === 'string' || !decoded ||
      typeof decoded.id !== 'string' || !decoded.id || decoded.id.length > 200 ||
      !isSessionRole(decoded.role) || decoded.sub !== decoded.id ||
      typeof decoded.jti !== 'string' || !decoded.jti || decoded.jti.length > 200 ||
      typeof decoded.credentialVersion !== 'string' || !/^[a-f0-9]{64}$/.test(decoded.credentialVersion) ||
      !Number.isInteger(decoded.iat) || !Number.isInteger(decoded.exp) ||
      decoded.iat! > Math.floor(Date.now() / 1000) + 5 || decoded.exp! <= decoded.iat! ||
      decoded.exp! - decoded.iat! > SESSION_DURATION_SECONDS) {
    throw new Error('Invalid session claims.');
  }
  return decoded as SessionClaims;
}

export function matchesCredentialVersion(version: string, passwordHash: string): boolean {
  const expected = credentialVersion(passwordHash);
  return version.length === expected.length && crypto.timingSafeEqual(Buffer.from(version), Buffer.from(expected));
}

export function sessionTokenDigest(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
