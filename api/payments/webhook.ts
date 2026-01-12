// Dedicated Stripe webhook handler for Vercel
// This file is automatically detected by Vercel for /api/payments/webhook routes
// It handles the raw body before Express can parse it

// Dedicated Stripe webhook handler for Vercel
// This handler reads raw body directly from request stream to avoid parsing issues
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';
import { connectToMongoDB, getDb } from '../../server/db/mongodb.js';
import { getCreditsByAmount, getCreditPackagePrice } from '../../utils/creditPackages.js';
import { abacatepayService } from '../../server/services/abacatepayService.js';

// Load environment variables
dotenv.config();

const isDev = process.env.NODE_ENV !== 'production';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY is not configured');
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
}) : null;

// Helper functions (same as in payments.ts)
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

const calculateCreditsResetDate = (subscription: Stripe.Subscription): Date => {
  // current_period_end exists on Stripe.Subscription but TypeScript may not recognize it
  const periodEnd = (subscription as any).current_period_end as number;
  if (!periodEnd) {
    throw new Error('Subscription current_period_end is missing');
  }
  return new Date(periodEnd * 1000);
};

// Process webhook event asynchronously (runs in background after response is sent)
const processWebhookEvent = async (event: Stripe.Event): Promise<void> => {
  try {
    // Connect to MongoDB and get db instance directly
    const db = await connectToMongoDB();

    if (!db) {
      throw new Error('Database connection failed');
    }

    // Process webhook events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (isDev) console.log('📥 Processing checkout.session.completed event:', {
          sessionId: session.id,
          mode: session.mode,
        });

        if (session.mode === 'subscription') {
          const subscriptionIdRaw = session.subscription;
          const subscriptionId = typeof subscriptionIdRaw === 'string'
            ? subscriptionIdRaw
            : (subscriptionIdRaw as any)?.id || null;

          // Extract customerId - can be string or expanded object
          const customerIdRaw = session.customer;
          const customerId = typeof customerIdRaw === 'string'
            ? customerIdRaw
            : (customerIdRaw as any)?.id || null;
          const customerEmail = session.customer_email || (session.customer_details?.email);

          if (!subscriptionId || !customerId) {
            console.error('❌ Missing subscriptionId or customerId');
            return;
          }

          if (isDev) console.log('✅ Checkout session completed for subscription:', { subscriptionId, customerId, customerEmail });

          try {
            // Try to retrieve subscription - it might not exist immediately after checkout
            let subscription: Stripe.Subscription | null = null;
            try {
              subscription = await stripe!.subscriptions.retrieve(subscriptionId);
              if (isDev) console.log('✅ Subscription retrieved from Stripe');
            } catch (subError: any) {
              if (subError.code === 'resource_missing') {
                if (isDev) console.warn('⚠️ Subscription not found immediately after checkout. This can happen if the event fires before subscription is fully created.');
                if (isDev) console.warn('   Subscription ID:', subscriptionId);
                if (isDev) console.warn('   Will retry or use session data instead');

                // Try to get subscription info from the session or wait a bit
                // For now, we'll use default values and the subscription should be updated by customer.subscription.updated event
                if (isDev) console.log('💡 Using default subscription values. Subscription will be updated when customer.subscription.updated event fires.');
              } else {
                throw subError; // Re-throw if it's a different error
              }
            }

            // Get plan info - try from subscription first, then from session metadata
            let planInfo: StripePlanInfo | null = null;
            let tier = 'premium';
            let monthlyCredits = 100;
            let creditsResetDate: Date;

            if (subscription) {
              planInfo = await getStripePlanInfo(subscriptionId);
              tier = planInfo?.tier || 'premium';
              monthlyCredits = planInfo?.monthlyCredits || 100;
              creditsResetDate = calculateCreditsResetDate(subscription);
            } else {
              // Fallback: try to get info from session metadata or use defaults
              const sessionMetadata = session.metadata || {};
              tier = sessionMetadata.tier || 'premium';
              monthlyCredits = sessionMetadata.monthlyCredits
                ? parseInt(sessionMetadata.monthlyCredits, 10)
                : 100;

              // Default to 30 days from now if we can't get subscription period
              creditsResetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              if (isDev) console.log('⚠️ Using default subscription period (30 days) - will be updated by subscription.updated event');
            }

            // Find user by stripeCustomerId
            let user = await db.collection('users').findOne({ stripeCustomerId: customerId });

            if (!user && customerEmail) {
              user = await db.collection('users').findOne({ email: customerEmail });
              if (user) {
                await db.collection('users').updateOne(
                  { _id: user._id },
                  { $set: { stripeCustomerId: customerId } }
                );
              }
            }

            if (!user && subscriptionId) {
              user = await db.collection('users').findOne({ stripeSubscriptionId: subscriptionId });
            }

            if (user) {
              await db.collection('users').updateOne(
                { _id: user._id },
                {
                  $set: {
                    subscriptionStatus: 'active',
                    subscriptionTier: tier,
                    stripeSubscriptionId: subscriptionId,
                    stripeCustomerId: customerId,
                    subscriptionEndDate: creditsResetDate,
                    monthlyCredits: monthlyCredits,
                    creditsUsed: 0,
                    creditsResetDate: creditsResetDate,
                  },
                }
              );
              if (isDev) console.log('✅ User subscription activated:', { userId: user._id, monthlyCredits });
            } else {
              console.error('❌ User not found for customer:', { customerId, customerEmail, subscriptionId });
            }
          } catch (error: any) {
            console.error('❌ Error processing checkout.session.completed:', error);
          }
        } else if (session.mode === 'payment') {
          // One-time credit purchase
          // Extract customerId - can be string or expanded object
          const customerIdRaw = session.customer;
          let customerId = typeof customerIdRaw === 'string'
            ? customerIdRaw
            : (customerIdRaw as any)?.id || null;
          const customerEmail = session.customer_email || (session.customer_details?.email);
          const amountTotal = session.amount_total; // Total amount in cents

          if (isDev) console.log('✅ Checkout session completed for one-time payment:', {
            sessionId: session.id,
            customerId,
            customerEmail,
            amountTotal,
            amountTotalFormatted: amountTotal ? `R$ ${(amountTotal / 100).toFixed(2)}` : 'N/A',
            metadata: session.metadata,
          });

          try {
            if (!stripe) {
              console.error('❌ Stripe is not configured');
              return;
            }

            let credits = 0;
            let productId: string | null = null;

            // Try to get line items from session
            try {
              if (isDev) console.log('📦 Fetching line items for session:', session.id);
              const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { expand: ['data.price.product'] });

              if (isDev) console.log('📦 Line items retrieved:', {
                count: lineItems.data?.length || 0,
                lineItems: lineItems.data?.map(item => ({
                  description: item.description,
                  amount: item.amount_total,
                  priceId: typeof item.price === 'string' ? item.price : item.price?.id,
                })),
              });

              if (lineItems.data && lineItems.data.length > 0) {
                // Get the first line item (we expect one product per checkout)
                const lineItem = lineItems.data[0];
                const priceId = typeof lineItem.price === 'string' ? lineItem.price : lineItem.price?.id;

                if (priceId) {
                  if (isDev) console.log('📦 Retrieving price details:', priceId);
                  // Get price details to access product
                  const price = await stripe.prices.retrieve(priceId);
                  productId = typeof price.product === 'string' ? price.product : price.product?.id;

                  if (productId) {
                    if (isDev) console.log('📦 Retrieving product details:', productId);
                    // Get product to extract credits from metadata
                    const product = await stripe.products.retrieve(productId);

                    if (isDev) console.log('📦 Product retrieved:', {
                      productId,
                      name: product.name,
                      metadata: product.metadata,
                      description: product.description,
                    });

                    credits = parseInt(product.metadata?.credits || '0', 10);
                    if (credits > 0) {
                      if (isDev) console.log('✅ Credits found in product metadata:', credits);
                    }
                  }
                }
              }
            } catch (lineItemsError: any) {
              // If session doesn't exist or line items can't be retrieved, use fallback
              if (isDev) console.warn('⚠️ Could not retrieve line items, will use amount fallback:', lineItemsError.message);

              // Check if it's a "session not found" error
              if (lineItemsError.message?.includes('No such checkout session')) {
                if (isDev) console.log('⚠️ Checkout session not found - this may happen when re-sending webhooks manually or with Payment Links.');
                if (isDev) console.log('💡 Will use amount fallback based on session.amount_total from event data.');
              }

              // Explicitly reset credits to 0 to ensure fallback is used
              credits = 0;
              if (isDev) console.log('🔄 Credits reset to 0, proceeding with amount-based fallback...');
            }

            // Fallback: Try to match by amount if credits not found from product metadata
            if (!credits || credits <= 0) {
              if (isDev) console.log('🔄 Entering amount-based fallback to determine credits...');
              if (isDev) console.log('📊 Session data available:', {
                amountTotal,
                amountTotalFormatted: amountTotal ? `R$ ${(amountTotal / 100).toFixed(2)}` : 'N/A',
                amountSubtotal: session.amount_subtotal,
                amountSubtotalFormatted: session.amount_subtotal ? `R$ ${(session.amount_subtotal / 100).toFixed(2)}` : 'N/A',
              });

              const normalizedCurrency = session.currency ? session.currency.toUpperCase() : undefined;
              const amountForMatching = session.amount_subtotal && session.amount_subtotal > 0
                ? session.amount_subtotal
                : amountTotal;

              if (!amountForMatching || amountForMatching <= 0) {
                console.error('❌ Cannot determine credits - amountTotal is missing or invalid:', {
                  amountTotal,
                  amountSubtotal: session.amount_subtotal,
                  sessionId: session.id,
                });
                return;
              }

              const hasCoupon = session.amount_subtotal && session.amount_subtotal > 0 && session.amount_subtotal !== amountTotal;
              if (hasCoupon) {
                const discountAmount = session.amount_subtotal - amountTotal;
                const discountPercent = ((discountAmount / session.amount_subtotal) * 100).toFixed(2);
                if (isDev) console.log('💡 Coupon detected:', {
                  subtotal: `R$ ${(session.amount_subtotal / 100).toFixed(2)}`,
                  total: `R$ ${(amountTotal / 100).toFixed(2)}`,
                  discount: `R$ ${(discountAmount / 100).toFixed(2)} (${discountPercent}%)`,
                  message: 'Using subtotal for credit matching to identify the package.',
                });
              }

              // Debug: log what we're passing to getCreditsByAmount
              if (isDev) console.log('🔍 Calling getCreditsByAmount:', {
                amountForMatching,
                amountFormatted: `R$ ${(amountForMatching / 100).toFixed(2)}`,
                currency: normalizedCurrency,
              });

              credits = getCreditsByAmount(amountForMatching, normalizedCurrency);

              if (isDev) console.log('🔍 getCreditsByAmount returned:', credits);

              if (credits > 0) {
                // Check if this was an exact match or tolerance match (coupon)
                const expectedPrice = getCreditPackagePrice(credits, normalizedCurrency || 'BRL');
                const expectedPriceInMinorUnits = Math.round(expectedPrice * 100);
                const isExactMatch = expectedPriceInMinorUnits === amountForMatching;

                if (isExactMatch) {
                  if (isDev) console.log('✅ Matched credits by amount (exact match):', {
                    amountUsed: amountForMatching,
                    amountFormatted: `R$ ${(amountForMatching / 100).toFixed(2)}`,
                    amountTotal,
                    amountSubtotal: session.amount_subtotal,
                    currency: normalizedCurrency,
                    credits,
                  });
                } else {
                  if (isDev) console.log('✅ Matched credits by amount (with coupon/tolerance):', {
                    amountUsed: amountForMatching,
                    amountFormatted: `R$ ${(amountForMatching / 100).toFixed(2)}`,
                    expectedPrice: `R$ ${expectedPrice.toFixed(2)}`,
                    discount: `R$ ${((expectedPriceInMinorUnits - amountForMatching) / 100).toFixed(2)}`,
                    discountPercent: `${(((expectedPriceInMinorUnits - amountForMatching) / expectedPriceInMinorUnits) * 100).toFixed(2)}%`,
                    amountTotal,
                    amountSubtotal: session.amount_subtotal,
                    currency: normalizedCurrency,
                    credits,
                  });
                }
              } else {
                console.error('❌ Could not determine credits - amount does not match any known packages:', {
                  productId,
                  amountTotal,
                  amountSubtotal: session.amount_subtotal,
                  amountUsed: amountForMatching,
                  currency: normalizedCurrency,
                });
                return;
              }
            } else {
              if (isDev) console.log('✅ Using credits from product metadata (fallback not needed):', credits);
            }

            if (isDev) console.log('📦 Credit purchase detected:', {
              productId,
              credits,
              sessionId: session.id,
              customerId,
              customerEmail,
              amountTotal,
            });

            // Find user with priority: stripeCustomerId -> client_reference_id -> metadata.userId -> email
            if (isDev) console.log('👤 Starting user lookup process...');
            let user = null;
            let userFoundBy = '';

            // Step 1: By stripeCustomerId (most reliable)
            if (customerId) {
              if (isDev) console.log('🔍 Step 1: Looking up user by stripeCustomerId:', customerId);
              user = await db.collection('users').findOne({ stripeCustomerId: customerId });
              if (isDev) console.log('🔍 User lookup by customerId:', { customerId, found: !!user });
              if (user) {
                if (isDev) console.log('✅ User found by customerId:', { userId: user._id, email: user.email });
                userFoundBy = 'stripeCustomerId';
              }
            } else {
              if (isDev) console.log('⚠️ No customerId available, skipping customerId lookup');
            }

            // Step 2: By client_reference_id (priority high - comes from dynamic checkout)
            if (!user && session.client_reference_id) {
              if (isDev) console.log('🔍 Step 2: Looking up user by client_reference_id:', session.client_reference_id);
              try {
                user = await db.collection('users').findOne({ _id: new ObjectId(session.client_reference_id) });
                if (isDev) console.log('🔍 User lookup by client_reference_id:', { client_reference_id: session.client_reference_id, found: !!user });

                if (user) {
                  if (isDev) console.log('✅ User found by client_reference_id:', { userId: user._id, email: user.email });
                  userFoundBy = 'client_reference_id';

                  // Check for email mismatch
                  if (customerEmail && user.email !== customerEmail) {
                    if (isDev) console.warn('⚠️ Email mismatch detected:', {
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
                      if (isDev) console.log('📝 Email mismatch logged for audit');
                    } catch (mismatchError: any) {
                      if (isDev) console.warn('⚠️ Failed to log email mismatch:', mismatchError.message);
                    }
                  }
                }
              } catch (refError: any) {
                if (isDev) console.warn('⚠️ Invalid client_reference_id format:', refError.message);
              }
            }

            // Step 3: By metadata.userId (priority high)
            if (!user && session.metadata?.userId) {
              if (isDev) console.log('🔍 Step 3: Looking up user by metadata.userId:', session.metadata.userId);
              try {
                user = await db.collection('users').findOne({ _id: new ObjectId(session.metadata.userId) });
                if (isDev) console.log('🔍 User lookup by metadata.userId:', { metadataUserId: session.metadata.userId, found: !!user });

                if (user) {
                  if (isDev) console.log('✅ User found by metadata.userId:', { userId: user._id, email: user.email });
                  userFoundBy = 'metadata.userId';

                  // Check for email mismatch
                  if (customerEmail && user.email !== customerEmail) {
                    if (isDev) console.warn('⚠️ Email mismatch detected:', {
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
                      if (isDev) console.log('📝 Email mismatch logged for audit');
                    } catch (mismatchError: any) {
                      if (isDev) console.warn('⚠️ Failed to log email mismatch:', mismatchError.message);
                    }
                  }
                }
              } catch (metaError: any) {
                if (isDev) console.warn('⚠️ Invalid metadata.userId format:', metaError.message);
              }
            }

            // Step 4: By email (fallback - low priority)
            if (!user && customerEmail) {
              if (isDev) console.log('🔍 Step 4: Looking up user by email (fallback):', customerEmail);
              user = await db.collection('users').findOne({ email: customerEmail });
              if (isDev) console.log('🔍 User lookup by email:', { customerEmail, found: !!user });

              if (user) {
                if (isDev) console.log('✅ User found by email:', { userId: user._id, email: user.email });
                if (isDev) console.log('⚠️ User found by email (no user ID in payment) - less reliable');
                userFoundBy = 'email';

                // Try to get customerId from payment intent if not in session
                if (!customerId && session.payment_intent) {
                  try {
                    const paymentIntentId = typeof session.payment_intent === 'string'
                      ? session.payment_intent
                      : (session.payment_intent as any)?.id;

                    if (paymentIntentId) {
                      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                      if (paymentIntent.customer) {
                        const piCustomerId = typeof paymentIntent.customer === 'string'
                          ? paymentIntent.customer
                          : (paymentIntent.customer as any)?.id;
                        if (piCustomerId) {
                          customerId = piCustomerId;
                          if (isDev) console.log('✅ Found customerId from payment intent:', piCustomerId);
                        }
                      }
                    }
                  } catch (piError: any) {
                    if (isDev) console.warn('⚠️ Could not retrieve payment intent for customerId:', piError.message);
                  }
                }

                // If found by email and we have a customerId, associate it
                if (customerId) {
                  if (isDev) console.log('🔗 Associating Stripe customerId with user account...');
                  await db.collection('users').updateOne(
                    { _id: user._id },
                    { $set: { stripeCustomerId: customerId } }
                  );
                  if (isDev) console.log('✅ Associated Stripe customer with user:', user._id);
                }
              } else {
                if (isDev) console.log('❌ User not found by email');
              }
            } else if (!user && !customerEmail) {
              if (isDev) console.log('⚠️ No customerEmail available, skipping email lookup');
            }

            // Consolidate finalCustomerId - use customerId from session or payment intent
            let finalCustomerId = customerId;

            // If we still don't have a customerId and have a payment intent, try to get it
            if (!finalCustomerId && session.payment_intent) {
              if (isDev) console.log('🔍 Step 5: Attempting to get customerId from payment intent...');
              try {
                const paymentIntentId = typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : (session.payment_intent as any)?.id;

                if (paymentIntentId) {
                  if (isDev) console.log('📦 Retrieving payment intent:', paymentIntentId);
                  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                  if (paymentIntent.customer) {
                    const piCustomerId = typeof paymentIntent.customer === 'string'
                      ? paymentIntent.customer
                      : (paymentIntent.customer as any)?.id;

                    if (piCustomerId) {
                      finalCustomerId = piCustomerId;
                      if (isDev) console.log('✅ Found customerId from payment intent:', piCustomerId);

                      // Try to find user by this customerId if not found yet
                      if (!user) {
                        if (isDev) console.log('🔍 Looking up user by payment intent customerId:', piCustomerId);
                        user = await db.collection('users').findOne({ stripeCustomerId: piCustomerId });
                        if (isDev) console.log('🔍 User lookup by payment intent customer:', { customerId: piCustomerId, found: !!user });
                        if (user) {
                          if (isDev) console.log('✅ User found by payment intent customer:', { userId: user._id, email: user.email });
                          userFoundBy = 'payment_intent_customerId';
                        }
                      }
                    } else {
                      if (isDev) console.log('⚠️ Payment intent has no customerId');
                    }
                  } else {
                    if (isDev) console.log('⚠️ Payment intent has no customer');
                  }
                } else {
                  if (isDev) console.log('⚠️ Could not extract payment intent ID');
                }
              } catch (piError: any) {
                if (isDev) console.warn('⚠️ Could not retrieve payment intent:', piError.message);
              }
            }

            // If user not found, create pending payment
            if (!user) {
              console.error('❌ User not found for credit purchase - creating pending payment:', {
                customerId,
                customerEmail,
                sessionId: session.id,
                client_reference_id: session.client_reference_id,
                metadata: session.metadata,
                paymentIntent: session.payment_intent,
              });

              try {
                await db.collection('pending_payments').insertOne({
                  sessionId: session.id,
                  customerEmail: customerEmail || null,
                  amount: amountTotal || 0,
                  credits: credits,
                  currency: session.currency || null,
                  timestamp: new Date(),
                  resolved: false
                });
                if (isDev) console.log('📝 Pending payment created - requires manual resolution');
              } catch (pendingError: any) {
                console.error('❌ Failed to create pending payment:', pendingError.message);
              }

              // Log all users for debugging (only in development)
              if (process.env.NODE_ENV === 'development') {
                const allUsers = await db.collection('users').find({}).limit(5).toArray();
                console.log('🔍 Sample users in database:', allUsers.map(u => ({
                  id: u._id,
                  email: u.email,
                  stripeCustomerId: u.stripeCustomerId
                })));
              }

              return; // Don't credit if user not found
            }

            if (user) {
              try {
                if (isDev) console.log('👤 User found:', {
                  userId: user._id,
                  email: user.email,
                  foundBy: userFoundBy,
                  currentTotalCredits: user.totalCreditsEarned || 0,
                  creditsToAdd: credits,
                  sessionId: session.id,
                  currentStripeCustomerId: user.stripeCustomerId || null,
                  finalCustomerId: finalCustomerId || null,
                });

                // Prepare update object
                const updateFields: any = {
                  $inc: { totalCreditsEarned: credits }
                };

                // If user doesn't have a stripeCustomerId, create/associate one
                if (!user.stripeCustomerId) {
                  if (finalCustomerId) {
                    // We have a customerId from session or payment intent
                    if (isDev) console.log('🔗 Associating existing Stripe customer with user account...');

                    // Verify customer exists in Stripe
                    try {
                      await stripe.customers.retrieve(finalCustomerId);
                      if (isDev) console.log('✅ Verified Stripe customer exists:', finalCustomerId);
                      updateFields.$set = { stripeCustomerId: finalCustomerId };
                      if (isDev) console.log('💾 Will update stripeCustomerId to:', finalCustomerId);
                    } catch (error: any) {
                      if (error.code === 'resource_missing') {
                        // Customer doesn't exist, create one
                        if (isDev) console.log('⚠️ Customer ID not found in Stripe, creating new customer...');
                        const stripeCustomer = await stripe.customers.create({
                          email: customerEmail || user.email,
                          metadata: {
                            userId: user._id.toString(),
                          },
                        });
                        updateFields.$set = { stripeCustomerId: stripeCustomer.id };
                        if (isDev) console.log('✅ Created new Stripe customer:', stripeCustomer.id);
                      } else {
                        if (isDev) console.warn('⚠️ Error verifying customer:', error.message);
                      }
                    }
                  } else {
                    // No customerId available, create a new one
                    if (isDev) console.log('📝 Creating new Stripe customer for user (no customerId found)...');
                    const stripeCustomer = await stripe.customers.create({
                      email: customerEmail || user.email,
                      metadata: {
                        userId: user._id.toString(),
                      },
                    });
                    updateFields.$set = { stripeCustomerId: stripeCustomer.id };
                    if (isDev) console.log('✅ Created new Stripe customer:', stripeCustomer.id);
                  }
                } else if (finalCustomerId && user.stripeCustomerId !== finalCustomerId) {
                  // User has a different customerId, update it
                  if (isDev) console.log('🔄 Updating stripeCustomerId from', user.stripeCustomerId, 'to', finalCustomerId);
                  updateFields.$set = { stripeCustomerId: finalCustomerId };
                }

                if (isDev) console.log('💾 Updating user credits in database...');
                // Atomically increment totalCreditsEarned and update stripeCustomerId if needed
                const updateResult = await db.collection('users').updateOne(
                  { _id: user._id },
                  updateFields
                );

                if (isDev) console.log('💾 Database update result:', {
                  matchedCount: updateResult.matchedCount,
                  modifiedCount: updateResult.modifiedCount,
                  acknowledged: updateResult.acknowledged,
                });

                if (updateResult.modifiedCount > 0) {
                  if (isDev) console.log('✅ Credits added to user account:', {
                    userId: user._id,
                    creditsAdded: credits,
                    sessionId: session.id,
                    timestamp: new Date().toISOString(),
                  });

                  // Get updated user to log current total
                  const updatedUser = await db.collection('users').findOne({ _id: user._id });
                  if (updatedUser) {
                    if (isDev) console.log('📊 Updated total credits earned:', updatedUser.totalCreditsEarned);
                  }
                } else {
                  if (isDev) console.warn('⚠️ Credit update returned 0 modified documents:', {
                    userId: user._id,
                    matchedCount: updateResult.matchedCount,
                  });
                }
              } catch (error: any) {
                console.error('❌ Error processing credit purchase:', {
                  error: error.message,
                  stack: error.stack,
                  sessionId: session.id,
                });
              }
            }
          } catch (error: any) {
            console.error('❌ Error processing payment mode checkout:', error);
          }
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (isDev) console.log('📥 Processing checkout.session.expired event:', {
          sessionId: session.id,
          mode: session.mode,
        });
        // Evento de sessão expirada - geralmente não precisa atualizar o banco
        // A sessão já expirou, então não há ação necessária
        if (isDev) console.log('ℹ️ Checkout session expired - no action needed');
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        // Handle other events - implement if needed
        if (isDev) console.log(`📥 Received ${event.type} event (not processed in dedicated handler)`);
        if (isDev) console.log('💡 Consider implementing handler or route to main payments.ts');
        break;
      }
    }
  } catch (error: any) {
    console.error('❌ Error in async webhook processing:', error);
    // Don't throw - we've already acknowledged the webhook
  }
};

