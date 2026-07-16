import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Zap, RefreshCw, ImageOff, Download, Bookmark, Check } from '@/lib/ui/icons';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { GeneratingImageCard } from '@/components/ui/GeneratingImageCard';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { glassSurface } from '@/lib/ui/glass';
import { useTranslation } from '@/hooks/useTranslation';
import { downloadBlob } from '@/utils/clipboard';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { mockupApi } from '@/services/mockupApi';
import { useMockupSuggestions } from '@/hooks/queries/useBrandGuidelines';
import {
  loadScene,
  loadArtFromUrl,
  renderSceneToCanvas,
  toBlob,
  type LoadedScene,
} from '@/lib/mockup/sceneClient';

export interface MockupRecipe {
  psdFileName: string;
  faceKey: string;
  faceName: string;
  assetUrl: string;
  variant?: string;
  surfaceKind: string;
  score: number;
}

interface SurpriseMockupHeroProps {
  brandId: string;
  className?: string;
  /** Marca sem logo/arte → CTA pra adicionar (em vez de beco sem saída). */
  onAddAsset?: () => void;
}

const pairKey = (r: MockupRecipe) => `${r.psdFileName}:${r.faceKey}`;

/** Consecutive render failures before we stop rotating and admit it's broken. */
const FAIL_STREAK_LIMIT = 3;

/** "1200x800" → "3:2". The library filters by aspectRatio, so persist a real one. */
function aspectRatioOf(size: { w: number; h: number } | null): string {
  if (!size?.w || !size?.h) return '';
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const d = gcd(size.w, size.h);
  return `${Math.round(size.w / d)}:${Math.round(size.h / d)}`;
}

/**
 * Free "surprise-me" mockup tile — shows ONE on-brand mockup at a time, composited
 * in the browser from the brand's own asset over a commercial scene (Scene Package
 * engine, zero credits). "Surpreenda-me" advances to the next matched suggestion.
 * Recipes come from the deterministic matcher (`/mockup-suggestions`); the pixel
 * work happens here on the client. Sits as one cell in the cockpit bento.
 */
