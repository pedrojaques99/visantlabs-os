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
import expertRoutes from './routes/expert.js';
import llmsRoutes from './routes/llms.js';
import appRoutes from './routes/apps.js';
import { errorHandler } from './middleware/errorHandler.js';
import { detectAgent } from './middleware/agentContent.js';
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

// Claude/Anthropic domains (always allowed for MCP connectors)
const claudeOrigins = [
  'https://claude.ai',
  'https://www.claude.ai',
  'https://console.anthropic.com',
  'https://api.anthropic.com',
];

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

const allAllowedOrigins = [...new Set([...allowedOrigins, ...claudeOrigins, ...devOrigins])];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl) or 'null' origin (Figma plugin iframes)
    if (!origin || origin === 'null') return callback(null, true);

    // Check if origin is in allowed list
    if (allAllowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, allow localhost and ngrok
      if (process.env.NODE_ENV !== 'production') {
        if (
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:') ||
          origin.includes('ngrok')
        ) {
          return callback(null, true);
        }
      }
      // In production, allow all (API is protected by auth)
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
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'MCP-Session-Id',
    'MCP-Protocol-Version',
  ],
  exposedHeaders: [
    'MCP-Session-Id',
  ],
}));

// Webhooks need raw body, so we handle them before json parser
const routePrefix = process.env.VERCEL ? '' : '/api';
app.use(`${routePrefix}/payments/webhook`, express.raw({ type: 'application/json' }));
app.use(`${routePrefix}/liveblocks/webhook`, express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// AI agent detection — sets res.locals.isAgent and adds Link header
app.use(detectAgent);

// Debug middleware to log all requests (only in development or when DEBUG is enabled)
if (process.env.DEBUG || process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    // Use structured logging to avoid format string vulnerability
    console.log('Request:', {
      method: String(req.method),
      url: String(req.url),
      originalUrl: String(req.originalUrl),
    });
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
      // Use structured logging to avoid format string vulnerability
      console.log('[Vercel Route Normalization]:', {
        method: String(req.method),
        originalUrl: String(originalUrl),
        normalizedUrl: String(req.url),
      });
    } else if (req.url && req.url.startsWith('/api')) {
      // Handle /api without trailing slash
      req.url = req.url.replace(/^\/api/, '') || '/';
      // Use structured logging to avoid format string vulnerability
      console.log('[Vercel Route Normalization]:', {
        method: String(req.method),
        originalUrl: String(originalUrl),
        normalizedUrl: String(req.url),
      });
    }
    next();
  });
}

// LLM discovery routes — served at root level (no /api prefix)
app.use('/', llmsRoutes);

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
app.use(`${routePrefix}/apps`, appRoutes);
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

// Import node builder routes
import nodeBuilderRoutes from './routes/node-builder.js';
app.use(`${routePrefix}/node-builder`, nodeBuilderRoutes);
console.log(`✅ Workflow routes registered at: ${routePrefix}/workflows`);

// Import AI routes
import aiRoutes from './routes/ai.js';
app.use(`${routePrefix}/ai`, aiRoutes);

// Import Figma plugin routes
import figmaRoutes from './routes/figma.js';
app.use(`${routePrefix}/figma`, figmaRoutes);

// Import plugin AI generation routes
import pluginRoutes, { initPluginWebSocket } from './routes/plugin.js';
app.use(`${routePrefix}/plugin`, pluginRoutes);

// Import brand guidelines routes
import brandGuidelinesRoutes from './routes/brand-guidelines.js';
app.use(`${routePrefix}/brand-guidelines`, brandGuidelinesRoutes);

// Import creative studio routes
import creativeRoutes from './routes/creative.js';
app.use(`${routePrefix}/creative`, creativeRoutes);

// Import documentation routes
import docsRoutes from './routes/docs.js';
app.use(`${routePrefix}/docs`, docsRoutes);
console.log(`✅ Documentation routes registered at: ${routePrefix}/docs`);

// Import surprise me routes
import surpriseMeRoutes from './routes/surprise-me.js';
app.use(`${routePrefix}/surprise-me`, surpriseMeRoutes);

// Import API key routes
import apiKeyRoutes from './routes/apiKeys.js';
app.use(`${routePrefix}/api-keys`, apiKeyRoutes);

// Import expert routes
app.use(`${routePrefix}/expert`, expertRoutes);
console.log(`✅ Expert routes registered at: ${routePrefix}/expert`);

