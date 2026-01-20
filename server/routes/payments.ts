import express from 'express';
import Stripe from 'stripe';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { verifyBotId } from '../middleware/botid.js';
import { getDb, connectToMongoDB } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';
import { getCreditsByAmount, getCreditPackage, getCreditPackagePrice } from '../../src/utils/creditPackages.js';
import { abacatepayService } from '../services/abacatepayService.js';
import { prisma } from '../db/prisma.js';
import { paymentRateLimiter, apiRateLimiter, webhookRateLimiter } from '../middleware/rateLimit.js';
import { isValidObjectId } from '../utils/validation.js';

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_ID_USD = process.env.STRIPE_PRICE_ID_USD || process.env.STRIPE_PRICE_ID || '';
const STRIPE_PRICE_ID_BRL = process.env.STRIPE_PRICE_ID_BRL || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FREE_GENERATIONS_LIMIT = 4;

// Helper function to get the first valid frontend URL from environment variable
// Handles cases where FRONTEND_URL contains multiple comma-separated URLs
const getFrontendUrl = (): string => {
  const rawUrl = FRONTEND_URL || 'http://localhost:3000';

  // Split by comma if multiple URLs are provided
  const urls = rawUrl.split(',').map(url => url.trim()).filter(url => url.length > 0);

  // Get the first URL
  const firstUrl = urls[0] || 'http://localhost:3000';

  // Validate URL format
  try {
    const url = new URL(firstUrl);
    // Remove trailing slashes
    return url.toString().replace(/\/+$/, '');
  } catch (error) {
    // If invalid, log warning and return default
    console.warn('⚠️ Invalid FRONTEND_URL format, using default:', firstUrl);
    return 'http://localhost:3000';
  }
};

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY is not configured. Stripe functionality will not work.');
}

if (!STRIPE_PRICE_ID_USD) {
  console.error('❌ STRIPE_PRICE_ID_USD is not configured. Subscription checkout will not work.');
}

// Helper function to get price ID based on currency
const getPriceId = (currency?: string): string => {
  if (currency === 'BRL' && STRIPE_PRICE_ID_BRL) {
    return STRIPE_PRICE_ID_BRL;
  }
  return STRIPE_PRICE_ID_USD; // Default to USD
};

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
}) : null;

const recordTransaction = async (
  db: ReturnType<typeof getDb>,
  transaction: {
    userId: ObjectId;
    type: 'purchase' | 'subscription';
    status?: string | null;
    credits?: number;
    amount?: number | null;
    currency?: string | null;
    description?: string | null;
    stripeSessionId?: string | null;
    stripePaymentIntentId?: string | null;
    stripeCustomerId?: string | null;
  }
) => {
  try {
    const now = new Date();
    const query: any = { userId: transaction.userId };
    if (transaction.stripeSessionId) {
      query.stripeSessionId = transaction.stripeSessionId;
    } else if (transaction.stripePaymentIntentId) {
      query.stripePaymentIntentId = transaction.stripePaymentIntentId;
    } else {
      query.createdAt = { $gte: new Date(now.getTime() - 1000) };
    }

    const payload = {
      userId: transaction.userId,
      type: transaction.type,
      status: (transaction.status || 'pending'),
      credits: transaction.credits,
      amount: transaction.amount ?? 0,
      currency: (transaction.currency || 'USD').toUpperCase(),
      description: transaction.description,
      stripeSessionId: transaction.stripeSessionId,
      stripePaymentIntentId: transaction.stripePaymentIntentId,
      stripeCustomerId: transaction.stripeCustomerId,
      updatedAt: now,
    };

    await db.collection('transactions').updateOne(
      query,
      {
        $set: payload,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  } catch (transactionError: any) {
    console.error('❌ Failed to record transaction:', transactionError.message);
  }
};

const mapTransactionDocument = (transaction: any) => {
  const createdAt = transaction.createdAt instanceof Date
    ? transaction.createdAt
    : transaction.createdAt
      ? new Date(transaction.createdAt)
      : new Date();

  return {
    id: transaction._id?.toString() ?? `${transaction.userId}-${createdAt.getTime()}`,
    type: transaction.type || 'purchase',
    credits: transaction.credits ?? null,
    amount: transaction.amount ?? 0,
    currency: (transaction.currency || 'USD').toUpperCase(),
    status: transaction.status || 'pending',
    description: transaction.description || '',
    createdAt: createdAt.toISOString(),
    stripeSessionId: transaction.stripeSessionId || null,
    stripePaymentIntentId: transaction.stripePaymentIntentId || null,
  };
};

const formatStripeSessionTransaction = (
  session: Stripe.Checkout.Session,
  type: 'purchase' | 'subscription',
  credits?: number
) => {
  const createdAt = typeof session.created === 'number'
    ? new Date(session.created * 1000)
    : new Date();

  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id;

  return {
    id: `${session.id}-${type}`,
    type,
    credits: typeof credits === 'number' ? credits : null,
    amount: session.amount_total ?? 0,
    currency: (session.currency || 'USD').toUpperCase(),
    status: session.payment_status || 'pending',
    description: type === 'subscription' ? 'Subscription checkout' : 'Credit purchase',
    createdAt: createdAt.toISOString(),
    stripeSessionId: session.id,
    stripePaymentIntentId: paymentIntentId || null,
  };
};

const formatStripeSubscriptionTransaction = (subscription: Stripe.Subscription) => {
  const primaryItem = subscription.items.data[0];
  const price = primaryItem?.price;
  const amount = price?.unit_amount ?? 0;
  const currency = price?.currency ?? 'USD';
  const creditsMeta = price?.metadata?.monthlyCredits;
  const credits = creditsMeta ? parseInt(creditsMeta, 10) : undefined;
  const periodStart = (subscription as any).current_period_start as number | undefined;
  const createdAt = periodStart
    ? new Date(periodStart * 1000)
    : new Date();

  return {
    id: `subscription-${subscription.id}-${periodStart || 'unknown'}`,
    type: 'subscription',
    credits: typeof credits === 'number' ? credits : null,
    amount,
    currency: currency.toUpperCase(),
    status: subscription.status,
    description: price?.nickname || 'Subscription renewal',
    createdAt: createdAt.toISOString(),
    stripeSessionId: null,
    stripePaymentIntentId: null,
  };
};

const fetchStripeTransactionsForCustomer = async (customerId: string) => {
  if (!stripe) {
    return [];
  }

  const transactions: any[] = [];

  const sessions = await stripe.checkout.sessions.list({
    customer: customerId,
    limit: 100,
  });

  for (const session of sessions.data) {
    if (session.mode === 'payment') {
      const metadataCredits = session.metadata?.credits
        ? parseInt(session.metadata.credits, 10)
        : undefined;
      const normalizedCurrency = session.currency ? session.currency.toUpperCase() : undefined;
      const amountReference = session.amount_subtotal ?? session.amount_total ?? 0;
      const creditsByAmount = amountReference > 0
        ? getCreditsByAmount(amountReference, normalizedCurrency)
        : 0;

      const credits = metadataCredits && metadataCredits > 0
        ? metadataCredits
        : creditsByAmount > 0
          ? creditsByAmount
          : undefined;

      transactions.push(formatStripeSessionTransaction(session, 'purchase', credits));
    } else if (session.mode === 'subscription') {
      transactions.push(formatStripeSessionTransaction(session, 'subscription'));
    }
  }

  if (transactions.length < 20) {
    const subscriptionList = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 50,
    });

    subscriptionList.data.forEach(subscription => {
      transactions.push(formatStripeSubscriptionTransaction(subscription));
    });
  }

  transactions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return transactions.slice(0, 100);
};

// Helper function to get subscription tier and monthly credits from Stripe metadata
interface StripePlanInfo {
  tier: string;
  monthlyCredits: number;
}

const getStripePlanInfo = async (subscriptionId: string): Promise<StripePlanInfo | null> => {
  if (!stripe) return null;

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;

    if (!priceId) return null;

    const price = await stripe.prices.retrieve(priceId);
    const productId = typeof price.product === 'string' ? price.product : price.product?.id;

    if (!productId) return null;

    const product = await stripe.products.retrieve(productId);
    const metadata = product.metadata || {};

    // Extract tier and monthlyCredits from metadata
    const tier = metadata.tier || 'premium';
    const monthlyCredits = metadata.monthlyCredits
      ? parseInt(metadata.monthlyCredits, 10)
      : (tier === 'premium' ? 100 : tier === 'pro' ? 500 : 3);

    return { tier, monthlyCredits };
  } catch (error) {
    console.error('Error fetching Stripe plan info:', error);
    return null;
  }
};

// Helper function to calculate next reset date based on subscription period
const calculateCreditsResetDate = (subscription: Stripe.Subscription): Date => {
  // current_period_end exists on Stripe.Subscription but TypeScript may not recognize it
  const periodEnd = (subscription as any).current_period_end as number;
  if (!periodEnd) {
    throw new Error('Subscription current_period_end is missing');
  }
  return new Date(periodEnd * 1000);
};

