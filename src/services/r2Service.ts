import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../../server/db/prisma';

// R2 configuration using S3-compatible API
const getR2Client = () => {
  // Trim whitespace from credentials (common issue when copying from UI)
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey) {
    const missing = [];
    if (!accountId) missing.push('R2_ACCOUNT_ID');
    if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
    throw new Error(`R2 credentials not configured. Missing: ${missing.join(', ')}`);
  }

  // Log credential info (without exposing actual values)
  console.log('R2 Client Configuration:', {
    accountIdLength: accountId.length,
    accessKeyIdLength: accessKeyId.length,
    secretAccessKeyLength: secretAccessKey.length,
    accountIdPrefix: accountId.substring(0, 4) + '...',
    accessKeyIdPrefix: accessKeyId.substring(0, 8) + '...',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  });

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // Force path-style URLs to avoid virtual-hosted-style issues
    forcePathStyle: true,
  });
};

/**
 * Helper function to check storage limit with optimizations
 * Skips check for admins (unlimited storage)
 */
async function checkStorageLimitIfNeeded(
  userId: string,
  fileSizeBytes: number,
  subscriptionTier?: string,
  isAdmin?: boolean,
  customLimitBytes?: number | null
): Promise<void> {
  // Skip check for admins (unlimited storage)
  if (isAdmin) {
    return;
  }

  const storageCheck = await checkStorageLimit(userId, fileSizeBytes, subscriptionTier, isAdmin, customLimitBytes);
  if (!storageCheck.allowed) {
    throw new StorageLimitExceededError(storageCheck.used, storageCheck.limit, fileSizeBytes);
  }
}

/**
 * Upload image to R2 storage
 * @param base64Image - Base64 encoded image string (with or without data URL prefix)
 * @param userId - User ID
 * @param mockupId - Mockup ID (optional, will be generated if not provided)
 * @param subscriptionTier - User's subscription tier (optional, defaults to 'free')
 * @param isAdmin - Whether user is admin (optional, defaults to false)
 * @returns Public URL of the uploaded image
 */
export async function uploadImage(
  base64Image: string,
  userId: string,
  mockupId?: string,
  subscriptionTier?: string,
  isAdmin?: boolean
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Check storage limit before upload (skips for admins)
  await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

  // Generate file path: userId/mockupId-timestamp.png
  const timestamp = Date.now();
  const mockupIdOrTimestamp = mockupId || timestamp;
  const key = `${userId}/${mockupIdOrTimestamp}-${timestamp}.png`;

  const client = getR2Client();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
        // Make file publicly accessible if using custom domain
        // Note: This works with public buckets or custom domains
      })
    );

    // Increment storage counter after successful upload
    await incrementUserStorage(userId, buffer.length);

    // Return public URL
    // Format: https://pub-[ID].r2.dev/userId/file.png
    // or: https://custom-domain.com/userId/file.png
    return `${publicUrl}/${key}`;
  } catch (error: any) {
    console.error('Error uploading to R2:', error);

    // Enhanced error logging for signature errors
    if (error.message?.includes('signature') || error.name === 'SignatureDoesNotMatch') {
      const accountId = process.env.R2_ACCOUNT_ID?.trim() || '';
      const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || '';
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || '';

      console.error('R2 Signature Error Details:');
      console.error('  - Bucket:', bucketName);
      console.error('  - Key:', key);
      console.error('  - Endpoint:', `https://${accountId}.r2.cloudflarestorage.com`);
      console.error('  - Account ID length:', accountId.length, accountId.length < 20 ? '⚠️ WARNING: Too short!' : '');
      console.error('  - Access Key ID length:', accessKeyId.length, accessKeyId.length < 16 ? '⚠️ WARNING: Too short!' : '');
      console.error('  - Secret Access Key length:', secretAccessKey.length, secretAccessKey.length < 16 ? '⚠️ WARNING: Too short!' : '');
      console.error('  - Account ID prefix:', accountId.substring(0, 8) + '...');
      console.error('  - Access Key ID prefix:', accessKeyId.substring(0, 8) + '...');
      console.error('  - Error Code:', error.Code || error.code || 'N/A');
      console.error('  - Request ID:', error.requestId || 'N/A');

      // Provide helpful troubleshooting tips
      const troubleshootingTips = [
        '1. Verifique se copiou o Access Key ID e Secret Access Key corretamente',
        '2. Certifique-se de usar as credenciais do "Account API Token" (não User API Token)',
        '3. Remova espaços em branco extras no início/fim das variáveis',
        '4. Verifique se o Account ID está correto (deve ter pelo menos 20 caracteres)',
        '5. Tente criar um novo Account API Token no Cloudflare Dashboard',
        '6. Certifique-se de que as credenciais correspondem ao mesmo token',
      ];

      console.error('\nTroubleshooting Tips:');
      troubleshootingTips.forEach(tip => console.error('  ', tip));

      throw new Error(
        `Failed to upload image to R2: Signature mismatch. ` +
        `Please verify your R2 credentials are correct. ` +
        `Make sure you're using Account API Token credentials (Access Key ID + Secret Access Key), ` +
        `and that there are no extra spaces. Error: ${error.message || error}`
      );
    }

    throw new Error(`Failed to upload image to R2: ${error.message || error}`);
  }
}

