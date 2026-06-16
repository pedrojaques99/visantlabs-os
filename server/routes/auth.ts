import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import bcrypt from 'bcryptjs';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getClientIp } from '../utils/auth.js';
import { recordSession } from './sessions.js';
import { rateLimit } from 'express-rate-limit';
// hCaptcha verification helper
const verifyHCaptcha = async (token: string): Promise<boolean> => {
  const secret = process.env.HCAPTCHA_SECRET_KEY;
  if (!secret) return true; // Skip if not configured
  try {
    const resp = await fetch('https://api.hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `response=${encodeURIComponent(token)}&secret=${encodeURIComponent(secret)}`,
    });
    const data = (await resp.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
};
import { detectAbuse, recordSignupAttempt } from '../utils/abuseDetection.js';
import { JWT_SECRET } from '../utils/jwtSecret.js';
import {
  signupSchema,
  signinSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  formatZodError,
} from '../utils/schemas.js';
import { isValidEmail } from '../utils/validation.js';
import { bruteForceGuard } from '../middleware/bruteForceGuard.js';
import crypto from 'crypto';
import { FRONTEND_BASE_URL } from '../lib/mcp-constants.js';
import { FREE_MONTHLY_CREDITS } from '../lib/credits.js';

const router = express.Router();
const getFrontendUrl = () => FRONTEND_BASE_URL.replace(/\/+$/, '');

// In-memory store for plugin OAuth sessions (sessionId → { token, createdAt })
const pluginOAuthSessions = new Map<
  string,
  { token?: string; error?: string; createdAt: number }
>();
const PLUGIN_SESSION_TTL = 5 * 60 * 1000; // 5 minutes

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of pluginOAuthSessions) {
    if (now - session.createdAt > PLUGIN_SESSION_TTL) pluginOAuthSessions.delete(id);
  }
}

const getEmailFromBody = (req: express.Request) =>
  typeof req.body?.email === 'string' ? req.body.email : undefined;
const signinBackoff = bruteForceGuard(getEmailFromBody);
const signupBackoff = bruteForceGuard(getEmailFromBody);
const forgotBackoff = bruteForceGuard(getEmailFromBody);

// Normalize redirect URI to remove trailing slashes
const getRedirectUri = () => {
  const uri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';
  return uri.replace(/\/+$/, ''); // Remove trailing slashes
};

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  getRedirectUri()
);

// Referral rewards configuration
const REFERRAL_REWARDS = {
  REFERRER_CREDITS: 5, // Credits for the person who referred
  REFERRED_CREDITS: 5, // Credits for the person who was referred
};

// Helper function to generate unique referral code
const generateReferralCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Helper function to ensure user has a referral code
const ensureReferralCode = async (userId: string): Promise<string> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  if (user?.referralCode) {
    return user.referralCode;
  }

  // Generate unique code
  let code: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    code = generateReferralCode();
    const existing = await prisma.user.findFirst({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique referral code');
  }

  // Update user with referral code
  await prisma.user.update({
    where: { id: userId },
    data: { referralCode: code! },
  });

  return code!;
};

