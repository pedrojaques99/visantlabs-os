/**
 * Configure an R2 (S3-compatible) bucket lifecycle rule that auto-expires
 * ephemeral ImageLab filter outputs.
 *
 * WHAT EXPIRES: objects under `imagelab/outputs/` (halftone / texture / riso /
 * shader / chain results — see r2Service.uploadEphemeralImage). These are
 * regenerable on demand and downloaded immediately, so a short TTL keeps storage
 * bounded without losing anything the user can't recreate.
 *
 * WHAT DOES NOT EXPIRE: everything else — user uploads, mockups (`${userId}/`),
 * canvas assets, brand media, presets, and the paid AI outputs from
 * generative-expand / inpaint / remove-background (they live under the permanent
 * `${userId}/` prefix, NOT here).
 *
 * Idempotent: it merges/replaces only the `imagelab-ephemeral-expire` rule and
 * preserves any other existing lifecycle rules on the bucket.
 *
 * Run: npx tsx server/scripts/setupR2Lifecycle.ts
 *      EXPIRE_DAYS=14 npx tsx server/scripts/setupR2Lifecycle.ts   (override TTL)
 */
import 'dotenv/config';
import {
  S3Client,
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
  type LifecycleRule,
} from '@aws-sdk/client-s3';
import { IMAGELAB_EPHEMERAL_PREFIX } from '../services/r2Service.js';

const RULE_ID = 'imagelab-ephemeral-expire';

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error(
      '[R2 Lifecycle] Missing env vars (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).'
    );
    console.error('[R2 Lifecycle] Run this on the server where R2 credentials are configured.');
    process.exit(1);
  }

  const expireDays = Math.max(1, parseInt(process.env.EXPIRE_DAYS || '7', 10) || 7);
  const prefix = `${IMAGELAB_EPHEMERAL_PREFIX}/`;

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  // Preserve any pre-existing rules; replace only ours.
  let existingRules: LifecycleRule[] = [];
  try {
    const current = await client.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: bucketName })
    );
    existingRules = (current.Rules || []).filter((r) => r.ID !== RULE_ID);
  } catch (err: any) {
    // R2 returns NoSuchLifecycleConfiguration when none is set yet — that's fine.
    if (err?.name && !/NoSuchLifecycleConfiguration/i.test(err.name)) {
      console.warn(`[R2 Lifecycle] Could not read existing config (${err.name}); continuing.`);
    }
  }

  const rule: LifecycleRule = {
    ID: RULE_ID,
    Status: 'Enabled',
    Filter: { Prefix: prefix },
    Expiration: { Days: expireDays },
    // Also clean up incomplete multipart uploads under this prefix.
    AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
  };

  await client.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucketName,
      LifecycleConfiguration: { Rules: [...existingRules, rule] },
    })
  );

  console.log(
    `[R2 Lifecycle] ✓ Rule "${RULE_ID}" set on bucket "${bucketName}": expire objects under "${prefix}" after ${expireDays} day(s).`
  );
  console.log(
    `[R2 Lifecycle] Preserved ${existingRules.length} other lifecycle rule(s).`
  );
}

main().catch((err) => {
  console.error('[R2 Lifecycle] Failed:', err);
  process.exit(1);
});