// ═══ Platform MCP Server (Streamable HTTP transport for Claude Connectors) ═══
import { createPlatformMcpServer, setMcpUserId } from './mcp/platform-mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { authenticateApiKey } from './middleware/apiKeyAuth.js';

// Legacy SSE transports (backwards compatibility)
const legacySseTransports = new Map<string, SSEServerTransport>();
const legacyMcpServer = createPlatformMcpServer();

/**
 * Validate Origin header to prevent DNS rebinding attacks
 * Allows: Claude domains, Visant domains, localhost (dev only)
 */
function validateMcpOrigin(req: express.Request): boolean {
  const origin = req.headers.origin;

  // No origin = same-origin request (curl, Postman, server-to-server)
  if (!origin) return true;

  // Claude/Anthropic domains (always allowed for connectors)
  const claudeDomains = [
    'https://claude.ai',
    'https://www.claude.ai',
    'https://console.anthropic.com',
    'https://api.anthropic.com',
  ];

  // Visant production domains
  const visantDomains = [
    'https://visantlabs.com',
    'https://www.visantlabs.com',
    'https://vsn-mockup-machine.vercel.app',
    'https://app.visantlabs.com',
  ];

  // Parse env vars (may be comma-separated)
  const envOrigins = [
    process.env.FRONTEND_URL,
    process.env.VITE_API_URL,
    process.env.VITE_FRONTEND_URL,
  ]
    .filter(Boolean)
    .flatMap(url => (url as string).split(',').map(u => u.trim()))
    .filter(Boolean);

  const allowedOrigins = [...claudeDomains, ...visantDomains, ...envOrigins];

  // Allow localhost/ngrok in development
  if (process.env.NODE_ENV !== 'production') {
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('ngrok')) {
      return true;
    }
  }

  return allowedOrigins.some(allowed => origin.startsWith(allowed));
}

/**
 * Authenticate request and set user context
 */
async function authenticateMcpRequest(req: express.Request): Promise<boolean> {
  const authReq = req as any;
  authReq.userId = undefined;
  authReq.userEmail = undefined;
  const isAuth = await authenticateApiKey(authReq);
  setMcpUserId(isAuth ? authReq.userId : null);
  return isAuth;
}

// ═══ Streamable HTTP Transport (Claude Connectors compatible) ═══
// Stateless mode: each request gets fresh server+transport (simpler, scales better)

app.post(`${routePrefix}/mcp`, async (req: express.Request, res: express.Response) => {
  // Security: Validate Origin
  if (!validateMcpOrigin(req)) {
    return res.status(403).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid origin' },
      id: null
    });
  }

  // Authenticate
  await authenticateMcpRequest(req);

  try {
    // Create fresh server and transport for this request (stateless)
    const server = createPlatformMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
    });

    // Clean up on response close
    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    // Connect and handle
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[MCP] Request error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  }
});

// GET returns 405 - we don't support standalone SSE streams in stateless mode
app.get(`${routePrefix}/mcp`, (req: express.Request, res: express.Response) => {
  res.setHeader('Allow', 'POST');
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32600, message: 'Use POST to send requests. GET not supported in stateless mode.' },
    id: null
  });
});

// ═══ Legacy SSE Transport (backwards compatibility with old clients) ═══
app.get(`${routePrefix}/mcp/sse`, async (req: any, res) => {
  await authenticateMcpRequest(req);

  const transport = new SSEServerTransport(`${routePrefix}/mcp/sse/message`, res);
  legacySseTransports.set(transport.sessionId, transport);
  res.on('close', () => { legacySseTransports.delete(transport.sessionId); });
  await legacyMcpServer.connect(transport);
});

app.post(`${routePrefix}/mcp/sse/message`, async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = legacySseTransports.get(sessionId);
  if (!transport) return res.status(404).json({ error: 'Session not found' });
  await transport.handlePostMessage(req, res);
});

console.log(`✅ Platform MCP server registered:
   • Claude Connectors: POST ${routePrefix}/mcp (Streamable HTTP, stateless)
   • Legacy clients:    GET  ${routePrefix}/mcp/sse (SSE)`);

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

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📝 Make sure MONGODB_URI is configured in your .env file`);
    });

    // Initialize WebSocket server for Figma plugin
    initPluginWebSocket(server);
  };

  startServer();
}

// Export for Vercel serverless functions
export default handler;

