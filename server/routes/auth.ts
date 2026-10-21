import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db.js';
import { authenticateToken, AuthRequest, isJwtConfiguredForRuntime, requireRole, verifyFacultySectionAccess } from '../middleware/auth.js';
import { recordBcrypt } from '../metrics.js';
import { withPrimaryDatabase } from '../databasePolicy.js';
import { getJwtSecret, isSessionRole, signSessionToken, SESSION_DURATION_SECONDS } from '../services/sessionTokens.js';

const router = Router();
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

const sessionCookieOptions = (req: Request) => ({
  httpOnly: true, secure: process.env.NODE_ENV === 'production' || req.secure,
  sameSite: 'lax' as const, path: '/'
});

// Rate limiting memory maps for failed logins (per identifier and per IP)
type Attempt = { count: number; lockedUntil?: number; expiresAt: number };
const failedAttempts = new Map<string, Attempt>();
const ipAttempts = new Map<string, Attempt>();
function recentAttempt(attempts: Map<string, Attempt>, key: string): Attempt | undefined {
  const attempt = attempts.get(key);
  if (attempt && attempt.expiresAt <= Date.now()) { attempts.delete(key); return undefined; }
  return attempt;
}
function recordAttempt(attempts: Map<string, Attempt>, key: string, limit: number, duration: number) {
  if (attempts.size >= 10000 && !attempts.has(key)) attempts.delete(attempts.keys().next().value!);
  const current = recentAttempt(attempts, key) || { count: 0, expiresAt: Date.now() + duration };
  current.count++;
  if (current.count >= limit) current.lockedUntil = current.expiresAt;
  attempts.set(key, current);
}

router.post('/login', (_req, _res, next) => withPrimaryDatabase(next), async (req, res) => {
  try {
    if (!isJwtConfiguredForRuntime()) {
      return res.status(503).json({ error: 'Authentication is not configured. Please contact the portal administrator.' });
    }
    const { identifier, password, role } = req.body || {};

    if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 256 ||
        typeof password !== 'string' || !password || password.length > 1024 || typeof role !== 'string' ||
        !['STUDENT', 'FACULTY', 'HOD', 'ADMIN'].includes(role.trim().toUpperCase())) {
      return res.status(400).json({ error: 'Invalid credentials. Identifier, password, and role are required.' });
    }

    const cleanId = identifier.trim().toLowerCase();
    const cleanRole = role.trim().toUpperCase();
    const accountKey = `${cleanRole}:${cleanId}`;
    // Only Express's configured proxy policy may determine the client IP.
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown-ip';

    // 1. IP-level rate limiting check: 15 failed attempts locks IP for 15 minutes
    const ipRecord = recentAttempt(ipAttempts, clientIp);
    if (ipRecord && ipRecord.lockedUntil) {
      if (Date.now() < ipRecord.lockedUntil) {
        const remainingSecs = Math.ceil((ipRecord.lockedUntil - Date.now()) / 1000);
        return res.status(429).json({ error: `Too many failed login requests from this IP address (${clientIp}). Please try again in ${remainingSecs} seconds.` });
      } else {
        ipAttempts.delete(clientIp);
      }
    }

    // 2. Identifier-level rate limiting check: 5 failed attempts locks account for 5 minutes
    const attemptRecord = recentAttempt(failedAttempts, accountKey);
    if (attemptRecord && attemptRecord.lockedUntil) {
      if (Date.now() < attemptRecord.lockedUntil) {
        const remainingSecs = Math.ceil((attemptRecord.lockedUntil - Date.now()) / 1000);
        return res.status(429).json({ error: `Account temporarily locked due to repeated failed login attempts. Please try again in ${remainingSecs} seconds.` });
      } else {
        failedAttempts.delete(accountKey);
      }
    }

    const recordFailedAttempt = () => {
      recordAttempt(failedAttempts, accountKey, 5, 5 * 60 * 1000);
      recordAttempt(ipAttempts, clientIp, 15, 15 * 60 * 1000);
    };

    const match = await db.findUserByIdentifier(cleanId, cleanRole);

    if (!match) {
      recordFailedAttempt();
      return res.status(401).json({
        error: 'Invalid credentials. Please check your identifier or portal password.',
        message: 'Invalid credentials'
      });
    }

    if (Number(match.is_active) !== 1 || match.role.trim().toUpperCase() !== cleanRole) {
      return res.status(401).json({
        error: 'Account is currently deactivated. Please contact your department administrator.',
        message: 'Account is currently deactivated'
      });
    }

    const tBcrypt0 = performance.now();
    let isPasswordValid = await bcrypt.compare(password, match.password_hash);
    if (!isPasswordValid && password.trim() !== password) {
      isPasswordValid = await bcrypt.compare(password.trim(), match.password_hash);
    }
    recordBcrypt(performance.now() - tBcrypt0);

    if (!isPasswordValid) {
      recordFailedAttempt();
      return res.status(401).json({
        error: 'Invalid credentials. Please check your identifier or portal password.',
        message: 'Invalid credentials'
      });
    }

    failedAttempts.delete(accountKey);
    ipAttempts.delete(clientIp);

    const normalizedRole = match.role.trim().toUpperCase();
    if (!isSessionRole(normalizedRole)) return res.status(401).json({ error: 'Invalid portal account.' });

    const isInitialPassword = normalizedRole === 'STUDENT' && Boolean(match.identifier && password.trim() === match.identifier.trim());

    // Token payload contains ONLY necessary identity claim â€” ZERO password hash exposed!
    const tokenPayload = {
      id: match.id,
      email: match.email,
      name: match.name,
      role: normalizedRole,
      assignedYear: match.year,
      assignedSection: match.section,
      registerNo: normalizedRole === 'STUDENT' ? match.identifier : undefined,
      studentId: normalizedRole === 'STUDENT' ? match.id : undefined,
      requiresPasswordChange: isInitialPassword
    };

    const token = signSessionToken({ ...match, role: normalizedRole }, isInitialPassword);
    const roleLower = normalizedRole.toLowerCase();
    const cookieOptions = {
      ...sessionCookieOptions(req),
      maxAge: SESSION_DURATION_SECONDS * 1000
    };

    await db.logAudit(match.id, match.email, normalizedRole, 'LOGIN_SUCCESS', 'AUTH_PORTAL');

    // Issue the session only after the required login audit has persisted.
    res.cookie(`aids_${roleLower}_token`, token, cookieOptions);

    return res.json({
      message: 'Login successful',
      token,
      user: tokenPayload
    });
  } catch (error) {
    console.error('[Auth] Login failed', error);
    return res.status(503).json({ error: 'Authentication is temporarily unavailable. Please try again.' });
  }
});

