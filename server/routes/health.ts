import express from 'express';
import { getDb } from '../db/mongodb.js';

const router = express.Router();

// Database health check
router.get('/db', async (req, res) => {
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
      collections: collections.map(c => c.name),
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
router.get('/r2', async (req, res) => {
  try {
    const r2Service = await import('@/services/r2Service.js');

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
      await client.send(new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1, // Just check if we can access the bucket
      }));

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
        troubleshooting: testError.name === 'SignatureDoesNotMatch' ? [
          '1. Verify Access Key ID and Secret Access Key are from the same token',
          '2. Ensure you are using Account API Token (not User API Token)',
          '3. Check for extra spaces in environment variables',
          '4. Try creating a new Account API Token',
          '5. Verify Account ID is correct',
        ] : undefined,
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