/**
 * Delete image from R2 storage
 * @param imageUrl - Full public URL of the image
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Extract key from URL
  // URL format: https://pub-[ID].r2.dev/userId/file.png
  // or: https://custom-domain.com/userId/file.png
  const url = new URL(imageUrl);
  const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;

  if (!key) {
    throw new Error('Invalid image URL: could not extract key');
  }

  const client = getR2Client();

  try {
    // Get file size before deleting (to decrement storage counter)
    let fileSize = 0;
    try {
      const headResponse = await client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: key,
        })
      );
      fileSize = headResponse.ContentLength || 0;
    } catch (headError: any) {
      // If file doesn't exist (404) or we can't get metadata, continue with delete anyway
      // Only log warnings for unexpected errors (not 404s)
      const errorCode = headError?.$metadata?.httpStatusCode || headError?.code;
      const errorMessage = headError?.message || headError?.name || 'Unknown error';

      // Don't log warnings for 404 (Not Found) - this is expected when file doesn't exist
      if (errorCode !== 404 && errorCode !== 'NotFound') {
        console.warn(`Could not get file size before delete for key "${key}":`, errorMessage);
      }
    }

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );

    // Decrement storage counter if we got the file size
    if (fileSize > 0) {
      // Extract userId from key
      // Key format: userId/... or prefix/userId/...
      const keyParts = key.split('/');
      let userId: string | null = null;

      if (keyParts.length === 1) {
        // Direct userId/ format
        userId = keyParts[0];
      } else {
        // Prefix/userId/ format - check if first part is a known prefix
        const prefixes = ['canvas', 'profiles', 'budgets', 'brands', 'gifts', 'users', 'pdf-presets'];
        if (prefixes.includes(keyParts[0]) && keyParts.length > 1) {
          userId = keyParts[1];
        } else {
          // Not a known prefix, assume first part is userId
          userId = keyParts[0];
        }
      }

      if (userId) {
        await decrementUserStorage(userId, fileSize);
      }
    }
  } catch (error: any) {
    console.error('Error deleting from R2:', error);
    throw new Error(`Failed to delete image from R2: ${error.message}`);
  }
}

/**
 * Upload profile picture to R2 storage
 * @param base64Image - Base64 encoded image string (with or without data URL prefix)
 * @param userId - User ID
 * @param subscriptionTier - User's subscription tier (optional, defaults to 'free')
 * @param isAdmin - Whether user is admin (optional, defaults to false)
 * @returns Public URL of the uploaded image
 */
export async function uploadProfilePicture(
  base64Image: string,
  userId: string,
  subscriptionTier?: string,
  isAdmin?: boolean
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Check storage limit before upload (skips for admins)
  await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

  // Generate file path: profiles/userId/profile-timestamp.png
  const timestamp = Date.now();
  const key = `profiles/${userId}/profile-${timestamp}.png`;

  const client = getR2Client();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
      })
    );

    // Increment storage counter after successful upload
    await incrementUserStorage(userId, buffer.length);

    return `${publicUrl}/${key}`;
  } catch (error: any) {
    console.error('Error uploading profile picture to R2:', error);
    throw new Error(`Failed to upload profile picture to R2: ${error.message || error}`);
  }
}

