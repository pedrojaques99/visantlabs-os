/**
 * Pricing Data for Documentation
 * Single source of truth for transparent pricing display
 *
 * Sources:
 * - Google Official: https://ai.google.dev/gemini-api/docs/pricing
 * - Last updated: 2026-03-24
 */

export interface PricingTier {
  model: string;
  modelId: string;
  resolution: string;
  googlePriceUSD: number;
  creditsRequired: number;
  category: 'image' | 'video' | 'chat' | 'branding';
}

export interface CreditPackage {
  credits: number;
  priceBRL: number;
  priceUSD: number;
  pricePerCreditUSD: number;
  imagesHD: number;      // Estimated images at HD (1K)
  images4K: number;      // Estimated images at 4K
  videosFast: number;    // Estimated videos (fast mode)
  videosStandard: number; // Estimated videos (standard)
}

export interface StoragePlan {
  id: string;
  name: string;
  storageMB: number;
  priceBRL: number;
  priceUSD: number;
  billingCycle: 'free' | 'monthly';
  features: string[];
  isByok?: boolean;
}

/**
 * Visant Infrastructure Costs (USD)
 * These are our actual costs for processing, storage, and delivery
 */
export const VISANT_INFRA_COSTS = {
  // Per-image costs
  IMAGE_PROCESSING: 0.005,     // Resizing, optimization, format conversion
  IMAGE_CDN: 0.003,            // R2 storage + Cloudflare delivery
  IMAGE_API_OVERHEAD: 0.005,   // Rate limiting, auth, logging, monitoring
  IMAGE_TOTAL: 0.013,          // Total overhead per image

  // Per-video costs (8 sec default)
  VIDEO_PROCESSING: 0.08,      // Encoding, thumbnail generation
  VIDEO_CDN: 0.04,             // R2 storage + streaming delivery
  VIDEO_API_OVERHEAD: 0.03,    // Processing queue, status tracking
  VIDEO_TOTAL: 0.15,           // Total overhead per video
} as const;

/**
 * Storage Plans - Separate from credits
 * For users who want storage without bundled credits (especially BYOK users)
 */
export const STORAGE_PLANS: StoragePlan[] = [
  {
    id: 'storage_free',
    name: 'Starter',
    storageMB: 100,
    priceBRL: 0,
    priceUSD: 0,
    billingCycle: 'free',
    features: ['Included with account', '~25 HD images', 'Perfect for trying out'],
  },
  {
    id: 'storage_pro',
    name: 'Pro Storage',
    storageMB: 5 * 1024, // 5 GB
    priceBRL: 9.90,
    priceUSD: 1.80,
    billingCycle: 'monthly',
    features: ['5 GB storage', '~1,250 HD images', 'Ideal for active creators'],
    isByok: true,
  },
  {
    id: 'storage_vision',
    name: 'Vision Storage',
    storageMB: 50 * 1024, // 50 GB
    priceBRL: 29.90,
    priceUSD: 5.45,
    billingCycle: 'monthly',
    features: ['50 GB storage', 'Video storage included', 'Unlimited projects'],
    isByok: true,
  },
];

/**
 * Official Google Gemini/Veo Pricing (USD)
 * Source: https://ai.google.dev/gemini-api/docs/pricing
 */
export const GOOGLE_OFFICIAL_PRICING = {
  image: {
    'gemini-2.5-flash-image': {
      '~1K': 0.039,
    },
    'gemini-3.1-flash-image-preview': {
      '512px': 0.045,
      '1K': 0.067,
      '2K': 0.101,
      '4K': 0.151,
    },
    'gemini-3-pro-image-preview': {
      '1K': 0.134,
      '2K': 0.134, // Google: "1K and up to 2K" same price
      '4K': 0.24,
    },
  },
  video: {
    'veo-3.1-fast-generate-preview': {
      '720p/1080p': 0.15, // per second
      '4K': 0.35,
    },
    'veo-3.1-generate-preview': {
      '720p/1080p': 0.40, // per second
      '4K': 0.60,
    },
  },
  defaultVideoDurationSec: 8,
} as const;

/**
 * Visant Credit Costs per Operation
 * Transparent mapping from credits to capabilities
 */
