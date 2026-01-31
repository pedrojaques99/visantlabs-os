import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../db/prisma.js';
import { getErrorMessage } from '../utils/securityValidation.js';

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

    return new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        forcePathStyle: true,
    });
};

/**
 * Helper function to check storage limit with optimizations
 */
async function checkStorageLimitIfNeeded(
    userId: string,
    fileSizeBytes: number,
    subscriptionTier?: string,
    isAdmin?: boolean,
    customLimitBytes?: number | null
): Promise<void> {
    if (isAdmin === true) return;

    const storageCheck = await checkStorageLimit(userId, fileSizeBytes, subscriptionTier, isAdmin, customLimitBytes);
    if (!storageCheck.allowed) {
        throw new StorageLimitExceededError(storageCheck.used, storageCheck.limit, fileSizeBytes);
    }
}

/**
 * Upload image to R2 storage
 */
export async function uploadImage(
    base64Image: string,
    userId: string,
    mockupId?: string,
    subscriptionTier?: string,
    isAdmin?: boolean
): Promise<string> {
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName || !publicUrl) throw new Error('R2 configuration missing.');

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

    const timestamp = Date.now();
    const key = `${userId}/${mockupId || timestamp}-${timestamp}.png`;

    const client = getR2Client();

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: 'image/png',
        }));

        await incrementUserStorage(userId, buffer.length);
        return `${publicUrl}/${key}`;
    } catch (error: unknown) {
        throw new Error(`Failed to upload image to R2: ${getErrorMessage(error)}`);
    }
}

/**
 * Delete image from R2 storage
 */
export async function deleteImage(imageUrl: string): Promise<void> {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) throw new Error('R2_BUCKET_NAME not set.');

    const url = new URL(imageUrl);
    const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;

    const client = getR2Client();

    try {
        let fileSize = 0;
        try {
            const headResponse = await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
            fileSize = headResponse.ContentLength || 0;
        } catch (e) { }

        await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));

        if (fileSize > 0) {
            const keyParts = key.split('/');
            let userId = keyParts[0];
            const prefixes = ['canvas', 'profiles', 'budgets', 'brands', 'gifts', 'users', 'pdf-presets'];
            if (prefixes.includes(keyParts[0]) && keyParts.length > 1) {
                userId = keyParts[1];
            }
            await decrementUserStorage(userId, fileSize);
        }
    } catch (error: unknown) {
        throw new Error(`Failed to delete image from R2: ${getErrorMessage(error)}`);
    }
}

/**
 * Upload profile picture to R2 storage
 */
export async function uploadProfilePicture(
    base64Image: string,
    userId: string,
    subscriptionTier?: string,
    isAdmin?: boolean
): Promise<string> {
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName || !publicUrl) throw new Error('R2 configuration missing.');

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

    const timestamp = Date.now();
    const key = `profiles/${userId}/profile-${timestamp}.png`;

    const client = getR2Client();

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: 'image/png',
        }));

        await incrementUserStorage(userId, buffer.length);
        return `${publicUrl}/${key}`;
    } catch (error: unknown) {
        throw new Error(`Failed to upload profile picture to R2: ${getErrorMessage(error)}`);
    }
}

/**
 * Upload brand logo to R2 storage
 */
export async function uploadBrandLogo(
    base64Image: string,
    userId: string,
    budgetId?: string,
    subscriptionTier?: string,
    isAdmin?: boolean
): Promise<string> {
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName || !publicUrl) throw new Error('R2 configuration missing.');

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

    const timestamp = Date.now();
    const key = budgetId
        ? `brands/${userId}/${budgetId}-logo-${timestamp}.png`
        : `brands/${userId}/logo-${timestamp}.png`;

    const client = getR2Client();

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: 'image/png',
        }));

        await incrementUserStorage(userId, buffer.length);
        return `${publicUrl}/${key}`;
    } catch (error: unknown) {
        throw new Error(`Failed to upload brand logo to R2: ${getErrorMessage(error)}`);
    }
}

