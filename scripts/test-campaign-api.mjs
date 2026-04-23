#!/usr/bin/env node
/**
 * Campaign API smoke test — creates 5 mock campaigns and polls until done.
 *
 * Usage:
 *   node scripts/test-campaign-api.mjs
 *   node scripts/test-campaign-api.mjs --url http://localhost:3001 --token YOUR_JWT
 *
 * Env vars (override via CLI flags):
 *   API_URL   — default http://localhost:3001/api
 *   API_TOKEN — JWT bearer token (required for authenticated endpoints)
 */

import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    url:   { type: 'string', short: 'u', default: process.env.API_URL   || 'http://localhost:3001/api' },
    token: { type: 'string', short: 't', default: process.env.API_TOKEN || '' },
    poll:  { type: 'string',             default: '5000' },  // ms between polls
  },
  strict: false,
});

const API_BASE   = values.url;
const API_TOKEN  = values.token;
const POLL_MS    = Number(values.poll);

if (!API_TOKEN) {
  console.error('ERROR: Provide --token <jwt> or set API_TOKEN env var');
  process.exit(1);
}

// ─── Mock campaign payloads ───────────────────────────────────────────────────

const MOCKS = [
  {
    label: 'Supplement brand — 6 square + story ads',
    payload: {
      productImageUrl: 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=800',
      brief: 'Pre-workout supplement targeting serious athletes who want explosive energy and faster recovery',
      count: 6,
      formats: ['square', 'story'],
      model: 'gpt-image-1',
    },
  },
  {
    label: 'Skincare — 4 portrait ads with no brand context',
    payload: {
      productImageUrl: 'https://images.unsplash.com/photo-1570194065650-d99fb4b67e59?w=800',
      brief: 'Luxury skincare serum for women 30-50 who want visible anti-aging results in 4 weeks',
      count: 4,
      formats: ['portrait'],
      model: 'gpt-image-1',
    },
  },
  {
    label: 'Coffee — 5 story ads for TikTok',
    payload: {
      productImageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800',
      brief: 'Specialty cold brew coffee for remote workers and busy creatives',
      count: 5,
      formats: ['story'],
      model: 'gpt-image-1',
    },
  },
  {
    label: 'Tech gadget — 3 banner ads',
    payload: {
      productImageUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800',
      brief: 'Wireless earbuds with 40h battery for commuters and remote workers',
      count: 3,
      formats: ['banner', 'square'],
      model: 'gpt-image-1',
    },
  },
  {
    label: 'Fitness apparel — 8 mixed format campaign',
    payload: {
      productImageUrl: 'https://images.unsplash.com/photo-1571945153237-4929e783af4a?w=800',
      brief: 'Performance running shoes for marathon runners and casual joggers',
      count: 8,
      formats: ['square', 'story', 'portrait'],
      model: 'gpt-image-1',
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_TOKEN}`,
  };
}

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function statusEmoji(status) {
  return { planning: '📋', generating: '⚡', done: '✅', error: '❌' }[status] ?? '?';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runMock(mock, idx) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[${idx + 1}/${MOCKS.length}] ${mock.label}`);
  console.log(`       count=${mock.payload.count}  formats=${mock.payload.formats.join(',')}  model=${mock.payload.model}`);

  const { jobId, totalCount } = await post('/canvas/generate-campaign', mock.payload);
  console.log(`       jobId=${jobId}  totalCount=${totalCount}`);

  // Poll until done or error (max 10 min)
  const deadline = Date.now() + 10 * 60 * 1000;
  let lastStatus = '';

  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const job = await get(`/canvas/generate-campaign/${jobId}`);

    if (job.status !== lastStatus) {
      console.log(`       ${statusEmoji(job.status)} status=${job.status}  completed=${job.completedCount}/${totalCount}`);
      lastStatus = job.status;
    }

    if (job.status === 'done') {
      const done   = job.results.filter(r => r.status === 'done').length;
      const errors = job.results.filter(r => r.status === 'error').length;
      console.log(`       Results: ${done} done, ${errors} errors`);
      for (const r of job.results.filter(r => r.status === 'done').slice(0, 3)) {
        console.log(`         [${r.adAngle}/${r.format}] ${r.imageUrl}`);
      }
      if (done > 3) console.log(`         …and ${done - 3} more`);
      return { jobId, done, errors, status: 'done' };
    }

    if (job.status === 'error') {
      console.error(`       ERROR: ${job.error}`);
      return { jobId, done: 0, errors: totalCount, status: 'error' };
    }
  }

  console.warn('       TIMEOUT — still generating after 10 min');
  return { jobId, done: 0, errors: 0, status: 'timeout' };
}

async function main() {
  console.log(`\nCampaign API Smoke Test`);
  console.log(`API: ${API_BASE}`);
  console.log(`Mocks: ${MOCKS.length}  Poll interval: ${POLL_MS}ms`);

  const summary = [];

  for (let i = 0; i < MOCKS.length; i++) {
    try {
      const result = await runMock(MOCKS[i], i);
      summary.push({ label: MOCKS[i].label, ...result });
    } catch (err) {
      console.error(`[${i + 1}] FAILED: ${err.message}`);
      summary.push({ label: MOCKS[i].label, status: 'error', error: err.message });
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'═'.repeat(60)}`);
  for (const s of summary) {
    const emoji = s.status === 'done' ? '✅' : s.status === 'timeout' ? '⏱' : '❌';
    const detail = s.status === 'done'
      ? `${s.done} done, ${s.errors} errors`
      : s.error || s.status;
    console.log(`${emoji} ${s.label.padEnd(48)} ${detail}`);
  }

  const allPassed = summary.every(s => s.status === 'done');
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