export const CREDIT_COSTS: PricingTier[] = [
  // Image Generation - Gemini 2.5 Flash
  { model: 'Gemini 2.5 Flash', modelId: 'gemini-2.5-flash-image', resolution: '~1K (HD)', googlePriceUSD: 0.039, creditsRequired: 1, category: 'image' },

  // Image Generation - Gemini 3.1 Flash (NB2)
  { model: 'Gemini 3.1 Flash', modelId: 'gemini-3.1-flash-image-preview', resolution: '512px', googlePriceUSD: 0.045, creditsRequired: 1, category: 'image' },
  { model: 'Gemini 3.1 Flash', modelId: 'gemini-3.1-flash-image-preview', resolution: '1K (HD)', googlePriceUSD: 0.067, creditsRequired: 2, category: 'image' },
  { model: 'Gemini 3.1 Flash', modelId: 'gemini-3.1-flash-image-preview', resolution: '2K', googlePriceUSD: 0.101, creditsRequired: 3, category: 'image' },
  { model: 'Gemini 3.1 Flash', modelId: 'gemini-3.1-flash-image-preview', resolution: '4K', googlePriceUSD: 0.151, creditsRequired: 4, category: 'image' },

  // Image Generation - Gemini 3 Pro
  { model: 'Gemini 3 Pro', modelId: 'gemini-3-pro-image-preview', resolution: '1K (HD)', googlePriceUSD: 0.134, creditsRequired: 3, category: 'image' },
  { model: 'Gemini 3 Pro', modelId: 'gemini-3-pro-image-preview', resolution: '2K', googlePriceUSD: 0.134, creditsRequired: 5, category: 'image' },
  { model: 'Gemini 3 Pro', modelId: 'gemini-3-pro-image-preview', resolution: '4K', googlePriceUSD: 0.24, creditsRequired: 7, category: 'image' },

  // Video Generation - Veo 3.1 (8 seconds default)
  { model: 'Veo 3.1 Fast', modelId: 'veo-3.1-fast-generate-preview', resolution: '720p/1080p (8s)', googlePriceUSD: 1.20, creditsRequired: 15, category: 'video' },
  { model: 'Veo 3.1 Standard', modelId: 'veo-3.1-generate-preview', resolution: '720p/1080p (8s)', googlePriceUSD: 3.20, creditsRequired: 40, category: 'video' },

  // Chat (1 credit every 4 messages)
  { model: 'AI Chat', modelId: 'gemini-2.5-flash', resolution: '4 messages', googlePriceUSD: 0.001, creditsRequired: 1, category: 'chat' },

  // Branding Analysis (10 steps)
  { model: 'Brand Analysis', modelId: 'gemini-2.5-flash', resolution: 'Complete (10 steps)', googlePriceUSD: 0.01, creditsRequired: 10, category: 'branding' },
];

/**
 * Credit Packages with transparent estimates
 * Exchange rate approximation: 1 USD = 5.5 BRL
 */
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    credits: 20,
    priceBRL: 9.90,
    priceUSD: 1.80,
    pricePerCreditUSD: 0.09,
    imagesHD: 10,        // 20 / 2 credits per HD image
    images4K: 5,         // 20 / 4 credits per 4K image
    videosFast: 1,       // 20 / 15 = 1.3 → 1
    videosStandard: 0,   // 20 / 40 = 0.5 → 0
  },
  {
    credits: 50,
    priceBRL: 25.90,
    priceUSD: 4.71,
    pricePerCreditUSD: 0.094,
    imagesHD: 25,
    images4K: 12,
    videosFast: 3,
    videosStandard: 1,
  },
  {
    credits: 100,
    priceBRL: 45.90,
    priceUSD: 8.35,
    pricePerCreditUSD: 0.0835,
    imagesHD: 50,
    images4K: 25,
    videosFast: 6,
    videosStandard: 2,
  },
  {
    credits: 500,
    priceBRL: 198.00,
    priceUSD: 36.00,
    pricePerCreditUSD: 0.072,
    imagesHD: 250,
    images4K: 125,
    videosFast: 33,
    videosStandard: 12,
  },
];

/**
 * Generate pricing table markdown
 */