router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await db.revokeSessionToken(req.session!.tokenDigest, req.user!.id);
  } catch (error) {
    console.error('[Auth] Session revocation unavailable', error);
    return res.status(503).json({ error: 'Sign out could not be completed. Please try again.' });
  }
  res.clearCookie(`aids_${req.user!.role.toLowerCase()}_token`, sessionCookieOptions(req));
  try { await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'LOGOUT', 'AUTH_PORTAL'); }
  catch (error) { console.error('[Auth] Audit unavailable after session revocation', error); }
  return res.json({ message: 'Logout successful' });
});

router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  return res.json({ user: req.user });
});

router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};

  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024 || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6 || Buffer.byteLength(newPassword) > 72) {
    return res.status(400).json({ error: 'New password must be at least 6 characters and at most 72 bytes long.' });
  }

  const user = await db.getUserById(req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const tBcrypt0 = performance.now();
  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  recordBcrypt(performance.now() - tBcrypt0);
  if (!isMatch) {
    return res.status(401).json({ error: 'Incorrect current password.' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.updateUserPassword(req.user!.id, newHash);
  res.clearCookie(`aids_${req.user!.role.toLowerCase()}_token`, sessionCookieOptions(req));
  try { await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'CHANGE_PASSWORD', `USER:${req.user!.email}`); }
  catch (error) { console.error('[Auth] Audit unavailable after password update', error); }

  return res.json({ message: 'Password changed successfully. Please sign in again.' });
});

function getFrontendUrl(req: Request): string {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.trim().replace(/\/$/, '');
  }
  const referer = req.headers.referer || req.headers.origin;
  if (referer) {
    try {
      const url = new URL(referer as string);
      return `${url.protocol}//${url.host}`;
    } catch {}
  }
  return 'http://127.0.0.1:3000';
}

function generateOAuthState(data: { studentId: string; purpose: string; emailType: string; expectedEmail: string }): string {
  const timestamp = Date.now();
  const payload = JSON.stringify({ ...data, timestamp });
  const sig = crypto.createHmac('sha256', getJwtSecret()).update(payload).digest('hex');
  const fullState = JSON.stringify({ payload, sig });
  return Buffer.from(fullState).toString('base64url');
}

function verifyAndDecodeOAuthState(stateStr: string): { studentId: string; purpose: string; emailType: string; expectedEmail: string; timestamp: number } | null {
  try {
    const raw = Buffer.from(stateStr, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.payload || !parsed.sig) return null;

    const expectedSig = crypto.createHmac('sha256', getJwtSecret()).update(parsed.payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(parsed.sig), Buffer.from(expectedSig))) {
      return null; // Tampered state!
    }

    const payload = JSON.parse(parsed.payload);
    // Short-lived state check: 15 minutes max
    if (!payload.timestamp || Date.now() - payload.timestamp > 15 * 60 * 1000) {
      return null; // Expired state!
    }

    return payload;
  } catch {
    return null;
  }
}