/**
 * Upload gift image to R2 storage
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
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName || !publicUrl) throw new Error('R2 configuration missing.');

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

    const timestamp = Date.now();
    const giftIndexStr = giftIndex !== undefined ? `-gift${giftIndex}` : '';
    const key = budgetId
        ? `gifts/${userId}/${budgetId}${giftIndexStr}-${timestamp}.png`
        : `gifts/${userId}/gift${giftIndexStr}-${timestamp}.png`;

    const client = getR2Client();

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: 'image/png',
        }));

        await incrementUserStorage(userId, buffer.length);
        return `${publicUrl}/${key}`;
    } catch (error: unknown) {
        throw new Error(`Failed to upload gift image to R2: ${getErrorMessage(error)}`);
    }
}

/**
 * Upload PDF to R2 storage
 */
export async function uploadBudgetPdf(
    pdfBase64: string,
    userId: string,
    budgetId?: string,
    subscriptionTier?: string,
    isAdmin?: boolean
): Promise<string> {
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName || !publicUrl) throw new Error('R2 configuration missing.');

    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

    const timestamp = Date.now();
    const key = budgetId
        ? `budgets/${userId}/${budgetId}-pdf-${timestamp}.pdf`
        : `budgets/${userId}/pdf-${timestamp}.pdf`;

    const client = getR2Client();

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: 'application/pdf',
        }));

        await incrementUserStorage(userId, buffer.length);
        return `${publicUrl}/${key}`;
    } catch (error: unknown) {
        throw new Error(`Failed to upload PDF to R2: ${getErrorMessage(error)}`);
    }
}

/**
 * Upload custom PDF preset to R2 storage
 */
export async function uploadCustomPdfPreset(
    pdfBase64: string,
    userId: string,
    presetId?: string,
    subscriptionTier?: string,
    isAdmin?: boolean
): Promise<string> {
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName || !publicUrl) throw new Error('R2 configuration missing.');

    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

    const timestamp = Date.now();
    const presetIdOrTimestamp = presetId || timestamp;
    const key = `pdf-presets/${userId}/${presetIdOrTimestamp}-${timestamp}.pdf`;

    const client = getR2Client();

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: 'application/pdf',
        }));

        await incrementUserStorage(userId, buffer.length);
        return `${publicUrl}/${key}`;
    } catch (error: unknown) {
        throw new Error(`Failed to upload PDF preset to R2: ${getErrorMessage(error)}`);
    }
}

/**
 * Upload canvas image to R2 storage
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
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName || !publicUrl) throw new Error('R2 configuration missing.');

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

    const timestamp = Date.now();
    const nodeIdOrImage = nodeId ? `node-${nodeId}` : 'image';
    const key = `canvas/${userId}/${canvasId}/${nodeIdOrImage}-${timestamp}.png`;

    const client = getR2Client();

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: 'image/png',
        }));

        await incrementUserStorage(userId, buffer.length);
        return `${publicUrl}/${key}`;
    } catch (error: unknown) {
        throw new Error(`Failed to upload canvas image to R2: ${getErrorMessage(error)}`);
    }
}

/**
 * Upload canvas PDF to R2 storage
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
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName || !publicUrl) throw new Error('R2 configuration missing.');

    // Remove data URL prefix if present
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

    const timestamp = Date.now();
    const nodeIdOrPdf = nodeId ? `pdf-${nodeId}` : 'pdf';
    const key = `canvas/${userId}/${canvasId}/${nodeIdOrPdf}-${timestamp}.pdf`;

    const client = getR2Client();

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: 'application/pdf',
        }));

        await incrementUserStorage(userId, buffer.length);
        return `${publicUrl}/${key}`;
    } catch (error: unknown) {
        throw new Error(`Failed to upload canvas PDF to R2: ${getErrorMessage(error)}`);
    }
}

/**
 * Upload cover image to R2 storage
 */
