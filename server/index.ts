// Register path aliases for tsx runtime
import { register } from 'tsconfig-paths';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Register path aliases from tsconfig
register({
  baseUrl: resolve(__dirname, '..'),
  paths: {
    '@/*': ['./src/*']
  }
});

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import mockupRoutes from './routes/mockups.js';
import mockupTagRoutes from './routes/mockupTags.js';
import authRoutes from './routes/auth.js';
import healthRoutes from './routes/health.js';
import paymentRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';
import brandingRoutes from './routes/branding.js';
import feedbackRoutes from './routes/feedback.js';
import canvasRoutes from './routes/canvas.js';
import imagesRoutes from './routes/images.js';
import waitlistRoutes from './routes/waitlist.js';
import usageRoutes from './routes/usage.js';
import videoRoutes from './routes/video.js';
import communityRoutes from './routes/community.js';
import storageRoutes from './routes/storage.js';
import usersRoutes from './routes/users.js';
import { errorHandler } from './middleware/errorHandler.js';
import { connectToMongoDB } from './db/mongodb.js';

// Load environment variables from .env or .env.local
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env if .env.local doesn't exist

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Vercel/Nginx)
const PORT = process.env.PORT || 3001;

// Middleware
// Support multiple frontend URLs (comma-separated)
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:3000', 'http://localhost:3002'];

// Add common development ports
const devOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173', // Vite default
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:5173',
];

