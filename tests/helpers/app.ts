import type { Express } from 'express';
import supertest from 'supertest';

let cachedApp: Express | null = null;

/**
 * Lazy-build the app once per test process.
 *
 * We don't hoist this into setup.ts because createApp() imports routes which
 * evaluate Prisma/Stripe clients — we want applyTestEnv() to run first.
 */
export async function getApp(): Promise<Express> {
  if (cachedApp) return cachedApp;
  const { createApp } = await import('../../server/app.js');
  cachedApp = createApp();
  return cachedApp;
}

export async function request() {
  const app = await getApp();
  return supertest(app);
}
