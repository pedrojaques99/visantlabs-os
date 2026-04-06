import { generateMockup } from '@/services/geminiService';
import { uploadImageToR2Auto } from '@/hooks/canvas/utils/r2UploadUtils';
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
}: GenerateInput): Promise<GenerateOutput> {
  // 1. Ask backend for structured creative plan
  const brandContext = guideline
    ? {
        name: guideline.identity?.name,
        colors: (guideline.colors ?? []).map((c) => c.hex).filter(Boolean),
        fonts: (guideline.typography ?? []).map((t) => t.family).filter(Boolean),
        voice: guideline.guidelines?.voice,
        keywords: Object.values(guideline.tags ?? {}).flat(),
      }
    : undefined;

  const token = authService.getToken();
  const planResp = await fetch(`${API_BASE}/creative/plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ prompt, format, brandContext }),
  });

  if (!planResp.ok) {
    throw new Error(`Creative plan failed: ${planResp.status}`);
  }

  const plan = (await planResp.json()) as CreativeAIResponse;

  // 2. Generate background image via existing geminiService
  const bgPrompt = plan.background?.prompt ?? prompt;
  const base64 = await generateMockup(
    bgPrompt,
    undefined,
    undefined,
    undefined,
    format
  );

  // 3. Upload to R2 (so dom-to-image-more can load via CORS)
  const dataUrl = `data:image/png;base64,${base64}`;
  const backgroundUrl = await uploadImageToR2Auto(dataUrl, `creative-bg-${Date.now()}.png`);

  if (!backgroundUrl) {
    throw new Error('Failed to upload background image to R2');
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