/**
 * Upload brand logo to R2 storage
 * @param base64Image - Base64 encoded image string (with or without data URL prefix)
 * @param userId - User ID
 * @param budgetId - Budget ID (optional, will be used in filename if provided)
 * @param subscriptionTier - User's subscription tier (optional, defaults to 'free')
 * @param isAdmin - Whether user is admin (optional, defaults to false)
 * @returns Public URL of the uploaded image
 */
export async function uploadBrandLogo(
  base64Image: string,
  userId: string,
  budgetId?: string,
  subscriptionTier?: string,
  isAdmin?: boolean
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Check storage limit before upload (skips for admins)
  await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

  // Generate file path: brands/userId/logo-timestamp.png or brands/userId/budgetId-logo-timestamp.png
  const timestamp = Date.now();
  const key = budgetId
    ? `brands/${userId}/${budgetId}-logo-${timestamp}.png`
    : `brands/${userId}/logo-${timestamp}.png`;

  const client = getR2Client();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
      })
    );

    // Increment storage counter after successful upload
    await incrementUserStorage(userId, buffer.length);

    return `${publicUrl}/${key}`;
  } catch (error: any) {
    console.error('Error uploading brand logo to R2:', error);
    throw new Error(`Failed to upload brand logo to R2: ${error.message || error}`);
  }
}

/**
 * Upload gift image to R2 storage
 * @param base64Image - Base64 encoded image string (with or without data URL prefix)
 * @param userId - User ID
 * @param budgetId - Budget ID (optional, will be used in filename if provided)
 * @param giftIndex - Index of the gift (0, 1, 2, etc.)
 * @param subscriptionTier - User's subscription tier (optional, defaults to 'free')
 * @param isAdmin - Whether user is admin (optional, defaults to false)
 * @returns Public URL of the uploaded image
 */
export async function uploadGiftImage(
  base64Image: string,
  userId: string,
  budgetId?: string,
  giftIndex?: number,
  subscriptionTier?: string,
  isAdmin?: boolean
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Check storage limit before upload (skips for admins)
  await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

  // Generate file path: gifts/userId/budgetId-gift-index-timestamp.png or gifts/userId/gift-timestamp.png
  const timestamp = Date.now();
  const giftIndexStr = giftIndex !== undefined ? `-gift${giftIndex}` : '';
  const key = budgetId
    ? `gifts/${userId}/${budgetId}${giftIndexStr}-${timestamp}.png`
    : `gifts/${userId}/gift${giftIndexStr}-${timestamp}.png`;

  const client = getR2Client();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
      })
    );

    // Increment storage counter after successful upload
    await incrementUserStorage(userId, buffer.length);

    return `${publicUrl}/${key}`;
  } catch (error: any) {
    console.error('Error uploading gift image to R2:', error);
    throw new Error(`Failed to upload gift image to R2: ${error.message || error}`);
  }
}

/**
 * Upload PDF to R2 storage
 * @param pdfBase64 - Base64 encoded PDF string (with or without data URL prefix)
 * @param userId - User ID
 * @param budgetId - Budget ID (optional, will be used in filename if provided)
 * @param subscriptionTier - User's subscription tier (optional, defaults to 'free')
 * @param isAdmin - Whether user is admin (optional, defaults to false)
 * @returns Public URL of the uploaded PDF
 */
export async function uploadBudgetPdf(
  pdfBase64: string,
  userId: string,
  budgetId?: string,
  subscriptionTier?: string,
  isAdmin?: boolean
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Remove data URL prefix if present
  const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Check storage limit before upload (skips for admins)
  await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

  // Generate file path: budgets/userId/budgetId-pdf-timestamp.pdf or budgets/userId/pdf-timestamp.pdf
  const timestamp = Date.now();
  const key = budgetId
    ? `budgets/${userId}/${budgetId}-pdf-${timestamp}.pdf`
    : `budgets/${userId}/pdf-${timestamp}.pdf`;

  const client = getR2Client();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      })
    );

    // Increment storage counter after successful upload
    await incrementUserStorage(userId, buffer.length);

    return `${publicUrl}/${key}`;
  } catch (error: any) {
    console.error('Error uploading PDF to R2:', error);
    throw new Error(`Failed to upload PDF to R2: ${error.message || error}`);
  }
}

