#!/usr/bin/env node
/**
 * Pricing v3 — configura os 3 Products de assinatura (Starter / Pro / Vision).
 *
 * Faz o que você faria à mão em /admin/products, mas idempotente e reproduzível.
 * Upsert por `productId` (nunca deleta) e NÃO toca em stripeProductId /
 * paymentLink* já existentes — só ajusta preço/metadata/nome (preserva o wiring
 * de checkout que você já tiver colado no admin).
 *
 * As chaves de metadata batem EXATAMENTE o que o backend lê:
 *   - tier                → matchPlanForTier + tierLimitFromProduct (brandQuota)
 *   - maxBrands           → 'unlimited' = ilimitado explícito (brandQuota.ts:110)
 *   - maxEditorsPerBrand  → seats por marca (0 = só dono; 'unlimited')
 *   - monthlyCredits      → créditos/mês (payments.ts getStripePlanInfo)
 *   - storageLimitGB      → cota de storage
 *   - founderPrice*       → promo fundador (exibição na PricingPage v3)
 *
 * NÃO cria produto/price no Stripe/Abacate — pra checkout real você ainda precisa
 * colar paymentLinkBRL/paymentLinkUSD (via /admin/products ou Stripe). Sem eles o
 * CTA de assinatura cai pra '/' (a UI já trata). Os preços de EXIBIÇÃO ficam certos.
 *
 * Uso:
 *   node scripts/setup-pricing-products.mjs           # DRY-RUN (default): só mostra
 *   node scripts/setup-pricing-products.mjs --apply   # grava de verdade
 *
 * Env: MONGODB_URI (lido do .env). ⚠️ Rode o dry-run e confira o DB ANTES do --apply.
 */
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

const APPLY = process.argv.includes('--apply');
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('✗ MONGODB_URI não setado (env ou .env).');
  process.exit(2);
}

// SSoT dos 3 tiers — espelha src/pages/pricing/pricingTiers.ts + fallbacks do backend.
const PRODUCTS = [
  {
    productId: 'plan_starter',
    type: 'subscription_plan',
    name: 'Starter',
    description: '1 marca ativa, 50 créditos/mês, o essencial pra começar.',
    credits: 50,
    priceBRL: 0,
    priceUSD: 0,
    isActive: true,
    displayOrder: 0,
    metadata: {
      tier: 'starter',
      monthlyCredits: 50,
      maxBrands: 1,
      maxEditorsPerBrand: 0,
      storageLimitGB: 1,
    },
  },
  {
    productId: 'plan_pro',
    type: 'subscription_plan',
    name: 'Pro',
    description: 'Marcas ilimitadas, 500 créditos/mês, 5 seats.',
    credits: 500,
    priceBRL: 49,
    priceUSD: 12,
    isActive: true,
    displayOrder: 1,
    metadata: {
      tier: 'pro',
      monthlyCredits: 500,
      maxBrands: 'unlimited',
      maxEditorsPerBrand: 4, // 5 seats = dono + 4 editores
      storageLimitGB: 20,
      founderPriceBRL: 29,
      founderPriceUSD: 7,
    },
  },
  {
    productId: 'plan_vision',
    type: 'subscription_plan',
    name: 'Vision',
    description: 'Tudo do Pro + prioridade, early access e seats ilimitados.',
    credits: 1000,
    priceBRL: 149,
    priceUSD: 29,
    isActive: true,
    displayOrder: 2,
    metadata: {
      tier: 'vision',
      monthlyCredits: 1000,
      maxBrands: 'unlimited',
      maxEditorsPerBrand: 'unlimited',
      storageLimitGB: 100,
      founderPriceBRL: 89,
      founderPriceUSD: 18,
      earlyAccess: true,
    },
  },
];

// Campos que o upsert NUNCA sobrescreve (preserva wiring de checkout já colado).
const PRESERVE = ['stripeProductId', 'abacateProductId', 'abacateBillId', 'paymentLinkBRL', 'paymentLinkUSD'];

const maskUri = (u) => u.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db();
  const col = db.collection('products');

  console.log(`\n  DB alvo: ${maskUri(uri)}  (db: ${db.databaseName})`);
  console.log(`  Modo:    ${APPLY ? 'APPLY (grava)' : 'DRY-RUN (só mostra)'}\n`);

  for (const p of PRODUCTS) {
    const existing = await col.findOne({ productId: p.productId });
    const action = existing ? 'update' : 'insert';
    const preserved = PRESERVE.filter((k) => existing?.[k]).map((k) => `${k}=✓`);

    // Preço/nome só entram em INSERT — em produto existente, PRESERVA o preço
    // (que já casa com o Stripe live) e só faz merge da metadata de gating.
    // Mudar preço de exibição é decisão acoplada ao Stripe (Price imutável) → manual.
    const priceInfo = existing
      ? `R$${existing.priceBRL} (preservado)`
      : `R$${p.priceBRL}/$${p.priceUSD} (novo)`;

    console.log(
      `  [${action}] ${p.productId.padEnd(13)} ${p.name.padEnd(8)} ` +
        `${priceInfo} · ${p.metadata.monthlyCredits}cr · ` +
        `marcas=${p.metadata.maxBrands} · seats=${p.metadata.maxEditorsPerBrand}` +
        (preserved.length ? `  (preserva: ${preserved.join(', ')})` : '')
    );

    if (APPLY) {
      const { productId, metadata, ...fields } = p;
      // metadata por CHAVE (merge) — nunca substitui o objeto inteiro, pra não
      // apagar chaves existentes (unlimitedModels, features, etc).
      const metaSet = Object.fromEntries(
        Object.entries(metadata).map(([k, v]) => [`metadata.${k}`, v])
      );
      await col.updateOne(
        { productId },
        {
          // SEMPRE: só a metadata de gating (merge) + updatedAt.
          $set: { ...metaSet, updatedAt: new Date() },
          // SÓ EM INSERT: doc completo (preço/nome/tipo) — nunca altera existente.
          $setOnInsert: { productId, createdAt: new Date(), ...fields },
        },
        { upsert: true }
      );
    }
  }

  console.log(
    `\n  ${APPLY ? '✓ Gravado.' : '(dry-run — rode com --apply pra gravar)'}\n` +
      `  ⚠ Checkout real precisa de paymentLinkBRL/USD (cole no /admin/products ou Stripe).\n`
  );
} catch (e) {
  console.error('✗ Erro:', e.message);
  process.exit(1);
} finally {
  await client.close();
}
