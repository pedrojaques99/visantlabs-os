// Register path aliases for tsx runtime
import { register } from 'tsconfig-paths';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

register({
  baseUrl: resolve(__dirname, '..'),
  paths: {
    '@/*': ['./src/*'],
  },
});

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: false });
dotenv.config({ override: false });

// Fail-fast env validation — must run before any module that reads env at load.
import { loadEnv } from './config/env.js';
try {
  loadEnv();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error((err as Error).message);
  process.exit(1);
}

import { createApp } from './app.js';
import { connectToMongoDB } from './db/mongodb.js';
import { initPluginWebSocket } from './routes/plugin.js';
import { initAdminChatWebSocket } from './routes/adminChat.js';
import { initRedis } from './lib/redis.js';
import { logger } from './lib/logger.js';

const app = createApp();
const PORT = Number(process.env.PORT) || 3001;

logger.info(
  { prefix: process.env.VERCEL ? '' : '/api' },
  'mcp.server.registered: POST /mcp (Streamable HTTP, stateless) + GET /mcp/sse (legacy)'
);

const validateStripeConfig = () => {
  const checks: Array<[string, string | undefined, string]> = [
    ['STRIPE_SECRET_KEY', process.env.STRIPE_SECRET_KEY, 'Stripe payments will not work'],
    ['STRIPE_PRICE_ID_USD', process.env.STRIPE_PRICE_ID_USD || process.env.STRIPE_PRICE_ID, 'Subscription checkout will not work'],
    ['STRIPE_PRICE_ID_BRL', process.env.STRIPE_PRICE_ID_BRL, 'BRL pricing will not be available'],
    ['STRIPE_WEBHOOK_SECRET', process.env.STRIPE_WEBHOOK_SECRET, 'Webhook events will not be processed'],
  ];
  for (const [name, value, warning] of checks) {
    if (!value) console.warn(`⚠️  ${name} is not configured. ${warning}.`);
    else console.log(`✅ ${name} configured`);
  }
};

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
  app(req, res);
};

// Local dev: bind to port + bootstrap WebSocket
if (!process.env.VERCEL) {
  (async () => {
    validateStripeConfig();

    const mongoConnected = await testMongoConnection();
    if (!mongoConnected) {
      console.warn('⚠️  MongoDB connection failed, but server will start anyway');
      console.warn('⚠️  Make sure MONGODB_URI is set in your .env file');
    }

    testPrismaConnection().catch(() => {
      console.warn('⚠️  Prisma connection test failed, but server will start anyway');
    });

    const redisConnected = await initRedis();
    if (!redisConnected) {
      console.warn('⚠️  Redis connection failed, continuing without cache');
    }

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📝 Make sure MONGODB_URI is configured in your .env file`);
    });

    // Allow port reuse immediately (prevents EADDRINUSE after restart)
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} already in use. Try killing the process or wait 30 seconds.`);
        process.exit(1);
      }
    });

    server.timeout = 600000;
    server.keepAliveTimeout = 650000;
    server.headersTimeout = 660000;

    initPluginWebSocket(server);
    initAdminChatWebSocket(server);
  })();
}

export default handler;
