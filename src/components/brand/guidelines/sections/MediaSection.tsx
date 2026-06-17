import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { SectionBlock } from '../SectionBlock';
import { MediaKitGallery } from '@/components/brand/MediaKitGallery';
import { Image as ImageIcon, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BrandGuideline } from '@/lib/figma-types';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';

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
  const hasAssets = (media?.length || 0) + (logos?.length || 0) > 0;

  const analyzeAssets = useCallback(async () => {
    if (!guidelineId) return;
    setAnalyzing(true);
    try {
      const res = await brandGuidelineApi.analyzeAssets(guidelineId);
      if (Array.isArray(res.media)) onMediaChange(res.media);
      if (Array.isArray(res.logos)) onLogosChange(res.logos);
      toast.success(
        res.analyzed > 0
          ? `${res.analyzed} asset(s) analyzed by AI`
          : 'All assets were already analyzed'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to analyze assets');
    } finally {
      setAnalyzing(false);
    }
  }, [guidelineId, onMediaChange, onLogosChange]);

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
      <div className="py-6">
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
