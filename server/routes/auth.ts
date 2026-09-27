import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db';
import { authenticateToken, AuthRequest, JWT_SECRET } from '../middleware/auth';

const router = Router();

// Rate limiting memory map for failed logins
const failedAttempts: Record<string, { count: number; lockedUntil?: number }> = {};

router.post('/login', async (req, res) => {
  const { identifier, password, role } = req.body;

  if (!identifier || !password || !role) {
    return res.status(400).json({ error: 'Invalid credentials. Identifier, password, and role are required.' });
  }

  const cleanId = identifier.trim().toLowerCase();

  // Rate limiting check: 5 failed attempts locks account for 5 minutes
  const attemptRecord = failedAttempts[cleanId];
  if (attemptRecord && attemptRecord.lockedUntil) {
    if (Date.now() < attemptRecord.lockedUntil) {
      const remainingSecs = Math.ceil((attemptRecord.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({ error: `Account temporarily locked due to repeated failed login attempts. Please try again in ${remainingSecs} seconds.` });
    } else {
      delete failedAttempts[cleanId];
    }
  }

  const match = db.findUserByIdentifier(cleanId, role);

  if (!match) {
    const curr = failedAttempts[cleanId] || { count: 0 };
    curr.count += 1;
    if (curr.count >= 5) curr.lockedUntil = Date.now() + 5 * 60 * 1000;
    failedAttempts[cleanId] = curr;

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
    const curr = failedAttempts[cleanId] || { count: 0 };
    curr.count += 1;
    if (curr.count >= 5) curr.lockedUntil = Date.now() + 5 * 60 * 1000;
    failedAttempts[cleanId] = curr;

    return res.status(401).json({ error: 'Invalid credentials. Please check your identifier or portal password.' });
  }

  delete failedAttempts[cleanId];

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

  res.cookie('aids_session_token', token, {
    httpOnly: true,
    secure: false, // Set to true in HTTPS production
    sameSite: 'lax',
    maxAge: 8 * 3600 * 1000
  });

  db.logAudit(match.id, match.email, match.role, 'LOGIN_SUCCESS', 'AUTH_PORTAL');

  return res.json({
    message: 'Login successful',
    token,
    user: tokenPayload
  });
});

router.post('/logout', authenticateToken, (req: AuthRequest, res: Response) => {
  if (req.user) {
    db.logAudit(req.user.id, req.user.email, req.user.role, 'LOGOUT', 'AUTH_PORTAL');
  }
  res.clearCookie('aids_session_token');
  return res.json({ message: 'Logout successful' });
});

router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  return res.json({ user: req.user });
});

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
router.get('/google/start', (req: Request, res: Response) => {
  const studentId = (req.query.studentId as string) || '';
  const purpose = (req.query.purpose as string) || 'NPTEL';
  const emailType = ((req.query.emailType as string) || 'COLLEGE').toUpperCase();

  if (!studentId) {
    return res.status(400).json({ error: 'Student ID is required for Google OAuth authorization.' });
  }

  const student = db.getStudentById(studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  // Determine expected email strictly from student's database record (NO FAKE FALLBACKS!)
  let expectedEmail = '';
  if (emailType === 'PERSONAL') {
    expectedEmail = (student.personal_email || (student as any).personalEmail || '').trim();
    if (!expectedEmail) {
      const redirectUrl = `http://127.0.0.1:3000/faculty?activeTab=nptel&studentId=${studentId}&error=${encodeURIComponent('Personal Mail ID not available for this student.')}`;
      return res.redirect(redirectUrl);
    }
  } else {
    expectedEmail = (student.email || '').trim();
    if (!expectedEmail) {
      const redirectUrl = `http://127.0.0.1:3000/faculty?activeTab=nptel&studentId=${studentId}&error=${encodeURIComponent('College Mail ID not available for this student.')}`;
      return res.redirect(redirectUrl);
    }
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:5000/api/auth/google/callback';

  if (!clientId || !clientSecret || clientId.trim() === '' || clientId.includes('YOUR_GOOGLE_CLIENT_ID') || clientId.includes('test-client') || clientId.includes('dummy-client')) {
    const redirectUrl = `http://127.0.0.1:3000/faculty?error=${encodeURIComponent('Google OAuth is not configured in backend environment variables. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.')}`;
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
    const redirectUrl = `http://127.0.0.1:3000/faculty?error=${encodeURIComponent('Google OAuth authorization was cancelled or failed.')}`;
    return res.redirect(redirectUrl);
  }

  // Cryptographically verify server-generated HMAC state & 15-min expiration
  const statePayload = verifyAndDecodeOAuthState(state as string);
  if (!statePayload) {
    const redirectUrl = `http://127.0.0.1:3000/faculty?error=${encodeURIComponent('Invalid or expired OAuth state session token. Authorization rejected.')}`;
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
      const errorUrl = `http://127.0.0.1:3000/faculty?activeTab=nptel&studentId=${studentId}&error=${encodeURIComponent(errorMsg)}`;
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

    const successUrl = `http://127.0.0.1:3000/faculty?activeTab=nptel&studentId=${studentId}&status=nptel_connected`;
    return res.redirect(successUrl);
  } catch (err: any) {
    const redirectUrl = `http://127.0.0.1:3000/faculty?error=${encodeURIComponent(err.message || 'Google OAuth authorization failed.')}`;
    return res.redirect(redirectUrl);
  }
});

export default router;