// --- REAL GOOGLE OAUTH AUTHORIZATION FLOW (PASSWORDLESS FOR LARGE SCALE) ---
router.get('/google/start', authenticateToken, requireRole('FACULTY', 'HOD', 'ADMIN'), verifyFacultySectionAccess, async (req: Request, res: Response) => {
  const studentId = (req.query.studentId as string) || '';
  const purpose = (req.query.purpose as string) || 'NPTEL';
  const emailType = ((req.query.emailType as string) || 'COLLEGE').toUpperCase();

  if (!studentId) {
    return res.status(400).json({ error: 'Student ID is required for Google OAuth authorization.' });
  }

  const student = await db.getStudentById(studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  // Determine expected email strictly from student's database record (NO FAKE FALLBACKS!)
  let expectedEmail = '';
  if (emailType === 'PERSONAL') {
    expectedEmail = (student.personal_email || (student as any).personalEmail || '').trim();
    if (!expectedEmail) {
      const redirectUrl = `${getFrontendUrl(req)}/faculty?activeTab=nptel&studentId=${studentId}&error=${encodeURIComponent('Personal Mail ID not available for this student.')}`;
      return res.redirect(redirectUrl);
    }
  } else {
    expectedEmail = (student.email || '').trim();
    if (!expectedEmail) {
      const redirectUrl = `${getFrontendUrl(req)}/faculty?activeTab=nptel&studentId=${studentId}&error=${encodeURIComponent('College Mail ID not available for this student.')}`;
      return res.redirect(redirectUrl);
    }
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:5000/api/auth/google/callback';

  if (!clientId || !clientSecret || clientId.trim() === '' || clientId.includes('YOUR_GOOGLE_CLIENT_ID') || clientId.includes('test-client') || clientId.includes('dummy-client')) {
    const redirectUrl = `${getFrontendUrl(req)}/faculty?error=${encodeURIComponent('Google OAuth is not configured in backend environment variables. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.')}`;
    return res.redirect(redirectUrl);
  }

  const state = generateOAuthState({
    studentId,
    purpose,
    emailType,
    expectedEmail
  });

  const googleAuthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent('openid email profile')}` +
    `&state=${encodeURIComponent(state)}` +
    `&login_hint=${encodeURIComponent(expectedEmail)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  return res.redirect(googleAuthUrl);
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error || !code || !state) {
    const redirectUrl = `${getFrontendUrl(req)}/faculty?error=${encodeURIComponent('Google OAuth authorization was cancelled or failed.')}`;
    return res.redirect(redirectUrl);
  }

  // Cryptographically verify server-generated HMAC state & 15-min expiration
  const statePayload = verifyAndDecodeOAuthState(state as string);
  if (!statePayload) {
    const redirectUrl = `${getFrontendUrl(req)}/faculty?error=${encodeURIComponent('Invalid or expired OAuth state session token. Authorization rejected.')}`;
    return res.redirect(redirectUrl);
  }

  const { studentId, purpose, emailType, expectedEmail } = statePayload;

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:5000/api/auth/google/callback';

    // Exchange authorization code with official Google Token endpoint
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData: any = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Failed to exchange Google OAuth authorization code.');
    }

    // Fetch user profile from official Google userinfo endpoint
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile: any = await profileRes.json();
    const authorizedEmail = (profile.email || '').toLowerCase().trim();
    const targetExpected = expectedEmail.toLowerCase().trim();

    // REQUIREMENT 14: Strict match validation against target email
    if (authorizedEmail !== targetExpected) {
      const label = emailType === 'PERSONAL' ? "student's selected Personal Mail ID" : "student's selected College Mail ID";
      const errorMsg = `The authorized Google account does not match this ${label}.`;
      const errorUrl = `${getFrontendUrl(req)}/faculty?activeTab=nptel&studentId=${studentId}&error=${encodeURIComponent(errorMsg)}`;
      return res.redirect(errorUrl);
    }

    if (studentId) {
      db.saveNptelGoogleConnection(studentId, {
        connectedEmail: profile.email,
        emailType,
        purpose,
        providerAccountId: profile.sub || `gacc-${Date.now()}`,
        connectedOn: new Date().toISOString(),
        lastSynced: new Date().toISOString(),
        status: 'CONNECTED',
        rawPayload: tokenData
      });
    }

    const successUrl = `${getFrontendUrl(req)}/faculty?activeTab=nptel&studentId=${studentId}&status=nptel_connected`;
    return res.redirect(successUrl);
  } catch (err: any) {
    const redirectUrl = `${getFrontendUrl(req)}/faculty?error=${encodeURIComponent(err.message || 'Google OAuth authorization failed.')}`;
    return res.redirect(redirectUrl);
  }
});

export default router;
