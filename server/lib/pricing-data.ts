/**
 * Pricing Data — canonical server-side source of truth.
 *
 * Served via GET /api/docs/pricing.
 * The frontend src/pages/docs/data/pricingData.ts re-exports from here
 * so there is exactly one place to update pricing.
 */

export interface PricingTier {
  model: string;
  modelId: string;
  resolution: string;
  googlePriceUSD: number;
  creditsRequired: number;
  category: 'image' | 'video' | 'chat' | 'branding' | 'text';
}

export interface CreditPackage {
  credits: number;
  priceBRL: number;
  priceUSD: number;
  pricePerCreditUSD: number;
  imagesHD: number;
  images4K: number;
  videosFast: number;
  videosStandard: number;
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

export const VISANT_INFRA_COSTS = {
  IMAGE_PROCESSING: 0.005,
  IMAGE_CDN: 0.003,
  IMAGE_API_OVERHEAD: 0.005,
  IMAGE_TOTAL: 0.013,
  VIDEO_PROCESSING: 0.08,
  VIDEO_CDN: 0.04,
  VIDEO_API_OVERHEAD: 0.03,
  VIDEO_TOTAL: 0.15,
} as const;

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
    storageMB: 5 * 1024,
    priceBRL: 9.90,
    priceUSD: 1.80,
    billingCycle: 'monthly',
    features: ['5 GB storage', '~1,250 HD images', 'Ideal for active creators'],
    isByok: true,
  },
  {
    id: 'storage_vision',
    name: 'Vision Storage',
    storageMB: 50 * 1024,
    priceBRL: 29.90,
    priceUSD: 5.45,
    billingCycle: 'monthly',
    features: ['50 GB storage', 'Video storage included', 'Unlimited projects'],
    isByok: true,
  },
];

export const GOOGLE_OFFICIAL_PRICING = {
  image: {
    'gemini-2.5-flash-image': { '~1K': 0.039 },
    'gemini-3.1-flash-image-preview': { '512px': 0.045, '1K': 0.067, '2K': 0.101, '4K': 0.151 },
    'gemini-3-pro-image-preview': { '1K': 0.134, '2K': 0.134, '4K': 0.24 },
  },
  video: {
    'veo-3.1-fast-generate-preview': { '720p/1080p': 0.15, '4K': 0.35 },
    'veo-3.1-generate-preview': { '720p/1080p': 0.40, '4K': 0.60 },
  },
  defaultVideoDurationSec: 8,
} as const;