export const SurpriseMockupHero: React.FC<SurpriseMockupHeroProps> = ({
  brandId,
  className,
  onAddAsset,
}) => {
  const { t } = useTranslation();
  const { data, isLoading: loadingRecipes, error: recipesError } = useMockupSuggestions(brandId);

  const [recipes, setRecipes] = useState<MockupRecipe[]>([]);
  const [idx, setIdx] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [feedBroken, setFeedBroken] = useState(false);
  const failStreak = useRef(0);

  const seen = useRef<Set<string>>(new Set());
  const sceneCache = useRef<Map<string, LoadedScene>>(new Map());
  const lastBlobUrl = useRef<string | null>(null);
  /** The rendered PNG at full PSD resolution — the preview element just shows it
      downscaled by CSS. Both actions reuse it, so neither re-renders the scene. */
  const lastBlob = useRef<Blob | null>(null);
  const lastSize = useRef<{ w: number; h: number } | null>(null);

  // Seed local list from the first page.
  useEffect(() => {
    if (data?.suggestions) {
      setRecipes(data.suggestions);
      setCursor(data.nextCursor);
      setIdx(0);
    }
  }, [data]);

  const current = recipes[idx];
  const reason = data?.reason;

  // Render the current recipe into a browser canvas → object URL. Scene packages
  // are cached so re-visiting a scene is instant.
  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    seen.current.add(pairKey(current));
    setRendering(true);
    setRenderError(false);

    (async () => {
      try {
        let scene = sceneCache.current.get(current.psdFileName);
        if (!scene) {
          scene = await loadScene(current.psdFileName);
          sceneCache.current.set(current.psdFileName, scene);
        }
        const art = await loadArtFromUrl(current.assetUrl);
        const canvas = renderSceneToCanvas(
          scene.doc,
          scene.images,
          { [current.faceKey]: art },
          { defaultArt: art }
        );
        const blob = await toBlob(canvas);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (lastBlobUrl.current) URL.revokeObjectURL(lastBlobUrl.current);
        lastBlobUrl.current = url;
        lastBlob.current = blob;
        lastSize.current = { w: canvas.width, h: canvas.height };
        setImgUrl(url);
        setRendering(false);
        failStreak.current = 0;
      } catch (err) {
        if (cancelled) return;
        // One scene failing is normal (not every PSD is in the public library) →
        // rotate. Every scene failing in a row is systemic (auth, network, a
        // missing CORS rule on the asset bucket) and rotating just hides it —
        // that's how an absent CORS header read as an eternal "compondo".
        failStreak.current += 1;
        if (failStreak.current >= FAIL_STREAK_LIMIT) {
          console.warn('[surprise-mockup] render keeps failing, stopping the feed:', err);
          setFeedBroken(true);
        }
        setRenderError(true);
        setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [current]);

  // Revoke the last object URL on unmount.
  useEffect(
    () => () => {
      if (lastBlobUrl.current) URL.revokeObjectURL(lastBlobUrl.current);
    },
    []
  );

  const surprise = useCallback(async () => {
    // Auto-skip a scene that failed to render (e.g. not in the public library).
    const next = idx + 1;
    if (next < recipes.length) {
      setIdx(next);
      return;
    }
    // Exhausted the loaded page — fetch the next, excluding what we've shown.
    if (cursor != null && !fetchingMore) {
      setFetchingMore(true);
      try {
        const more = await brandGuidelineApi.getMockupSuggestions(brandId, {
          cursor,
          seen: [...seen.current],
        });
        if (more.suggestions.length) {
          setRecipes((prev) => [...prev, ...more.suggestions]);
          setCursor(more.nextCursor);
          setIdx(next);
          return;
        }
        setCursor(null);
      } finally {
        setFetchingMore(false);
      }
    }
    // Nothing new — wrap around for another pass.
    setIdx(0);
  }, [idx, recipes.length, cursor, fetchingMore, brandId]);

  // Auto-advance past a scene that couldn't be rendered so the feed never dead-ends
  // — but stop once it's clear the failure isn't scene-specific.
  useEffect(() => {
    if (renderError && !feedBroken) {
      const timer = setTimeout(() => void surprise(), 400);
      return () => clearTimeout(timer);
    }
  }, [renderError, feedBroken, surprise]);

  /** Slug for the download filename: "urban-stay-business-card-front.png". */
  const fileName = useMemo(() => {
    const slug = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    const parts = [current?.psdFileName, current?.faceName].filter(Boolean).map((p) => slug(p!));
    return `${parts.join('-') || 'mockup'}.png`;
  }, [current]);

  // The canvas is already the full PSD size (renderScene uses doc.width/height), so
  // the blob we composited IS the high-res PNG — no re-render, no server round-trip.
  const download = useCallback(() => {
    if (!lastBlob.current) return;
    downloadBlob(lastBlob.current, fileName);
  }, [fileName]);

  const save = useCallback(async () => {
    const blob = lastBlob.current;
    if (!blob || !current || saving) return;
    setSaving(true);
    try {
      const { presignedUrl, finalUrl } = await mockupApi.getUploadUrl('image/png');
      const put = await fetch(presignedUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/png' },
      });
      if (!put.ok) throw new Error(`upload falhou: ${put.status}`);
      await mockupApi.save({
        imageUrl: finalUrl,
        prompt: `${current.faceName} · ${current.psdFileName}`,
        designType: 'brand-mockup',
        tags: ['mockup-gratis', current.surfaceKind].filter(Boolean),
        brandingTags: [],
        aspectRatio: aspectRatioOf(lastSize.current),
        brandGuidelineId: brandId,
      });
      setSavedKey(pairKey(current));
      toast.success('Salvo em Meus Mockups');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não deu pra salvar o mockup');
    } finally {
      setSaving(false);
    }
  }, [current, saving, brandId]);

  const isSaved = !!current && savedKey === pairKey(current);
  const canAct = !!imgUrl && !rendering && !renderError;

  const busy = loadingRecipes || rendering || fetchingMore;

  const emptyCopy = useMemo(() => {
    if (feedBroken) return 'Não deu pra compor os mockups agora. Tente recarregar.';
    if (recipesError) return 'Não deu pra carregar sugestões agora.';
    if (reason === 'no_assets')
      return 'Adicione um logo ou arte à marca pra gerar mockups on-brand.';
    if (reason === 'no_scenes') return 'Nenhuma cena comercial disponível ainda.';
    if (!loadingRecipes && recipes.length === 0) return 'Sem sugestões pra esta marca ainda.';
    return null;
  }, [feedBroken, recipesError, reason, loadingRecipes, recipes.length]);

  return (
    <section
      data-vsn-region="surprise-mockups"
      className={cn('rounded-2xl p-3 flex flex-col gap-2.5', glassSurface.panel, className)}
    >
      <div className="flex items-center justify-between gap-3">
        <MicroTitle className="flex items-center gap-1.5">
          <Zap className="size-3.5" />
          Mockups grátis
        </MicroTitle>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => void surprise()}
          disabled={busy || (!current && !emptyCopy)}
          className="gap-1.5"
          aria-label="Surpreenda-me"
        >
          <RefreshCw className={cn('size-3.5', busy && 'animate-spin')} />
        </Button>
      </div>

      {emptyCopy ? (
        <div
          className={cn(
            'rounded-xl aspect-[4/3] flex flex-col items-center justify-center gap-2.5 text-center px-6',
            glassSurface.tile
          )}
        >
          <ImageOff className="size-6 opacity-40" />
          <p className="text-sm opacity-70">{emptyCopy}</p>
          {/* Beco sem saída → CTA: sem logo, o único render grátis fica vazio.
              Aqui o usuário adiciona um asset e o tile passa a produzir. */}
          {reason === 'no_assets' && onAddAsset && (
            <Button size="xs" variant="secondary" onClick={onAddAsset} className="mt-1 gap-1.5">
              <Zap className="size-3.5" />
              Adicionar logo
            </Button>
          )}
        </div>
      ) : (
        <div className="group relative">
          <GeneratingImageCard
            isLoading={busy || (!imgUrl && !renderError)}
            variant="tile"
            aspectRatio="4/3"
            steps={['compondo', 'aplicando marca', 'renderizando']}
          >
            {imgUrl && (
              <img
                src={imgUrl}
                alt={`Mockup ${current?.faceName ?? ''}`}
                className="w-full h-full object-cover rounded-xl"
              />
            )}
          </GeneratingImageCard>

          {/* pointer-events-none so the tile stays clickable; only the buttons opt back in. */}
          {canAct && (
            <div className="absolute inset-0 z-20 pointer-events-none flex items-end justify-center pb-3">
              <div
                className={cn(
                  'flex items-center gap-0.5 p-1 rounded-lg pointer-events-auto',
                  'bg-neutral-950/80 backdrop-blur-xl border border-white/10 shadow-2xl',
                  'opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300'
                )}
              >
                <Tooltip content={isSaved ? 'Salvo' : t('common.save') || 'Salvar'} position="top">
                  <Button
                    variant="action"
                    onClick={() => void save()}
                    disabled={saving || isSaved}
                    className="w-8 h-8 p-1.5 hover:text-white hover:bg-white/10"
                    aria-label={t('common.save') || 'Salvar'}
                  >
                    {isSaved ? (
                      <Check className="size-4 text-brand-cyan" />
                    ) : (
                      <Bookmark className={cn('size-4', saving && 'animate-pulse')} />
                    )}
                  </Button>
                </Tooltip>
                <Tooltip content={t('common.download') || 'Baixar'} position="top">
                  <Button
                    variant="action"
                    onClick={download}
                    className="w-8 h-8 p-1.5 hover:text-white hover:bg-white/10"
                    aria-label={t('common.download') || 'Baixar'}
                  >
                    <Download className="size-4" />
                  </Button>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
