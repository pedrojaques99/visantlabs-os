import crypto from 'crypto';
import { prisma } from '../db/prisma.js';

type WebhookEvent = 'generation.complete' | 'credits.depleted' | 'brand.updated';

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function deliverWithRetry(
  url: string,
  body: string,
  signature: string,
  event: WebhookEvent
): Promise<boolean> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event,
          },
          body,
          signal: controller.signal,
        });

        if (res.ok || (res.status >= 200 && res.status < 300)) return true;
        if (res.status >= 400 && res.status < 500) return false;
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // network error or timeout — retry
    }

    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return false;
}

export async function dispatchWebhookEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, any>
): Promise<void> {
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

        const ok = await deliverWithRetry(wh.url, body, signature, event);
        if (!ok) {
          console.error(`[webhook] delivery failed after ${MAX_RETRIES + 1} attempts: ${event} → ${wh.url}`);
        }
      })
    );
  } catch (err) {
    console.error(`[webhook] dispatch error for ${event}:`, err);
  }
}