// Helper function to process referral rewards
const processReferralRewards = async (newUserId: string, referralCode?: string) => {
  if (!referralCode) {
    return;
  }

  try {
    // Find the referrer by code
    const referrer = await prisma.user.findFirst({
      where: { referralCode },
      select: { id: true, monthlyCredits: true, totalCreditsEarned: true },
    });

    if (!referrer) {
      console.warn(`Referral code not found: ${referralCode}`);
      return;
    }

    // Prevent self-referral
    if (referrer.id === newUserId) {
      console.warn('Self-referral detected, skipping rewards');
      return;
    }

    // Check if user was already referred (prevent double rewards)
    const newUser = await prisma.user.findUnique({
      where: { id: newUserId },
      select: { referredBy: true },
    });

    if (newUser?.referredBy) {
      console.warn('User already has a referrer, skipping rewards');
      return;
    }

    // Update new user with referredBy
    await prisma.user.update({
      where: { id: newUserId },
      data: {
        referredBy: referrer.id,
        monthlyCredits: {
          increment: REFERRAL_REWARDS.REFERRED_CREDITS,
        },
        totalCreditsEarned: {
          increment: REFERRAL_REWARDS.REFERRED_CREDITS,
        },
      },
    });

    // Give credits to referrer and increment count
    await prisma.user.update({
      where: { id: referrer.id },
      data: {
        monthlyCredits: {
          increment: REFERRAL_REWARDS.REFERRER_CREDITS,
        },
        totalCreditsEarned: {
          increment: REFERRAL_REWARDS.REFERRER_CREDITS,
        },
        referralCount: {
          increment: 1,
        },
      },
    });

    console.log(`Referral rewards processed: ${referralCode} -> ${newUserId}`);
  } catch (error) {
    console.error('Error processing referral rewards:', error);
    // Don't throw - referral rewards are nice to have but shouldn't block registration
  }
};

// Helper function for structured error logging
interface LogErrorContext {
  endpoint?: string;
  method?: string;
  email?: string;
  userId?: string;
  [key: string]: any;
}

const logError = (error: any, context: LogErrorContext = {}) => {
  const timestamp = new Date().toISOString();
  const errorInfo: any = {
    timestamp,
    error: {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Error',
      code: error?.code || null,
      meta: error?.meta || null,
      stack: error?.stack || null,
    },
    context,
  };

  // Detect Prisma errors
  if (error?.code) {
    errorInfo.errorType = 'Prisma';
    if (error.code === 'P2002') {
      errorInfo.errorType = 'PrismaUniqueConstraint';
      errorInfo.userMessage = 'A record with this value already exists';
    } else if (error.code === 'P2025') {
      errorInfo.errorType = 'PrismaRecordNotFound';
      errorInfo.userMessage = 'Record not found';
    }
  }

  // Log with appropriate level
  if (error?.code?.startsWith('P')) {
    console.error('🔴 [PRISMA ERROR]', JSON.stringify(errorInfo, null, 2));
  } else {
    console.error('🔴 [ERROR]', JSON.stringify(errorInfo, null, 2));
  }

  return errorInfo;
};

// OAuth rate limiter - prevent brute force on OAuth endpoints
// Using express-rate-limit for CodeQL recognition
const oauthRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_OAUTH_WINDOW_MS || '300000', 10), // 5 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_OAUTH || '20', 10), // 20 OAuth requests per 5 minutes
  message: { error: 'Too many OAuth requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Token verification rate limiter - prevent brute force on token verification
// Using express-rate-limit for CodeQL recognition
const verifyRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10), // 1 minute default
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10), // 60 requests per minute
  message: { error: 'Too many verification requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset rate limiter - strict to prevent enumeration/brute force
// Using express-rate-limit for CodeQL recognition
const passwordResetRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_PASSWORD_RESET_WINDOW_MS || '3600000', 10), // 1 hour default
  max: parseInt(process.env.RATE_LIMIT_MAX_PASSWORD_RESET || '5', 10), // 5 password reset attempts per hour
  message: { error: 'Too many password reset attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Signup rate limiter - prevent mass account creation
// Using express-rate-limit for CodeQL recognition
const signupRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour default
  max: parseInt(process.env.RATE_LIMIT_MAX_SIGNUP || '3', 10), // 3 signups per hour
  message: { error: 'Too many signup attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Signin rate limiter - prevent brute force attacks
// Using express-rate-limit for CodeQL recognition
const signinRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour default
  max: parseInt(process.env.RATE_LIMIT_MAX_SIGNIN || '10', 10), // 10 signin attempts per hour
  message: { error: 'Too many signin attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// API rate limiter - general authenticated endpoints
// Using express-rate-limit for CodeQL recognition
const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10), // 1 minute default
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10), // 60 requests per minute
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload image rate limiter
// Using express-rate-limit for CodeQL recognition
const uploadImageRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS || '900000', 10), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_UPLOAD || '10', 10), // 10 uploads per 15 minutes
  message: { error: 'Too many upload attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Get Google OAuth URL
router.get('/google', oauthRateLimiter, (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Missing Google OAuth credentials');
      return res.status(500).json({ error: 'OAuth configuration missing' });
    }

    const source = req.query.source as string | undefined;
    const referralCode = req.query.ref as string | undefined;

    let state: string | undefined;
    let sessionId: string | undefined;

    if (source === 'plugin') {
      cleanExpiredSessions();
      sessionId = crypto.randomBytes(16).toString('hex');
      pluginOAuthSessions.set(sessionId, { createdAt: Date.now() });
      state = `plugin:${sessionId}`;
    } else if (referralCode) {
      state = `ref:${referralCode}`;
    }

    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: ['profile', 'email'],
      prompt: 'consent',
      state: state,
    });
    res.json({ authUrl, ...(sessionId && { sessionId }) });
  } catch (error: any) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL', message: error.message });
  }
});

