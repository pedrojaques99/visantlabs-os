import { mockupApi } from '@/services/mockupApi';
import { canvasApi } from '@/services/canvasApi';
import { authService } from '@/services/authService';
import type { BrandGuideline } from '@/lib/figma-types';
import {
  getContrastColor,
  getContrastRatioPublic,
} from '@/utils/colorUtils';
import type {
  CreativeAIResponse,
  CreativeFormat,
  CreativeLayerData,
  CreativeOverlay,
  TextLayerData,
} from '../store/creativeTypes';
import { API_BASE } from '@/config/api';

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
  // 1. Ask backend for structured creative plan. Send the full guideline so the
  // server's `buildBrandContextJSON` produces a rich structured context (role,
  // weight, variant, gradients, strategy/personas) — all of which the LLM uses
  // to align cores/fontes/logo placement with the brand.
  const token = authService.getToken();
  const planResp = await fetch(`${API_BASE}/creative/plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({
      prompt,
      format,
      brandGuideline: guideline ?? undefined,
      brandId: brandId ?? undefined,
    }),
  });

  if (!planResp.ok) {
    const errText = await planResp.text();
    throw new Error(`Creative plan failed: ${planResp.status} - ${errText}`);
  }

  const plan = (await planResp.json()) as CreativeAIResponse & {
    pickedMedia?: { url: string } | null;
  };

  // 2. Background source priority — assembly editor, not image gen:
  //    (a) caller-supplied existingBackgroundUrl wins
  //    (b) brand media picked by the engine for this format
  //    (c) AI image gen as last resort (other routes own primary AI gen)
  let backgroundUrl = existingBackgroundUrl || plan.pickedMedia?.url || '';

  if (!backgroundUrl) {
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

    backgroundUrl =
      result.imageUrl ||
      (await canvasApi.uploadImageToR2(`data:image/png;base64,${base64}`));

    if (!backgroundUrl) {
      throw new Error('Failed to upload background image to R2');
    }
  }

  // 4. Resolve logo + WCAG text colors. We don't know the actual image
  // luminance, so use the overlay color as a proxy. Falls back to primary
  // variant if no overlay or if a matching variant doesn't exist.
  const overlay = plan.overlay ?? null;
  const logoForOverlay = pickLogoForOverlay(guideline?.logos ?? [], overlay);
  const layers = plan.layers
    .map((l) => {
      if (l.type === 'logo') {
        if (!logoForOverlay?.url) return null;
        return { ...l, url: logoForOverlay.url };
      }
      if (l.type === 'text') {
        return ensureTextContrast(l, overlay);
      }
      return l;
    })
    .filter((l): l is CreativeLayerData => l !== null);

  return {
    backgroundUrl,
    overlay,
    layers,
  };
}

/**
 * Pick a logo variant adapted to the overlay luminance:
 *   dark overlay  → 'light' or 'primary' (light is preferred)
 *   light overlay → 'dark' or 'primary'
 * No overlay → 'primary' first, otherwise the first available.
 */
function pickLogoForOverlay(
  logos: BrandGuideline['logos'] = [],
  overlay: CreativeOverlay | null
) {
  if (!logos.length) return null;
  const find = (variant: string) => logos.find((l) => l.variant === variant);

  if (overlay?.color) {
    const overlayIsDark = getContrastColor(overlay.color) === 'white';
    const preferred = overlayIsDark ? find('light') : find('dark');
    if (preferred?.url) return preferred;
  }
  return find('primary') ?? logos[0];
}

/**
 * If a text layer's color has < 4.5:1 contrast against the overlay (WCAG AA),
 * snap it to black or white — whichever wins. Pure-image backgrounds with no
 * overlay are left alone (we can't measure them client-side).
 */
function ensureTextContrast(
  layer: TextLayerData,
  overlay: CreativeOverlay | null
): TextLayerData {
  if (!overlay?.color) return layer;
  const ratio = getContrastRatioPublic(layer.color, overlay.color);
  if (ratio >= 4.5) return layer;
  const safeColor = getContrastColor(overlay.color) === 'white' ? '#ffffff' : '#000000';
  return { ...layer, color: safeColor };
}
