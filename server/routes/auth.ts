import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import bcrypt from 'bcryptjs';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { signupRateLimiter, signinRateLimiter, getClientIp } from '../middleware/rateLimit.js';
// CAPTCHA middleware import removed - CAPTCHA is disabled
// import { captchaMiddleware } from '../middleware/captcha.js';
import { detectAbuse, recordSignupAttempt } from '@/utils/abuseDetection.js';
import { JWT_SECRET } from '@/utils/jwtSecret.js';

const router = express.Router();

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
    const existing = await prisma.user.findUnique({
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
    const referrer = await prisma.user.findUnique({
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

// Get Google OAuth URL
router.get('/google', (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('Missing Google OAuth credentials');
      return res.status(500).json({ error: 'OAuth configuration missing' });
    }

    // Get referral code from query param if provided
    const referralCode = req.query.ref as string | undefined;
    const state = referralCode ? `ref:${referralCode}` : undefined;

    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: ['profile', 'email'],
      prompt: 'consent',
      state: state,
    });
    res.json({ authUrl });
  } catch (error: any) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL', message: error.message });
  }
});

// Get Google OAuth URL for linking account (requires authentication)
router.get('/google/link', authenticate, async (req: AuthRequest, res) => {
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
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth?error=no_code`);
    }

    const { tokens } = await client.getToken(code as string);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth?error=invalid_token`);
    }

    // Extract referral code from state parameter (if provided)
    // State format: "ref:ABC123" or just the referral code
    const referralCode = state ? (state as string).startsWith('ref:')
      ? (state as string).substring(4)
      : (state as string)
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
          monthlyCredits: 20,
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
    const token = jwt.sign(
      { userId, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth?token=${token}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth?error=oauth_failed`);
  }
});

// Google OAuth callback for linking account
router.get('/google/link-callback', authenticate, async (req: AuthRequest, res) => {
  try {
    const { code, state } = req.query;
    const userId = req.userId!;

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?error=no_code`);
    }

    // Verify state matches current user
    if (!state || !(state as string).startsWith('link:') || (state as string).substring(5) !== userId) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?error=invalid_state`);
    }

    const { tokens } = await client.getToken(code as string);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.sub) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?error=invalid_token`);
    }

    // Check if this Google account is already linked to another user
    const existingUserWithGoogle = await prisma.user.findFirst({
      where: { googleId: payload.sub },
    });

    if (existingUserWithGoogle && existingUserWithGoogle.id !== userId) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?error=google_already_linked`);
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?error=user_not_found`);
    }

    // Check if email matches (security: ensure Google email matches user email)
    if (payload.email.toLowerCase() !== currentUser.email.toLowerCase()) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?error=email_mismatch`);
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
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?google_linked=true`);
  } catch (error) {
    console.error('OAuth link callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?error=link_failed`);
  }
});

// Verify token
router.get('/verify', async (req, res) => {
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
      const userDoc = await db.collection('users').findOne(
        { _id: userIdObjectId },
        { projection: { isAdmin: 1, userCategory: 1 } }
      );

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
      console.error('Mongo lookup failed in /auth/verify, falling back to Prisma user flags:', mongoError);
    }

    // Fallback to Prisma flags when Mongo didn't give us values
    if (!isAdmin || !userCategory) {
      const userWithFlags = user as typeof user & { isAdmin?: boolean; userCategory?: string };

      if (!isAdmin && userWithFlags.isAdmin === true) {
        isAdmin = true;
      }

      if (!userCategory && typeof userWithFlags.userCategory === 'string' && userWithFlags.userCategory.trim() !== '') {
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
      },
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Email/Password Sign Up
// CAPTCHA middleware removed - CAPTCHA is disabled
router.post('/signup', signupRateLimiter, async (req, res) => {
  const ipAddress = getClientIp(req);
  let signupSuccessful = false;

  try {
    const { email, password, name, referralCode } = req.body;

    if (!email || !password) {
      await recordSignupAttempt(email || '', ipAddress, false);
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await recordSignupAttempt(email, ipAddress, false);
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    if (password.length < 6) {
      await recordSignupAttempt(email, ipAddress, false);
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
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
        monthlyCredits: 20,
        creditsUsed: 0,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        subscriptionEndDate: null,
      },
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

    // Send welcome email
    try {
      const { sendWelcomeEmail, isEmailConfigured } = await import('../services/emailService.js');

      if (isEmailConfigured()) {
        await sendWelcomeEmail({
          email: user.email,
          name: user.name || undefined,
        });
      } else {
        console.warn('Email service not configured. Welcome email not sent.');
      }
    } catch (emailError: any) {
      console.error('Error sending welcome email:', emailError);
      // Don't fail the request if email fails, but log it
    }

    // Generate JWT token
    const userId = user.id;
    const token = jwt.sign(
      { userId, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        picture: user.picture,
        username: user.username,
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
        message: 'Este email já está cadastrado. Tente fazer login ou use outro email.'
      });
    }

    if (error?.code?.startsWith('P')) {
      // Other Prisma errors
      return res.status(500).json({
        error: 'Database error',
        message: errorInfo.userMessage || 'Erro ao criar conta. Tente novamente mais tarde.'
      });
    }

    // Generic error response
    res.status(500).json({
      error: 'Failed to create account',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao criar conta. Tente novamente mais tarde.'
    });
  }
});

// Email/Password Sign In
router.post('/signin', signinRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

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
        error: 'This account was created with Google. Please sign in with Google instead.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const userId = user.id;
    const token = jwt.sign(
      { userId, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        picture: user.picture,
        username: user.username,
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
        message: errorInfo.userMessage || 'Erro ao fazer login. Tente novamente mais tarde.'
      });
    }

    // Generic error response
    res.status(500).json({
      error: 'Failed to sign in',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao fazer login. Tente novamente mais tarde.'
    });
  }
});

// Logout (client-side token removal, but we can add token blacklisting here if needed)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Forgot Password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

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
        const { sendPasswordResetEmail, isEmailConfigured } = await import('../services/emailService.js');

        if (!isEmailConfigured()) {
          console.warn('Email service not configured. Password reset email not sent.');
          // In development, log the token for testing
          if (process.env.NODE_ENV === 'development') {
            console.log('🔑 Password reset token (dev only):', resetToken);
            console.log('🔗 Reset URL:', `${process.env.FRONTEND_URL || 'http://localhost:3000'}/forgot-password?token=${resetToken}`);
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
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao processar solicitação. Tente novamente mais tarde.',
    });
  }
});

// Reset Password - Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

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
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao redefinir senha. Tente novamente mais tarde.',
    });
  }
});

// Upload profile picture
router.post('/profile/picture', authenticate, async (req: AuthRequest, res) => {
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
    const r2Service = await import('../services/r2Service.js');

    if (!r2Service.isR2Configured()) {
      return res.status(500).json({
        error: 'R2 storage is not configured',
        details: 'Please configure R2 environment variables.'
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
});

// Update user profile
router.put('/profile', authenticate, async (req: AuthRequest, res) => {
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
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
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

export default router;