export async function uploadCoverImage(
    base64Image: string,
    userId: string,
    subscriptionTier?: string,
    isAdmin?: boolean
): Promise<string> {
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName || !publicUrl) throw new Error('R2 configuration missing.');

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

    const timestamp = Date.now();
    const key = `users/${userId}/cover-${timestamp}.png`;

    const client = getR2Client();

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: 'image/png',
        }));

        await incrementUserStorage(userId, buffer.length);
        return `${publicUrl}/${key}`;
    } catch (error: unknown) {
        throw new Error(`Failed to upload cover image to R2: ${getErrorMessage(error)}`);
    }
}

/**
 * Upload canvas video to R2 storage
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
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName || !publicUrl) throw new Error('R2 configuration missing.');

    const base64Data = videoBase64.replace(/^data:video\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    await checkStorageLimitIfNeeded(userId, buffer.length, subscriptionTier, isAdmin);

    let videoFormat = 'mp4';
    if (videoBase64.includes('data:video/')) {
        const match = videoBase64.match(/data:video\/(\w+);base64/);
        if (match && match[1]) {
            videoFormat = match[1];
        }
    }

    const timestamp = Date.now();
    const nodeIdOrVideo = nodeId ? `video-${nodeId}` : 'video';
    const key = `canvas/${userId}/${canvasId}/${nodeIdOrVideo}-${timestamp}.${videoFormat}`;

    const client = getR2Client();

    try {
        await client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: `video/${videoFormat}`,
        }));

        await incrementUserStorage(userId, buffer.length);
        return `${publicUrl}/${key}`;
    } catch (error: unknown) {
        throw new Error(`Failed to upload canvas video to R2: ${getErrorMessage(error)}`);
    }
}

/**
 * Generate presigned URL for canvas image upload
 */
export async function generateCanvasImageUploadUrl(
    userId: string,
    canvasId: string,
    nodeId?: string,
    contentType: string = 'image/png',
    expiresIn: number = 3600
): Promise<{ presignedUrl: string; finalUrl: string; key: string }> {
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName || !publicUrl) throw new Error('R2 configuration missing.');

    const ct = typeof contentType === 'string' ? contentType : 'image/png';
    const exp = (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) ? Math.min(Math.floor(expiresIn), 86400) : 3600;

    let extension = 'png';
    if (ct.includes('jpeg') || ct.includes('jpg')) {
        extension = 'jpg';
    } else if (ct.includes('webp')) {
        extension = 'webp';
    } else if (ct.includes('gif')) {
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
            ContentType: ct,
        });

        const presignedUrl = await getSignedUrl(client, command, { expiresIn: exp });

        return {
            presignedUrl,
            finalUrl: `${publicUrl}/${key}`,
            key,
        };
    } catch (error: unknown) {
        throw new Error(`Failed to generate presigned URL: ${getErrorMessage(error)}`);
    }
}

/**
 * Generate presigned URL for mockup image upload
 */
export async function generateMockupImageUploadUrl(
    userId: string,
    contentType: string = 'image/png',
    expiresIn: number = 3600
): Promise<{ presignedUrl: string; finalUrl: string; key: string }> {
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName || !publicUrl) throw new Error('R2 configuration missing.');

    const ct = typeof contentType === 'string' ? contentType : 'image/png';
    const exp = (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) ? Math.min(Math.floor(expiresIn), 86400) : 3600;

    let extension = 'png';
    if (ct.includes('jpeg') || ct.includes('jpg')) {
        extension = 'jpg';
    } else if (ct.includes('webp')) {
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
            ContentType: ct,
        });

        const presignedUrl = await getSignedUrl(client, command, { expiresIn: exp });

        return {
            presignedUrl,
            finalUrl: `${publicUrl}/${key}`,
            key,
        };
    } catch (error: unknown) {
        throw new Error(`Failed to generate presigned URL: ${getErrorMessage(error)}`);
    }
}

/**
 * Generate presigned URL for canvas video upload
 */