// Create checkout session for subscription
router.post('/create-checkout-session', paymentRateLimiter, verifyBotId, authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!stripe) {
      console.error('❌ Stripe is not configured');
      return res.status(500).json({ error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.' });
    }

    const { currency, locale } = req.body || {};
    const priceId = getPriceId(currency);

    console.log('🔍 Checkout session request:', { currency, locale, priceId });

    if (!priceId) {
      console.error('❌ Price ID not configured');
      return res.status(500).json({ error: 'Stripe price ID not configured. Please set STRIPE_PRICE_ID_USD or STRIPE_PRICE_ID_BRL in your environment variables.' });
    }

    // Verify price exists in Stripe
    try {
      await stripe.prices.retrieve(priceId);
    } catch (priceError: any) {
      console.error('❌ Invalid price ID:', priceError.message);
      return res.status(400).json({ error: `Invalid price ID: ${priceError.message}. Please check your STRIPE_PRICE_ID configuration.` });
    }

    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;

    // Get or create Stripe customer
    let user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      console.log('📝 Creating new Stripe customer for user:', user.email);
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: userId,
        },
      });
      customerId = customer.id;

      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { stripeCustomerId: customerId } }
      );
      console.log('✅ Created Stripe customer:', customerId);
    }

    // Get normalized frontend URL (handles comma-separated URLs)
    const normalizedFrontendUrl = getFrontendUrl();

    console.log('🔗 Creating checkout session:', {
      customerId,
      priceId,
      successUrl: `${normalizedFrontendUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${normalizedFrontendUrl}?canceled=true`,
    });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      locale: locale || 'auto',
      allow_promotion_codes: true, // Enable promotion codes/coupons
      success_url: `${normalizedFrontendUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${normalizedFrontendUrl}?canceled=true`,
    });

    console.log('✅ Checkout session created:', session.id);

    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('❌ Checkout session error:', error);
    // Log more details in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error details:', {
        message: error.message,
        type: error.type,
        code: error.code,
        statusCode: error.statusCode,
      });
    }
    next(error);
  }
});

// Create customer portal session
router.post('/create-portal-session', paymentRateLimiter, verifyBotId, authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.' });
    }

    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user || !user.stripeCustomerId) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: getFrontendUrl(),
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// Get subscription status
router.get('/subscription-status', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const freeGenerationsUsed = user.freeGenerationsUsed || 0;
    const subscriptionStatus = user.subscriptionStatus || 'free';
    const subscriptionTier = user.subscriptionTier || 'free';
    const hasActiveSubscription = subscriptionStatus === 'active';
    const monthlyCredits = user.monthlyCredits || 20;
    const creditsUsed = user.creditsUsed || 0;
    const creditsRemaining = Math.max(0, monthlyCredits - creditsUsed);
    const creditsResetDate = user.creditsResetDate || null;
    const totalCreditsEarned = user.totalCreditsEarned ?? 0;
    const totalCredits = (totalCreditsEarned ?? 0) + creditsRemaining;

    res.json({
      subscriptionStatus,
      subscriptionTier,
      hasActiveSubscription,
      freeGenerationsUsed,
      freeGenerationsRemaining: Math.max(0, FREE_GENERATIONS_LIMIT - freeGenerationsUsed),
      monthlyCredits,
      creditsUsed,
      creditsRemaining,
      creditsResetDate,
      totalCreditsEarned,
      totalCredits,
      canGenerate: hasActiveSubscription
        ? totalCredits > 0
        : (freeGenerationsUsed < FREE_GENERATIONS_LIMIT && totalCredits > 0),
    });
  } catch (error) {
    next(error);
  }
});

// Get available plans from Stripe
router.get('/plans', apiRateLimiter, async (req, res, next) => {
  try {
    if (!stripe) {
      console.error('❌ Stripe is not configured');
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    const { currency } = req.query;
    const priceId = getPriceId(currency as string);

    if (!priceId) {
      console.error('❌ Price ID not configured for currency:', currency);
      return res.status(500).json({ error: 'Price ID not configured' });
    }

    console.log('🔍 Fetching plan info for price ID:', priceId);

    // Get price details
    let price;
    try {
      price = await stripe.prices.retrieve(priceId);
    } catch (priceError: any) {
      console.error('❌ Error retrieving price from Stripe:', priceError.message);
      if (priceError.code === 'resource_missing') {
        return res.status(404).json({
          error: `Price ID not found in Stripe: ${priceId}. Please check your STRIPE_PRICE_ID configuration.`
        });
      }
      throw priceError;
    }
    const productId = typeof price.product === 'string' ? price.product : price.product?.id;

    if (!productId) {
      console.error('❌ Product ID not found in price');
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log('🔍 Fetching product info for product ID:', productId);

    // Get product with metadata
    const product = await stripe.products.retrieve(productId);
    const metadata = product.metadata || {};

    // Extract plan information
    const tier = metadata.tier || 'premium';
    const monthlyCredits = metadata.monthlyCredits
      ? parseInt(metadata.monthlyCredits, 10)
      : (tier === 'premium' ? 100 : tier === 'pro' ? 500 : 3);

    // Format price
    const amount = price.unit_amount ? price.unit_amount / 100 : 0;
    const currencyCode = price.currency.toUpperCase();

    console.log('✅ Plan info retrieved:', { tier, monthlyCredits, amount, currencyCode });

    res.json({
      priceId,
      tier,
      monthlyCredits,
      amount,
      currency: currencyCode,
      interval: price.recurring?.interval || 'month',
      productName: product.name || 'Premium',
      description: product.description || '',
    });
  } catch (error: any) {
    console.error('❌ Error fetching plans:', error);
    const errorMessage = error.message || 'Failed to fetch plans';
    res.status(500).json({ error: errorMessage });
  }
});

// Get all active products (credit packages and subscription plans) from database
router.get('/products', apiRateLimiter, async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    res.json(products);
  } catch (error) {
    console.error('❌ Error fetching public products:', error);
    next(error);
  }
});

// Get usage info
router.get('/usage', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const freeGenerationsUsed = user.freeGenerationsUsed || 0;
    const hasActiveSubscription = user.subscriptionStatus === 'active';
    const monthlyCredits = user.monthlyCredits || 20;
    const creditsUsed = user.creditsUsed || 0;
    const creditsRemaining = Math.max(0, monthlyCredits - creditsUsed);
    const creditsResetDate = user.creditsResetDate || null;
    const totalCreditsEarned = user.totalCreditsEarned ?? 0;
    const totalCredits = (totalCreditsEarned ?? 0) + creditsRemaining;

    res.json({
      freeGenerationsUsed,
      freeGenerationsRemaining: Math.max(0, FREE_GENERATIONS_LIMIT - freeGenerationsUsed),
      hasActiveSubscription,
      monthlyCredits,
      creditsUsed,
      creditsRemaining,
      creditsResetDate,
      totalCreditsEarned,
      totalCredits,
      canGenerate: hasActiveSubscription
        ? totalCredits > 0
        : (freeGenerationsUsed < FREE_GENERATIONS_LIMIT && totalCredits > 0),
    });
  } catch (error) {
    next(error);
  }
});

// Get transactions history
router.get('/transactions', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in request' });
    }

    await connectToMongoDB();
    const db = getDb();
    const userObjectId = new ObjectId(userId);

    const storedTransactions = await db.collection('transactions')
      .find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    if (storedTransactions.length > 0) {
      return res.json(storedTransactions.map(mapTransactionDocument));
    }

    const user = await db.collection('users').findOne({ _id: userObjectId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!stripe || !user.stripeCustomerId) {
      return res.json([]);
    }

    const fallbackTransactions = await fetchStripeTransactionsForCustomer(user.stripeCustomerId);
    return res.json(fallbackTransactions);
  } catch (error) {
    next(error);
  }
});

// Verify subscription manually (fallback when webhook fails)
router.post('/verify-subscription', paymentRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;

    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const customerId = user.stripeCustomerId;
    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe customer ID found for this user' });
    }

    console.log('🔍 Verifying subscription manually for user:', { userId, customerId });

    try {
      // List all subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10,
      });

      const activeSubscription = subscriptions.data.find(sub => sub.status === 'active' || sub.status === 'trialing');

      if (activeSubscription) {
        const subscriptionId = activeSubscription.id;
        console.log('✅ Found active subscription:', subscriptionId);

        // Get plan info from Stripe metadata
        const planInfo = await getStripePlanInfo(subscriptionId);
        const tier = planInfo?.tier || 'premium';
        const monthlyCredits = planInfo?.monthlyCredits || 100;
        const creditsResetDate = calculateCreditsResetDate(activeSubscription);

        // Update user in database
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          {
            $set: {
              subscriptionStatus: activeSubscription.status === 'active' ? 'active' : 'trialing',
              subscriptionTier: tier,
              stripeSubscriptionId: subscriptionId,
              stripeCustomerId: customerId,
              subscriptionEndDate: creditsResetDate,
              monthlyCredits: monthlyCredits,
              creditsResetDate: creditsResetDate,
            },
          }
        );

        console.log('✅ Subscription verified and updated:', {
          userId,
          subscriptionId,
          status: activeSubscription.status,
          tier,
          monthlyCredits,
        });

        // Return updated subscription status
        const updatedUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        return res.json({
          success: true,
          message: 'Subscription verified and updated',
          subscriptionStatus: updatedUser?.subscriptionStatus || 'active',
          subscriptionTier: tier,
          monthlyCredits,
          creditsResetDate: creditsResetDate.toISOString(),
        });
      } else {
        // No active subscription found
        console.log('ℹ️ No active subscription found for customer:', customerId);

        // Check if user has subscription status that should be updated
        if (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') {
          // Update to canceled if no active subscription exists
          await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            {
              $set: {
                subscriptionStatus: 'canceled',
                subscriptionTier: 'free',
                monthlyCredits: 20,
              },
            }
          );

          return res.json({
            success: true,
            message: 'No active subscription found. Status updated to canceled.',
            subscriptionStatus: 'canceled',
            subscriptionTier: 'free',
          });
        }

        return res.json({
          success: false,
          message: 'No active subscription found',
          subscriptionStatus: user.subscriptionStatus || 'free',
        });
      }
    } catch (stripeError: any) {
      console.error('❌ Error verifying subscription with Stripe:', {
        error: stripeError.message,
        customerId,
      });
      return res.status(500).json({
        error: 'Failed to verify subscription with Stripe',
        message: stripeError.message,
      });
    }
  } catch (error: any) {
    console.error('❌ Error in verify-subscription endpoint:', error);
    next(error);
  }
});

