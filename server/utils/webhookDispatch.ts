import crypto from 'crypto';
import { prisma } from '../db/prisma.js';

type WebhookEvent = 'generation.complete' | 'credits.depleted' | 'brand.updated';

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
}

export async function dispatchWebhookEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, any>
): Promise<void> {
  // Fire-and-forget — errors logged, never thrown to caller
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { userId, active: true, events: { has: event } },
    });

    if (webhooks.length === 0) return;

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };
    const body = JSON.stringify(payload);

    await Promise.allSettled(
      webhooks.map(async (wh) => {
        const signature = crypto
          .createHmac('sha256', wh.secret)
          .update(body)
          .digest('hex');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
          await fetch(wh.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': signature,
              'X-Webhook-Event': event,
            },
            body,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
      })
    );
  } catch (err) {
    console.error(`[webhook] dispatch error for ${event}:`, err);
  }
}
