/**
 * BrandPreviewGallery — the Preview tab: a masonry of on-brand template tiles.
 *
 * Built-in presets + Figma-synced templates, each a LIVE editable render (per-tile
 * color combination + text overrides, edited in a focus overlay). The masonry packs
 * mixed aspect ratios (story 9:16, banner 16:9, square…) and is the same component the
 * reference library uses (`src/components/ui/Masonry`). Tiles: `PreviewTile`.
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Masonry } from '@/components/ui/Masonry';
import { useSyncedTemplates } from '@/hooks/queries/useBrandGuidelines';
import type { MockTokens } from './mockTokens';
import { useBrandFonts } from './useBrandFonts';
import {
  InstagramFeedMock,
  LinkedInPostMock,
  StoriesMock,
  WebsiteHeroMock,
  EmailHeaderMock,
  PosterMock,
  BusinessCardMock,
  EditorialStoryMock,
  CardScatterMock,
  EditorialHeroMock,
  BrandPatternMock,
  type MockOverrides,
} from './BrandMocks';
import { TemplateRenderer, type TemplateSchema } from './TemplateRenderer';
import cardScatterSchema from './schemas/card-scatter.json';
import { PreviewTile, type TileItem } from './PreviewTile';

// A preset rendered LIVE from a Figma-extracted schema (no hand-written React).
const SyncedCardScatterMock: React.FC<{
  tokens: MockTokens;
  className?: string;
  exportRef?: React.Ref<HTMLDivElement>;
  variant?: number;
  overrides?: MockOverrides;
}> = (props) => (
  <TemplateRenderer schema={cardScatterSchema as unknown as TemplateSchema} {...props} />
);

const BUILTIN: TileItem[] = [
  { id: 'instagram', label: 'Instagram', Component: InstagramFeedMock },
  { id: 'linkedin', label: 'LinkedIn', Component: LinkedInPostMock },
  { id: 'stories', label: 'Stories', Component: StoriesMock },
  { id: 'website', label: 'Website hero', Component: WebsiteHeroMock },
  { id: 'email', label: 'Email header', Component: EmailHeaderMock },
  { id: 'poster', label: 'Poster', Component: PosterMock },
  { id: 'card', label: 'Business card', Component: BusinessCardMock },
  { id: 'story', label: 'Editorial story', Component: EditorialStoryMock },
  { id: 'scatter', label: 'Card showcase', Component: CardScatterMock },
  { id: 'hero', label: 'Editorial hero', Component: EditorialHeroMock },
  { id: 'pattern', label: 'Brand pattern', Component: BrandPatternMock },
  { id: 'scatter-sync', label: 'Card scatter · Figma', Component: SyncedCardScatterMock },
];

export const BrandPreviewGallery: React.FC<{
  tokens: MockTokens;
  brandName: string;
  brandId?: string;
}> = ({ tokens, brandName, brandId }) => {
  // Load the brand's real fonts so tiles render in-brand, not a system fallback.
  useBrandFonts(tokens.headingFamily, tokens.bodyFamily);

  // Layout schemas synced from the brand's Figma [Template] frames — rendered live by
  // <TemplateRenderer>. Appended to the built-in presets in the same masonry.
  const synced = useSyncedTemplates(brandId);
  const items = useMemo<TileItem[]>(() => {
    const syncedItems: TileItem[] = (synced.data ?? []).map((s, i) => ({
      id: `synced-${s.id || i}`,
      label: `${s.name.replace(/^\[Template\]\s*/, '')} · Figma`,
      Component: (props) => <TemplateRenderer schema={s} {...props} />,
    }));
    return [...BUILTIN, ...syncedItems];
  }, [synced.data]);

  return (
    <motion.div id="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-baseline justify-between px-1">
        <MicroTitle className="text-[var(--accent)] font-bold opacity-70">Brand Preview</MicroTitle>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/30">
          {items.length} designs · clique pra editar
        </span>
      </div>

      <Masonry
        items={items}
        breakpoints={{ base: 1, sm: 2, lg: 2, xl: 3 }}
        gap={16}
        getKey={(item) => item.id}
        renderItem={(item) => <PreviewTile item={item} tokens={tokens} brandName={brandName} />}
      />
    </motion.div>
  );
};