/**
 * Upload custom PDF preset to R2 storage
 * @param pdfBase64 - Base64 encoded PDF string (with or without data URL prefix)
 * @param userId - User ID
 * @param presetId - Preset ID (optional, will be generated if not provided)
 * @param subscriptionTier - User's subscription tier (optional, defaults to 'free')
 * @param isAdmin - Whether user is admin (optional, defaults to false)
 * @returns Public URL of the uploaded PDF
 */
export async function uploadCustomPdfPreset(
  pdfBase64: string,
  userId: string,
  presetId?: string,
  subscriptionTier?: string,
  isAdmin?: boolean
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Remove data URL prefix if present
  const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Check storage limit before upload (skips for admins)
  await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

  // Generate file path: pdf-presets/userId/presetId-timestamp.pdf or pdf-presets/userId/preset-timestamp.pdf
  const timestamp = Date.now();
  const presetIdOrTimestamp = presetId || timestamp;
  const key = `pdf-presets/${userId}/${presetIdOrTimestamp}-${timestamp}.pdf`;

  const client = getR2Client();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      })
    );

    // Increment storage counter after successful upload
    await incrementUserStorage(userId, buffer.length);

    return `${publicUrl}/${key}`;
  } catch (error: any) {
    console.error('Error uploading PDF preset to R2:', error);
    throw new Error(`Failed to upload PDF preset to R2: ${error.message || error}`);
  }
}

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  const publicUrl = process.env.R2_PUBLIC_URL?.trim();

  const configured = !!(
    accountId &&
    accessKeyId &&
    secretAccessKey &&
    bucketName &&
    publicUrl
  );

  if (!configured) {
    console.warn('R2 not fully configured:', {
      hasAccountId: !!accountId,
      hasAccessKeyId: !!accessKeyId,
      hasSecretAccessKey: !!secretAccessKey,
      hasBucketName: !!bucketName,
      hasPublicUrl: !!publicUrl,
    });
  }

  return configured;
}

/**
 * Generate presigned URL for direct upload to R2
 * @param userId - User ID
 * @param canvasId - Canvas project ID
 * @param nodeId - Node ID (optional, will be used in filename if provided)
 * @param contentType - Content type (default: image/png)
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Object with presignedUrl and finalUrl (public URL after upload)
 */
export async function generateCanvasImageUploadUrl(
  userId: string,
  canvasId: string,
  nodeId?: string,
  contentType: string = 'image/png',
  expiresIn: number = 3600
): Promise<{ presignedUrl: string; finalUrl: string; key: string }> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Generate file path: canvas/userId/canvasId/nodeId-timestamp.{ext}
  // Determine file extension from content type
  let extension = 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    extension = 'jpg';
  } else if (contentType.includes('webp')) {
    extension = 'webp';
  } else if (contentType.includes('gif')) {
    extension = 'gif';
  }

  const timestamp = Date.now();
  const nodeIdOrImage = nodeId ? `node-${nodeId}` : 'image';
  const key = `canvas/${userId}/${canvasId}/${nodeIdOrImage}-${timestamp}.${extension}`;

  const client = getR2Client();

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn });

    return {
      presignedUrl,
      finalUrl: `${publicUrl}/${key}`,
      key,
    };
  } catch (error: any) {
    console.error('Error generating presigned URL for canvas image:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message || error}`);
  }
}

/**
 * Generate presigned URL for direct mockup image upload to R2
 * This allows large images to bypass Vercel's 4.5MB limit by uploading directly to R2
 * 
 * @param userId - User ID
 * @param contentType - Content type (default: image/png)
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Object with presignedUrl and finalUrl (public URL after upload)
 */
export async function generateMockupImageUploadUrl(
  userId: string,
  contentType: string = 'image/png',
  expiresIn: number = 3600
): Promise<{ presignedUrl: string; finalUrl: string; key: string }> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Generate file path: mockups/inputs/userId/image-timestamp.{ext}
  let extension = 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    extension = 'jpg';
  } else if (contentType.includes('webp')) {
    extension = 'webp';
  }

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const key = `mockups/inputs/${userId}/input-${timestamp}-${randomSuffix}.${extension}`;

  const client = getR2Client();

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn });

    return {
      presignedUrl,
      finalUrl: `${publicUrl}/${key}`,
      key,
    };
  } catch (error: any) {
    console.error('Error generating presigned URL for mockup image:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message || error}`);
  }
}

