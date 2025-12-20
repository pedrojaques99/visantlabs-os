# Setting Up Liveblocks (Real-time Collaboration)

This guide explains how to configure Liveblocks for real-time canvas collaboration.

## Overview

Liveblocks enables real-time collaboration on canvas projects, allowing multiple users to:

- See each other's cursors
- Edit nodes simultaneously
- Share canvas projects with collaborators

**Note**: The canvas works without Liveblocks, but in single-user mode only.

## Prerequisites

- A [Liveblocks account](https://liveblocks.io/)

## Getting Your API Keys

1. Go to [Liveblocks Dashboard](https://liveblocks.io/dashboard)
2. Create a new project or select an existing one
3. Go to **API keys**
4. Copy the **Secret key** (starts with `sk_`)

## Configuration

Add the following to your `.env.local` file:

```env
LIVEBLOCKS_SECRET_KEY=sk_live_your_liveblocks_secret_key
```

## Webhook Setup (Optional)

Webhooks enable real-time notifications and sync.

### Configuration

1. Go to your project in Liveblocks Dashboard
2. Navigate to **Webhooks**
3. Add endpoint: `https://your-domain.com/api/liveblocks/webhook`
4. Select events to subscribe to
5. Copy the signing secret

Add to `.env.local`:

```env
LIVEBLOCKS_WEBHOOK_SECRET=your_liveblocks_webhook_secret
```

## How It Works

### Authentication

The server authenticates users with Liveblocks using the secret key:

```typescript
// server/routes/canvas.ts
const session = liveblocks.prepareSession(userId, {
  userInfo: { name, email, picture }
});
```

### Room Access

Canvas projects create Liveblocks rooms for collaboration:

- Room ID format: `canvas-{projectId}`
- Users with edit access can modify nodes
- Users with view access can only observe

### Presence

Real-time presence shows:

- Active collaborators
- Cursor positions
- Selection states

## Features

| Feature | With Liveblocks | Without |
|---------|-----------------|---------|
| Real-time sync | ✅ | ❌ |
| Cursor presence | ✅ | ❌ |
| Collaboration | ✅ | ❌ |
| Canvas editing | ✅ | ✅ |
| Saving projects | ✅ | ✅ |

## Troubleshooting

**Error: "Liveblocks not configured"**
- Ensure `LIVEBLOCKS_SECRET_KEY` is set
- Restart the server

**Collaboration not working**
- Check browser console for connection errors
- Verify the project has `isCollaborative: true`
- Ensure users have proper permissions

**"Not allowed to access room"**
- User doesn't have permission
- Check `canEdit` and `canView` arrays in the canvas project

## Pricing

Liveblocks offers:

- **Free tier**: Up to 250 monthly active users
- **Paid plans**: Higher limits and features

See [Liveblocks Pricing](https://liveblocks.io/pricing) for details.

