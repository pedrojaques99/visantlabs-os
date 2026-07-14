import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, RefreshCw, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { GeneratingImageCard } from '@/components/ui/GeneratingImageCard';
import { cn } from '@/lib/utils';
import { glassSurface } from '@/lib/ui/glass';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
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
  const { data, isLoading: loadingRecipes, error: recipesError } = useMockupSuggestions(brandId);

  const [recipes, setRecipes] = useState<MockupRecipe[]>([]);
  const [idx, setIdx] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);

  const seen = useRef<Set<string>>(new Set());
  const sceneCache = useRef<Map<string, LoadedScene>>(new Map());
  const lastBlobUrl = useRef<string | null>(null);

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
        setImgUrl(url);
        setRendering(false);
      } catch {
        if (cancelled) return;
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

  // Auto-advance past a scene that couldn't be rendered so the feed never dead-ends.
  useEffect(() => {
    if (renderError) {
      const t = setTimeout(() => void surprise(), 400);
      return () => clearTimeout(t);
    }
  }, [renderError, surprise]);

  const busy = loadingRecipes || rendering || fetchingMore;

  const emptyCopy = useMemo(() => {
    if (recipesError) return 'Não deu pra carregar sugestões agora.';
    if (reason === 'no_assets')
      return 'Adicione um logo ou arte à marca pra gerar mockups on-brand.';
    if (reason === 'no_scenes') return 'Nenhuma cena comercial disponível ainda.';
    if (!loadingRecipes && recipes.length === 0) return 'Sem sugestões pra esta marca ainda.';
    return null;
  }, [recipesError, reason, loadingRecipes, recipes.length]);

  return (
    <section
      data-vsn-region="surprise-mockups"
      className={cn('rounded-2xl p-3 flex flex-col gap-2.5', glassSurface.panel, className)}
    >
      <div className="flex items-center justify-between gap-3">
        <MicroTitle className="flex items-center gap-1.5">
          <Sparkles className="size-3.5" />
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
              <Sparkles className="size-3.5" />
              Adicionar logo
            </Button>
          )}
        </div>
      ) : (
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
      )}
    </section>
  );
};