// Create PIX checkout session for credit purchase
router.post('/create-pix-checkout', paymentRateLimiter, verifyBotId, authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!stripe) {
      console.error('❌ Stripe is not configured');
      return res.status(500).json({ error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.' });
    }

    const { credits, currency } = req.body || {};

    if (!credits || credits <= 0) {
      return res.status(400).json({ error: 'Invalid credits amount' });
    }

    if (currency !== 'BRL') {
      return res.status(400).json({ error: 'PIX is only available for BRL currency' });
    }

    // Get credit package info
    const creditPackage = getCreditPackage(credits);
    if (!creditPackage) {
      return res.status(400).json({ error: 'Credit package not found' });
    }

    const price = getCreditPackagePrice(credits, currency);
    if (!price || price <= 0) {
      return res.status(400).json({ error: 'Invalid price for credit package' });
    }

    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;

    // Get or create Stripe customer
    let user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    let customerId = user.stripeCustomerId;

    // If customer exists, verify it's valid in Stripe
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
        console.log('✅ Verified existing Stripe customer:', customerId);
      } catch (error: any) {
        // Customer doesn't exist in Stripe, clear it and create a new one
        if (error.code === 'resource_missing') {
          console.warn('⚠️ Customer not found in Stripe, creating new one. Old ID:', customerId);
          customerId = null;
        } else {
          throw error;
        }
      }
    }

    if (!customerId) {
      console.log('📝 Creating new Stripe customer for user:', user.email);
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: userId,
        },
      });
      customerId = customer.id;

      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { stripeCustomerId: customerId } }
      );
      console.log('✅ Created Stripe customer:', customerId);
    }

    // Get normalized frontend URL (handles comma-separated URLs)
    const normalizedFrontendUrl = getFrontendUrl();

    // Convert price to cents (minor units)
    const unitAmount = Math.round(price * 100);

    console.log('🔗 Creating PIX checkout session:', {
      customerId,
      credits,
      price,
      unitAmount,
      currency,
      frontendUrl: normalizedFrontendUrl,
    });

    // Build URLs properly using URL constructor
    let successUrl: string;
    let cancelUrl: string;

    try {
      const baseUrl = new URL(normalizedFrontendUrl);
      const successUrlObj = new URL('/pricing', baseUrl);
      successUrlObj.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
      successUrlObj.searchParams.set('success', 'true');
      successUrl = successUrlObj.toString();

      const cancelUrlObj = new URL('/pricing', baseUrl);
      cancelUrlObj.searchParams.set('canceled', 'true');
      cancelUrl = cancelUrlObj.toString();
    } catch (urlError: any) {
      console.error('❌ Invalid URL format:', {
        frontendUrl: normalizedFrontendUrl,
        error: urlError.message
      });
      return res.status(500).json({
        error: 'Invalid URL configuration. Please check FRONTEND_URL environment variable.'
      });
    }

    // Build session config - use customer OR customer_email (not both)
    const sessionConfig: any = {
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `${credits} Credits`,
              description: `Credit package - ${credits} credits`,
              metadata: {
                credits: credits.toString(),
              },
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      payment_method_types: ['pix'],
      allow_promotion_codes: true, // Enable promotion codes/coupons
      metadata: {
        credits: credits.toString(),
        userId: userId,
        type: 'credit_purchase',
        userEmail: user.email || '',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    };

    // Use customer if available, otherwise use customer_email
    // Stripe doesn't allow both at the same time
    if (customerId) {
      try {
        // Double-check customer exists before adding
        await stripe.customers.retrieve(customerId);
        sessionConfig.customer = customerId;
        console.log('✅ Using Stripe customer ID for PIX checkout:', customerId);
      } catch (customerError: any) {
        console.warn('⚠️ Customer invalid when creating session, using customer_email instead:', customerError.message);
        // Fallback to customer_email if customer is invalid
        if (user.email) {
          sessionConfig.customer_email = user.email;
        }
      }
    } else {
      // No customer ID, use customer_email
      if (user.email) {
        sessionConfig.customer_email = user.email;
        console.log('✅ Using customer_email for PIX checkout:', user.email);
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log('✅ PIX checkout session created:', session.id);

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('❌ PIX checkout session error:', error);

    // Handle Stripe errors specifically
    if (error.type && error.type.startsWith('Stripe')) {
      const statusCode = error.statusCode || 400;
      let errorMessage = error.message || 'Stripe error occurred';

      // Check if PIX is not enabled
      if (errorMessage.includes('payment method type provided: pix is invalid') ||
        errorMessage.includes('Pix') && errorMessage.includes('invalid')) {
        errorMessage = 'PIX payment method is not enabled in your Stripe account. Please enable PIX in Stripe Dashboard: https://dashboard.stripe.com/account/payments/settings';
      }

      console.error('Stripe error details:', {
        message: errorMessage,
        type: error.type,
        code: error.code,
        statusCode,
        param: error.param,
      });

      return res.status(statusCode).json({
        error: errorMessage,
        code: error.code,
        type: error.type,
      });
    }

    // Handle other errors
    if (process.env.NODE_ENV === 'development') {
      console.error('Error details:', {
        message: error.message,
        type: error.type,
        code: error.code,
        statusCode: error.statusCode,
        stack: error.stack,
      });
    }

    next(error);
  }
});

