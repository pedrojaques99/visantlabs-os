# Setting Up Cloudflare R2 Storage

This guide explains how to configure Cloudflare R2 for image and file storage.

## Overview

Cloudflare R2 is used for storing:

- Generated mockup images
- User uploads (logos, backgrounds)
- PDF exports
- Custom assets

**Note**: Without R2, images are stored temporarily in base64 format in the database.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up)

## Creating an R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** in the sidebar
3. Click **Create bucket**
4. Enter a bucket name (e.g., `vsn-mockup-machine`)
5. Choose a location (or auto for best performance)
6. Click **Create bucket**

## Enabling Public Access

For images to be accessible:

1. Select your bucket
2. Go to **Settings**
3. Under **Public access**, click **Allow Access**
4. Note the public URL (e.g., `https://pub-xxx.r2.dev`)

Or connect a custom domain:

1. Go to **Custom Domains**
2. Add your domain (e.g., `assets.your-domain.com`)

## Creating API Tokens

1. Go to **R2 > Overview**
2. Click **Manage R2 API Tokens**
3. Click **Create API token**
4. Set permissions:
   - **Object Read & Write** for your bucket
5. Click **Create API Token**
6. Copy the credentials:
   - Access Key ID
   - Secret Access Key

## Configuration

Add the following to your `.env.local` file:

```env
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-bucket.r2.dev
```

### Finding Your Account ID

1. Go to Cloudflare Dashboard
2. The Account ID is in the URL: `dash.cloudflare.com/{account_id}/...`
3. Or find it in **R2 > Overview**

## Verification

Run the check script to verify configuration:

```bash
npm run check-r2
```

Test the connection:

```bash
npm run test-r2
```

## CORS Configuration

If you get CORS errors, configure CORS rules:

1. Select your bucket
2. Go to **Settings > CORS policy**
3. Add a rule:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

For production, restrict `AllowedOrigins` to your domain.

## Storage Limits

The application tracks storage usage per user:

| Tier | Storage Limit |
|------|--------------|
| Free | 50 MB |
| Pro | 500 MB |
| Enterprise | Custom |

## Troubleshooting

**Error: "R2 not configured"**
- Ensure all R2 environment variables are set
- Restart the server

**Error: "Access Denied"**
- Verify API token has correct permissions
- Check bucket name is correct

**Images not loading**
- Verify public access is enabled
- Check `R2_PUBLIC_URL` is correct
- Ensure CORS is configured

**Upload fails**
- Check file size limits
- Verify user has available storage quota

## Pricing

Cloudflare R2 pricing:

- **Free tier**: 10 GB storage, 10M Class A operations/month
- **Storage**: $0.015/GB/month after free tier
- **No egress fees** (unlike S3)

See [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/) for details.

