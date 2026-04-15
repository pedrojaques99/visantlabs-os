import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
import telemetryRoutes from './routes/telemetry.js';
import llmsRoutes from './routes/llms.js';
import appRoutes from './routes/apps.js';
import referralRoutes from './routes/referral.js';
import budgetRoutes from './routes/budget.js';
import visantTemplatesRoutes from './routes/visant-templates.js';
import workflowRoutes from './routes/workflows.js';
import nodeBuilderRoutes from './routes/node-builder.js';
import aiRoutes from './routes/ai.js';
import figmaRoutes from './routes/figma.js';
import pluginRoutes from './routes/plugin.js';
import brandGuidelinesRoutes from './routes/brand-guidelines.js';
import creativeRoutes from './routes/creative.js';
import creativeProjectsRoutes from './routes/creative-projects.js';
import docsRoutes from './routes/docs.js';
import surpriseMeRoutes from './routes/surprise-me.js';
import brandIntelligenceRoutes from './routes/brandIntelligence.js';
import rpcRoutes from './routes/rpc.js';

import { errorHandler } from './middleware/errorHandler.js';
import { detectAgent } from './middleware/agentContent.js';
import { requestContext } from './middleware/requestContext.js';

import { createPlatformMcpServer, setMcpUserId } from './mcp/platform-mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { authenticateApiKey } from './middleware/apiKeyAuth.js';

