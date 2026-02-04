// Vercel serverless function handler
// This file is automatically detected by Vercel for /api/* routes
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import { connectToMongoDB } from '../server/db/mongodb.js';
import mockupRoutes from '../server/routes/mockups.js';
import mockupTagRoutes from '../server/routes/mockupTags.js';
import authRoutes from '../server/routes/auth.js';
import healthRoutes from '../server/routes/health.js';
import paymentRoutes from '../server/routes/payments.js';
import adminRoutes from '../server/routes/admin.js';
import referralRoutes from '../server/routes/referral.js';
import brandingRoutes from '../server/routes/branding.js';
import feedbackRoutes from '../server/routes/feedback.js';
import canvasRoutes from '../server/routes/canvas.js';
import budgetRoutes from '../server/routes/budget.js';
import visantTemplatesRoutes from '../server/routes/visant-templates.js';
import imagesRoutes from '../server/routes/images.js';
import usageRoutes from '../server/routes/usage.js';
import videoRoutes from '../server/routes/video.js';
import waitlistRoutes from '../server/routes/waitlist.js';
import communityRoutes from '../server/routes/community.js';
import usersRoutes from '../server/routes/users.js';
import storageRoutes from '../server/routes/storage.js';
import aiRoutes from '../server/routes/ai.js';
import workflowRoutes from '../server/routes/workflows.js';
import { errorHandler } from '../server/middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const isDev = process.env.NODE_ENV !== 'production';

const app = express();

// CORS configuration - whitelist allowed origins
const getAllowedOrigins = (): string[] => {
    const frontendUrl = process.env.FRONTEND_URL || '';
    const origins: string[] = [];
    
    // Parse FRONTEND_URL which may contain comma-separated values
    if (frontendUrl) {
        frontendUrl.split(',').forEach(url => {
            const trimmed = url.trim();
            if (trimmed) {
                origins.push(trimmed);
                // Also allow with/without trailing slash
                origins.push(trimmed.replace(/\/$/, ''));
            }
        });
    }
    
    // Development origins
    if (isDev) {
        origins.push('http://localhost:3000');
        origins.push('http://localhost:3001');
        origins.push('http://localhost:5173');
        origins.push('http://127.0.0.1:3000');
        origins.push('http://127.0.0.1:5173');
    }
    
    return [...new Set(origins)]; // Remove duplicates
};

