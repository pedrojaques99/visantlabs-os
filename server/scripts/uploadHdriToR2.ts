/**
 * Download drei HDRI presets and upload to R2.
 * Run: npx tsx server/scripts/uploadHdriToR2.ts
 */
import 'dotenv/config';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const CUBEMAP_ROOT = 'https://raw.githack.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/';

const PRESETS: Record<string, string> = {
  apartment: 'lebombo_1k.hdr',
  city: 'potsdamer_platz_1k.hdr',
  dawn: 'kiara_1_dawn_1k.hdr',
  forest: 'forest_slope_1k.hdr',
  lobby: 'st_fagans_interior_1k.hdr',
  night: 'dikhololo_night_1k.hdr',
  park: 'rooitou_park_1k.hdr',
  studio: 'studio_small_03_1k.hdr',
  sunset: 'venice_sunset_1k.hdr',
  warehouse: 'empty_warehouse_01_1k.hdr',
};

async function main() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  const publicUrl = process.env.R2_PUBLIC_URL?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    console.error('Missing R2 env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL');
    process.exit(1);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const results: Record<string, string> = {};

  for (const [preset, filename] of Object.entries(PRESETS)) {
    const r2Key = `hdri/${filename}`;
    const finalUrl = `${publicUrl.replace(/\/$/, '')}/${r2Key}`;

    // Check if already exists
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: r2Key }));
      console.log(`✓ ${preset} already exists: ${finalUrl}`);
      results[preset] = finalUrl;
      continue;
    } catch {
      // doesn't exist, proceed
    }

    const sourceUrl = `${CUBEMAP_ROOT}${filename}`;
    console.log(`↓ Downloading ${preset} from ${sourceUrl}...`);

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      console.error(`✗ Failed to download ${preset}: ${response.status}`);
      continue;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`↑ Uploading ${preset} (${(buffer.length / 1024).toFixed(0)} KB) to R2...`);

    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
      Body: buffer,
      ContentType: 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    console.log(`✓ ${preset} → ${finalUrl}`);
    results[preset] = finalUrl;
  }

  console.log('\n--- URL Map (paste into ENVIRONMENT_HDRI_URLS) ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