/**
 * Generate presigned URL for direct video upload to R2
 * This allows videos to bypass Vercel's 4.5MB limit by uploading directly to R2
 * 
 * @param userId - User ID
 * @param canvasId - Canvas project ID
 * @param nodeId - Node ID (optional, will be used in filename if provided)
 * @param contentType - Content type (default: video/mp4)
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Object with presignedUrl and finalUrl (public URL after upload)
 */
export async function generateCanvasVideoUploadUrl(
  userId: string,
  canvasId: string,
  nodeId?: string,
  contentType: string = 'video/mp4',
  expiresIn: number = 3600
): Promise<{ presignedUrl: string; finalUrl: string; key: string }> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Determine file extension from content type
  let extension = 'mp4';
  if (contentType.includes('webm')) {
    extension = 'webm';
  } else if (contentType.includes('mov')) {
    extension = 'mov';
  } else if (contentType.includes('avi')) {
    extension = 'avi';
  } else if (contentType.includes('quicktime')) {
    extension = 'mov';
  }

  const timestamp = Date.now();
  const nodeIdOrVideo = nodeId ? `video-${nodeId}` : 'video';
  const key = `canvas/${userId}/${canvasId}/${nodeIdOrVideo}-${timestamp}.${extension}`;

  const client = getR2Client();

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn });

    return {
      presignedUrl,
      finalUrl: `${publicUrl}/${key}`,
      key,
    };
  } catch (error: any) {
    console.error('Error generating presigned URL for canvas video:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message || error}`);
  }
}

/**
 * Upload canvas image to R2 storage
 * @param base64Image - Base64 encoded image string (with or without data URL prefix)
 * @param userId - User ID
 * @param canvasId - Canvas project ID
 * @param nodeId - Node ID (optional, will be used in filename if provided)
 * @param subscriptionTier - User's subscription tier (optional, defaults to 'free')
 * @param isAdmin - Whether user is admin (optional, defaults to false)
 * @returns Public URL of the uploaded image
 */
export async function uploadCanvasImage(
  base64Image: string,
  userId: string,
  canvasId: string,
  nodeId?: string,
  subscriptionTier?: string,
  isAdmin?: boolean
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Check storage limit before upload (skips for admins)
  await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

  // Generate file path: canvas/userId/canvasId/nodeId-timestamp.png or canvas/userId/canvasId/image-timestamp.png
  const timestamp = Date.now();
  const nodeIdOrImage = nodeId ? `node-${nodeId}` : 'image';
  const key = `canvas/${userId}/${canvasId}/${nodeIdOrImage}-${timestamp}.png`;

  const client = getR2Client();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
      })
    );

    // Increment storage counter after successful upload
    await incrementUserStorage(userId, buffer.length);

    return `${publicUrl}/${key}`;
  } catch (error: any) {
    console.error('Error uploading canvas image to R2:', error);
    throw new Error(`Failed to upload canvas image to R2: ${error.message || error}`);
  }
}

/**
 * Upload cover image to R2 storage
 * @param base64Image - Base64 encoded image string (with or without data URL prefix)
 * @param userId - User ID
 * @param subscriptionTier - User's subscription tier (optional, defaults to 'free')
 * @param isAdmin - Whether user is admin (optional, defaults to false)
 * @returns Public URL of the uploaded image
 */
export async function uploadCoverImage(
  base64Image: string,
  userId: string,
  subscriptionTier?: string,
  isAdmin?: boolean
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Check storage limit before upload (skips for admins)
  await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

  // Generate file path: users/userId/cover-timestamp.png
  const timestamp = Date.now();
  const key = `users/${userId}/cover-${timestamp}.png`;

  const client = getR2Client();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
      })
    );

    // Increment storage counter after successful upload
    await incrementUserStorage(userId, buffer.length);

    return `${publicUrl}/${key}`;
  } catch (error: any) {
    console.error('Error uploading cover image to R2:', error);
    throw new Error(`Failed to upload cover image to R2: ${error.message || error}`);
  }
}

/**
 * Upload mockup preset reference image to R2 storage
 * @param base64Image - Base64 encoded image string (with or without data URL prefix)
 * @param presetId - Preset ID (e.g., 'cap', 'sp', 'device')
 * @returns Public URL of the uploaded image
 */