// Vercel serverless function handler for webhook
export default async (req: any, res: any) => {
  if (isDev) console.log('🔔 Webhook endpoint hit:', {
    method: req.method,
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'stripe-signature': req.headers['stripe-signature'] ? 'present' : 'missing'
    }
  });

  // Only allow POST requests
  if (req.method !== 'POST') {
    if (isDev) console.log('⚠️ Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Check if this is an AbacatePay webhook (has webhookSecret query param or missing stripe-signature)
  const webhookSecretQuery = req.query?.webhookSecret || req.query?.secret;
  const sig = req.headers['stripe-signature'];

  // If webhookSecret is in query params and no stripe-signature, it's AbacatePay
  if (webhookSecretQuery && !sig) {
    if (isDev) console.log('🔍 Detected AbacatePay webhook, processing...');
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
        if (isDev) console.log('✅ AbacatePay webhook secret validated');
      } else {
        if (isDev) console.warn('⚠️ ABACATEPAY_WEBHOOK_SECRET not configured - webhook validation disabled');
      }

      // Parse body for AbacatePay webhook
      let body: any;
      try {
        if (typeof req.body === 'string') {
          body = JSON.parse(req.body);
        } else if (Buffer.isBuffer(req.body)) {
          body = JSON.parse(req.body.toString('utf8'));
        } else {
          body = req.body;
        }
      } catch (parseError: any) {
        console.error('❌ Error parsing AbacatePay webhook body:', parseError);
        return res.status(400).json({ error: 'Invalid request body' });
      }

      // Log full body structure for debugging
      if (isDev) console.log('📥 AbacatePay webhook body structure:', JSON.stringify(body, null, 2));

      const { event, data } = body;

      // Try multiple possible locations for billId
      const billId = data?.id || data?.billId || data?.billing?.id || body?.id || body?.billId || body?.billing?.id;

      if (isDev) console.log('📥 AbacatePay webhook received:', {
        event,
        billId,
        dataKeys: data ? Object.keys(data) : [],
        bodyKeys: Object.keys(body),
        dataId: data?.id,
        bodyId: body?.id
      });

      if (event === 'billing.paid' || event === 'billing.payment_received') {
        // billId was already extracted above
        if (!billId) {
          console.error('❌ Bill ID is missing from webhook. Body structure:', JSON.stringify(body, null, 2));
          return res.status(400).json({ error: 'Bill ID is missing' });
        }

        await connectToMongoDB();
        const db = getDb();

        // Find payment in database
        let payment = await db.collection('payments').findOne({ billId });

        // Use webhook data directly - it already contains payment status
        // Check multiple possible locations for status and amount
        const pixQrCodeStatus = data?.pixQrCode?.status || data?.pixQrCode?.paymentStatus;
        const pixQrCodeAmount = data?.pixQrCode?.amount;
        const pixQrCodeMetadata = data?.pixQrCode?.metadata || {};

        // Check billing status (new format)
        const billingStatusStr = data?.billing?.status;
        const billingPaidAmount = data?.billing?.paidAmount;
        const billingAmount = data?.billing?.amount;
        const paymentAmount = data?.payment?.amount;

        // Determine if payment is confirmed from webhook data
        // If event is billing.paid, check for paidAmount or status indicating payment
        let isPaidFromWebhook = false;

        if (event === 'billing.paid' || event === 'billing.payment_received') {
          // When event is billing.paid, check for indicators of payment
          if (billingPaidAmount && billingPaidAmount > 0) {
            // paidAmount exists and > 0 means payment was made
            isPaidFromWebhook = true;
            if (isDev) console.log('✅ Payment confirmed by billing.paidAmount:', billingPaidAmount);
          } else if (billingStatusStr === 'ACTIVE' && (billingPaidAmount || paymentAmount)) {
            // ACTIVE status with payment amount means paid
            isPaidFromWebhook = true;
            if (isDev) console.log('✅ Payment confirmed by ACTIVE status with payment amount');
          } else if (pixQrCodeStatus === 'PAID' || pixQrCodeStatus === 'CONFIRMED') {
            isPaidFromWebhook = true;
            if (isDev) console.log('✅ Payment confirmed by pixQrCode status:', pixQrCodeStatus);
          } else if (billingStatusStr === 'PAID' || billingStatusStr === 'CONFIRMED') {
            isPaidFromWebhook = true;
            if (isDev) console.log('✅ Payment confirmed by billing status:', billingStatusStr);
          }
        }

        // Fallback to API call only if webhook doesn't have clear status
        let billingStatus: any = null;
        let amountPaidInCents = pixQrCodeAmount || billingPaidAmount || paymentAmount || billingAmount || 0;
        let isPaid = isPaidFromWebhook;

        if (!isPaidFromWebhook) {
          // If webhook data doesn't confirm payment, try API call
          if (isDev) console.log('📞 Webhook status unclear, calling API...');
          try {
            billingStatus = await abacatepayService.getPaymentStatus(billId);
            amountPaidInCents = billingStatus.amount || amountPaidInCents;
            isPaid = billingStatus.status === 'PAID' || billingStatus.status === 'CONFIRMED' || billingStatus.status === 'ACTIVE+' ||
              (billingStatus.status === 'ACTIVE' && billingStatus.amount > 0);
            if (isDev) console.log('📥 API returned status:', billingStatus.status);
          } catch (apiError: any) {
            if (isDev) console.warn('⚠️ API call failed, using webhook data:', apiError.message);
            // Continue with webhook data - if event is billing.paid, assume paid
            if (event === 'billing.paid' && amountPaidInCents > 0) {
              isPaid = true;
              if (isDev) console.log('✅ Assuming payment confirmed based on billing.paid event with amount');
            }
          }
        }

        if (isPaid) {
          // Extract actual amount paid (in cents) - prefer webhook data
          if (!amountPaidInCents && billingStatus) {
            amountPaidInCents = billingStatus.amount || 0;
          }

          // Use getCreditsByAmount to identify the correct package (supports coupons)
          let credits = 0;

          // Try to get credits from metadata first (check multiple locations)
          const metadataCredits = pixQrCodeMetadata.credits || data?.billing?.metadata?.credits || data?.metadata?.credits;
          if (metadataCredits) {
            credits = parseInt(metadataCredits, 10);
            if (isDev) console.log('📦 Using credits from webhook metadata:', credits);
          } else if (payment && payment.credits) {
            credits = payment.credits;
            if (isDev) console.log('📦 Using credits from payment record:', credits);
          } else if (amountPaidInCents > 0) {
            credits = getCreditsByAmount(amountPaidInCents, 'BRL');
            if (isDev) console.log('📦 Calculated credits from amount paid:', { amountPaidInCents, credits });
          }

          if (credits <= 0) {
            console.error('❌ Invalid credits amount:', { billId, amountPaidInCents, credits, metadata: pixQrCodeMetadata });
            return res.status(400).json({ error: 'Invalid credits amount' });
          }

          // Find user - try metadata first, then payment record, then email
          let user = null;
          let userId: ObjectId | null = null;

          // Try userId from metadata first (most reliable) - check multiple locations
          const metadataUserId = pixQrCodeMetadata.userId ||
            data?.billing?.metadata?.userId ||
            data?.metadata?.userId;
          if (metadataUserId) {
            try {
              userId = new ObjectId(metadataUserId);
              user = await db.collection('users').findOne({ _id: userId });
              if (user) {
                if (isDev) console.log('👤 Found user by metadata userId:', metadataUserId);
              }
            } catch (idError: any) {
              if (isDev) console.warn('⚠️ Invalid userId in metadata:', metadataUserId);
            }
          }

          // Fallback to payment record
          if (!user && payment && payment.userId) {
            userId = payment.userId instanceof ObjectId ? payment.userId : new ObjectId(payment.userId);
            user = await db.collection('users').findOne({ _id: userId });
            if (user) {
              if (isDev) console.log('👤 Found user by payment record userId');
            }
          }

          // Fallback to email from customer data (check multiple locations)
          const customerEmail = data?.pixQrCode?.customer?.email ||
            data?.pixQrCode?.customer?.metadata?.email ||
            data?.billing?.customer?.metadata?.email ||
            data?.billing?.customer?.email ||
            data?.customer?.email;
          if (!user && customerEmail) {
            user = await db.collection('users').findOne({ email: customerEmail });
            if (user) {
              userId = user._id;
              if (isDev) console.log('👤 Found user by email:', customerEmail);
            }
          }

          if (!user || !userId) {
            console.error('❌ User not found for AbacatePay payment:', {
              billId,
              userId,
              metadataUserId: metadataUserId,
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
            if (isDev) console.log('✅ Credits added via AbacatePay webhook:', {
              userId,
              credits,
              billId,
              source: pixQrCodeMetadata.credits ? 'metadata' : (payment?.credits ? 'payment_record' : 'calculated'),
            });

            // Send credits purchased email
            try {
              const { sendCreditsPurchasedEmail, isEmailConfigured } = await import('../../server/services/emailService.js');

              if (isEmailConfigured()) {
                // Get updated user to calculate total credits
                const updatedUser = await db.collection('users').findOne({ _id: userId });
                if (updatedUser) {
                  const totalCredits = (updatedUser.totalCreditsEarned || 0) +
                    Math.max(0, (updatedUser.monthlyCredits || 0) - (updatedUser.creditsUsed || 0));

                  const amountPaid = amountPaidInCents || billingStatus?.amount || payment?.amount;

                  await sendCreditsPurchasedEmail({
                    email: user.email,
                    name: user.name || undefined,
                    credits,
                    totalCredits,
                    amount: amountPaid,
                    currency: 'BRL',
                  });
                }
              } else {
                if (isDev) console.warn('Email service not configured. Credits purchased email not sent.');
              }
            } catch (emailError: any) {
              console.error('Error sending credits purchased email:', emailError);
              // Don't fail the request if email fails, but log it
            }
          } else {
            if (isDev) console.warn('⚠️ Credit update returned 0 modified documents:', {
              userId,
              matchedCount: updateResult.matchedCount,
            });
          }

          return res.json({ received: true, credits });
        } else {
          const status = pixQrCodeStatus || billingStatusStr || billingStatus?.status || 'UNKNOWN';
          if (isDev) console.log('⏳ Payment not yet confirmed:', status);
          return res.json({ received: true, status });
        }
      } else {
        if (isDev) console.log('📥 AbacatePay webhook event (not payment):', event);
        return res.json({ received: true });
      }
    } catch (error: any) {
      console.error('❌ AbacatePay webhook processing error:', error);
      return res.status(500).json({ error: error.message || 'Webhook processing failed' });
    }
  }

  // Continue with Stripe webhook processing
  if (!stripe) {
    console.error('❌ Stripe is not configured');
    return res.status(500).json({ error: 'Stripe is not configured' });
  }

  if (!sig || !STRIPE_WEBHOOK_SECRET) {
    console.error('❌ Webhook secret not configured:', {
      hasSig: !!sig,
      hasSecret: !!STRIPE_WEBHOOK_SECRET
    });
    return res.status(400).json({ error: 'Webhook secret not configured' });
  }

  // IMPORTANT: Always read raw body from stream to avoid parsing issues
  // Even if req.body exists, we read from stream to ensure we get the raw bytes
  let bodyBuffer: Buffer;

  try {
    if (isDev) console.log('📥 Reading raw body from request stream...');
    if (isDev) console.log('   req.body type:', typeof req.body);
    if (isDev) console.log('   req.body is Buffer:', Buffer.isBuffer(req.body));

    // Always read from stream to get raw body, regardless of req.body state
    const chunks: Buffer[] = [];

    // If body is already a Buffer and stream is not readable, use it
    if (Buffer.isBuffer(req.body) && !req.readable) {
      bodyBuffer = req.body;
      if (isDev) console.log('✅ Using req.body as Buffer (stream already consumed), length:', bodyBuffer.length);
    } else {
      // Read from stream
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Stream read timeout'));
        }, 10000); // Increased timeout

        // If stream is already ended, try to use req.body
        if (req.readableEnded || !req.readable) {
          clearTimeout(timeout);
          if (Buffer.isBuffer(req.body)) {
            bodyBuffer = req.body;
            if (isDev) console.log('✅ Stream already ended, using req.body as Buffer, length:', bodyBuffer.length);
            return resolve();
          } else if (typeof req.body === 'string') {
            bodyBuffer = Buffer.from(req.body, 'utf8');
            if (isDev) console.log('✅ Stream already ended, converted req.body string to Buffer, length:', bodyBuffer.length);
            return resolve();
          } else {
            return reject(new Error('Stream ended but req.body is not usable'));
          }
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

      if (!bodyBuffer) {
        bodyBuffer = Buffer.concat(chunks);
        if (isDev) console.log('✅ Body read from stream, length:', bodyBuffer.length);
      }
    }

    if (!bodyBuffer || bodyBuffer.length === 0) {
      console.error('❌ Webhook body is empty');
      return res.status(400).json({ error: 'Webhook Error: Empty body' });
    }

    if (isDev) console.log('✅ Body ready for signature verification, length:', bodyBuffer.length);
  } catch (error: any) {
    console.error('❌ Error reading webhook body:', error.message);
    if (isDev) console.error('   Error stack:', error.stack);

    // If stream reading failed, try to use req.body as fallback
    if (Buffer.isBuffer(req.body)) {
      if (isDev) console.log('⚠️ Fallback: Using req.body as Buffer');
      bodyBuffer = req.body;
    } else if (typeof req.body === 'string') {
      if (isDev) console.log('⚠️ Fallback: Converting req.body string to Buffer');
      bodyBuffer = Buffer.from(req.body, 'utf8');
    } else {
      return res.status(400).json({
        error: `Webhook Error: Failed to read request body - ${error.message}`,
        hint: 'Body may have been parsed as JSON. Ensure webhook routes directly to this handler.'
      });
    }
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature using raw body (as Buffer)
    if (isDev) console.log('🔐 Verifying webhook signature...');
    event = stripe.webhooks.constructEvent(bodyBuffer, sig, STRIPE_WEBHOOK_SECRET);
    if (isDev) console.log('✅ Webhook signature verified, event type:', event.type);
  } catch (err: any) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Process the event BEFORE returning response
  // This ensures we can catch and log any errors properly
  try {
    if (isDev) console.log('📥 Processing webhook event:', event.type);
    await processWebhookEvent(event);
    if (isDev) console.log('✅ Webhook event processed successfully');
  } catch (error: any) {
    console.error('❌ Error processing webhook event:', error);
    if (isDev) console.error('   Error stack:', error.stack);
    // Still return 200 to acknowledge receipt, but log the error
  }

  // Return 200 OK after processing
  if (isDev) console.log('✅ Webhook received, verified, and processed - returning 200 OK');
  return res.status(200).json({ received: true, eventType: event.type });
};

