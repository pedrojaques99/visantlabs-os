import { mockupApi } from '@/services/mockupApi';
import { canvasApi } from '@/services/canvasApi';
import { authService } from '@/services/authService';
import type { BrandGuideline } from '@/lib/figma-types';
import type {
  CreativeAIResponse,
  CreativeFormat,
  CreativeLayerData,
} from '../store/creativeTypes';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

interface GenerateInput {
  prompt: string;
  format: CreativeFormat;
  guideline: BrandGuideline | null;
  brandId?: string | null;
  modelId?: string;
  provider?: string;
  resolution?: string;
  existingBackgroundUrl?: string | null;
}

interface GenerateOutput {
  backgroundUrl: string;
  overlay: CreativeAIResponse['overlay'] | null;
  layers: CreativeLayerData[];
}

export async function generateCreative({
  prompt,
  format,
  guideline,
  brandId,
  modelId,
  provider,
  resolution,
  existingBackgroundUrl,
}: GenerateInput): Promise<GenerateOutput> {
  // 1. Ask backend for structured creative plan
  const brandContext = guideline
    ? {
        name: guideline.identity?.name,
        colors: (guideline.colors ?? []).map((c) => c.hex).filter(Boolean),
        fonts: (guideline.typography ?? []).map((t) => t.family).filter(Boolean),
        voice: guideline.guidelines?.voice,
        keywords: Object.values(guideline.tags ?? {}).flat(),
        hasLogos: (guideline.logos ?? []).length > 0,
      }
    : undefined;

  const token = authService.getToken();
  const planResp = await fetch(`${API_BASE}/creative/plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ prompt, format, brandContext, brandId: brandId ?? undefined }),
  });

  if (!planResp.ok) {
    const errText = await planResp.text();
    throw new Error(`Creative plan failed: ${planResp.status} - ${errText}`);
  }

  const plan = (await planResp.json()) as CreativeAIResponse;

  // 2. Resolve background image
  let backgroundUrl = existingBackgroundUrl || '';

  if (!backgroundUrl) {
    // Generate background image via mockupApi (centralized backend generation)
    const bgPrompt = plan.background?.prompt ?? prompt;
    const result = await mockupApi.generate({
      promptText: bgPrompt,
      model: modelId || 'gemini-3.1-flash-image-preview',
      provider: (provider as any) || 'gemini',
      resolution,
      aspectRatio: format,
      feature: 'canvas',
    });

    const base64 = result.imageBase64;
    if (!base64 && !result.imageUrl) {
      throw new Error('No image generated for creative background');
    }

    // 3. Upload to R2 (so Konva useImage can load via CORS / crossOrigin='anonymous')
    backgroundUrl = result.imageUrl || await canvasApi.uploadImageToR2(`data:image/png;base64,${base64}`);

    if (!backgroundUrl) {
      throw new Error('Failed to upload background image to R2');
    }
  }

  // 4. Resolve logo layers — replace any logo placeholder with actual brand logo URL
  const primaryLogo = guideline?.logos?.find((l) => l.variant === 'primary') ?? guideline?.logos?.[0];
  const layers = plan.layers
    .map((l) => {
      if (l.type === 'logo') {
        if (!primaryLogo?.url) return null;
        return { ...l, url: primaryLogo.url };
      }
      return l;
    })
    .filter((l): l is CreativeLayerData => l !== null);

  return {
    backgroundUrl,
    overlay: plan.overlay ?? null,
    layers,
  };
}