export async function uploadMockupPresetReference(
  base64Image: string,
  presetId: string
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Generate file path: mockup-presets/{presetId}/reference.png
  const key = `mockup-presets/${presetId}/reference.png`;

  const client = getR2Client();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'image/png',
      })
    );

    return `${publicUrl}/${key}`;
  } catch (error: any) {
    console.error('Error uploading mockup preset reference to R2:', error);
    throw new Error(`Failed to upload mockup preset reference to R2: ${error.message || error}`);
  }
}

/**
 * Upload canvas PDF to R2 storage
 * @param pdfBase64 - Base64 encoded PDF string (with or without data URL prefix)
 * @param userId - User ID
 * @param canvasId - Canvas project ID
 * @param nodeId - Node ID (optional, will be used in filename if provided)
 * @param subscriptionTier - User's subscription tier (optional, defaults to 'free')
 * @param isAdmin - Whether user is admin (optional, defaults to false)
 * @returns Public URL of the uploaded PDF
 */
export async function uploadCanvasPdf(
  pdfBase64: string,
  userId: string,
  canvasId: string,
  nodeId?: string,
  subscriptionTier?: string,
  isAdmin?: boolean
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Remove data URL prefix if present
  const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Check storage limit before upload (skips for admins)
  await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

  // Generate file path: canvas/userId/canvasId/pdf-nodeId-timestamp.pdf or canvas/userId/canvasId/pdf-timestamp.pdf
  const timestamp = Date.now();
  const nodeIdOrPdf = nodeId ? `pdf-${nodeId}` : 'pdf';
  const key = `canvas/${userId}/${canvasId}/${nodeIdOrPdf}-${timestamp}.pdf`;

  const client = getR2Client();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      })
    );

    // Increment storage counter after successful upload
    await incrementUserStorage(userId, buffer.length);

    return `${publicUrl}/${key}`;
  } catch (error: any) {
    console.error('Error uploading canvas PDF to R2:', error);
    throw new Error(`Failed to upload canvas PDF to R2: ${error.message || error}`);
  }
}

/**
 * Upload canvas video to R2 storage
 * 
 * IMPORTANT: This function uploads videos WITHOUT ANY COMPRESSION.
 * Videos are stored with their original quality preserved for designers.
 * 
 * @param videoBase64 - Base64 encoded video string (with or without data URL prefix)
 * @param userId - User ID
 * @param canvasId - Canvas project ID
 * @param nodeId - Optional node ID
 * @param subscriptionTier - User's subscription tier (optional, defaults to 'free')
 * @param isAdmin - Whether user is admin (optional, defaults to false)
 * @returns Public URL of uploaded video
 */
export async function uploadCanvasVideo(
  videoBase64: string,
  userId: string,
  canvasId: string,
  nodeId?: string,
  subscriptionTier?: string,
  isAdmin?: boolean
): Promise<string> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl) {
    throw new Error('R2_PUBLIC_URL environment variable is not set.');
  }

  // Remove data URL prefix if present (supports various video formats)
  // NO COMPRESSION - preserving original video quality
  const base64Data = videoBase64.replace(/^data:video\/\w+;base64,/, '');

  // Convert base64 to buffer - direct conversion, no quality loss
  const buffer = Buffer.from(base64Data, 'base64');

  // Check storage limit before upload (skips for admins)
  await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

  // Determine video format from original base64 or default to mp4
  let videoFormat = 'mp4';
  if (videoBase64.includes('data:video/')) {
    const match = videoBase64.match(/data:video\/(\w+);base64/);
    if (match && match[1]) {
      videoFormat = match[1];
    }
  }

  // Generate file path: canvas/userId/canvasId/video-nodeId-timestamp.mp4
  const timestamp = Date.now();
  const nodeIdOrVideo = nodeId ? `video-${nodeId}` : 'video';
  const key = `canvas/${userId}/${canvasId}/${nodeIdOrVideo}-${timestamp}.${videoFormat}`;

  const client = getR2Client();

  console.log('[R2 UPLOAD] Starting canvas video upload to R2', {
    userId,
    canvasId,
    nodeId: nodeId || 'not provided',
    key,
    videoFormat,
    sizeKB: Math.round(buffer.length / 1024),
    sizeMB: (buffer.length / 1024 / 1024).toFixed(2),
  });

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: `video/${videoFormat}`,
      })
    );

    // Increment storage counter after successful upload
    await incrementUserStorage(userId, buffer.length);

    const finalUrl = `${publicUrl}/${key}`;
    console.log('[R2 UPLOAD] ✅ Canvas video uploaded to R2 successfully', {
      userId,
      canvasId,
      nodeId: nodeId || 'not provided',
      key,
      finalUrl,
      sizeKB: Math.round(buffer.length / 1024),
    });

    return finalUrl;
  } catch (error: any) {
    console.error('[R2 UPLOAD] ❌ Error uploading canvas video to R2:', {
      userId,
      canvasId,
      nodeId: nodeId || 'not provided',
      key,
      error: error.message,
      errorCode: error.Code || error.code,
    });
    throw new Error(`Failed to upload canvas video to R2: ${error.message || error}`);
  }
}

