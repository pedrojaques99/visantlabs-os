#!/usr/bin/env node
/**
 * Confere os preços/modelos que o Visant Labs assume contra as APIs dos provedores.
 * Roda à mão ou em cron semanal; sai com código 1 se algo divergir.
 *
 *   FAL_KEY=... GEMINI_API_KEY=... node scripts/check-provider-prices.mjs
 *
 * - fal: GET /v1/models/pricing (qualquer chave) contra os US$/s usados em
 *   server/lib/pricing-data.ts (clipe-base de 5s ÷ 5) e falVideoService.ts;
 * - Gemini: GET /v1beta/models/<id> de cada modelo, pra pegar o que o Google já tirou do ar.
 * Contexto: docs/CREDIT-PRICING-AUDIT.md.
 */

// endpoint do fal -> US$/s que o código assume
const FAL_EXPECTED = {
  'fal-ai/kling-video/v3/standard/image-to-video': 0.14,
  'fal-ai/kling-video/v3/pro/image-to-video': 0.14,
  'fal-ai/kling-video/v3/4k/image-to-video': 0.42,
  'fal-ai/kling-video/o3/pro/image-to-video': 0.14,
  'fal-ai/kling-video/v2.5-turbo/pro/image-to-video': 0.07,
};
const GEMINI_MODELS = [
  'gemini-3.1-flash-lite-image',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
  'gemini-3.1-flash-lite',
  'veo-3.1-generate-preview',
  'veo-3.1-fast-generate-preview',
  'veo-3.1-lite-generate-preview',
];

let problems = 0;
const warn = (msg) => {
  problems += 1;
  console.log(`✗ ${msg}`);
};

if (process.env.FAL_KEY) {
  const ids = Object.keys(FAL_EXPECTED).join(',');
  const resp = await fetch(`https://api.fal.ai/v1/models/pricing?endpoint_id=${ids}`, {
    headers: { Authorization: `Key ${process.env.FAL_KEY}` },
  });
  if (!resp.ok) warn(`fal pricing respondeu HTTP ${resp.status}`);
  else {
    const { prices = [] } = await resp.json();
    for (const [id, expected] of Object.entries(FAL_EXPECTED)) {
      const got = prices.find((p) => p.endpoint_id === id)?.unit_price;
      if (got === undefined) warn(`fal: ${id} sem preço na API`);
      else if (Math.abs(got - expected) > 1e-9)
        warn(`fal: ${id} agora US$ ${got}/s (código assume ${expected})`);
      else console.log(`✓ fal ${id} US$ ${got}/s`);
    }
  }
} else console.log('- FAL_KEY ausente: pulei o fal');

if (process.env.GEMINI_API_KEY) {
  // GET por modelo: a listagem /models não traz os Veo, então não serve pra checar existência.
  for (const id of GEMINI_MODELS) {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${id}?key=${process.env.GEMINI_API_KEY}`
    );
    if (resp.ok) console.log(`✓ gemini ${id} disponível`);
    else warn(`gemini: ${id} respondeu HTTP ${resp.status} (aposentado ou sem acesso?)`);
  }
} else console.log('- GEMINI_API_KEY ausente: pulei o Gemini');

if (problems) {
  console.log(`\n${problems} divergência(s). Atualize pricing-data.ts e docs/CREDIT-PRICING-AUDIT.md.`);
  process.exit(1);
}
console.log('\nOK: preços e modelos conferem.');