export async function generateCanvasVideoUploadUrl(
    userId: string,
    canvasId: string,
    nodeId?: string,
    contentType: string = 'video/mp4',
    expiresIn: number = 3600
): Promise<{ presignedUrl: string; finalUrl: string; key: string }> {
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucketName || !publicUrl) throw new Error('R2 configuration missing.');

    const ct = typeof contentType === 'string' ? contentType : 'video/mp4';
    const exp = (typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0) ? Math.min(Math.floor(expiresIn), 86400) : 3600;

    let extension = 'mp4';
    if (ct.includes('webm')) {
        extension = 'webm';
    } else if (ct.includes('mov')) {
        extension = 'mov';
    } else if (ct.includes('avi')) {
        extension = 'avi';
    } else if (ct.includes('quicktime')) {
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
            ContentType: ct,
        });

        const presignedUrl = await getSignedUrl(client, command, { expiresIn: exp });

        return {
            presignedUrl,
            finalUrl: `${publicUrl}/${key}`,
            key,
        };
    } catch (error: unknown) {
        throw new Error(`Failed to generate presigned URL: ${getErrorMessage(error)}`);
    }
}

// Storage limits constants (in bytes)
const STORAGE_LIMIT_FREE = 100 * 1024 * 1024; // 100 MB
const STORAGE_LIMIT_PREMIUM = 1024 * 1024 * 1024; // 1 GB
const STORAGE_LIMIT_ADMIN = Number.MAX_SAFE_INTEGER;

export class StorageLimitExceededError extends Error {
    constructor(public used: number, public limit: number, public fileSize: number) {
        super(`Storage limit exceeded.`);
        this.name = 'StorageLimitExceededError';
    }
}

export function getUserStorageLimit(subscriptionTier?: string, isAdmin?: boolean, customLimitBytes?: number | null): number {
    if (typeof customLimitBytes === 'number' && Number.isFinite(customLimitBytes) && customLimitBytes >= 0) return customLimitBytes;
    if (isAdmin === true) return STORAGE_LIMIT_ADMIN;
    const tier = typeof subscriptionTier === 'string' ? subscriptionTier.toLowerCase() : 'free';
    return (tier === 'premium' || tier === 'active') ? STORAGE_LIMIT_PREMIUM : STORAGE_LIMIT_FREE;
}

export async function getUserStorageUsed(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { storageUsedBytes: true } });
    return user?.storageUsedBytes || 0;
}

export async function incrementUserStorage(userId: string, bytes: number): Promise<void> {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) throw new Error('Invalid bytes');
    try {
        await prisma.user.update({ where: { id: userId }, data: { storageUsedBytes: { increment: bytes } } });
    } catch (e) { }
}

export async function decrementUserStorage(userId: string, bytes: number): Promise<void> {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) throw new Error('Invalid bytes');
    try {
        await prisma.user.update({ where: { id: userId }, data: { storageUsedBytes: { decrement: bytes } } });
    } catch (e) { }
}

export async function checkStorageLimit(userId: string, fileSizeBytes: number, subscriptionTier?: string, isAdmin?: boolean, customLimitBytes?: number | null) {
    if (typeof fileSizeBytes !== 'number' || !Number.isFinite(fileSizeBytes) || fileSizeBytes < 0) throw new Error('Invalid file size');
    const limit = getUserStorageLimit(subscriptionTier, isAdmin, customLimitBytes);
    const used = await getUserStorageUsed(userId);
    const allowed = used + fileSizeBytes <= limit;
    return { allowed, used, limit, remaining: Math.max(0, limit - used) };
}

/**
 * Sync user storage counter with actual R2 usage
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
    } catch (error: unknown) {
        console.error('Error syncing user storage:', error);
        throw new Error(`Failed to sync user storage: ${getErrorMessage(error)}`);
    }
}

/**
 * Calculate total storage used by a user in R2
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
        `mockups/inputs/${userId}/`, // Mockup inputs
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
                        const size = object.Size;
                        if (typeof size === 'number' && Number.isFinite(size) && size >= 0) totalSize += size;
                    }
                }

                continuationToken = response.NextContinuationToken;
            } while (continuationToken);
        }

        return totalSize;
    } catch (error: unknown) {
        console.error('Error calculating user storage:', error);
        throw new Error(`Failed to calculate user storage: ${getErrorMessage(error)}`);
    }
}

export function isR2Configured(): boolean {
    return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME);
}
