// Dedicated Resend webhook handler for Vercel
// This file is automatically detected by Vercel for /api/resend/webhook routes
import dotenv from 'dotenv';
import { connectToMongoDB, getDb } from '../../server/db/mongodb.js';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

const isDev = process.env.NODE_ENV !== 'production';
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || '';

// Resend webhook event types
interface ResendWebhookEvent {
    type: string;
    created_at: string;
    data: {
        email_id?: string;
        from?: string;
        to?: string[];
        subject?: string;
        created_at?: string;
        [key: string]: any;
    };
}

// Verify webhook signature (Resend uses Svix for webhooks)
const verifyWebhookSignature = (
    payload: string,
    signature: string,
    secret: string
): boolean => {
    if (!secret) {
        if (isDev) console.warn('⚠️ RESEND_WEBHOOK_SECRET not configured - skipping signature verification');
        return true; // Allow if secret not configured
    }

    try {
        // Resend/Svix uses HMAC SHA256
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');

        // Svix signatures are in format: v1,timestamp,signature
        // Extract the signature part if needed
        const signatureParts = signature.split(',');
        const receivedSignature = signatureParts.length > 2
            ? signatureParts[2]
            : signatureParts[signatureParts.length - 1];

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
const processWebhookEvent = async (event: ResendWebhookEvent): Promise<void> => {
    try {
        await connectToMongoDB();
        const db = getDb();

        if (isDev) console.log('📧 Processing Resend webhook event:', {
            type: event.type,
            emailId: event.data.email_id,
            to: event.data.to,
            createdAt: event.created_at,
        });

        // Log email events to database for tracking
        try {
            await db.collection('email_events').insertOne({
                eventType: event.type,
                emailId: event.data.email_id,
                from: event.data.from,
                to: event.data.to,
                subject: event.data.subject,
                createdAt: new Date(event.created_at || Date.now()),
                receivedAt: new Date(),
                data: event.data,
            });
            if (isDev) console.log('✅ Email event logged to database');
        } catch (dbError: any) {
            console.error('❌ Error logging email event:', dbError.message);
            // Don't fail the webhook if logging fails
        }

        // Handle specific event types
        switch (event.type) {
            case 'email.sent':
                if (isDev) console.log('✅ Email sent:', event.data.email_id);
                break;

            case 'email.delivered':
                if (isDev) console.log('✅ Email delivered:', event.data.email_id);
                break;

            case 'email.delivery_delayed':
                if (isDev) console.log('⚠️ Email delivery delayed:', event.data.email_id);
                break;

            case 'email.complained':
                if (isDev) console.log('⚠️ Email marked as spam:', event.data.email_id);
                // Could update user preferences or mark email as problematic
                break;

            case 'email.bounced':
                if (isDev) console.log('❌ Email bounced:', event.data.email_id);
                // Could mark email as invalid or update user record
                break;

            case 'email.opened':
                if (isDev) console.log('👁️ Email opened:', event.data.email_id);
                break;

            case 'email.clicked':
                if (isDev) console.log('🖱️ Email link clicked:', event.data.email_id);
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
    if (isDev) console.log('📧 Resend webhook endpoint hit:', {
        method: req.method,
        url: req.url,
        headers: {
            'content-type': req.headers['content-type'],
            'svix-id': req.headers['svix-id'] ? 'present' : 'missing',
            'svix-signature': req.headers['svix-signature'] ? 'present' : 'missing',
            'svix-timestamp': req.headers['svix-timestamp'] ? 'present' : 'missing',
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

    // Verify webhook signature - REQUIRED in production (CRIT-002 fix)
    const signature = req.headers['svix-signature'] || req.headers['resend-signature'];

    // In production, FAIL if secret is not configured
    if (!isDev && !RESEND_WEBHOOK_SECRET) {
        console.error('❌ RESEND_WEBHOOK_SECRET not configured in production');
        return res.status(500).json({ error: 'Webhook verification not configured' });
    }

    if (RESEND_WEBHOOK_SECRET) {
        if (!signature) {
            console.error('❌ Missing webhook signature header');
            return res.status(401).json({ error: 'Missing webhook signature' });
        }

        const isValid = verifyWebhookSignature(
            bodyString,
            signature as string,
            RESEND_WEBHOOK_SECRET
        );

        if (!isValid) {
            console.error('❌ Webhook signature verification failed');
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }

        if (isDev) console.log('✅ Webhook signature verified');
    } else if (isDev) {
        console.warn('⚠️ [DEV ONLY] Webhook signature verification skipped');
    }

    // Parse webhook event
    let event: ResendWebhookEvent;
    try {
        event = JSON.parse(bodyString);
    } catch (parseError: any) {
        console.error('❌ Error parsing webhook body:', parseError.message);
        return res.status(400).json({ error: 'Invalid JSON in webhook body' });
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