export function generatePricingMarkdown(): string {
  const lines: string[] = [];

  lines.push('# Pricing & Credits');
  lines.push('');
  lines.push('> **Transparency is a core value.** We show exactly what operations cost and how we calculate credits.');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Cost Breakdown Section - NEW
  lines.push('## How Visant Pricing Works');
  lines.push('');
  lines.push('Every generation has two cost components:');
  lines.push('');
  lines.push('1. **Google API Cost** — What Google charges for the AI model');
  lines.push('2. **Visant Infrastructure** — Our processing, storage, and delivery costs');
  lines.push('');
  lines.push('### Image Generation Breakdown');
  lines.push('');
  lines.push('| Model | Resolution | Google API | + Visant Infra | = Total | Credits |');
  lines.push('|-------|------------|------------|----------------|---------|---------|');
  lines.push(`| Gemini 3.1 Flash | 1K (HD) | $0.067 | $${VISANT_INFRA_COSTS.IMAGE_TOTAL.toFixed(3)} | **$0.080** | 2 |`);
  lines.push(`| Gemini 3.1 Flash | 4K | $0.151 | $${VISANT_INFRA_COSTS.IMAGE_TOTAL.toFixed(3)} | **$0.164** | 4 |`);
  lines.push(`| Gemini 3 Pro | 1K (HD) | $0.134 | $${VISANT_INFRA_COSTS.IMAGE_TOTAL.toFixed(3)} | **$0.147** | 3 |`);
  lines.push('');
  lines.push('### What "Visant Infrastructure" Includes');
  lines.push('');
  lines.push(`- **Image processing** — Resizing, optimization, format conversion ($${VISANT_INFRA_COSTS.IMAGE_PROCESSING.toFixed(3)})`);
  lines.push(`- **CDN delivery** — Cloudflare R2 storage + global delivery ($${VISANT_INFRA_COSTS.IMAGE_CDN.toFixed(3)})`);
  lines.push(`- **API overhead** — Rate limiting, auth, monitoring ($${VISANT_INFRA_COSTS.IMAGE_API_OVERHEAD.toFixed(3)})`);
  lines.push('');
  lines.push('### With BYOK (Bring Your Own Key)');
  lines.push('');
  lines.push('| Component | Platform Credits | BYOK Mode |');
  lines.push('|-----------|-----------------|-----------|');
  lines.push('| Google API | Included in credits | **You pay Google directly** |');
  lines.push('| Visant Infra | Included in credits | **Free** (we absorb it) |');
  lines.push('| Storage | Tier-based limit | **Separate purchase** |');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Official Google Pricing
  lines.push('## Official Google API Pricing');
  lines.push('');
  lines.push('Source: [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)');
  lines.push('');
  lines.push('### Image Generation');
  lines.push('');
  lines.push('| Model | Resolution | Google Price (USD) |');
  lines.push('|-------|------------|-------------------|');
  lines.push('| Gemini 2.5 Flash Image | ~1K | $0.039 |');
  lines.push('| Gemini 3.1 Flash Image | 512px | $0.045 |');
  lines.push('| Gemini 3.1 Flash Image | 1K | $0.067 |');
  lines.push('| Gemini 3.1 Flash Image | 2K | $0.101 |');
  lines.push('| Gemini 3.1 Flash Image | 4K | $0.151 |');
  lines.push('| Gemini 3 Pro Image | 1K/2K | $0.134 |');
  lines.push('| Gemini 3 Pro Image | 4K | $0.24 |');
  lines.push('');

  lines.push('### Video Generation (Veo 3.1)');
  lines.push('');
  lines.push('| Model | Resolution | Google Price (USD/sec) | 8 sec video |');
  lines.push('|-------|------------|----------------------|-------------|');
  lines.push('| Veo 3.1 Fast | 720p/1080p | $0.15 | $1.20 |');
  lines.push('| Veo 3.1 Standard | 720p/1080p | $0.40 | $3.20 |');
  lines.push('| Veo 3.1 Fast | 4K | $0.35 | $2.80 |');
  lines.push('| Veo 3.1 Standard | 4K | $0.60 | $4.80 |');
  lines.push('');

  lines.push('---');
  lines.push('');

  // Visant Credit System
  lines.push('## Visant Credit System');
  lines.push('');
  lines.push('Credits are our universal currency. Each operation has a fixed credit cost.');
  lines.push('');
  lines.push('### Image Generation Costs');
  lines.push('');
  lines.push('| Model | Resolution | Credits |');
  lines.push('|-------|------------|---------|');

  CREDIT_COSTS
    .filter(c => c.category === 'image')
    .forEach(c => {
      lines.push(`| ${c.model} | ${c.resolution} | ${c.creditsRequired} |`);
    });

  lines.push('');
  lines.push('### Video Generation Costs');
  lines.push('');
  lines.push('| Model | Duration | Credits |');
  lines.push('|-------|----------|---------|');

  CREDIT_COSTS
    .filter(c => c.category === 'video')
    .forEach(c => {
      lines.push(`| ${c.model} | ${c.resolution} | ${c.creditsRequired} |`);
    });

  lines.push('');
  lines.push('### Other Operations');
  lines.push('');
  lines.push('| Operation | Credits |');
  lines.push('|-----------|---------|');
  lines.push('| AI Chat | 1 credit every 4 messages |');
  lines.push('| Brand Analysis | 10 credits (complete) |');
  lines.push('| Read operations (list, get) | Free |');
  lines.push('');

  lines.push('---');
  lines.push('');

  // Credit Packages
  lines.push('## Credit Packages');
  lines.push('');
  lines.push('### What can you create?');
  lines.push('');
  lines.push('| Package | Price (BRL) | Images HD | Images 4K | Videos Fast | Videos Std |');
  lines.push('|---------|-------------|-----------|-----------|-------------|------------|');

  CREDIT_PACKAGES.forEach(pkg => {
    lines.push(`| ${pkg.credits} credits | R$${pkg.priceBRL.toFixed(2)} | ~${pkg.imagesHD} | ~${pkg.images4K} | ~${pkg.videosFast} | ~${pkg.videosStandard} |`);
  });

  lines.push('');
  lines.push('*Estimates based on default models and resolutions. Actual usage may vary.*');
  lines.push('');

  lines.push('---');
  lines.push('');

  // Storage Plans Section - NEW
  lines.push('## Storage Plans');
  lines.push('');
  lines.push('Storage is **separate from credits**. BYOK users can purchase storage without buying credits.');
  lines.push('');
  lines.push('| Plan | Storage | Price (BRL) | Price (USD) | Best For |');
  lines.push('|------|---------|-------------|-------------|----------|');

  STORAGE_PLANS.forEach(plan => {
    const storageDisplay = plan.storageMB >= 1024
      ? `${(plan.storageMB / 1024).toFixed(0)} GB`
      : `${plan.storageMB} MB`;
    const priceDisplay = plan.priceBRL === 0
      ? 'Free'
      : `R$${plan.priceBRL.toFixed(2)}/mo`;
    const priceUsdDisplay = plan.priceUSD === 0
      ? 'Free'
      : `$${plan.priceUSD.toFixed(2)}/mo`;
    lines.push(`| ${plan.name} | ${storageDisplay} | ${priceDisplay} | ${priceUsdDisplay} | ${plan.features[plan.features.length - 1]} |`);
  });

  lines.push('');
  lines.push('> **Note:** Subscription plans (Pro, Vision) include storage. Storage plans are for users who want storage-only or additional storage.');
  lines.push('');

  lines.push('---');
  lines.push('');

  // BYOK Section - UPDATED
  lines.push('## BYOK (Bring Your Own Key)');
  lines.push('');
  lines.push('Use your own Google AI API key for unlimited generations.');
  lines.push('');
  lines.push('### How It Works');
  lines.push('');
  lines.push('1. Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)');
  lines.push('2. Add it in **Profile → API Settings**');
  lines.push('3. Your key is AES-256 encrypted before storage');
  lines.push('4. All generations use YOUR Google quota, not Visant credits');
  lines.push('');
  lines.push('### Benefits');
  lines.push('');
  lines.push('| Aspect | Platform Credits | BYOK Mode |');
  lines.push('|--------|-----------------|-----------|');
  lines.push('| Image cost (HD) | ~$0.08 (2 credits) | $0.067 (Google direct) |');
  lines.push('| Credit deduction | Yes | **No** |');
  lines.push('| Rate limits | Platform limits | Your Google limits |');
  lines.push('| Storage | Included in tier | **Separate purchase** |');
  lines.push('');
  lines.push('### What You Still Need');
  lines.push('');
  lines.push('- **Storage Plan** — Your generated files need somewhere to live');
  lines.push('- We recommend **Pro Storage** (5 GB) for active creators');
  lines.push('');
  lines.push('### Security');
  lines.push('');
  lines.push('- Your key is AES-256 encrypted before storage');
  lines.push('- Never logged or exposed in API responses');
  lines.push('- Only decrypted server-side for generation calls');
  lines.push('- Delete anytime in Profile settings');
  lines.push('');

  lines.push('---');
  lines.push('');

  // Build in Public
  lines.push('## Build in Public');
  lines.push('');
  lines.push('We believe in transparency. This pricing data is:');
  lines.push('');
  lines.push('1. **Derived from official sources** — Google\'s published API pricing');
  lines.push('2. **Open in our codebase** — `src/utils/pricing.ts`, `src/utils/creditCalculator.ts`');
  lines.push('3. **Updated when Google updates** — We track official pricing changes');
  lines.push('');
  lines.push('Questions? Check our [GitHub](https://github.com/visantlabs) or join our Discord.');

  return lines.join('\n');
}

/**
 * Generate credit calculator example
 */
export function getCreditsEstimate(credits: number): {
  imagesHD: number;
  images4K: number;
  videosFast: number;
  videosStandard: number;
  chatMessages: number;
  brandAnalysis: number;
} {
  return {
    imagesHD: Math.floor(credits / 2),      // NB2 1K = 2 credits
    images4K: Math.floor(credits / 4),      // NB2 4K = 4 credits
    videosFast: Math.floor(credits / 15),   // Veo Fast = 15 credits
    videosStandard: Math.floor(credits / 40), // Veo Standard = 40 credits
    chatMessages: credits * 4,              // 1 credit = 4 messages
    brandAnalysis: Math.floor(credits / 10), // 10 credits per analysis
  };
}