export const CREDIT_COSTS: PricingTier[] = [
  // ── Gemini Image ──
  { model: 'Gemini 2.5 Flash', modelId: 'gemini-2.5-flash-image', resolution: '~1K (HD)', googlePriceUSD: 0.039, creditsRequired: 1, category: 'image' },
  { model: 'Gemini 3.1 Flash', modelId: 'gemini-3.1-flash-image-preview', resolution: '512px', googlePriceUSD: 0.045, creditsRequired: 1, category: 'image' },
  { model: 'Gemini 3.1 Flash', modelId: 'gemini-3.1-flash-image-preview', resolution: '1K (HD)', googlePriceUSD: 0.067, creditsRequired: 2, category: 'image' },
  { model: 'Gemini 3.1 Flash', modelId: 'gemini-3.1-flash-image-preview', resolution: '2K', googlePriceUSD: 0.101, creditsRequired: 3, category: 'image' },
  { model: 'Gemini 3.1 Flash', modelId: 'gemini-3.1-flash-image-preview', resolution: '4K', googlePriceUSD: 0.151, creditsRequired: 4, category: 'image' },
  { model: 'Gemini 3 Pro', modelId: 'gemini-3-pro-image-preview', resolution: '1K (HD)', googlePriceUSD: 0.134, creditsRequired: 3, category: 'image' },
  { model: 'Gemini 3 Pro', modelId: 'gemini-3-pro-image-preview', resolution: '2K', googlePriceUSD: 0.134, creditsRequired: 5, category: 'image' },
  { model: 'Gemini 3 Pro', modelId: 'gemini-3-pro-image-preview', resolution: '4K', googlePriceUSD: 0.24, creditsRequired: 7, category: 'image' },
  // ── OpenAI Image (gpt-image-2, token-based, estimates per image) ──
  { model: 'GPT Image 2', modelId: 'gpt-image-2', resolution: '1K (HD)', googlePriceUSD: 0.053, creditsRequired: 2, category: 'image' },
  { model: 'GPT Image 2', modelId: 'gpt-image-2', resolution: '2K', googlePriceUSD: 0.12, creditsRequired: 3, category: 'image' },
  { model: 'GPT Image 2', modelId: 'gpt-image-2', resolution: '4K', googlePriceUSD: 0.211, creditsRequired: 4, category: 'image' },
  // ── Seedream Image (BytePlus API) ──
  { model: 'Seedream 5 Lite', modelId: 'seedream-5-0-lite', resolution: '2K', googlePriceUSD: 0.035, creditsRequired: 2, category: 'image' },
  { model: 'Seedream 5 Lite', modelId: 'seedream-5-0-lite', resolution: '3K', googlePriceUSD: 0.045, creditsRequired: 3, category: 'image' },
  { model: 'Seedream 5 Lite', modelId: 'seedream-5-0-lite', resolution: '4K', googlePriceUSD: 0.055, creditsRequired: 4, category: 'image' },
  { model: 'Seedream 4.5', modelId: 'seedream-4.5', resolution: '2K', googlePriceUSD: 0.04, creditsRequired: 2, category: 'image' },
  { model: 'Seedream 4.5', modelId: 'seedream-4.5', resolution: '3K', googlePriceUSD: 0.045, creditsRequired: 3, category: 'image' },
  { model: 'Seedream 4.5', modelId: 'seedream-4.5', resolution: '4K', googlePriceUSD: 0.055, creditsRequired: 4, category: 'image' },
  { model: 'Seedream 4.0', modelId: 'seedream-4.0', resolution: '2K', googlePriceUSD: 0.025, creditsRequired: 2, category: 'image' },
  { model: 'Seedream 4.0', modelId: 'seedream-4.0', resolution: '3K', googlePriceUSD: 0.035, creditsRequired: 3, category: 'image' },
  { model: 'Seedream 4.0', modelId: 'seedream-4.0', resolution: '4K', googlePriceUSD: 0.045, creditsRequired: 4, category: 'image' },
  // ── Veo Video (Google, per-second × 8s default) ──
  { model: 'Veo 3.1 Fast', modelId: 'veo-3.1-fast-generate-preview', resolution: '720p/1080p (8s)', googlePriceUSD: 1.20, creditsRequired: 15, category: 'video' },
  { model: 'Veo 3.1 Standard', modelId: 'veo-3.1-generate-preview', resolution: '720p/1080p (8s)', googlePriceUSD: 3.20, creditsRequired: 40, category: 'video' },
  // ── Seedance Video (ByteDance, ~$0.092/s × 5s) ──
  { model: 'Seedance Fast', modelId: 'seedance-fast', resolution: '720p (5s)', googlePriceUSD: 0.46, creditsRequired: 20, category: 'video' },
  { model: 'Seedance Standard', modelId: 'seedance-standard', resolution: '720p (5s)', googlePriceUSD: 0.92, creditsRequired: 35, category: 'video' },
  // ── Kling Video (Kuaishou, ~$0.10-0.14/s × 5s avg) ──
  { model: 'Kling Standard', modelId: 'kling-standard', resolution: '720p (5s)', googlePriceUSD: 0.50, creditsRequired: 20, category: 'video' },
  { model: 'Kling Pro', modelId: 'kling-pro', resolution: '1080p (5s)', googlePriceUSD: 0.70, creditsRequired: 30, category: 'video' },
  // ── Text / Chat / Analysis ──
  { model: 'AI Chat', modelId: 'gemini-2.5-flash', resolution: '4 messages', googlePriceUSD: 0.001, creditsRequired: 1, category: 'chat' },
  { model: 'Brand Analysis', modelId: 'gemini-2.5-flash', resolution: 'Complete (10 steps)', googlePriceUSD: 0.01, creditsRequired: 10, category: 'branding' },
  { model: 'AI Text (single call)', modelId: 'gemini-text-single', resolution: '~2K tokens', googlePriceUSD: 0.001, creditsRequired: 1, category: 'text' },
];

// ── Lookup helpers (single source of truth for credit calculations) ──

const _creditLookup = new Map<string, number>();
for (const tier of CREDIT_COSTS) {
  _creditLookup.set(`${tier.modelId}:${tier.resolution}`, tier.creditsRequired);
}

export function lookupCredits(modelId: string, resolution?: string): number | undefined {
  if (resolution) {
    const exact = _creditLookup.get(`${modelId}:${resolution}`);
    if (exact !== undefined) return exact;
  }
  for (const tier of CREDIT_COSTS) {
    if (tier.modelId === modelId) return tier.creditsRequired;
  }
  return undefined;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { credits: 20, priceBRL: 9.90, priceUSD: 1.80, pricePerCreditUSD: 0.09, imagesHD: 10, images4K: 5, videosFast: 1, videosStandard: 0 },
  { credits: 50, priceBRL: 25.90, priceUSD: 4.71, pricePerCreditUSD: 0.094, imagesHD: 25, images4K: 12, videosFast: 3, videosStandard: 1 },
  { credits: 100, priceBRL: 45.90, priceUSD: 8.35, pricePerCreditUSD: 0.0835, imagesHD: 50, images4K: 25, videosFast: 6, videosStandard: 2 },
  { credits: 500, priceBRL: 198.00, priceUSD: 36.00, pricePerCreditUSD: 0.072, imagesHD: 250, images4K: 125, videosFast: 33, videosStandard: 12 },
];

/** Returns the full pricing payload served by GET /api/docs/pricing */
export function getPricingPayload() {
  return {
    creditCosts: CREDIT_COSTS,
    creditPackages: CREDIT_PACKAGES,
    storagePlans: STORAGE_PLANS,
    googlePricing: GOOGLE_OFFICIAL_PRICING,
    infraCosts: VISANT_INFRA_COSTS,
  };
}