app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();
        
        // Allow requests with no origin (like mobile apps, curl, or Postman)
        // In production, you may want to be stricter
        if (!origin) {
            return callback(null, true);
        }
        
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Log blocked origin for debugging
            console.warn(`CORS blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
            // Still allow in case of misconfiguration to avoid breaking the app
            // In strict mode, you would use: callback(new Error('Not allowed by CORS'));
            callback(null, true);
        }
    },
    credentials: true,
}));

// Middleware to normalize routes - remove /api prefix if present (BEFORE body parsing)
app.use((req, res, next) => {
    const originalUrl = req.url;

    // Remove /api prefix if present (Vercel routes /api/* to this handler)
    // Note: req.path is read-only, so we only modify req.url
    if (req.url) {
        if (req.url.startsWith('/api/')) {
            req.url = req.url.replace(/^\/api/, '');
        } else if (req.url.startsWith('/api')) {
            req.url = req.url.replace(/^\/api/, '') || '/';
        }
    }

    // Also update req.originalUrl if needed
    if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
        req.originalUrl = req.originalUrl.replace(/^\/api/, '');
    }

    if (originalUrl !== req.url && isDev) {
        console.log(`[Route Normalization] ${req.method} ${originalUrl} -> ${req.url}`);
    }

    next();
});

// IMPORTANT: Skip body parsing for webhook routes - they should be handled by dedicated handler
// But if they somehow reach here, we need to preserve raw body
app.use((req, res, next) => {
    const isWebhook = req.url?.includes('/payments/webhook');
    if (isWebhook && req.method === 'POST') {
        // Don't parse body for webhooks - preserve as raw
        // This should not happen if vercel.json routing is correct
        if (isDev) console.warn('⚠️ Webhook request reached Express middleware - should use dedicated handler');
        return next();
    }
    next();
});

// IMPORTANT: Stripe webhook needs raw body (Buffer), so we handle it BEFORE json parser
// The order matters: raw body handler must come BEFORE express.json()
app.use('/payments/webhook', express.raw({ type: 'application/json' }));

// JSON parser for all other routes (AFTER webhook handler)
// Only parse JSON if it's NOT a webhook request
app.use((req, res, next) => {
    const isWebhook = req.url?.includes('/payments/webhook');
    if (isWebhook && req.method === 'POST') {
        // Skip JSON parsing for webhooks
        return next();
    }
    express.json({ limit: '50mb' })(req, res, next);
});

app.use((req, res, next) => {
    const isWebhook = req.url?.includes('/payments/webhook');
    if (isWebhook && req.method === 'POST') {
        // Skip URL encoding for webhooks
        return next();
    }
    express.urlencoded({ extended: true, limit: '50mb' })(req, res, next);
});

// Debug middleware to log all incoming requests (before routes)
app.use((req, res, next) => {
    if (req.url?.includes('/video') && isDev) {
        console.log(`[VIDEO REQUEST] ${req.method} ${req.url} | path: ${req.path} | originalUrl: ${req.originalUrl}`);
    }
    next();
});

// Routes (no /api prefix needed in Vercel)
app.use('/auth', authRoutes);
app.use('/mockups', mockupRoutes);
app.use('/mockup-tags', mockupTagRoutes);
app.use('/payments', paymentRoutes);
app.use('/health', healthRoutes);
app.use('/admin', adminRoutes);
app.use('/referral', referralRoutes);
app.use('/branding', brandingRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/canvas', canvasRoutes);
app.use('/budget', budgetRoutes);
app.use('/visant-templates', visantTemplatesRoutes);
app.use('/images', imagesRoutes);
app.use('/usage', usageRoutes);
app.use('/video', videoRoutes);
if (isDev) console.log('✅ Video routes registered at /video');
app.use('/waitlist', waitlistRoutes);
app.use('/community', communityRoutes);
if (isDev) console.log('✅ Community routes registered at /community');
app.use('/users', usersRoutes);
if (isDev) console.log('✅ Users routes registered at /users');
app.use('/storage', storageRoutes);
if (isDev) console.log('✅ Storage routes registered at /storage');
app.use('/ai', aiRoutes);
if (isDev) console.log('✅ AI routes registered at /ai');
app.use('/workflows', workflowRoutes);
if (isDev) console.log('✅ Workflow routes registered at /workflows');

// Health check rate limiter
const healthCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: 'Too many health check requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/health', healthCheckLimiter, (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

app.use(errorHandler);

// MongoDB connection (reused across invocations)
let mongoConnectionPromise: Promise<void> | null = null;
const ensureMongoConnection = async () => {
    if (!mongoConnectionPromise) {
        mongoConnectionPromise = (async () => {
            try {
                await connectToMongoDB();
            } catch (error) {
                console.error('Failed to connect to MongoDB:', error);
                mongoConnectionPromise = null;
                throw error;
            }
        })();
    }
    return mongoConnectionPromise;
};

// Vercel serverless function handler
export default async (req: any, res: any) => {
    try {
        // Log incoming request for debugging
        const incomingUrl = req.url || req.path || '';
        if (incomingUrl.includes('/video') && isDev) {
            console.log(`[Vercel Handler] Incoming request: ${req.method} ${incomingUrl}`);
            console.log(`[Vercel Handler] req.url: ${req.url}, req.path: ${req.path}, req.originalUrl: ${req.originalUrl}`);
        }

        // IMPORTANT: For Stripe webhooks, DO NOT process through Express
        // The dedicated handler at api/payments/webhook.ts should handle it directly
        // Check if this is a webhook request
        const url = req.url || req.path || '';
        const isWebhookRequest = url.includes('/payments/webhook');

        if (isWebhookRequest && req.method === 'POST') {
            // This should not happen - the dedicated handler should catch it first
            // But if it does, we need to preserve the raw body
            if (isDev) {
                console.log('⚠️ Webhook request reached api/index.ts - this should not happen');
                console.log('   URL:', url);
                console.log('   Body type:', typeof req.body);
                console.log('   Body is Buffer:', Buffer.isBuffer(req.body));
            }

            // If body is already parsed, we can't recover the raw body
            // Return error to indicate the issue
            if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
                if (isDev) console.error('❌ Body was already parsed as JSON - cannot verify signature');
                return res.status(400).json({
                    error: 'Webhook Error: Body was parsed before signature verification. Raw body required.',
                    hint: 'The webhook should be handled by api/payments/webhook.ts directly, not through api/index.ts'
                });
            }

            // If we somehow get here with raw body, try to pass it through
            // But ideally this should not happen
            if (isDev) console.warn('⚠️ Webhook request in api/index.ts - attempting to preserve raw body');
        }

        await ensureMongoConnection();
        app(req, res);
    } catch (error: any) {
        console.error('Handler error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message || 'A server error has occurred'
            });
        }
    }
};