/**
 * Build the Express application.
 *
 * Pure construction — no side effects (no .listen, no DB connects, no env
 * validation). Callers (server/index.ts for prod, tests for supertest) decide
 * when/how to bring the app online.
 */
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  // ── Security Headers & Performance ───────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false, // Disable CSP in dev for easier debugging
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
  app.use(compression());

  // ── CORS ─────────────────────────────────────────────────────────────────
  const envFrontendOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((u) => u.trim())
    : ['http://localhost:3000', 'http://localhost:3002'];

  const claudeOrigins = [
    'https://claude.ai',
    'https://www.claude.ai',
    'https://console.anthropic.com',
    'https://api.anthropic.com',
  ];

  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:5173',
  ];

  const allAllowedOrigins = [...new Set([...envFrontendOrigins, ...claudeOrigins, ...devOrigins])];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || origin === 'null') return callback(null, true);
        if (allAllowedOrigins.includes(origin)) return callback(null, origin);
        if (process.env.NODE_ENV !== 'production') {
          if (
            origin.startsWith('http://localhost:') ||
            origin.startsWith('http://127.0.0.1:') ||
            origin.includes('ngrok')
          ) {
            return callback(null, origin);
          }
        }
        if (process.env.NODE_ENV === 'production') return callback(null, origin);
        console.warn(`⚠️  CORS blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'MCP-Session-Id', 'MCP-Protocol-Version'],
      exposedHeaders: ['MCP-Session-Id'],
    })
  );

  // ── Body parsers & Rate Limiting ─────────────────────────────────────────
  const routePrefix = process.env.VERCEL ? '' : '/api';

  // Global API Rate Limiter
  const globalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per average user IP
    message: { error: 'Too many requests from this IP. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limit for internal health checks if needed
      return req.path.includes('/health');
    }
  });

  app.use(`${routePrefix}/`, globalApiLimiter);

  // Webhooks need raw body — register BEFORE json parser
  app.use(`${routePrefix}/payments/webhook`, express.raw({ type: 'application/json' }));
  app.use(`${routePrefix}/liveblocks/webhook`, express.raw({ type: 'application/json' }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Correlation ID + request-scoped Pino logger (X-Request-Id in/out)
  app.use(requestContext);

  // Agent detection
  app.use(detectAgent);

  // Request logging (dev/debug only; silent in tests) — superseded by requestContext,
  // kept behind DEBUG for raw-url visibility during local troubleshooting.
  if (process.env.DEBUG && process.env.NODE_ENV !== 'test') {
    app.use((req, _res, next) => {
      console.log('Request:', {
        method: String(req.method),
        url: String(req.url),
        originalUrl: String(req.originalUrl),
      });
      next();
    });
  }

  // Vercel path normalization
  if (process.env.VERCEL) {
    app.use((req, _res, next) => {
      if (req.url?.startsWith('/api/')) {
        req.url = req.url.replace(/^\/api/, '');
      } else if (req.url?.startsWith('/api')) {
        req.url = req.url.replace(/^\/api/, '') || '/';
      }
      next();
    });
  }

  // ── Routes ───────────────────────────────────────────────────────────────
  // Root-level (no /api prefix)
  app.use('/', llmsRoutes);

  // Feature routes — keep this list sorted and flat for grep-ability
  const mounts: Array<[string, express.Router]> = [
    ['/auth', authRoutes],
    ['/mockups', mockupRoutes],
    ['/mockup-tags', mockupTagRoutes],
    ['/payments', paymentRoutes],
    ['/health', healthRoutes],
    ['/admin', adminRoutes],
    ['/branding', brandingRoutes],
    ['/feedback', feedbackRoutes],
    ['/canvas', canvasRoutes],
    ['/images', imagesRoutes],
    ['/waitlist', waitlistRoutes],
    ['/usage', usageRoutes],
    ['/video', videoRoutes],
    ['/community', communityRoutes],
    ['/storage', storageRoutes],
    ['/users', usersRoutes],
    ['/apps', appRoutes],
    ['/referral', referralRoutes],
    ['/budget', budgetRoutes],
    ['/visant-templates', visantTemplatesRoutes],
    ['/workflows', workflowRoutes],
    ['/node-builder', nodeBuilderRoutes],
    ['/ai', aiRoutes],
    ['/figma', figmaRoutes],
    ['/plugin', pluginRoutes],
    ['/brand-guidelines', brandGuidelinesRoutes],
    ['/creative', creativeRoutes],
    ['/creative-projects', creativeProjectsRoutes],
    ['/docs', docsRoutes],
    ['/surprise-me', surpriseMeRoutes],
    ['/brand-intelligence', brandIntelligenceRoutes],
    ['/expert', expertRoutes],
    ['/telemetry', telemetryRoutes],
    ['/rpc', rpcRoutes],
  ];

  for (const [path, router] of mounts) {
    app.use(`${routePrefix}${path}`, router);
  }

  // ── Platform MCP (Streamable HTTP + legacy SSE) ──────────────────────────
  const legacySseTransports = new Map<string, SSEServerTransport>();
  const legacyMcpServer = createPlatformMcpServer();

  const validateMcpOrigin = (req: express.Request): boolean => {
    const origin = req.headers.origin;
    if (!origin) return true;
    const claudeDomains = [
      'https://claude.ai',
      'https://www.claude.ai',
      'https://console.anthropic.com',
      'https://api.anthropic.com',
    ];
    const visantDomains = [
      'https://visantlabs.com',
      'https://www.visantlabs.com',
      'https://vsn-mockup-machine.vercel.app',
      'https://app.visantlabs.com',
    ];
    const envOrigins = [process.env.FRONTEND_URL, process.env.VITE_API_URL, process.env.VITE_FRONTEND_URL]
      .filter(Boolean)
      .flatMap((url) => (url as string).split(',').map((u) => u.trim()))
      .filter(Boolean);
    const allowed = [...claudeDomains, ...visantDomains, ...envOrigins];
    if (process.env.NODE_ENV !== 'production') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('ngrok')) return true;
    }
    return allowed.some((a) => origin.startsWith(a));
  };

  const authenticateMcpRequest = async (req: express.Request): Promise<boolean> => {
    const authReq = req as any;
    authReq.userId = undefined;
    authReq.userEmail = undefined;
    const isAuth = await authenticateApiKey(authReq);
    setMcpUserId(isAuth ? authReq.userId : null);
    return isAuth;
  };

  app.post(`${routePrefix}/mcp`, async (req, res) => {
    if (!validateMcpOrigin(req)) {
      return res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid origin' },
        id: null,
      });
    }
    await authenticateMcpRequest(req);
    try {
      const server = createPlatformMcpServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('[MCP] Request error:', err);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    }
  });

  app.get(`${routePrefix}/mcp`, (_req, res) => {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Use POST to send requests. GET not supported in stateless mode.' },
      id: null,
    });
  });

  app.get(`${routePrefix}/mcp/sse`, async (req: any, res) => {
    await authenticateMcpRequest(req);
    const transport = new SSEServerTransport(`${routePrefix}/mcp/sse/message`, res);
    legacySseTransports.set(transport.sessionId, transport);
    res.on('close', () => {
      legacySseTransports.delete(transport.sessionId);
    });
    await legacyMcpServer.connect(transport);
  });

  app.post(`${routePrefix}/mcp/sse/message`, async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = legacySseTransports.get(sessionId);
    if (!transport) return res.status(404).json({ error: 'Session not found' });
    await transport.handlePostMessage(req, res);
  });

  // ── Error handler (must be last) ─────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
