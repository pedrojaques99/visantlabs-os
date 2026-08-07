import express from 'express';
import { getDb } from '../db/mongodb.js';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
const startTime = Date.now();

/**
 * Commit que está REALMENTE rodando, para dar pra comparar com o HEAD do `main`.
 *
 * Sem isto não existe forma de saber se um deploy aconteceu. Em 2026-08-07 o
 * servidor estava com 8,8 dias de uptime rodando código de julho enquanto vários
 * merges se acumulavam em `main`, e ninguém tinha como perceber: o `deploy.yml`
 * falhava por falta dos secrets VPS_*, o job aparecia como `skipped`, e o health
 * só respondia `version: "0.0.0"` do package.json — que nunca muda.
 *
 * Lê da env (injetada no build/deploy) e cai pro .git local quando existe.
 */
function commitEmExecucao(): string | null {
  const daEnv =
    process.env.GIT_COMMIT_SHA ||
    process.env.SOURCE_COMMIT || // Coolify
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA;
  if (daEnv) return daEnv.trim().slice(0, 40);

  // Fallback: lê .git/HEAD no servidor (deploy por `git pull` mantém o .git).
  try {
    const gitDir = path.resolve(__dirname, '../../.git');
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    const ref = head.startsWith('ref: ') ? head.slice(5) : null;
    if (!ref) return head.slice(0, 40); // detached: o próprio SHA
    return fs.readFileSync(path.join(gitDir, ref), 'utf8').trim().slice(0, 40);
  } catch {
    return null;
  }
}

const COMMIT = commitEmExecucao();

// API rate limiter - general authenticated endpoints
// Using express-rate-limit for CodeQL recognition
const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

// General health check
router.get('/', apiRateLimiter, (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    version: pkg.version,
    // `commit` é o que permite detectar deploy que não aconteceu; `version` vem
    // do package.json e fica em 0.0.0 desde sempre, então não serve pra isso.
    commit: COMMIT,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    startedAt: new Date(startTime).toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

// Database health check
router.get('/db', apiRateLimiter, async (req, res) => {
  try {
    const db = getDb();
    // Test connection by running a simple command
    await db.admin().ping();

    // Get database stats
    const stats = await db.stats();
    const collections = await db.listCollections().toArray();

    res.json({
      status: 'connected',
      database: db.databaseName,
      collections: collections.map((c) => c.name),
      stats: {
        collections: stats.collections,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

// R2 storage health check
router.get('/r2', apiRateLimiter, async (req, res) => {
  try {
    const r2Service = await import('../../src/services/r2Service.js');

    // Check if R2 is configured
    if (!r2Service.isR2Configured()) {
      return res.status(500).json({
        status: 'not_configured',
        error: 'R2 is not fully configured. Check environment variables.',
        missing: {
          accountId: !process.env.R2_ACCOUNT_ID?.trim(),
          accessKeyId: !process.env.R2_ACCESS_KEY_ID?.trim(),
          secretAccessKey: !process.env.R2_SECRET_ACCESS_KEY?.trim(),
          bucketName: !process.env.R2_BUCKET_NAME?.trim(),
          publicUrl: !process.env.R2_PUBLIC_URL?.trim(),
        },
      });
    }

    const accountId = process.env.R2_ACCOUNT_ID?.trim() || '';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || '';
    const bucketName = process.env.R2_BUCKET_NAME?.trim() || '';

    // Test connection by trying to list bucket (minimal operation)
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });

    try {
      await client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          MaxKeys: 1, // Just check if we can access the bucket
        })
      );

      return res.json({
        status: 'connected',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        bucket: bucketName,
        credentials: {
          accountIdLength: accountId.length,
          accessKeyIdLength: accessKeyId.length,
          secretAccessKeyLength: secretAccessKey.length,
        },
      });
    } catch (testError: any) {
      return res.status(500).json({
        status: 'error',
        error: testError.message,
        errorCode: testError.Code || testError.code,
        errorName: testError.name,
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        bucket: bucketName,
        credentials: {
          accountIdLength: accountId.length,
          accessKeyIdLength: accessKeyId.length,
          secretAccessKeyLength: secretAccessKey.length,
        },
        troubleshooting:
          testError.name === 'SignatureDoesNotMatch'
            ? [
                '1. Verify Access Key ID and Secret Access Key are from the same token',
                '2. Ensure you are using Account API Token (not User API Token)',
                '3. Check for extra spaces in environment variables',
                '4. Try creating a new Account API Token',
                '5. Verify Account ID is correct',
              ]
            : undefined,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

export default router;
