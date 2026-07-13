#!/usr/bin/env node
/**
 * Brand billing migration — grandfathering (plan task 2.8 / Fase 2).
 *
 * For every user, records metadata.legacyBrands = current count of their
 * (non-archived) brand guidelines, so the effective brand limit becomes
 * max(tierLimit, legacyBrands) — early users never lose anything when
 * FEATURE_BRAND_BILLING is turned on.
 *
 * Idempotent: users that already have metadata.legacyBrands are skipped, so
 * re-running never lowers a previously recorded grandfathered limit.
 *
 * Usage:
 *   node scripts/migrate-brand-billing.mjs           # DRY-RUN (default): report only
 *   node scripts/migrate-brand-billing.mjs --apply   # actually write metadata.legacyBrands
 *
 * Env: MONGODB_URI (read from .env if present)
 *
 * ⚠️ Do NOT run against production without a dry-run first.
 */
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

const APPLY = process.argv.includes('--apply');
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('✗ MONGODB_URI not set (env or .env).');
  process.exit(2);
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db();
  const users = db.collection('users');
  const brands = db.collection('brand_guidelines');

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN (pass --apply to write)'}\n`);

  // Count non-archived brands per owner in one aggregation pass.
  const counts = await brands
    .aggregate([
      { $match: { status: { $ne: 'archived' } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ])
    .toArray();
  const countByUser = new Map(counts.map((c) => [String(c._id), c.count]));

  const cursor = users.find(
    {},
    { projection: { _id: 1, email: 1, subscriptionTier: 1, metadata: 1 } }
  );

  let scanned = 0;
  let updated = 0;
  let skippedExisting = 0;
  let skippedZero = 0;

  for await (const user of cursor) {
    scanned++;
    const existing = user.metadata?.legacyBrands;
    if (existing !== undefined && existing !== null) {
      skippedExisting++;
      continue; // idempotent — never overwrite a recorded grandfathered limit
    }

    const count = countByUser.get(String(user._id)) ?? 0;
    if (count === 0) {
      skippedZero++;
      continue; // nothing to grandfather
    }

    if (APPLY) {
      await users.updateOne({ _id: user._id }, { $set: { 'metadata.legacyBrands': count } });
    }
    updated++;
    console.log(
      `${APPLY ? '✓' : '·'} ${user.email || user._id} (${user.subscriptionTier || 'free'}): legacyBrands = ${count}`
    );
  }

  console.log(
    `\nDone. scanned=${scanned} ${APPLY ? 'updated' : 'would update'}=${updated} ` +
      `already-set=${skippedExisting} zero-brands=${skippedZero}`
  );
} finally {
  await client.close();
}
