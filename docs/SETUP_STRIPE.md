# Setting Up Stripe Payments

This guide explains how to configure Stripe for payment processing.

## Prerequisites

- A [Stripe account](https://dashboard.stripe.com/register)
- Access to Stripe Dashboard

## Getting Your API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Developers > API keys**
3. Copy your **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for production)
4. Copy your **Publishable key** (starts with `pk_test_` or `pk_live_`)

## Configuration

Add the following to your `.env.local` file:

```env
# Backend (secret key)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

# Frontend (publishable key)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

## Creating Products and Prices

### Option 1: Stripe Dashboard

1. Go to **Products** in Stripe Dashboard
2. Click **Add product**
3. Create products for each credit package (e.g., "100 Credits", "500 Credits")
4. Set prices in USD and BRL
5. Copy the Price IDs

### Option 2: Stripe CLI

```bash
stripe products create --name="100 Credits" --description="100 AI generation credits"
stripe prices create --product=prod_xxx --unit-amount=999 --currency=usd
```

## Price Configuration

Add your price IDs to `.env.local`:

```env
STRIPE_PRICE_ID_USD=price_your_usd_price_id
STRIPE_PRICE_ID_BRL=price_your_brl_price_id
```

## Webhook Setup

Webhooks are required to process successful payments.

### Local Development

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Run: `stripe listen --forward-to localhost:3001/api/payments/webhook`
3. Copy the webhook signing secret (starts with `whsec_`)

### Production

1. Go to **Developers > Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Enter your webhook URL: `https://your-domain.com/api/payments/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
5. Copy the signing secret

Add to `.env.local`:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

## Testing

Use Stripe's test card numbers:

| Card | Number |
|------|--------|
| Success | 4242 4242 4242 4242 |
| Decline | 4000 0000 0000 0002 |
| Auth required | 4000 0025 0000 3155 |

Use any future expiry date and any 3-digit CVC.

## Going Live

1. Switch to live mode in Stripe Dashboard
2. Replace test keys with live keys
3. Update webhook endpoints
4. Test with a real card (refund immediately)

## Troubleshooting

**Error: "No such price"**
- Verify the price ID exists in your Stripe account
- Check if you're using test/live keys consistently

**Webhook failures**
- Check the webhook signing secret
- Verify the endpoint URL is accessible
- Check server logs for errors

**Payment not processed**
- Verify webhook events are being received
- Check the `transactions` collection in MongoDB

