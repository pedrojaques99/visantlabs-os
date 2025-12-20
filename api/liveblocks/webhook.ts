// Dedicated Liveblocks webhook handler for Vercel
// This file is automatically detected by Vercel for /api/liveblocks/webhook routes
import dotenv from 'dotenv';
import { connectToMongoDB, getDb } from '../../server/db/mongodb.js';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

const isDev = process.env.NODE_ENV !== 'production';
const LIVEBLOCKS_WEBHOOK_SECRET = process.env.LIVEBLOCKS_WEBHOOK_SECRET || '';

// Liveblocks webhook event types
interface LiveblocksWebhookEvent {
  type: string;
  roomId: string;
  timestamp: number;
  userId?: string;
  data?: {
    [key: string]: any;
  };
}

// Verify webhook signature (Liveblocks uses HMAC SHA256)
const verifyWebhookSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  if (!secret) {
    if (isDev) console.warn('⚠️ LIVEBLOCKS_WEBHOOK_SECRET not configured - skipping signature verification');
    return true; // Allow if secret not configured
  }

  try {
    // Liveblocks uses HMAC SHA256
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Liveblocks signature format: sha256=signature or just signature
    const receivedSignature = signature.startsWith('sha256=')
      ? signature.substring(7)
      : signature;

    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );
  } catch (error: any) {
    console.error('❌ Error verifying webhook signature:', error.message);
    return false;
  }
};

// Process webhook event
const processWebhookEvent = async (event: LiveblocksWebhookEvent): Promise<void> => {
  try {
    await connectToMongoDB();
    const db = getDb();

    if (isDev) console.log('🔵 Processing Liveblocks webhook event:', {
      type: event.type,
      roomId: event.roomId,
      userId: event.userId,
      timestamp: event.timestamp,
    });

    // Extract canvas project ID from roomId (format: canvas-{projectId})
    const projectId = event.roomId.startsWith('canvas-')
      ? event.roomId.replace('canvas-', '')
      : null;

    // Log webhook events to database for tracking
    try {
      await db.collection('liveblocks_events').insertOne({
        eventType: event.type,
        roomId: event.roomId,
        projectId,
        userId: event.userId,
        timestamp: new Date(event.timestamp),
        receivedAt: new Date(),
        data: event.data || {},
      });
      if (isDev) console.log('✅ Liveblocks event logged to database');
    } catch (dbError: any) {
      console.error('❌ Error logging Liveblocks event:', dbError.message);
      // Don't fail the webhook if logging fails
    }

    // Handle specific event types
    switch (event.type) {
      case 'roomCreated':
        if (isDev) console.log('✅ Room created:', event.roomId);
        // Could update project status or send notifications
        break;

      case 'roomDeleted':
        if (isDev) console.log('✅ Room deleted:', event.roomId);
        // Could clean up related data
        break;

      case 'userEntered':
        if (isDev) console.log('👤 User entered room:', { roomId: event.roomId, userId: event.userId });
        // Could update presence or send notifications
        break;

      case 'userLeft':
        if (isDev) console.log('👋 User left room:', { roomId: event.roomId, userId: event.userId });
        // Could update presence
        break;

      case 'storageUpdated':
        if (isDev) console.log('💾 Storage updated:', event.roomId);
        // Could trigger sync or backup operations
        break;

      case 'ydocUpdated':
        if (isDev) console.log('📄 YDoc updated:', event.roomId);
        // Could trigger sync operations
        break;

      case 'commentCreated':
        if (isDev) console.log('💬 Comment created:', { roomId: event.roomId, userId: event.userId });
        // Could send notifications to other users
        break;

      case 'commentEdited':
        if (isDev) console.log('✏️ Comment edited:', { roomId: event.roomId, userId: event.userId });
        break;

      case 'commentDeleted':
        if (isDev) console.log('🗑️ Comment deleted:', { roomId: event.roomId, userId: event.userId });
        break;

      case 'commentReactionAdded':
        if (isDev) console.log('👍 Comment reaction added:', { roomId: event.roomId, userId: event.userId });
        break;

      case 'commentReactionRemoved':
        if (isDev) console.log('👎 Comment reaction removed:', { roomId: event.roomId, userId: event.userId });
        break;

      case 'threadCreated':
        if (isDev) console.log('🧵 Thread created:', { roomId: event.roomId, userId: event.userId });
        break;

      case 'threadDeleted':
        if (isDev) console.log('🗑️ Thread deleted:', { roomId: event.roomId, userId: event.userId });
        break;

      case 'threadMarkedAsResolved':
        if (isDev) console.log('✅ Thread marked as resolved:', { roomId: event.roomId, userId: event.userId });
        break;

      case 'threadMarkedAsUnresolved':
        if (isDev) console.log('❌ Thread marked as unresolved:', { roomId: event.roomId, userId: event.userId });
        break;

      case 'threadMetadataUpdated':
        if (isDev) console.log('📝 Thread metadata updated:', { roomId: event.roomId, userId: event.userId });
        break;

      case 'notification':
        if (isDev) console.log('🔔 Notification event:', { roomId: event.roomId, userId: event.userId });
        // Could process notification data
        break;

      default:
        if (isDev) console.log('ℹ️ Unhandled event type:', event.type);
    }
  } catch (error: any) {
    console.error('❌ Error processing webhook event:', error);
    throw error;
  }
};

