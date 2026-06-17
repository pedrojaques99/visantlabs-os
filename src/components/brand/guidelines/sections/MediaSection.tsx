import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { SectionBlock } from '../SectionBlock';
import { MediaKitGallery } from '@/components/brand/MediaKitGallery';
import { Image as ImageIcon, Sparkles, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BrandGuideline } from '@/lib/figma-types';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';

interface SearchHit {
  id: string;
  url: string;
  label?: string;
  score: number;
  assetKind?: 'logo' | 'media';
}

interface MediaSectionProps {
  guidelineId: string;
  media: BrandGuideline['media'];
  logos: BrandGuideline['logos'];
  onMediaChange: (media: BrandGuideline['media']) => void;
  onLogosChange: (logos: BrandGuideline['logos']) => void;
  span?: string;
}

export const MediaSection: React.FC<MediaSectionProps> = ({
  guidelineId,
  media,
  logos,
  onMediaChange,
  onLogosChange,
  span,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const hasAssets = (media?.length || 0) + (logos?.length || 0) > 0;

  const analyzeAssets = useCallback(async () => {
    if (!guidelineId) return;
    setAnalyzing(true);
    setProgress(null);
    try {
      const res = await brandGuidelineApi.analyzeAssets(guidelineId, {
        onProgress: (p) => setProgress(p),
      });
      // Re-fetch so the gallery shows each asset's freshly-persisted analysis.
      const g = await brandGuidelineApi.getById(guidelineId);
      if (Array.isArray(g.media)) onMediaChange(g.media);
      if (Array.isArray(g.logos)) onLogosChange(g.logos);
      toast.success(
        res.analyzed > 0
          ? `${res.analyzed} asset(s) analyzed by AI`
          : 'All assets were already analyzed'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to analyze assets');
    } finally {
      setAnalyzing(false);
      setProgress(null);
    }
  }, [guidelineId, onMediaChange, onLogosChange]);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!guidelineId || !q) return;
    setSearching(true);
    try {
      const res = await brandGuidelineApi.searchAssets(guidelineId, q);
      setHits((res.results || []) as SearchHit[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [guidelineId, query]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setHits(null);
  }, []);

  return (
    <SectionBlock
      id="media"
      span={span as any}
      icon={<ImageIcon size={14} />}
      title="Visual Library & Components"
      actions={
        hasAssets && guidelineId ? (
          <Button
            variant="action"
            size="icon-sm"
            onClick={analyzeAssets}
            disabled={analyzing}
            title="Analyze assets with AI (vibe, aesthetic, theme, mood)"
            aria-label="Analyze assets with AI"
          >
            {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          </Button>
        ) : undefined
      }
    >
      <div className="py-6 space-y-5">
        {analyzing && (
          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
            <Loader2 size={12} className="animate-spin" />
            {progress && progress.total > 0
              ? `Analyzing assets with AI… ${progress.processed}/${progress.total}`
              : 'Starting analysis…'}
          </div>
        )}
        {hasAssets && guidelineId && (
          <div className="space-y-3">
            {/* Semantic search over the brand's own analyzed assets */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  placeholder="Search assets by vibe, theme, mood…"
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Button variant="action" size="sm" onClick={runSearch} disabled={searching || !query.trim()}>
                {searching ? <Loader2 size={12} className="animate-spin" /> : 'Search'}
              </Button>
              {hits !== null && (
                <Button variant="ghost" size="icon-sm" onClick={clearSearch} aria-label="Clear search">
                  <X size={12} />
                </Button>
              )}
            </div>

            {hits !== null && (
              <div>
                {hits.length === 0 ? (
                  <p className="text-[11px] text-neutral-600">No matching assets.</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {hits.map((h) => (
                      <div
                        key={h.id}
                        className="relative aspect-square rounded-md overflow-hidden border border-neutral-800 group"
                        title={`${h.label || ''} · ${Math.round(h.score * 100)}% match`}
                      >
                        <img src={h.url} alt={h.label || ''} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 px-1 rounded bg-black/70 text-[9px] font-mono text-white/80">
                          {Math.round(h.score * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <MediaKitGallery
          guidelineId={guidelineId}
          media={media || []}
          logos={logos || []}
          onMediaChange={onMediaChange}
          onLogosChange={onLogosChange}
          compact
        />
      </div>
    </SectionBlock>
  );
};
