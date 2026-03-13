import React from 'react';
import { SectionBlock } from '../SectionBlock';
import { MediaKitGallery } from '@/components/brand/MediaKitGallery';
import { Image as ImageIcon } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface MediaSectionProps {
  guidelineId: string;
  media: BrandGuideline['media'];
  logos: BrandGuideline['logos'];
  onMediaChange: (media: BrandGuideline['media']) => void;
  onLogosChange: (logos: BrandGuideline['logos']) => void;
}

export const MediaSection: React.FC<MediaSectionProps> = ({
  guidelineId,
  media,
  logos,
  onMediaChange,
  onLogosChange,
}) => {
  return (
    <SectionBlock id="media" span="3" icon={<ImageIcon size={14} />} title="Visual Library & Components">
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
