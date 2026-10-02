import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db.js';
import { authenticateToken, AuthRequest, JWT_SECRET } from '../middleware/auth.js';

const router = Router();

// Rate limiting memory maps for failed logins (per identifier and per IP)
const failedAttempts: Record<string, { count: number; lockedUntil?: number }> = {};
const ipAttempts: Record<string, { count: number; lockedUntil?: number }> = {};

router.post('/login', async (req, res) => {
  const { identifier, password, role } = req.body;

  if (!identifier || !password || !role) {
    return res.status(400).json({ error: 'Invalid credentials. Identifier, password, and role are required.' });
  }

  const cleanId = identifier.trim().toLowerCase();
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || req.socket.remoteAddress || 'unknown-ip';

  // 1. IP-level rate limiting check: 15 failed attempts locks IP for 15 minutes
  const ipRecord = ipAttempts[clientIp];
  if (ipRecord && ipRecord.lockedUntil) {
    if (Date.now() < ipRecord.lockedUntil) {
      const remainingSecs = Math.ceil((ipRecord.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({ error: `Too many failed login requests from this IP address (${clientIp}). Please try again in ${remainingSecs} seconds.` });
    } else {
      delete ipAttempts[clientIp];
    }
  }

  // 2. Identifier-level rate limiting check: 5 failed attempts locks account for 5 minutes
  const attemptRecord = failedAttempts[cleanId];
  if (attemptRecord && attemptRecord.lockedUntil) {
    if (Date.now() < attemptRecord.lockedUntil) {
      const remainingSecs = Math.ceil((attemptRecord.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({ error: `Account temporarily locked due to repeated failed login attempts. Please try again in ${remainingSecs} seconds.` });
    } else {
      delete failedAttempts[cleanId];
    }
  }

  const recordFailedAttempt = () => {
    const currId = failedAttempts[cleanId] || { count: 0 };
    currId.count += 1;
    if (currId.count >= 5) currId.lockedUntil = Date.now() + 5 * 60 * 1000;
    failedAttempts[cleanId] = currId;

    const currIp = ipAttempts[clientIp] || { count: 0 };
    currIp.count += 1;
    if (currIp.count >= 15) currIp.lockedUntil = Date.now() + 15 * 60 * 1000;
    ipAttempts[clientIp] = currIp;
  };

  let match = await db.findUserByIdentifier(cleanId, role);

  if (!match && role === 'HOD' && (cleanId === 'hod' || cleanId === 'hod.aids@avsenggcollege.ac.in')) {
    try {
      const hodHash = await bcrypt.hash('hod@123', 10);
      await db.createUser({
        id: 'hod-sys',
        email: 'hod.aids@avsenggcollege.ac.in',
        identifier: 'hod',
        name: 'Head of Department',
        role: 'HOD',
        passwordHash: hodHash,
        isActive: true
      });
      match = await db.findUserByIdentifier(cleanId, role);
    } catch (_e) {
      // Ignore if concurrent creation occurs
    }
  }

  if (!match) {
    recordFailedAttempt();
    return res.status(401).json({ error: 'Invalid credentials. Please check your identifier or portal password.' });
  }

  if (!match.is_active) {
    return res.status(401).json({ error: 'Account is currently deactivated. Please contact your department administrator.' });
  }

  let isPasswordValid = await bcrypt.compare(password, match.password_hash);
  if (!isPasswordValid && password.trim() !== password) {
    isPasswordValid = await bcrypt.compare(password.trim(), match.password_hash);
  }

  if (!isPasswordValid) {
    recordFailedAttempt();
    return res.status(401).json({ error: 'Invalid credentials. Please check your identifier or portal password.' });
  }

  delete failedAttempts[cleanId];
  if (ipAttempts[clientIp]) delete ipAttempts[clientIp];

  // Token payload contains ONLY necessary identity claim — ZERO password hash exposed!
  const tokenPayload = {
    id: match.id,
    email: match.email,
    name: match.name,
    role: match.role,
    assignedYear: match.year,
    assignedSection: match.section,
    registerNo: match.role === 'STUDENT' ? match.identifier : undefined,
    studentId: match.role === 'STUDENT' ? match.id : undefined
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

  // BUG-02: Dynamic Secure Cookie Configuration
  const isSecure = process.env.NODE_ENV === 'production' || Boolean(req.secure) || req.headers['x-forwarded-proto'] === 'https';

  res.cookie('aids_session_token', token, {
    httpOnly: true,
    secure: Boolean(isSecure),
    sameSite: isSecure ? 'none' : 'lax',
    maxAge: 8 * 3600 * 1000
  });

  await db.logAudit(match.id, match.email, match.role, 'LOGIN_SUCCESS', 'AUTH_PORTAL');

  return res.json({
    message: 'Login successful',
    token,
    user: tokenPayload
  });
});

router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (req.user) {
    await db.logAudit(req.user.id, req.user.email, req.user.role, 'LOGOUT', 'AUTH_PORTAL');
  }
  res.clearCookie('aids_session_token');
  return res.json({ message: 'Logout successful' });
});

router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  return res.json({ user: req.user });
});

router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const user = await db.getUserById(req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Incorrect current password.' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.updateUserPassword(req.user!.id, newHash);
  await db.logAudit(req.user!.id, req.user!.email, req.user!.role, 'CHANGE_PASSWORD', `USER:${req.user!.email}`);

  return res.json({ message: 'Password changed successfully.' });
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
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  const fullState = JSON.stringify({ payload, sig });
  return Buffer.from(fullState).toString('base64url');
}

function verifyAndDecodeOAuthState(stateStr: string): { studentId: string; purpose: string; emailType: string; expectedEmail: string; timestamp: number } | null {
  try {
    const raw = Buffer.from(stateStr, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.payload || !parsed.sig) return null;

    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(parsed.payload).digest('hex');
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
router.get('/google/start', async (req: Request, res: Response) => {
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
