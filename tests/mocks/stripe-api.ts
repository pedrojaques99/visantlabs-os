import { http, HttpResponse } from 'msw';

/**
 * MSW handlers for the Stripe REST API.
 *
 * Tests must never reach api.stripe.com — these return deterministic
 * fixtures for the read-only endpoints the app touches on public routes
 * (GET /api/payments/plans retrieves price + product).
 */
export const stripeApiHandlers = [
  http.get('https://api.stripe.com/v1/prices/:priceId', ({ params }) =>
    HttpResponse.json({
      id: params.priceId,
      object: 'price',
      active: true,
      currency: 'usd',
      product: 'prod_test_visant',
      recurring: { interval: 'month', interval_count: 1 },
      type: 'recurring',
      unit_amount: 2900,
      unit_amount_decimal: '2900',
    })
  ),

  http.get('https://api.stripe.com/v1/products/:productId', ({ params }) =>
    HttpResponse.json({
      id: params.productId,
      object: 'product',
      active: true,
      name: 'Visant Premium (test fixture)',
      description: 'Deterministic test product',
      metadata: { tier: 'premium', monthlyCredits: '100' },
    })
  ),
];
