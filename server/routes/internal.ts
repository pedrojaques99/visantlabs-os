import { Router, Request, Response } from 'express';
import { connectToMongoDB } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';

const router = Router();

const PARTNER_API_KEY = process.env.PARTNER_API_KEY || '';

function validateApiKey(req: Request, res: Response): boolean {
  if (!PARTNER_API_KEY) {
    res.status(503).json({ error: 'Partner API not configured' });
    return false;
  }
  const key = req.headers['x-api-key'] as string;
  if (!key || key !== PARTNER_API_KEY) {
    res.status(401).json({ error: 'Invalid API key' });
    return false;
  }
  return true;
}

// POST /api/internal/partner-credits
// Grants or queries credits for a partner platform user (e.g. Boxy)
router.post('/partner-credits', async (req: Request, res: Response) => {
  if (!validateApiKey(req, res)) return;

  const { email, credits, action, source, ref } = req.body;

  if (!email || !action || !source) {
    return res.status(400).json({ error: 'Missing required fields: email, action, source' });
  }

  try {
    const db = await connectToMongoDB();
    if (!db) return res.status(500).json({ error: 'Database connection failed' });

    const user = await db.collection('users').findOne({ email });

    if (action === 'info') {
      return res.json({
        found: !!user,
        currentCredits: user ? (user.totalCreditsEarned || 0) : 0,
      });
    }

    if (action === 'grant') {
      if (!credits || credits <= 0 || !ref) {
        return res.status(400).json({ error: 'Missing required fields: credits, ref' });
      }

      if (!user) {
        return res.json({ success: false, reason: 'user_not_found', email });
      }

      // Idempotency: check if this ref was already granted this month
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const existing = await db.collection('transactions').findOne({
        userId: user._id,
        type: 'partner_grant',
        description: ref,
        createdAt: { $gte: monthStart },
      });

      if (existing) {
        return res.json({ success: true, alreadyGranted: true, transactionId: existing._id.toString() });
      }

      await db.collection('users').updateOne(
        { _id: user._id },
        { $inc: { totalCreditsEarned: credits } }
      );

      const txResult = await db.collection('transactions').insertOne({
        userId: user._id,
        type: 'partner_grant',
        status: 'completed',
        credits,
        amount: 0,
        currency: 'BRL',
        description: ref,
        stripeSessionId: `partner_${source}_${ref}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`✅ Partner credits granted: ${credits} to ${email} from ${source} (ref: ${ref})`);

      return res.json({
        success: true,
        alreadyGranted: false,
        creditsGranted: credits,
        transactionId: txResult.insertedId.toString(),
      });
    }

    return res.status(400).json({ error: 'Invalid action. Use "grant" or "info".' });
  } catch (error: any) {
    console.error('❌ Partner credits error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