// Create credit checkout session for card payments (dynamic checkout for authenticated users)
router.post('/create-credit-checkout', verifyBotId, authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!stripe) {
      console.error('❌ Stripe is not configured');
      return res.status(500).json({ error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.' });
    }

    const { credits, currency } = req.body || {};

    if (!credits || credits <= 0) {
      return res.status(400).json({ error: 'Invalid credits amount' });
    }

    if (!currency || (currency !== 'USD' && currency !== 'BRL')) {
      return res.status(400).json({ error: 'Invalid currency. Must be USD or BRL' });
    }

    // Get credit package info
    const creditPackage = getCreditPackage(credits);
    if (!creditPackage) {
      return res.status(400).json({ error: 'Credit package not found' });
    }

    const price = getCreditPackagePrice(credits, currency);
    if (!price || price <= 0) {
      return res.status(400).json({ error: 'Invalid price for credit package' });
    }

    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;

    // Get or create Stripe customer
    let user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    let customerId = user.stripeCustomerId;

    // If customer exists, verify it's valid in Stripe
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
        console.log('✅ Verified existing Stripe customer:', customerId);
      } catch (error: any) {
        // Customer doesn't exist in Stripe, clear it and create a new one
        if (error.code === 'resource_missing') {
          console.warn('⚠️ Customer not found in Stripe, creating new one. Old ID:', customerId);
          customerId = null;
        } else {
          throw error;
        }
      }
    }

    if (!customerId) {
      console.log('📝 Creating new Stripe customer for user:', user.email);
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: userId,
        },
      });
      customerId = customer.id;

      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { stripeCustomerId: customerId } }
      );
      console.log('✅ Created Stripe customer:', customerId);
    }

    // Get normalized frontend URL (handles comma-separated URLs)
    const normalizedFrontendUrl = getFrontendUrl();

    // Convert price to cents (minor units)
    const unitAmount = Math.round(price * 100);
    const currencyLower = currency.toLowerCase();

    console.log('🔗 Creating credit checkout session:', {
      customerId,
      credits,
      price,
      unitAmount,
      currency: currencyLower,
      frontendUrl: normalizedFrontendUrl,
    });

    // Build URLs properly using URL constructor
    let successUrl: string;
    let cancelUrl: string;

    try {
      const baseUrl = new URL(normalizedFrontendUrl);
      const successUrlObj = new URL('/pricing', baseUrl);
      successUrlObj.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
      successUrlObj.searchParams.set('success', 'true');
      successUrl = successUrlObj.toString();

      const cancelUrlObj = new URL('/pricing', baseUrl);
      cancelUrlObj.searchParams.set('canceled', 'true');
      cancelUrl = cancelUrlObj.toString();
    } catch (urlError: any) {
      console.error('❌ Invalid URL format:', {
        frontendUrl: normalizedFrontendUrl,
        error: urlError.message
      });
      return res.status(500).json({
        error: 'Invalid URL configuration. Please check FRONTEND_URL environment variable.'
      });
    }

    // Try to use stripeProductId if available, otherwise use price_data
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

    if (creditPackage.stripeProductId) {
      // Use existing product - need to find or create price for this currency
      // For now, use price_data as fallback since we need dynamic pricing
      lineItems = [
        {
          price_data: {
            currency: currencyLower,
            product_data: {
              name: `${credits} Credits`,
              description: `Credit package - ${credits} credits`,
              metadata: {
                credits: credits.toString(),
              },
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ];
    } else {
      // Use price_data directly
      lineItems = [
        {
          price_data: {
            currency: currencyLower,
            product_data: {
              name: `${credits} Credits`,
              description: `Credit package - ${credits} credits`,
              metadata: {
                credits: credits.toString(),
              },
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ];
    }

    // Build session config
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      line_items: lineItems,
      mode: 'payment',
      payment_method_types: ['card'],
      allow_promotion_codes: true, // Enable promotion codes/coupons
      client_reference_id: userId, // User ID for webhook identification
      metadata: {
        credits: credits.toString(),
        userId: userId,
        type: 'credit_purchase',
        userEmail: user.email || '',
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    };

    // Use customer if available, otherwise use customer_email
    // Stripe doesn't allow both at the same time
    if (customerId) {
      try {
        // Double-check customer exists before adding
        await stripe.customers.retrieve(customerId);
        sessionConfig.customer = customerId;
        console.log('✅ Using Stripe customer ID for credit checkout:', customerId);
      } catch (customerError: any) {
        console.warn('⚠️ Customer invalid when creating session, using customer_email instead:', customerError.message);
        // Fallback to customer_email if customer is invalid
        if (user.email) {
          sessionConfig.customer_email = user.email;
        }
      }
    } else {
      // No customer ID, use customer_email
      if (user.email) {
        sessionConfig.customer_email = user.email;
        console.log('✅ Using customer_email for credit checkout:', user.email);
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log('✅ Credit checkout session created:', session.id);

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('❌ Credit checkout session error:', error);

    // Handle Stripe errors specifically
    if (error.type && error.type.startsWith('Stripe')) {
      const statusCode = error.statusCode || 400;
      const errorMessage = error.message || 'Stripe error occurred';

      console.error('Stripe error details:', {
        message: errorMessage,
        type: error.type,
        code: error.code,
        statusCode,
        param: error.param,
      });

      return res.status(statusCode).json({
        error: errorMessage,
        code: error.code,
        type: error.type,
      });
    }

    // Handle other errors
    if (process.env.NODE_ENV === 'development') {
      console.error('Error details:', {
        message: error.message,
        type: error.type,
        code: error.code,
        statusCode: error.statusCode,
        stack: error.stack,
      });
    }

    next(error);
  }
});

// Get PIX QR Code and payment details from session
router.get('/pix-qrcode/:sessionId', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe is not configured' });
    }

    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    // Verify user owns this session
    const userId = req.userId!;
    if (session.metadata?.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to this session' });
    }

    // Check if session is for PIX
    if (!session.payment_method_types?.includes('pix')) {
      return res.status(400).json({ error: 'This session is not for PIX payment' });
    }

    // Get payment intent to access PIX details
    let pixCode: string | null = null;
    let qrCode: string | null = null;

    if (session.payment_intent) {
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent.id;

      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ['payment_method'],
        });

        // For PIX, the details are in payment_method_options.pix
        const pixOptions = (paymentIntent as any).payment_method_options?.pix;
        if (pixOptions) {
          pixCode = pixOptions.pix_string || null;
          // QR Code is typically a data URL or can be generated from pix_string
        }

        // Alternative: check if there's a payment method with PIX details
        if (paymentIntent.payment_method && typeof paymentIntent.payment_method === 'object') {
          const paymentMethod = paymentIntent.payment_method as any;
          if (paymentMethod.pix) {
            pixCode = paymentMethod.pix.pix_string || pixCode;
          }
        }
      } catch (error: any) {
        console.warn('⚠️ Could not retrieve payment intent for PIX details:', error.message);
      }
    }

    // If payment is still pending, we can redirect to Stripe's hosted checkout
    // which will show the QR code. For programmatic access, we return the session URL
    // The frontend can open this URL or we can use Stripe's API to get the QR code

    res.json({
      sessionId: session.id,
      status: session.payment_status,
      pixCode: pixCode,
      qrCode: qrCode, // May be null if payment intent not yet created
      checkoutUrl: session.url, // URL to Stripe's hosted checkout with QR code
      amount: session.amount_total,
      currency: session.currency,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      metadata: session.metadata,
    });
  } catch (error: any) {
    console.error('❌ Error retrieving PIX QR Code:', error);
    if (error.code === 'resource_missing') {
      return res.status(404).json({ error: 'Session not found' });
    }
    next(error);
  }
});