// Get Google OAuth URL for linking account (requires authentication)
router.get('/google/link', oauthRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Missing Google OAuth credentials');
      return res.status(500).json({ error: 'OAuth configuration missing' });
    }

    const userId = req.userId!;

    // Check if user already has Google linked
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleId: true },
    });

    if (user?.googleId) {
      return res.status(400).json({ error: 'Google account already linked' });
    }

    // Generate auth URL with state containing userId for linking
    const state = `link:${userId}`;

    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: ['profile', 'email'],
      prompt: 'consent',
      state: state,
    });

    res.json({ authUrl });
  } catch (error: any) {
    console.error('Error generating link auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL', message: error.message });
  }
});

// Google OAuth callback
router.get('/google/callback', oauthRateLimiter, async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(`${getFrontendUrl()}/auth?error=no_code`);
    }

    const { tokens } = await client.getToken(code as string);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.redirect(`${getFrontendUrl()}/auth?error=invalid_token`);
    }

    // Extract referral code from state parameter (if provided)
    // State format: "ref:ABC123", "plugin:sessionId", or just the referral code
    const stateStr = state as string | undefined;
    const referralCode = stateStr?.startsWith('ref:')
      ? stateStr.substring(4)
      : stateStr && !stateStr.startsWith('plugin:') && !stateStr.startsWith('link:')
        ? stateStr
        : undefined;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name ?? null,
          picture: payload.picture ?? null,
          googleId: payload.sub ?? null,
          subscriptionStatus: 'free',
          subscriptionTier: 'free',
          freeGenerationsUsed: 0,
          monthlyCredits: FREE_MONTHLY_CREDITS,
          creditsUsed: 0,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          subscriptionEndDate: null,
        },
      });

      // Process referral rewards for new users only
      if (referralCode) {
        await processReferralRewards(user.id, referralCode);
      }

      // Generate referral code for new user
      await ensureReferralCode(user.id);
    } else {
      // Update user info and ensure googleId is set
      user = await prisma.user.update({
        where: { email: payload.email },
        data: {
          name: payload.name ?? null,
          picture: payload.picture ?? null,
          googleId: payload.sub ?? user.googleId,
        },
      });

      // Ensure existing user has referral code
      if (!user.referralCode) {
        await ensureReferralCode(user.id);
      }
    }

    // Generate JWT token
    const userId = user.id;
    const token = jwt.sign({ userId, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    // Plugin OAuth: store token for polling and show success page
    if (typeof state === 'string' && (state as string).startsWith('plugin:')) {
      const sessionId = (state as string).substring(7);
      const session = pluginOAuthSessions.get(sessionId);
      if (session) {
        session.token = token;
      }
      return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Visant – Login OK</title>
<style>body{background:#0a0a0a;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{text-align:center;padding:2rem}.check{font-size:3rem;margin-bottom:1rem}p{color:#999;font-size:.9rem}</style></head>
<body><div class="card"><div class="check">&#10003;</div><h2>Login realizado!</h2><p>Volte para o Figma. Você pode fechar esta aba.</p></div></body></html>`);
    }

    // Redirect to frontend with token
    res.redirect(`${getFrontendUrl()}/auth?token=${token}`);
  } catch (error) {
    console.error('OAuth callback error:', error);

    if (
      typeof (req.query.state as string) === 'string' &&
      (req.query.state as string).startsWith('plugin:')
    ) {
      const sessionId = (req.query.state as string).substring(7);
      const session = pluginOAuthSessions.get(sessionId);
      if (session) session.error = 'oauth_failed';
      return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Visant – Erro</title>
<style>body{background:#0a0a0a;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{text-align:center;padding:2rem}p{color:#999;font-size:.9rem}</style></head>
<body><div class="card"><h2>Erro no login</h2><p>Tente novamente pelo plugin.</p></div></body></html>`);
    }

    res.redirect(`${getFrontendUrl()}/auth?error=oauth_failed`);
  }
});

// Poll for plugin OAuth result
router.get('/google/poll/:sessionId', oauthRateLimiter, (req, res) => {
  const session = pluginOAuthSessions.get(req.params.sessionId);
  if (!session) return res.json({ status: 'expired' });
  if (session.error) {
    pluginOAuthSessions.delete(req.params.sessionId);
    return res.json({ status: 'error', error: session.error });
  }
  if (session.token) {
    const token = session.token;
    pluginOAuthSessions.delete(req.params.sessionId);
    return res.json({ status: 'complete', token });
  }
  res.json({ status: 'pending' });
});

// Google OAuth callback for linking account
router.get(
  '/google/link-callback',
  oauthRateLimiter,
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      const { code, state } = req.query;
      const userId = req.userId!;

      if (!code) {
        return res.redirect(`${getFrontendUrl()}/profile?error=no_code`);
      }

      // Verify state matches current user
      if (
        !state ||
        !(state as string).startsWith('link:') ||
        (state as string).substring(5) !== userId
      ) {
        return res.redirect(`${getFrontendUrl()}/profile?error=invalid_state`);
      }

      const { tokens } = await client.getToken(code as string);
      client.setCredentials(tokens);

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        return res.redirect(`${getFrontendUrl()}/profile?error=invalid_token`);
      }

      // Check if this Google account is already linked to another user
      const existingUserWithGoogle = await prisma.user.findFirst({
        where: { googleId: payload.sub },
      });

      if (existingUserWithGoogle && existingUserWithGoogle.id !== userId) {
        return res.redirect(`${getFrontendUrl()}/profile?error=google_already_linked`);
      }

      // Get current user
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!currentUser) {
        return res.redirect(`${getFrontendUrl()}/profile?error=user_not_found`);
      }

      // Check if email matches (security: ensure Google email matches user email)
      if (payload.email.toLowerCase() !== currentUser.email.toLowerCase()) {
        return res.redirect(`${getFrontendUrl()}/profile?error=email_mismatch`);
      }

      // Link Google account to user
      await prisma.user.update({
        where: { id: userId },
        data: {
          googleId: payload.sub,
          // Update name and picture if not set or if Google has better data
          name: currentUser.name || payload.name || null,
          picture: currentUser.picture || payload.picture || null,
        },
      });

      // Redirect back to profile with success
      res.redirect(`${getFrontendUrl()}/profile?google_linked=true`);
    } catch (error) {
      console.error('OAuth link callback error:', error);
      res.redirect(`${getFrontendUrl()}/profile?error=link_failed`);
    }
  }
);

// Verify token
router.get('/verify', verifyRateLimiter, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get isAdmin and userCategory fields.
    // Priority:
    // 1) MongoDB `users` collection (source of truth for flags)
    // 2) Prisma `user` record as a safe fallback (covers cases where
    //    userCategory was added only in Prisma or vice‑versa).
    let isAdmin = false;
    let userCategory: string | undefined = undefined;

    try {
      const { connectToMongoDB, getDb } = await import('../db/mongodb.js');
      const { ObjectId } = await import('mongodb');

      await connectToMongoDB();
      const db = getDb();

      // Convert user ID to ObjectId and query MongoDB directly
      const userIdObjectId = new ObjectId(user.id);
      const userDoc = await db
        .collection('users')
        .findOne({ _id: userIdObjectId }, { projection: { isAdmin: 1, userCategory: 1 } });

      if (userDoc) {
        // Use explicit checks so we don't accidentally overwrite with null/undefined
        if (userDoc.isAdmin === true) {
          isAdmin = true;
        }
        if (typeof userDoc.userCategory === 'string' && userDoc.userCategory.trim() !== '') {
          userCategory = userDoc.userCategory;
        }
      }
    } catch (mongoError) {
      // If Mongo lookup fails (e.g., invalid ObjectId), we'll fall back to Prisma below.
      console.error(
        'Mongo lookup failed in /auth/verify, falling back to Prisma user flags:',
        mongoError
      );
    }

    // Fallback to Prisma flags when Mongo didn't give us values
    if (!isAdmin || !userCategory) {
      const userWithFlags = user as typeof user & { isAdmin?: boolean; userCategory?: string };

      if (!isAdmin && userWithFlags.isAdmin === true) {
        isAdmin = true;
      }

      if (
        !userCategory &&
        typeof userWithFlags.userCategory === 'string' &&
        userWithFlags.userCategory.trim() !== ''
      ) {
        userCategory = userWithFlags.userCategory;
      }
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        username: user.username,
        taxId: user.taxId,
        isAdmin,
        userCategory,
        googleId: user.googleId,
        emailVerified: user.emailVerified,
        onboardingCompleted: user.onboardingCompleted,
        totpEnabled: user.totpEnabled,
      },
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Public runtime config for the auth UI. The hCaptcha *site* key is public (not
// a secret), so serving it from the server's runtime env lets the frontend
// render the widget without a rebuild — the widget no longer depends on the
// build-time VITE var being baked into the bundle. Keeps site/secret in sync:
// the widget shows exactly when the server is configured to verify.
router.get('/config', apiRateLimiter, (_req, res) => {
  res.json({
    hcaptchaSiteKey: process.env.HCAPTCHA_SITE_KEY || process.env.VITE_HCAPTCHA_SITE_KEY || null,
  });
});

// Email/Password Sign Up
// CAPTCHA middleware removed - CAPTCHA is disabled
router.post('/signup', signupRateLimiter, signupBackoff, async (req, res) => {
  const ipAddress = getClientIp(req);
  let signupSuccessful = false;

  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      await recordSignupAttempt(req.body?.email || '', ipAddress, false);
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }
    const { email, password, name, referralCode } = parsed.data;

    // Verify CAPTCHA if configured
    const captchaToken = req.body?.captchaToken;
    if (process.env.HCAPTCHA_SECRET_KEY) {
      if (!captchaToken) {
        return res.status(400).json({ error: 'CAPTCHA verification required' });
      }
      const captchaValid = await verifyHCaptcha(captchaToken);
      if (!captchaValid) {
        return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
      }
    }

    // Check for abuse patterns
    const abuseCheck = await detectAbuse(email.toLowerCase(), ipAddress);
    if (abuseCheck.shouldBlock) {
      await recordSignupAttempt(email.toLowerCase(), ipAddress, false);
      console.warn(`[SECURITY] Signup blocked due to abuse detection`, {
        email: email.toLowerCase(),
        ipAddress,
        score: abuseCheck.score,
        reasons: abuseCheck.reasons,
      });
      return res.status(429).json({
        error: 'Signup blocked',
        message: 'Unable to create account at this time. Please try again later.',
      });
    }

    // Log suspicious activity (but don't block if score < 50)
    if (abuseCheck.score >= 30) {
      console.warn(`[SECURITY] Suspicious signup attempt (not blocked)`, {
        email: email.toLowerCase(),
        ipAddress,
        score: abuseCheck.score,
        reasons: abuseCheck.reasons,
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingUser) {
      await recordSignupAttempt(email.toLowerCase(), ipAddress, false);
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        password: hashedPassword,
        subscriptionStatus: 'free',
        subscriptionTier: 'free',
        freeGenerationsUsed: 0,
        monthlyCredits: FREE_MONTHLY_CREDITS,
        creditsUsed: 0,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        subscriptionEndDate: null,
      },
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken, verificationExpires },
    });

    // Process referral rewards if code provided
    if (referralCode) {
      await processReferralRewards(user.id, referralCode);
    }

    // Generate referral code for new user
    await ensureReferralCode(user.id);

    // Record successful signup attempt
    signupSuccessful = true;
    await recordSignupAttempt(email.toLowerCase(), ipAddress, true);

    // Send verification email (replaces welcome email)
    try {
      const { sendVerificationEmail, isEmailConfigured } =
        await import('../services/emailService.js');

      if (isEmailConfigured()) {
        await sendVerificationEmail({
          email: user.email,
          name: user.name || undefined,
          verificationToken,
        });
      } else {
        console.warn('Email service not configured. Verification email not sent.');
      }
    } catch (emailError: any) {
      console.error('Error sending verification email:', emailError);
    }

    // Generate JWT token
    const userId = user.id;
    const token = jwt.sign({ userId, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    // Record session
    recordSession(userId, req).catch(() => {});

    res.json({
      token,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        picture: user.picture,
        username: user.username,
        emailVerified: false,
        onboardingCompleted: false,
      },
    });
  } catch (error: any) {
    // Record failed signup attempt if not already recorded
    if (!signupSuccessful) {
      await recordSignupAttempt(req.body?.email || '', ipAddress, false).catch(() => {
        // Ignore errors in recording attempt
      });
    }

    // Use structured error logging
    const errorInfo = logError(error, {
      endpoint: '/signup',
      method: 'POST',
      email: req.body?.email,
      ipAddress,
    });

    // Handle specific Prisma errors
    if (error?.code === 'P2002') {
      // Unique constraint violation (email already exists)
      return res.status(400).json({
        error: 'User with this email already exists',
        message: 'Este email já está cadastrado. Tente fazer login ou use outro email.',
      });
    }

    if (error?.code?.startsWith('P')) {
      // Other Prisma errors
      return res.status(500).json({
        error: 'Database error',
        message: errorInfo.userMessage || 'Erro ao criar conta. Tente novamente mais tarde.',
      });
    }

    // Generic error response
    res.status(500).json({
      error: 'Failed to create account',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Erro ao criar conta. Tente novamente mais tarde.',
    });
  }
});

// Email/Password Sign In
router.post('/signin', signinRateLimiter, signinBackoff, async (req, res) => {
  try {
    const parsed = signinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }
    const { email, password } = parsed.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user has a password (might be OAuth-only user)
    if (!user.password) {
      return res.status(401).json({
        error: 'This account was created with Google. Please sign in with Google instead.',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const userId = user.id;
    const token = jwt.sign({ userId, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    // Record session
    recordSession(userId, req).catch(() => {});

    res.json({
      token,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        picture: user.picture,
        username: user.username,
        emailVerified: user.emailVerified,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error: any) {
    // Use structured error logging
    const errorInfo = logError(error, {
      endpoint: '/signin',
      method: 'POST',
      email: req.body?.email,
    });

    // Handle Prisma errors
    if (error?.code?.startsWith('P')) {
      return res.status(500).json({
        error: 'Database error',
        message: errorInfo.userMessage || 'Erro ao fazer login. Tente novamente mais tarde.',
      });
    }

    // Generic error response
    res.status(500).json({
      error: 'Failed to sign in',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Erro ao fazer login. Tente novamente mais tarde.',
    });
  }
});

// ── DEV ONLY ───────────────────────────────────────────────────────────────────
// Issue a real JWT for local development without OAuth/password. Hard-gated to
// non-production (returns 404 in prod). Resolves the user by body.email, else
// DEV_LOGIN_EMAIL, else the first admin. Lets the local frontend authenticate
// when Google OAuth can't redirect to localhost.
router.post('/dev-login', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    const email = String(req.body?.email || process.env.DEV_LOGIN_EMAIL || '')
      .toLowerCase()
      .trim();
    const user = email
      ? await prisma.user.findUnique({ where: { email } })
      : await prisma.user.findFirst({ where: { isAdmin: true }, orderBy: { createdAt: 'asc' } });

    if (!user) {
      return res
        .status(404)
        .json({ error: 'No user found. Pass { "email": "..." } or set DEV_LOGIN_EMAIL.' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    console.warn(`⚠️  [dev-login] issued token for ${user.email} — DEV ONLY`);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        username: user.username,
        isAdmin: user.isAdmin,
        emailVerified: user.emailVerified,
        onboardingCompleted: user.onboardingCompleted,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'dev-login failed', message: error?.message });
  }
});

// Logout (client-side token removal, but we can add token blacklisting here if needed)
router.post('/logout', apiRateLimiter, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Forgot Password - Request password reset
router.post('/forgot-password', passwordResetRateLimiter, forgotBackoff, async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }
    const { email } = parsed.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success message (security: don't reveal if email exists)
    // But only send email if user exists and has a password (not OAuth-only)
    if (user && user.password) {
      // Generate reset token (JWT with 1 hour expiration)
      const resetToken = jwt.sign(
        { userId: user.id, email: user.email, type: 'password-reset' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Save token and expiration to database
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: expiresAt,
        },
      });

      // Send email
      try {
        const { sendPasswordResetEmail, isEmailConfigured } =
          await import('../services/emailService.js');

        if (!isEmailConfigured()) {
          console.warn('Email service not configured. Password reset email not sent.');
          // In development, log the token for testing
          if (process.env.NODE_ENV === 'development') {
            console.log('🔑 Password reset token (dev only):', resetToken);
            console.log('🔗 Reset URL:', `${getFrontendUrl()}/forgot-password?token=${resetToken}`);
          }
        } else {
          await sendPasswordResetEmail({
            email: user.email,
            name: user.name || undefined,
            resetToken,
          });
        }
      } catch (emailError: any) {
        console.error('Error sending password reset email:', emailError);
        // Don't fail the request if email fails, but log it
      }
    }

    // Always return success (security best practice)
    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Failed to process password reset request',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Erro ao processar solicitação. Tente novamente mais tarde.',
    });
  }
});

// Reset Password - Reset password with token
router.post('/reset-password', passwordResetRateLimiter, async (req, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }
    const { token, password } = parsed.data;

    // Verify token
    let decoded: { userId: string; email: string; type?: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; type?: string };

      // Verify token type
      if (decoded.type !== 'password-reset') {
        return res.status(400).json({ error: 'Invalid token type' });
      }
    } catch (jwtError) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Find user and verify token matches
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Check if token matches and hasn't expired
    if (!user.passwordResetToken || user.passwordResetToken !== token) {
      return res.status(400).json({ error: 'Invalid token' });
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return res.status(400).json({ error: 'Token has expired' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    res.json({
      message: 'Password has been reset successfully',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Failed to reset password',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Erro ao redefinir senha. Tente novamente mais tarde.',
    });
  }
});

// Upload profile picture
router.post(
  '/profile/picture',
  uploadImageRateLimiter,
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      const { imageBase64 } = req.body;
      const userId = req.userId!;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!imageBase64) {
        return res.status(400).json({ error: 'Image is required' });
      }

      // Upload to R2
      const r2Service = await import('../../src/services/r2Service.js');

      if (!r2Service.isR2Configured()) {
        return res.status(500).json({
          error: 'R2 storage is not configured',
          details: 'Please configure R2 environment variables.',
        });
      }

      const imageUrl = await r2Service.uploadProfilePicture(imageBase64, userId);

      // Update user profile with new picture URL
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { picture: imageUrl },
      });

      res.json({
        picture: imageUrl,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          picture: updatedUser.picture,
          username: updatedUser.username,
        },
      });
    } catch (error: any) {
      console.error('Profile picture upload error:', error);
      res.status(500).json({ error: 'Failed to upload profile picture', message: error.message });
    }
  }
);

// Update user profile
router.put('/profile', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, email, picture } = req.body;
    const userId = req.userId!;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare update data
    const updateData: { name?: string; email?: string; picture?: string } = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (picture !== undefined) {
      updateData.picture = picture;
    }

    // If email is being changed, validate it and check uniqueness
    if (email !== undefined && email !== currentUser.email) {
      // Validate email format (ReDoS-safe validation)
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if email is already taken
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'Email already in use' });
      }

      updateData.email = email.toLowerCase();
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        picture: updatedUser.picture,
        username: updatedUser.username,
      },
    });
  } catch (error: any) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile', message: error.message });
  }
});

// Verify email token
router.post('/verify-email', verifyRateLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpires: null,
      },
    });

    res.json({ message: 'Email verified successfully' });
  } catch (error: any) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Resend verification email
router.post(
  '/resend-verification',
  verifyRateLimiter,
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      const userId = req.userId;
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.emailVerified) {
        return res.status(400).json({ error: 'Email already verified' });
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: userId },
        data: { verificationToken, verificationExpires },
      });

      const { sendVerificationEmail, isEmailConfigured } =
        await import('../services/emailService.js');
      if (!isEmailConfigured()) {
        return res.status(500).json({ error: 'Email service not configured' });
      }

      await sendVerificationEmail({
        email: user.email,
        name: user.name || undefined,
        verificationToken,
      });

      res.json({ message: 'Verification email sent' });
    } catch (error: any) {
      console.error('Resend verification error:', error);
      res.status(500).json({ error: 'Failed to resend verification email' });
    }
  }
);

// Complete onboarding
router.post('/complete-onboarding', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { userCategory } = req.body;

    const updateData: Record<string, unknown> = { onboardingCompleted: true };
    if (userCategory && typeof userCategory === 'string') {
      updateData.userCategory = userCategory;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    res.json({ message: 'Onboarding completed' });
  } catch (error: any) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

// Account deletion (LGPD compliance) — soft delete with 30-day retention
router.delete('/account', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cancel Stripe subscription if active
    if (user.stripeSubscriptionId) {
      try {
        const Stripe = (await import('stripe')).default;
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (stripeSecretKey) {
          const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-04-30.basil' as any });
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        }
      } catch (stripeError) {
        console.error('Failed to cancel Stripe subscription during account deletion:', stripeError);
      }
    }

    // Soft delete: anonymize PII, keep record for 30-day retention
    const anonymizedEmail = `deleted_${user.id}@deleted.visant.app`;
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        name: 'Deleted User',
        picture: null,
        username: null,
        bio: null,
        coverImageUrl: null,
        instagram: null,
        youtube: null,
        x: null,
        website: null,
        password: null,
        passwordResetToken: null,
        googleId: null,
        stripeSubscriptionId: null,
        subscriptionStatus: 'deleted',
        subscriptionTier: 'free',
        verificationToken: null,
      },
    });

    res.json({ message: 'Account scheduled for deletion' });
  } catch (error: any) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
