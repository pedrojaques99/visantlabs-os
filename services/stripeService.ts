import { loadStripe, Stripe } from '@stripe/stripe-js';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

if (!STRIPE_PUBLISHABLE_KEY) {
  console.warn('⚠️  VITE_STRIPE_PUBLISHABLE_KEY is not configured. Stripe payments will not work.');
}

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    if (!STRIPE_PUBLISHABLE_KEY) {
      throw new Error(
        'Stripe publishable key is not configured. ' +
        'Please set VITE_STRIPE_PUBLISHABLE_KEY in your environment variables. ' +
        'See docs/SETUP_STRIPE.md for setup instructions. ' +
        'Payment features will be disabled without Stripe configuration.'
      );
    }
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

/**
 * Check if Stripe is configured
 */
export const isStripeConfigured = (): boolean => {
  return !!STRIPE_PUBLISHABLE_KEY && STRIPE_PUBLISHABLE_KEY.trim().length > 0;
};