const allAllowedOrigins = [...new Set([...allowedOrigins, ...devOrigins])];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list
    if (allAllowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, allow localhost on any port
      if (process.env.NODE_ENV !== 'production') {
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true);
        }
      }
      // In production, also allow same-origin requests
      if (process.env.NODE_ENV === 'production') {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Webhooks need raw body, so we handle them before json parser
const routePrefix = process.env.VERCEL ? '' : '/api';
app.use(`${routePrefix}/payments/webhook`, express.raw({ type: 'application/json' }));
app.use(`${routePrefix}/liveblocks/webhook`, express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Debug middleware to log all requests (only in development or when DEBUG is enabled)
if (process.env.DEBUG || process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - Original URL: ${req.originalUrl}`);
    next();
  });
}

// Middleware to normalize routes for Vercel
// In Vercel, requests to /api/* are routed to this handler, but the URL may still include /api
if (process.env.VERCEL) {
  app.use((req, res, next) => {
    // Log for debugging
    const originalUrl = req.url;
    // Remove /api prefix if present (Vercel routing)
    // Only remove if it's at the start of the path
    if (req.url && req.url.startsWith('/api/')) {
      req.url = req.url.replace(/^\/api/, '');
      console.log(`[Vercel Route Normalization] ${req.method} ${originalUrl} -> ${req.url}`);
    } else if (req.url && req.url.startsWith('/api')) {
      // Handle /api without trailing slash
      req.url = req.url.replace(/^\/api/, '') || '/';
      console.log(`[Vercel Route Normalization] ${req.method} ${originalUrl} -> ${req.url}`);
    }
    next();
  });
}

// Routes
// In Vercel, the /api prefix is already handled by routing, so we use paths without /api
// In local dev, we need the /api prefix

app.use(`${routePrefix}/auth`, authRoutes);
app.use(`${routePrefix}/mockups`, mockupRoutes);
app.use(`${routePrefix}/mockup-tags`, mockupTagRoutes);
app.use(`${routePrefix}/payments`, paymentRoutes);
app.use(`${routePrefix}/health`, healthRoutes);
app.use(`${routePrefix}/admin`, adminRoutes);
app.use(`${routePrefix}/branding`, brandingRoutes);
app.use(`${routePrefix}/feedback`, feedbackRoutes);
app.use(`${routePrefix}/canvas`, canvasRoutes);
app.use(`${routePrefix}/images`, imagesRoutes);
app.use(`${routePrefix}/waitlist`, waitlistRoutes);
app.use(`${routePrefix}/usage`, usageRoutes);
app.use(`${routePrefix}/video`, videoRoutes);
app.use(`${routePrefix}/community`, communityRoutes);
app.use(`${routePrefix}/storage`, storageRoutes);
app.use(`${routePrefix}/users`, usersRoutes);
console.log(`✅ Video routes registered at: ${routePrefix}/video`);
console.log(`✅ Community routes registered at: ${routePrefix}/community`);
console.log(`✅ Images routes registered at: ${routePrefix}/images`);

// Import referral routes
import referralRoutes from './routes/referral.js';
app.use(`${routePrefix}/referral`, referralRoutes);

// Import budget routes
import budgetRoutes from './routes/budget.js';
app.use(`${routePrefix}/budget`, budgetRoutes);

// Import visant templates routes
import visantTemplatesRoutes from './routes/visant-templates.js';
app.use(`${routePrefix}/visant-templates`, visantTemplatesRoutes);

// Import workflow routes
import workflowRoutes from './routes/workflows.js';
app.use(`${routePrefix}/workflows`, workflowRoutes);
console.log(`✅ Workflow routes registered at: ${routePrefix}/workflows`);

// Import AI routes
import aiRoutes from './routes/ai.js';
app.use(`${routePrefix}/ai`, aiRoutes);

// Import surprise me routes
import surpriseMeRoutes from './routes/surprise-me.js';
app.use(`${routePrefix}/surprise-me`, surpriseMeRoutes);

// Health check rate limiter
const healthCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: 'Too many health check requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Basic health check
app.get(`${routePrefix}/health`, healthCheckLimiter, (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Error handling
app.use(errorHandler);

// Prisma manages connections automatically (lazy connection)
// No need to connect on startup - connections are established on first query

// Validate Stripe configuration
const validateStripeConfig = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePriceIdUsd = process.env.STRIPE_PRICE_ID_USD || process.env.STRIPE_PRICE_ID;
  const stripePriceIdBrl = process.env.STRIPE_PRICE_ID_BRL;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey) {
    console.warn('⚠️  STRIPE_SECRET_KEY is not configured. Stripe payments will not work.');
  } else {
    console.log('✅ STRIPE_SECRET_KEY configured');
  }

  if (!stripePriceIdUsd) {
    console.warn('⚠️  STRIPE_PRICE_ID_USD is not configured. Subscription checkout will not work.');
  } else {
    console.log('✅ STRIPE_PRICE_ID_USD configured');
  }

  if (!stripePriceIdBrl) {
    console.warn('⚠️  STRIPE_PRICE_ID_BRL is not configured. BRL pricing will not be available.');
  } else {
    console.log('✅ STRIPE_PRICE_ID_BRL configured');
  }

  if (!stripeWebhookSecret) {
    console.warn('⚠️  STRIPE_WEBHOOK_SECRET is not configured. Webhook events will not be processed.');
  } else {
    console.log('✅ STRIPE_WEBHOOK_SECRET configured');
  }
};

// Test MongoDB connection
const testMongoConnection = async () => {
  try {
    await connectToMongoDB();
    console.log('✅ MongoDB connection established');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    return false;
  }
};

// Test Prisma connection (optional, for health check)
const testPrismaConnection = async () => {
  try {
    const { prisma } = await import('./db/prisma.js');
    await prisma.$connect();
    console.log('✅ Prisma connected to MongoDB');
    return true;
  } catch (error) {
    console.error('❌ Prisma connection failed:', error);
    return false;
  }
};

// Serverless handler for Vercel
const handler = async (req: any, res: any) => {
  // Prisma connects automatically on first query
  // No need to ensure connection beforehand
  app(req, res);
};

// For local development, start the server
if (!process.env.VERCEL) {
  const startServer = async () => {
    // Validate Stripe configuration
    validateStripeConfig();

    // Test MongoDB connection
    const mongoConnected = await testMongoConnection();
    if (!mongoConnected) {
      console.warn('⚠️  MongoDB connection failed, but server will start anyway');
      console.warn('⚠️  Make sure MONGODB_URI is set in your .env file');
    }

    // Test Prisma connection but don't block server startup
    testPrismaConnection().catch(() => {
      console.warn('⚠️  Prisma connection test failed, but server will start anyway');
    });

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📝 Make sure MONGODB_URI is configured in your .env file`);
    });
  };

  startServer();
}

// Export for Vercel serverless functions
export default handler;