// Storage limits constants (in bytes)
const STORAGE_LIMIT_FREE = 100 * 1024 * 1024; // 100 MB
const STORAGE_LIMIT_PREMIUM = 1024 * 1024 * 1024; // 1 GB
const STORAGE_LIMIT_ADMIN = Number.MAX_SAFE_INTEGER; // No limit for admins

/**
 * Custom error for storage limit exceeded
 */
export class StorageLimitExceededError extends Error {
  constructor(
    public used: number,
    public limit: number,
    public fileSize: number
  ) {
    const usedMB = (used / 1024 / 1024).toFixed(2);
    const limitMB = (limit / 1024 / 1024).toFixed(2);
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
    const limitGB = (limit / 1024 / 1024 / 1024).toFixed(2);

    const message = limit >= 1024 * 1024 * 1024
      ? `Storage limit exceeded. You are using ${usedMB} MB of ${limitGB} GB. This file (${fileSizeMB} MB) would exceed your limit.`
      : `Storage limit exceeded. You are using ${usedMB} MB of ${limitMB} MB. This file (${fileSizeMB} MB) would exceed your limit.`;

    super(message);
    this.name = 'StorageLimitExceededError';
  }
}

/**
 * Get storage limit for a user based on subscription tier
 * @param subscriptionTier - User's subscription tier ('free', 'premium', etc.)
 * @param isAdmin - Whether user is admin
 * @param customLimitBytes - Custom storage limit in bytes from database (optional, overrides tier-based limit)
 * @returns Storage limit in bytes
 */
export function getUserStorageLimit(
  subscriptionTier?: string,
  isAdmin?: boolean,
  customLimitBytes?: number | null
): number {
  // Custom limit takes precedence
  if (customLimitBytes !== undefined && customLimitBytes !== null) {
    return customLimitBytes;
  }

  if (isAdmin) {
    return STORAGE_LIMIT_ADMIN;
  }

  const tier = subscriptionTier?.toLowerCase() || 'free';

  // Premium or active subscription gets 1GB
  if (tier === 'premium' || tier === 'active') {
    return STORAGE_LIMIT_PREMIUM;
  }

  // Free tier gets 100MB
  return STORAGE_LIMIT_FREE;
}

/**
 * Get current storage used by a user from database
 * @param userId - User ID
 * @returns Total storage used in bytes
 */
export async function getUserStorageUsed(userId: string): Promise<number> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { storageUsedBytes: true },
    });
    return user?.storageUsedBytes || 0;
  } catch (error: any) {
    console.error('Error getting user storage from database:', error);
    throw new Error(`Failed to get user storage: ${error.message || error}`);
  }
}

/**
 * Increment user storage counter in database
 * @param userId - User ID
 * @param bytes - Bytes to add
 */
export async function incrementUserStorage(userId: string, bytes: number): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        storageUsedBytes: {
          increment: bytes,
        },
      },
    });
  } catch (error: any) {
    console.error('Error incrementing user storage:', error);
    // Don't throw - storage counter is not critical for upload to fail
    // We'll sync from R2 if needed
  }
}

/**
 * Decrement user storage counter in database
 * @param userId - User ID
 * @param bytes - Bytes to subtract
 */
export async function decrementUserStorage(userId: string, bytes: number): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        storageUsedBytes: {
          decrement: bytes,
        },
      },
    });
  } catch (error: any) {
    console.error('Error decrementing user storage:', error);
    // Don't throw - storage counter is not critical for delete to fail
    // We'll sync from R2 if needed
  }
}

