# Setting Up AbacatePay (PIX Payments - Brazil)

This guide explains how to configure AbacatePay for PIX payments in Brazil.

## Overview

AbacatePay enables PIX payments, the instant payment system popular in Brazil. This is optional and complements Stripe for Brazilian customers.

**Note**: Without AbacatePay, PIX payment option will be unavailable. Stripe payments still work.

## Prerequisites

- A [AbacatePay account](https://www.abacatepay.com/)
- Brazilian business documentation (CNPJ) for production

## Getting Your API Key

1. Go to [AbacatePay Dashboard](https://www.abacatepay.com/dashboard)
2. Navigate to **API Keys** or **Configurações**
3. Generate a new API key
4. Copy the key (starts with `abc_`)

## Configuration

Add the following to your `.env.local` file:

```env
ABACATEPAY_API_KEY=abc_your_abacatepay_api_key
```

## Creating Products (Optional)

You can pre-create products in AbacatePay for each credit package:

1. Go to **Produtos** in the dashboard
2. Create products for each credit tier
3. Copy the product IDs

Add product IDs to `.env.local`:

```env
ABACATE_PRODUCT_100=prod_xxx  # 100 credits
ABACATE_PRODUCT_500=prod_yyy  # 500 credits
```

If not configured, products are created dynamically.

## Webhook Setup

Webhooks notify your server when payments are completed.

### Configuration

1. Go to **Webhooks** in AbacatePay Dashboard
2. Add endpoint: `https://your-domain.com/api/payments/webhook/abacatepay`
3. Copy the webhook secret

Add to `.env.local`:

```env
ABACATEPAY_WEBHOOK_SECRET=your_abacatepay_webhook_secret
```

## How It Works

### Payment Flow

1. User selects PIX payment
2. Server creates a billing request via AbacatePay API
3. User receives PIX QR code and copy-paste code
4. User pays via their bank app
5. AbacatePay sends webhook notification
6. Server credits the user's account

### PIX QR Code

The generated QR code:

- Valid for 1 hour by default
- Contains the exact payment amount
- Can be scanned by any PIX-enabled bank app

## Testing

AbacatePay provides a sandbox environment:

1. Use test API keys
2. Payments complete automatically in sandbox

## Verification

Run the check script:

```bash
npm run check-abacatepay
```

## Troubleshooting

**Error: "AbacatePay not configured"**
- Ensure `ABACATEPAY_API_KEY` is set
- Restart the server

**Error: "SDK returned error with undefined"**
- Verify API key is valid and active
- Check if account has billing permissions
- Ensure product IDs exist (if using)

**PIX code not generated**
- Check AbacatePay dashboard for errors
- Verify the amount is within limits

**Payment not credited**
- Check webhook is receiving events
- Verify webhook secret is correct
- Check server logs for errors

## Customer Data

When creating PIX payments with customer data:

All fields are required if providing customer info:
- `name`: Customer full name
- `email`: Customer email
- `taxId`: CPF or CNPJ (numbers only)
- `cellphone`: Phone number (optional)

## Pricing

AbacatePay charges per transaction:

- See [AbacatePay Pricing](https://www.abacatepay.com/pricing) for current rates
- No monthly fees
- Pay per successful transaction only

## Going Live

1. Complete business verification in AbacatePay
2. Replace sandbox keys with production keys
3. Update webhook endpoints
4. Test with a real PIX payment (refund immediately)