// Stripe webhook handler
router.post('/webhook', webhookRateLimiter, async (req, res) => {
  // Check if this is an AbacatePay webhook (has webhookSecret query param or missing stripe-signature)
  const webhookSecretQuery = req.query.webhookSecret || req.query.secret;
  const sig = req.headers['stripe-signature'];

  // If webhookSecret is in query params and no stripe-signature, it's AbacatePay
  if (webhookSecretQuery && !sig) {
    console.log('🔍 Detected AbacatePay webhook, forwarding to AbacatePay handler');
    // Forward to AbacatePay webhook handler by changing the route
    // We'll handle it inline to avoid route conflicts
    try {
      // Validate webhook secret if configured
      const abacateWebhookSecret = process.env.ABACATE_WEBHOOK_SECRET
        || process.env.ABACATEPAY_WEBHOOK_SECRET
        || process.env.ABACATEPAY_WEBHHOOK_SECRET; // Support typo variant

      if (abacateWebhookSecret) {
        const secretValue = typeof webhookSecretQuery === 'string' ? webhookSecretQuery : (Array.isArray(webhookSecretQuery) ? webhookSecretQuery[0] : String(webhookSecretQuery));
        if (secretValue !== abacateWebhookSecret) {
          console.error('❌ AbacatePay webhook secret validation failed', {
            hasSecret: !!webhookSecretQuery,
            secretMatch: secretValue === abacateWebhookSecret,
          });
          return res.status(401).json({ error: 'Invalid webhook secret' });
        }
        console.log('✅ AbacatePay webhook secret validated');
      } else {
        console.warn('⚠️ ABACATEPAY_WEBHOOK_SECRET not configured - webhook validation disabled');
      }

      // Log full body structure for debugging
      console.log('📥 AbacatePay webhook body structure:', JSON.stringify(req.body, null, 2));

      const { event, data } = req.body;

      // Try multiple possible locations for billId
      const billId = data?.id || data?.billId || data?.billing?.id || req.body?.id || req.body?.billId || req.body?.billing?.id;

      console.log('📥 AbacatePay webhook received:', {
        event,
        billId,
        dataKeys: data ? Object.keys(data) : [],
        bodyKeys: Object.keys(req.body),
        dataId: data?.id,
        bodyId: req.body?.id
      });

      if (event === 'billing.paid' || event === 'billing.payment_received') {
        // billId was already extracted above
        if (!billId) {
          console.error('❌ Bill ID is missing from webhook. Body structure:', JSON.stringify(req.body, null, 2));
          return res.status(400).json({ error: 'Bill ID is missing' });
        }

        await connectToMongoDB();
        const db = getDb();

        // Find payment in database
        let payment = await db.collection('payments').findOne({ billId });

        // Use webhook data directly - it already contains payment status
        // Check pixQrCode status from webhook first (most reliable)
        const pixQrCodeStatus = data?.pixQrCode?.status || data?.pixQrCode?.paymentStatus;
        const pixQrCodeAmount = data?.pixQrCode?.amount;
        const pixQrCodeMetadata = data?.pixQrCode?.metadata || {};

        // Determine if payment is confirmed from webhook data
        const isPaidFromWebhook = pixQrCodeStatus === 'PAID' || pixQrCodeStatus === 'CONFIRMED';

        // Fallback to API call only if webhook doesn't have clear status
        let billingStatus: any = null;
        let amountPaidInCents = pixQrCodeAmount || 0;
        let isPaid = isPaidFromWebhook;

        if (!isPaidFromWebhook && pixQrCodeStatus) {
          // If webhook has status but not PAID, use it
          console.log('📥 Using status from webhook:', pixQrCodeStatus);
          isPaid = false;
        } else if (!pixQrCodeStatus) {
          // Only call API if webhook doesn't have status info
          console.log('📞 Webhook missing status, calling API...');
          try {
            billingStatus = await abacatepayService.getPaymentStatus(billId);
            amountPaidInCents = billingStatus.amount || amountPaidInCents;
            isPaid = billingStatus.status === 'PAID' || billingStatus.status === 'CONFIRMED' || billingStatus.status === 'ACTIVE+';
            console.log('📥 API returned status:', billingStatus.status);
          } catch (apiError: any) {
            console.warn('⚠️ API call failed, using webhook data:', apiError.message);
            // Continue with webhook data
          }
        }

        if (isPaid) {
          // Extract actual amount paid (in cents) - prefer webhook data
          if (!amountPaidInCents && billingStatus) {
            amountPaidInCents = billingStatus.amount || 0;
          }

          // Use getCreditsByAmount to identify the correct package (supports coupons)
          let credits = 0;

          // Try to get credits from metadata first
          if (pixQrCodeMetadata.credits) {
            credits = parseInt(pixQrCodeMetadata.credits, 10);
            console.log('📦 Using credits from webhook metadata:', credits);
          } else if (payment && payment.credits) {
            credits = payment.credits;
            console.log('📦 Using credits from payment record:', credits);
          } else if (amountPaidInCents > 0) {
            credits = getCreditsByAmount(amountPaidInCents, 'BRL');
            console.log('📦 Calculated credits from amount paid:', { amountPaidInCents, credits });
          }

          if (credits <= 0) {
            console.error('❌ Invalid credits amount:', { billId, amountPaidInCents, credits, metadata: pixQrCodeMetadata });
            return res.status(400).json({ error: 'Invalid credits amount' });
          }

          // Find user - try metadata first, then payment record, then email
          let user = null;
          let userId: ObjectId | null = null;

          // Try userId from metadata first (most reliable)
          if (pixQrCodeMetadata.userId) {
            try {
              userId = new ObjectId(pixQrCodeMetadata.userId);
              user = await db.collection('users').findOne({ _id: userId });
              if (user) {
                console.log('👤 Found user by metadata userId:', pixQrCodeMetadata.userId);
              }
            } catch (idError: any) {
              console.warn('⚠️ Invalid userId in metadata:', pixQrCodeMetadata.userId);
            }
          }

          // Fallback to payment record
          if (!user && payment && payment.userId) {
            userId = payment.userId instanceof ObjectId ? payment.userId : new ObjectId(payment.userId);
            user = await db.collection('users').findOne({ _id: userId });
            if (user) {
              console.log('👤 Found user by payment record userId');
            }
          }

          // Fallback to email from customer data
          const customerEmail = data?.pixQrCode?.customer?.email || data?.customer?.email;
          if (!user && customerEmail) {
            user = await db.collection('users').findOne({ email: customerEmail });
            if (user) {
              userId = user._id;
              console.log('👤 Found user by email:', customerEmail);
            }
          }

          if (!user || !userId) {
            console.error('❌ User not found for AbacatePay payment:', {
              billId,
              userId,
              metadataUserId: pixQrCodeMetadata.userId,
              email: customerEmail,
              paymentUserId: payment?.userId
            });
            return res.status(404).json({ error: 'User not found' });
          }

          // Add credits to user
          const updateResult = await db.collection('users').updateOne(
            { _id: userId },
            { $inc: { totalCreditsEarned: credits } }
          );

          if (updateResult.modifiedCount > 0) {
            console.log('✅ Credits added via AbacatePay webhook:', {
              userId,
              credits,
              billId,
              source: pixQrCodeMetadata.credits ? 'metadata' : (payment?.credits ? 'payment_record' : 'calculated'),
            });
          } else {
            console.warn('⚠️ Credit update returned 0 modified documents:', {
              userId,
              matchedCount: updateResult.matchedCount,
            });
          }

          return res.json({ received: true, credits });
        } else {
          const status = pixQrCodeStatus || billingStatus?.status || 'UNKNOWN';
          console.log('⏳ Payment not yet confirmed:', status);
          return res.json({ received: true, status });
        }
      } else {
        console.log('📥 AbacatePay webhook event (not payment):', event);
        return res.json({ received: true });
      }
    } catch (error: any) {
      console.error('❌ AbacatePay webhook processing error:', error);
      return res.status(500).json({ error: error.message || 'Webhook processing failed' });
    }
  }

  // Continue with Stripe webhook processing
  if (!stripe) {
    return res.status(500).send('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.');
  }

  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !stripeWebhookSecret) {
    return res.status(400).send('Webhook secret not configured. Please set STRIPE_WEBHOOK_SECRET in your environment variables.');
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  await connectToMongoDB();
  const db = getDb();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('📥 Processing checkout.session.completed event:', {
          sessionId: session.id,
          mode: session.mode,
          customerId: session.customer,
          customerEmail: session.customer_email || session.customer_details?.email,
        });

        if (session.mode === 'subscription') {
          const subscriptionId = session.subscription as string;
          const customerId = session.customer as string;
          const customerEmail = session.customer_email || (session.customer_details?.email);

          if (!subscriptionId) {
            console.error('❌ No subscription ID found in checkout session:', session.id);
            break;
          }

          if (!customerId) {
            console.error('❌ No customer ID found in checkout session:', session.id);
            break;
          }

          console.log('✅ Checkout session completed for subscription:', { subscriptionId, customerId, customerEmail });

          try {
            console.log('📡 Retrieving subscription from Stripe:', subscriptionId);
            const subscription: Stripe.Subscription = await stripe!.subscriptions.retrieve(subscriptionId);
            const periodEnd = (subscription as any).current_period_end as number | undefined;
            console.log('✅ Subscription retrieved:', {
              status: subscription.status,
              currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            });

            // Get plan info from Stripe metadata
            console.log('📦 Getting plan info from Stripe metadata...');
            const planInfo = await getStripePlanInfo(subscriptionId);
            const tier = planInfo?.tier || 'premium';
            const monthlyCredits = planInfo?.monthlyCredits || 100;
            const creditsResetDate = calculateCreditsResetDate(subscription);

            console.log('📋 Plan info:', { tier, monthlyCredits, creditsResetDate: creditsResetDate.toISOString() });

            // Try to find user by stripeCustomerId first, then by email (for Payment Links)
            console.log('🔍 Searching for user by stripeCustomerId:', customerId);
            let user = await db.collection('users').findOne({ stripeCustomerId: customerId });

            if (!user && customerEmail) {
              // Payment Link case: find user by email and associate customerId
              console.log('🔍 User not found by customerId, searching by email:', customerEmail);
              user = await db.collection('users').findOne({ email: customerEmail });

              if (user) {
                // Associate the Stripe customer with our user
                console.log('🔗 Associating Stripe customer with user:', user._id);
                await db.collection('users').updateOne(
                  { _id: user._id },
                  { $set: { stripeCustomerId: customerId } }
                );
                console.log('✅ Associated Stripe customer with user:', user._id);
              }
            }

            // Try searching by subscriptionId if still not found
            if (!user && subscriptionId) {
              console.log('🔍 User not found by customerId/email, searching by subscriptionId:', subscriptionId);
              user = await db.collection('users').findOne({ stripeSubscriptionId: subscriptionId });
            }

            if (user) {
              console.log('👤 User found, updating subscription status:', {
                userId: user._id,
                email: user.email,
                currentStatus: user.subscriptionStatus,
                currentTier: user.subscriptionTier,
              });

              const updateResult = await db.collection('users').updateOne(
                { _id: user._id },
                {
                  $set: {
                    subscriptionStatus: 'active',
                    subscriptionTier: tier,
                    stripeSubscriptionId: subscriptionId,
                    stripeCustomerId: customerId, // Ensure customerId is set
                    subscriptionEndDate: creditsResetDate,
                    monthlyCredits: monthlyCredits,
                    creditsUsed: 0, // Reset credits when subscription starts
                    creditsResetDate: creditsResetDate,
                  },
                }
              );

              if (updateResult.modifiedCount > 0) {
                console.log('✅ User subscription activated successfully:', {
                  userId: user._id,
                  monthlyCredits,
                  tier,
                  creditsResetDate: creditsResetDate.toISOString(),
                });

                const paymentIntentId = typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : session.payment_intent?.id;

                await recordTransaction(db, {
                  userId: user._id,
                  type: 'subscription',
                  status: session.payment_status || subscription.status,
                  credits: monthlyCredits,
                  amount: session.amount_total ?? null,
                  currency: session.currency,
                  description: `${tier} subscription`,
                  stripeSessionId: session.id,
                  stripePaymentIntentId: paymentIntentId || undefined,
                  stripeCustomerId: customerId,
                });
              } else {
                console.warn('⚠️ User update returned 0 modified documents:', { userId: user._id });
              }
            } else {
              console.error('❌ User not found for customer:', {
                customerId,
                customerEmail,
                subscriptionId,
                suggestion: 'User may not exist in database or customer was not created during checkout'
              });
            }
          } catch (error: any) {
            console.error('❌ Error processing checkout.session.completed:', {
              error: error.message,
              stack: error.stack,
              subscriptionId,
              customerId,
            });
            // Don't throw - we want to acknowledge the webhook
          }
        } else if (session.mode === 'payment') {
          // One-time credit purchase (includes PIX payments)
          const customerIdRaw = session.customer;
          const customerId = typeof customerIdRaw === 'string' ? customerIdRaw : (customerIdRaw as any)?.id || null;
          const customerEmail = session.customer_email || (session.customer_details?.email);
          const paymentMethodTypes = session.payment_method_types || [];

          console.log('✅ Checkout session completed for one-time payment:', {
            sessionId: session.id,
            customerId,
            customerEmail,
            paymentMethodTypes,
            isPix: paymentMethodTypes.includes('pix'),
          });

          try {
            if (!stripe) {
              console.error('❌ Stripe is not configured');
              break;
            }

            // Get line items to extract product information
            // Get line items to extract product information
            let lineItems = null;
            let product: Stripe.Product | null = null;
            let credits = 0;

            try {
              lineItems = await stripe.checkout.sessions.listLineItems(session.id);
            } catch (stripeError: any) {
              if (stripeError.statusCode === 404) {
                const isLiveSession = session.id.startsWith('cs_live_');
                // Check if current key is likely a test key (starts with sk_test)
                const isTestKey = STRIPE_SECRET_KEY.startsWith('sk_test_');

                console.warn('⚠️ Stripe Session not found (404) via API. Using fallback credit calculation from amount.', {
                  sessionId: session.id,
                  isLiveSession,
                  usingTestKey: isTestKey,
                  amount: session.amount_total
                });
                // We don't throw here, we'll try to use amount_total fallback
              } else {
                console.error('❌ Error fetching line items:', stripeError);
                // For other errors we might want to throw or also fallback
              }
            }

            if (lineItems && lineItems.data && lineItems.data.length > 0) {
              // Get the first line item (we expect one product per checkout)
              const lineItem = lineItems.data[0];
              const priceId = typeof lineItem.price === 'string' ? lineItem.price : lineItem.price?.id;

              if (priceId) {
                try {
                  // Get price details to access product
                  const price = await stripe.prices.retrieve(priceId);
                  const productId = typeof price.product === 'string' ? price.product : price.product?.id;

                  if (productId) {
                    // Get product to extract credits from metadata
                    product = await stripe.products.retrieve(productId);
                    credits = parseInt(product.metadata?.credits || '0', 10);
                  }
                } catch (err: any) {
                  console.warn("⚠️ Failed to retrieve price/product details from Stripe:", err.message);
                }
              }
            }

            // Fallback: try to get credits from session metadata (for PIX payments with price_data)

            // Fallback: try to get credits from session metadata (for PIX payments with price_data)
            if (!credits || credits <= 0) {
              credits = parseInt(session.metadata?.credits || '0', 10);
            }

            // Final fallback: calculate credits from amount
            if (!credits || credits <= 0) {
              const amountTotal = session.amount_total ?? 0;
              credits = getCreditsByAmount(amountTotal, session.currency?.toUpperCase());
            }

            if (!credits || credits <= 0) {
              console.error('❌ Invalid or missing credits (Fallbacks failed):', {
                sessionMetadata: session.metadata,
                amountTotal: session.amount_total,
                currency: session.currency
              });
              break;
            }

            console.log('📦 Credit purchase detected:', {
              productId: product?.id || 'unknown',
              credits,
              sessionId: session.id,
              source: product ? 'product_metadata' : 'amount_calculation'
            });

            // Find user with priority: stripeCustomerId -> client_reference_id -> metadata.userId -> email
            console.log('👤 Starting user lookup process...');
            let user = null;
            let userFoundBy = '';

            // Step 1: By stripeCustomerId (most reliable)
            if (customerId) {
              console.log('🔍 Step 1: Looking up user by stripeCustomerId:', customerId);
              user = await db.collection('users').findOne({ stripeCustomerId: customerId });
              console.log('🔍 User lookup by customerId:', { customerId, found: !!user });
              if (user) {
                console.log('✅ User found by customerId:', { userId: user._id, email: user.email });
                userFoundBy = 'stripeCustomerId';
              }
            } else {
              console.log('⚠️ No customerId available, skipping customerId lookup');
            }

            // Step 2: By client_reference_id (priority high - comes from dynamic checkout)
            if (!user && session.client_reference_id) {
              console.log('🔍 Step 2: Looking up user by client_reference_id:', session.client_reference_id);
              try {
                user = await db.collection('users').findOne({ _id: new ObjectId(session.client_reference_id) });
                console.log('🔍 User lookup by client_reference_id:', { client_reference_id: session.client_reference_id, found: !!user });

                if (user) {
                  console.log('✅ User found by client_reference_id:', { userId: user._id, email: user.email });
                  userFoundBy = 'client_reference_id';

                  // Check for email mismatch
                  if (customerEmail && user.email !== customerEmail) {
                    console.warn('⚠️ Email mismatch detected:', {
                      userId: user._id,
                      accountEmail: user.email,
                      paymentEmail: customerEmail
                    });

                    // Create audit record for email mismatch
                    try {
                      await db.collection('email_mismatches').insertOne({
                        userId: user._id,
                        accountEmail: user.email,
                        paymentEmail: customerEmail,
                        sessionId: session.id,
                        timestamp: new Date()
                      });
                      console.log('📝 Email mismatch logged for audit');
                    } catch (mismatchError: any) {
                      console.warn('⚠️ Failed to log email mismatch:', mismatchError.message);
                    }
                  }
                }
              } catch (refError: any) {
                console.warn('⚠️ Invalid client_reference_id format:', refError.message);
              }
            }

            // Step 3: By metadata.userId (priority high)
            if (!user && session.metadata?.userId) {
              console.log('🔍 Step 3: Looking up user by metadata.userId:', session.metadata.userId);
              try {
                user = await db.collection('users').findOne({ _id: new ObjectId(session.metadata.userId) });
                console.log('🔍 User lookup by metadata.userId:', { metadataUserId: session.metadata.userId, found: !!user });

                if (user) {
                  console.log('✅ User found by metadata.userId:', { userId: user._id, email: user.email });
                  userFoundBy = 'metadata.userId';

                  // Check for email mismatch
                  if (customerEmail && user.email !== customerEmail) {
                    console.warn('⚠️ Email mismatch detected:', {
                      userId: user._id,
                      accountEmail: user.email,
                      paymentEmail: customerEmail
                    });

                    // Create audit record for email mismatch
                    try {
                      await db.collection('email_mismatches').insertOne({
                        userId: user._id,
                        accountEmail: user.email,
                        paymentEmail: customerEmail,
                        sessionId: session.id,
                        timestamp: new Date()
                      });
                      console.log('📝 Email mismatch logged for audit');
                    } catch (mismatchError: any) {
                      console.warn('⚠️ Failed to log email mismatch:', mismatchError.message);
                    }
                  }
                }
              } catch (metaError: any) {
                console.warn('⚠️ Invalid metadata.userId format:', metaError.message);
              }
            }

            // Step 4: By email (fallback - low priority)
            if (!user && customerEmail) {
              console.log('🔍 Step 4: Looking up user by email (fallback):', customerEmail);
              user = await db.collection('users').findOne({ email: customerEmail });
              console.log('🔍 User lookup by email:', { customerEmail, found: !!user });

              if (user) {
                console.log('✅ User found by email:', { userId: user._id, email: user.email });
                console.log('⚠️ User found by email (no user ID in payment) - less reliable');
                userFoundBy = 'email';

                // If found by email and we have a customerId, associate it
                if (customerId) {
                  console.log('🔗 Associating Stripe customerId with user account...');
                  await db.collection('users').updateOne(
                    { _id: user._id },
                    { $set: { stripeCustomerId: customerId } }
                  );
                  console.log('✅ Associated Stripe customer with user:', user._id);
                }
              } else {
                console.log('❌ User not found by email');
              }
            } else if (!user && !customerEmail) {
              console.log('⚠️ No customerEmail available, skipping email lookup');
            }

            // If user not found, create pending payment
            if (!user) {
              console.error('❌ User not found for credit purchase - creating pending payment:', {
                customerId,
                customerEmail,
                sessionId: session.id,
                client_reference_id: session.client_reference_id,
                metadata: session.metadata,
              });

              try {
                await db.collection('pending_payments').insertOne({
                  sessionId: session.id,
                  customerEmail: customerEmail || null,
                  amount: session.amount_total || 0,
                  credits: credits,
                  currency: session.currency || null,
                  timestamp: new Date(),
                  resolved: false
                });
                console.log('📝 Pending payment created - requires manual resolution');
              } catch (pendingError: any) {
                console.error('❌ Failed to create pending payment:', pendingError.message);
              }

              break; // Don't credit if user not found
            }

            if (user) {
              console.log('👤 User found:', {
                userId: user._id,
                email: user.email,
                foundBy: userFoundBy,
              });
              // Atomically increment totalCreditsEarned
              const updateResult = await db.collection('users').updateOne(
                { _id: user._id },
                { $inc: { totalCreditsEarned: credits } }
              );

              if (updateResult.modifiedCount > 0) {
                console.log('✅ Credits added to user account:', {
                  userId: user._id,
                  creditsAdded: credits,
                  sessionId: session.id,
                  timestamp: new Date().toISOString(),
                });

                // Get updated user to log current total
                const updatedUser = await db.collection('users').findOne({ _id: user._id });
                if (updatedUser) {
                  console.log('📊 Updated total credits earned:', updatedUser.totalCreditsEarned);
                }

                const paymentIntentId = typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : session.payment_intent?.id;

                await recordTransaction(db, {
                  userId: user._id,
                  type: 'purchase',
                  status: session.payment_status,
                  credits,
                  amount: session.amount_total ?? null,
                  currency: session.currency,
                  description: product?.name || 'Credit package',
                  stripeSessionId: session.id,
                  stripePaymentIntentId: paymentIntentId || undefined,
                  stripeCustomerId: customerId,
                });

                // Send credits purchased email
                try {
                  const { sendCreditsPurchasedEmail, isEmailConfigured } = await import('../services/emailService.js');

                  if (isEmailConfigured() && updatedUser) {
                    const totalCredits = (updatedUser.totalCreditsEarned || 0) +
                      Math.max(0, (updatedUser.monthlyCredits || 0) - (updatedUser.creditsUsed || 0));

                    await sendCreditsPurchasedEmail({
                      email: user.email,
                      name: user.name || undefined,
                      credits,
                      totalCredits,
                      amount: session.amount_total ?? undefined,
                      currency: session.currency ?? undefined,
                    });
                  } else if (!isEmailConfigured()) {
                    console.warn('Email service not configured. Credits purchased email not sent.');
                  }
                } catch (emailError: any) {
                  console.error('Error sending credits purchased email:', emailError);
                  // Don't fail the request if email fails, but log it
                }
              } else {
                console.warn('⚠️ Credit update returned 0 modified documents:', { userId: user._id });
              }
            } else {
              console.error('❌ User not found for credit purchase:', {
                customerId,
                customerEmail,
                sessionId: session.id,
              });
            }
          } catch (error: any) {
            console.error('❌ Error processing credit purchase:', {
              error: error.message,
              stack: error.stack,
              sessionId: session.id,
            });
          }
        } else {
          console.log('ℹ️ Checkout session is not for subscription or payment, skipping:', { mode: session.mode });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const subscriptionId = subscription.id;

        console.log('📥 Processing customer.subscription.updated event:', {
          subscriptionId,
          customerId,
          status: subscription.status,
        });

        try {
          // Get current user to check if plan changed
          const user = await db.collection('users').findOne({ stripeCustomerId: customerId });

          if (!user) {
            console.error('❌ User not found for subscription update:', { customerId, subscriptionId });
            break;
          }

          console.log('👤 User found for subscription update:', {
            userId: user._id,
            currentTier: user.subscriptionTier,
            currentStatus: user.subscriptionStatus,
          });

          const currentTier = user?.subscriptionTier || 'free';
          const currentPeriodEnd = user?.creditsResetDate
            ? new Date(user.creditsResetDate).getTime()
            : null;
          const newPeriodEnd = ((subscription as any).current_period_end as number) * 1000;

          // Get plan info from Stripe metadata
          const planInfo = await getStripePlanInfo(subscriptionId);
          const tier = planInfo?.tier || 'premium';
          const monthlyCredits = planInfo?.monthlyCredits || 100;
          const creditsResetDate = calculateCreditsResetDate(subscription);

          // Check if subscription period renewed or plan changed
          const planChanged = tier !== currentTier;
          const periodRenewed = currentPeriodEnd && newPeriodEnd > currentPeriodEnd;

          console.log('📊 Subscription update details:', {
            planChanged,
            periodRenewed,
            oldTier: currentTier,
            newTier: tier,
            oldPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd).toISOString() : null,
            newPeriodEnd: new Date(newPeriodEnd).toISOString(),
          });

          const updateData: any = {
            subscriptionStatus: subscription.status === 'active' ? 'active' : subscription.status,
            subscriptionEndDate: creditsResetDate,
            subscriptionTier: tier,
            monthlyCredits: monthlyCredits,
            creditsResetDate: creditsResetDate,
          };

          // Reset credits if period renewed or plan changed
          if (subscription.status === 'active' && (planChanged || periodRenewed)) {
            updateData.creditsUsed = 0;
            // creditsUsed now tracks ALL credits used (both earned and monthly)
            // When resetting, we only reset creditsUsed to 0
            // totalCreditsEarned is not affected (it was already deducted when used)
            console.log('🔄 Credits reset due to renewal or plan change');
          }

          const updateResult = await db.collection('users').updateOne(
            { stripeCustomerId: customerId },
            { $set: updateData }
          );

          if (updateResult.modifiedCount > 0) {
            console.log('✅ Subscription updated successfully:', {
              userId: user._id,
              newStatus: updateData.subscriptionStatus,
              newTier: tier,
            });
          } else {
            console.warn('⚠️ Subscription update returned 0 modified documents:', { userId: user._id });
          }
        } catch (error: any) {
          console.error('❌ Error processing customer.subscription.updated:', {
            error: error.message,
            stack: error.stack,
            subscriptionId,
            customerId,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        console.log('📥 Processing customer.subscription.deleted event:', {
          subscriptionId: subscription.id,
          customerId,
        });

        try {
          const user = await db.collection('users').findOne({ stripeCustomerId: customerId });

          if (!user) {
            console.error('❌ User not found for subscription deletion:', { customerId });
            break;
          }

          console.log('👤 User found, canceling subscription:', {
            userId: user._id,
            currentStatus: user.subscriptionStatus,
          });

          // Reset to free tier with 4 monthly credits
          const freeCreditsResetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          const updateResult = await db.collection('users').updateOne(
            { stripeCustomerId: customerId },
            {
              $set: {
                subscriptionStatus: 'canceled',
                subscriptionTier: 'free',
                stripeSubscriptionId: null,
                monthlyCredits: 20,
                creditsUsed: 0,
                creditsResetDate: freeCreditsResetDate,
              },
            }
          );

          if (updateResult.modifiedCount > 0) {
            console.log('✅ Subscription canceled successfully:', {
              userId: user._id,
              creditsResetDate: freeCreditsResetDate.toISOString(),
            });
          } else {
            console.warn('⚠️ Subscription cancellation returned 0 modified documents:', { userId: user._id });
          }
        } catch (error: any) {
          console.error('❌ Error processing customer.subscription.deleted:', {
            error: error.message,
            stack: error.stack,
            customerId,
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.log('📥 Processing invoice.payment_succeeded event:', {
          invoiceId: invoice.id,
          customerId,
        });

        try {
          const subscriptionId = (invoice as any).subscription
            ? (typeof (invoice as any).subscription === 'string'
              ? (invoice as any).subscription
              : (invoice as any).subscription?.id)
            : null;

          if (subscriptionId) {
            const user = await db.collection('users').findOne({ stripeCustomerId: customerId });

            if (!user) {
              console.error('❌ User not found for invoice payment succeeded:', { customerId });
              break;
            }

            console.log('✅ Updating user subscription status to active:', { userId: user._id });

            const updateResult = await db.collection('users').updateOne(
              { stripeCustomerId: customerId },
              {
                $set: {
                  subscriptionStatus: 'active',
                },
              }
            );

            if (updateResult.modifiedCount > 0) {
              console.log('✅ Subscription status updated to active:', { userId: user._id });
            }
          } else {
            console.log('ℹ️ Invoice is not for a subscription, skipping');
          }
        } catch (error: any) {
          console.error('❌ Error processing invoice.payment_succeeded:', {
            error: error.message,
            stack: error.stack,
            customerId,
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.log('📥 Processing invoice.payment_failed event:', {
          invoiceId: invoice.id,
          customerId,
        });

        try {
          const subscriptionId = (invoice as any).subscription
            ? (typeof (invoice as any).subscription === 'string'
              ? (invoice as any).subscription
              : (invoice as any).subscription?.id)
            : null;

          if (subscriptionId) {
            const user = await db.collection('users').findOne({ stripeCustomerId: customerId });

            if (!user) {
              console.error('❌ User not found for invoice payment failed:', { customerId });
              break;
            }

            console.log('⚠️ Updating user subscription status to past_due:', { userId: user._id });

            const updateResult = await db.collection('users').updateOne(
              { stripeCustomerId: customerId },
              {
                $set: {
                  subscriptionStatus: 'past_due',
                },
              }
            );

            if (updateResult.modifiedCount > 0) {
              console.log('✅ Subscription status updated to past_due:', { userId: user._id });
            }
          } else {
            console.log('ℹ️ Invoice is not for a subscription, skipping');
          }
        } catch (error: any) {
          console.error('❌ Error processing invoice.payment_failed:', {
            error: error.message,
            stack: error.stack,
            customerId,
          });
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// ========== ABACATEPAY ENDPOINTS ==========

// Create PIX payment using AbacatePay (alternative to Stripe PIX)
router.post('/create-abacate-pix', paymentRateLimiter, verifyBotId, authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Check if AbacatePay is configured
    if (!abacatepayService.isConfigured()) {
      console.error('❌ AbacatePay is not configured. ABACATEPAY_API_KEY is missing.');
      return res.status(503).json({
        error: 'PIX payment service is not available. Please contact support.',
        code: 'SERVICE_NOT_CONFIGURED'
      });
    }

    const { credits, currency, taxId } = req.body || {};

    if (!credits || credits <= 0) {
      return res.status(400).json({ error: 'Invalid credits amount' });
    }

    if (currency !== 'BRL') {
      return res.status(400).json({ error: 'PIX is only available for BRL currency' });
    }

    // Get credit package info
    const creditPackage = getCreditPackage(credits);
    if (!creditPackage) {
      return res.status(400).json({ error: 'Credit package not found' });
    }

    const price = getCreditPackagePrice(credits, currency);
    if (!price || price <= 0) {
      return res.status(400).json({ error: 'Invalid price for credit package' });
    }

    const userId = req.userId!;

    // Get user info using Prisma
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // Get or create abacateCustomerId
    // AbacatePay uses email as customer identifier, so we'll use email if no customer ID exists
    let abacateCustomerId = user.abacateCustomerId;

    // Save taxId to user profile if not already saved
    const taxIdNumbers = taxId ? taxId.replace(/\D/g, '') : '';
    const updateData: { taxId?: string; abacateCustomerId?: string } = {};

    if (!user.taxId && taxIdNumbers) {
      updateData.taxId = taxIdNumbers;
    }

    if (!abacateCustomerId && user.email) {
      // Use email as abacateCustomerId identifier (AbacatePay doesn't have separate customer API like Stripe)
      // The customer is created inline with the billing
      abacateCustomerId = user.email;
      updateData.abacateCustomerId = abacateCustomerId;
    }

    // Update user with abacateCustomerId and/or taxId if needed using Prisma
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
      console.log('✅ Updated user profile:', Object.keys(updateData));

      // Update local user object for use below
      if (updateData.taxId) {
        user = { ...user, taxId: updateData.taxId };
      }
      if (updateData.abacateCustomerId) {
        user = { ...user, abacateCustomerId: updateData.abacateCustomerId };
      }
    }

    // Convert price to cents (minor units)
    const amountInCents = Math.round(price * 100);

    console.log('🔗 Creating AbacatePay PIX payment:', {
      userId,
      credits,
      price,
      amountInCents,
      currency,
      userEmail: user.email,
      abacateCustomerId,
    });

    // Create payment with AbacatePay
    // Note: customerCellphone is optional and defaults to empty string if not provided
    // According to AbacatePay docs, if customer object is sent, all fields are required
    // But we use empty string as fallback which should work for PIX payments
    const payment = await abacatepayService.createPayment({
      credits,
      amount: amountInCents,
      customerEmail: user.email || '',
      customerName: user.name || user.email?.split('@')[0] || 'Cliente',
      customerCellphone: '', // Optional - using empty string as fallback
      customerTaxId: taxIdNumbers,
      userId: userId,
    });

    console.log('✅ AbacatePay payment created:', payment.id);

    // Store payment reference in database for tracking
    // Note: Still using MongoDB direct for payments collection (not migrated to Prisma yet)
    await connectToMongoDB();
    const db = getDb();
    await db.collection('payments').insertOne({
      userId: new ObjectId(userId),
      billId: payment.id,
      provider: 'abacatepay',
      type: 'credit_purchase',
      credits,
      amount: amountInCents,
      currency: 'BRL',
      status: payment.status,
      createdAt: new Date(),
    });

    res.json({
      billId: payment.id,
      sessionId: payment.id, // Use same ID for compatibility
      url: payment.url,
      qrCode: payment.qrCode,
      pixCode: payment.pixCode,
      status: payment.status,
      expiresAt: payment.expiresAt,
      provider: 'abacatepay',
    });
  } catch (error: any) {
    console.error('❌ AbacatePay payment creation error:', error);

    // Provide more specific error messages
    let statusCode = 500;
    let errorMessage = error.message || 'Failed to create AbacatePay payment';

    if (error.message?.includes('not configured') || error.message?.includes('ABACATEPAY_API_KEY')) {
      statusCode = 503;
      errorMessage = 'PIX payment service is not available. Please contact support.';
    }

    res.status(statusCode).json({
      error: errorMessage,
      code: statusCode === 503 ? 'SERVICE_NOT_CONFIGURED' : 'PAYMENT_CREATION_FAILED',
    });
  }
});

// Get AbacatePay payment status and PIX details
router.get('/abacate-pix-status/:billId', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { billId } = req.params;
    const userId = req.userId!;

    if (!billId) {
      return res.status(400).json({ error: 'Bill ID is required' });
    }

    // Verify user owns this payment
    await connectToMongoDB();
    const db = getDb();
    const payment = await db.collection('payments').findOne({
      billId,
      userId: new ObjectId(userId),
    });

    if (!payment) {
      return res.status(403).json({ error: 'Unauthorized access to this payment' });
    }

    // Get status from AbacatePay
    try {
      const status = await abacatepayService.getPaymentStatus(billId);

      res.json({
        billId: status.id,
        sessionId: status.id,
        status: status.status,
        pixCode: status.pixCode,
        qrCode: status.qrCode,
        expiresAt: status.expiresAt,
        paidAt: status.paidAt,
        amount: status.amount,
        provider: 'abacatepay',
      });
    } catch (error: any) {
      // If billing not found, return expired status instead of error
      if (error.message && error.message.includes('not found')) {
        console.warn(`⚠️ Billing ${billId} not found - returning expired status`);
        return res.json({
          billId,
          sessionId: billId,
          status: 'expired',
          pixCode: undefined,
          qrCode: undefined,
          expiresAt: undefined,
          paidAt: undefined,
          amount: 0,
          provider: 'abacatepay',
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('❌ Error getting AbacatePay payment status:', error);
    res.status(500).json({
      error: error.message || 'Failed to get payment status',
    });
  }
});

// AbacatePay webhook handler
router.post('/abacate-webhook', webhookRateLimiter, async (req, res) => {
  try {
    // Validate webhook secret if configured
    // AbacatePay sends the secret as a query parameter in the URL
    // Support multiple variable name variations for compatibility
    const abacateWebhookSecret = process.env.ABACATE_WEBHOOK_SECRET
      || process.env.ABACATEPAY_WEBHOOK_SECRET
      || process.env.ABACATEPAY_WEBHHOOK_SECRET; // Support typo variant
    const webhookSecret = req.query.secret as string | undefined;

    if (abacateWebhookSecret) {
      if (!webhookSecret || webhookSecret !== abacateWebhookSecret) {
        console.error('❌ AbacatePay webhook secret validation failed', {
          hasSecret: !!webhookSecret,
          secretMatch: webhookSecret === abacateWebhookSecret,
        });
        return res.status(401).json({ error: 'Invalid webhook secret' });
      }
      console.log('✅ AbacatePay webhook secret validated');
    } else {
      console.warn('⚠️ ABACATE_WEBHOOK_SECRET not configured - webhook validation disabled');
    }

    await connectToMongoDB();
    const db = getDb();

    // Use abacatepay service to process webhook
    const result = await abacatepayService.processWebhook(req.body, db);

    if (result.success) {
      console.log('✅ AbacatePay webhook processed successfully:', result.message);
      return res.status(200).json({ success: true, message: result.message });
    } else {
      console.error('❌ AbacatePay webhook processing failed:', result.message);
      // AbacatePay documentation says to return 200 even on some failures to avoid retries
      return res.status(200).json({ success: false, message: result.message });
    }
  } catch (error: any) {
    console.error('❌ AbacatePay webhook error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Get pending payments (for authenticated users)
router.get('/pending-payments', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;

    // Get user to check email
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find pending payments by email or allow admin to see all
    const query: any = { resolved: false };

    // Regular users can only see their own pending payments (by email)
    // Admins can see all (you can add admin check here if needed)
    if (user.email) {
      query.customerEmail = user.email;
    }

    const pendingPayments = await db.collection('pending_payments')
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();

    res.json({ pendingPayments });
  } catch (error: any) {
    console.error('❌ Error fetching pending payments:', error);
    next(error);
  }
});

// Resolve pending payment (associate with user)
router.post('/resolve-pending-payment', paymentRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const userId = req.userId!;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Get user
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find pending payment
    const pendingPayment = await db.collection('pending_payments').findOne({
      sessionId,
      resolved: false
    });

    if (!pendingPayment) {
      return res.status(404).json({ error: 'Pending payment not found or already resolved' });
    }

    // Verify email matches (optional security check)
    if (pendingPayment.customerEmail && user.email !== pendingPayment.customerEmail) {
      console.warn('⚠️ Email mismatch in pending payment resolution:', {
        userId: user._id,
        userEmail: user.email,
        paymentEmail: pendingPayment.customerEmail
      });
      // Still allow resolution but log it
    }

    // Credit the user
    const updateResult = await db.collection('users').updateOne(
      { _id: user._id },
      { $inc: { totalCreditsEarned: pendingPayment.credits } }
    );

    if (updateResult.modifiedCount > 0) {
      // Mark payment as resolved
      await db.collection('pending_payments').updateOne(
        { sessionId },
        {
          $set: {
            resolved: true,
            resolvedUserId: user._id,
            resolvedAt: new Date()
          }
        }
      );

      console.log('✅ Pending payment resolved:', {
        sessionId,
        userId: user._id,
        credits: pendingPayment.credits
      });

      res.json({
        success: true,
        credits: pendingPayment.credits,
        message: 'Payment resolved and credits added'
      });
    } else {
      return res.status(500).json({ error: 'Failed to credit user account' });
    }
  } catch (error: any) {
    console.error('❌ Error resolving pending payment:', error);
    next(error);
  }
});

export default router;