/**
 * Sync user storage counter with actual R2 usage
 * Calculates real storage from R2 and updates the database counter
 * @param userId - User ID
 * @returns The actual storage used in bytes (from R2)
 */
export async function syncUserStorage(userId: string): Promise<number> {
  try {
    const actualStorage = await calculateUserStorage(userId);

    await prisma.user.update({
      where: { id: userId },
      data: {
        storageUsedBytes: actualStorage,
      },
    });

    console.log(`[Storage Sync] Synced storage for user ${userId}: ${actualStorage} bytes`);
    return actualStorage;
  } catch (error: any) {
    console.error('Error syncing user storage:', error);
    throw new Error(`Failed to sync user storage: ${error.message || error}`);
  }
}

/**
 * Calculate total storage used by a user in R2
 * Lists all objects with user prefixes and sums their sizes
 * 
 * NOTE: This is an expensive operation. Use getUserStorageUsed() for normal checks.
 * This function should only be used for:
 * - Initial sync when migrating to storage counter
 * - Periodic sync jobs to fix discrepancies
 * - Admin tools
 * 
 * @param userId - User ID
 * @returns Total storage used in bytes
 */
export async function calculateUserStorage(userId: string): Promise<number> {
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME environment variable is not set.');
  }

  const client = getR2Client();
  let totalSize = 0;

  // Prefixes where user files are stored
  const userPrefixes = [
    `${userId}/`, // Mockups
    `canvas/${userId}/`, // Canvas projects
    `profiles/${userId}/`, // Profile pictures
    `budgets/${userId}/`, // Budget PDFs
    `brands/${userId}/`, // Brand logos
    `gifts/${userId}/`, // Gift images
    `users/${userId}/`, // Cover images
    `pdf-presets/${userId}/`, // PDF presets
  ];

  try {
    // List objects for each prefix
    for (const prefix of userPrefixes) {
      let continuationToken: string | undefined;

      do {
        const command = new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });

        const response = await client.send(command);

        if (response.Contents) {
          for (const object of response.Contents) {
            if (object.Size !== undefined) {
              totalSize += object.Size;
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);
    }

    return totalSize;
  } catch (error: any) {
    console.error('Error calculating user storage:', error);
    throw new Error(`Failed to calculate user storage: ${error.message || error}`);
  }
}

/**
 * Check if user can upload a file of given size
 * @param userId - User ID
 * @param fileSizeBytes - Size of file to upload in bytes
 * @param subscriptionTier - User's subscription tier
 * @param isAdmin - Whether user is admin
 * @param customLimitBytes - Custom storage limit in bytes from database (optional)
 * @returns Object with check result and storage info
 */
export async function checkStorageLimit(
  userId: string,
  fileSizeBytes: number,
  subscriptionTier?: string,
  isAdmin?: boolean,
  customLimitBytes?: number | null
): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  wouldExceedBy?: number;
}> {
  // If customLimitBytes not provided, try to get from database
  let actualCustomLimitBytes = customLimitBytes;
  if (actualCustomLimitBytes === undefined && userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { storageLimitBytes: true, subscriptionTier: true, isAdmin: true },
      });
      if (user) {
        actualCustomLimitBytes = user.storageLimitBytes;
        // Also update subscriptionTier and isAdmin if not provided
        if (!subscriptionTier) {
          subscriptionTier = user.subscriptionTier || 'free';
        }
        if (isAdmin === undefined) {
          isAdmin = user.isAdmin || false;
        }
      }
    } catch (error: any) {
      // If we can't fetch from DB, continue with provided values
      console.warn('Could not fetch user storage limit from database:', error.message);
    }
  }

  const limit = getUserStorageLimit(subscriptionTier, isAdmin, actualCustomLimitBytes);
  // Use database counter instead of expensive R2 query
  const used = await getUserStorageUsed(userId);
  const remaining = Math.max(0, limit - used);
  const wouldExceedBy = used + fileSizeBytes - limit;
  const allowed = used + fileSizeBytes <= limit;

  return {
    allowed,
    used,
    limit,
    remaining,
    wouldExceedBy: allowed ? undefined : wouldExceedBy,
  };
}