// Vercel serverless function handler
export default async (req: any, res: any) => {
  if (isDev) console.log('🔵 Liveblocks webhook endpoint hit:', {
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'x-liveblocks-signature': req.headers['x-liveblocks-signature'] ? 'present' : 'missing',
    },
  });

  // Only allow POST requests
  if (req.method !== 'POST') {
    if (isDev) console.log('⚠️ Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Read raw body for signature verification
  let bodyBuffer: Buffer;
  let bodyString: string;

  try {
    // Read body from stream
    if (Buffer.isBuffer(req.body)) {
      bodyBuffer = req.body;
      bodyString = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
      bodyString = req.body;
      bodyBuffer = Buffer.from(req.body, 'utf8');
    } else {
      // Read from stream
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Stream read timeout'));
        }, 10000);

        if (req.readableEnded || !req.readable) {
          clearTimeout(timeout);
          return reject(new Error('Stream already ended'));
        }

        req.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        req.on('end', () => {
          clearTimeout(timeout);
          resolve();
        });

        req.on('error', (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      bodyBuffer = Buffer.concat(chunks);
      bodyString = bodyBuffer.toString('utf8');
    }

    if (!bodyBuffer || bodyBuffer.length === 0) {
      console.error('❌ Webhook body is empty');
      return res.status(400).json({ error: 'Webhook Error: Empty body' });
    }
  } catch (error: any) {
    console.error('❌ Error reading webhook body:', error.message);
    return res.status(400).json({
      error: `Webhook Error: Failed to read request body - ${error.message}`,
    });
  }

  // Verify webhook signature if secret is configured
  const signature = req.headers['x-liveblocks-signature'] || req.headers['liveblocks-signature'];
  if (LIVEBLOCKS_WEBHOOK_SECRET && signature) {
    const isValid = verifyWebhookSignature(
      bodyString,
      signature as string,
      LIVEBLOCKS_WEBHOOK_SECRET
    );

    if (!isValid) {
      console.error('❌ Webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    if (isDev) console.log('✅ Webhook signature verified');
  } else {
    if (isDev) console.warn('⚠️ Webhook signature verification skipped (no secret or signature header)');
  }

  // Parse webhook event
  let event: LiveblocksWebhookEvent;
  try {
    event = JSON.parse(bodyString);
  } catch (parseError: any) {
    console.error('❌ Error parsing webhook body:', parseError.message);
    return res.status(400).json({ error: 'Invalid JSON in webhook body' });
  }

  // Validate required fields
  if (!event.type || !event.roomId) {
    console.error('❌ Invalid webhook event: missing required fields');
    return res.status(400).json({ error: 'Invalid webhook event: missing required fields' });
  }

  // Process the event
  try {
    await processWebhookEvent(event);
    if (isDev) console.log('✅ Webhook event processed successfully');
  } catch (error: any) {
    console.error('❌ Error processing webhook event:', error);
    // Still return 200 to acknowledge receipt, but log the error
  }

  // Return 200 OK after processing
  return res.status(200).json({ received: true, eventType: event.type });
};















