/**
 * BrandPreviewGallery — the Preview tab. Shows the brand applied across real
 * surfaces, grouped by context (Social / Web & Email / Print & Identity).
 *
 * Replaces the old one-at-a-time format switcher. Each preview gets its own
 * framed card with room to breathe (max two per row, generous gaps) and its
 * own export menu — an individual, gallery experience rather than a dense
 * stack. Reuses the BrandMocks renderers + exportMock; no new UI primitives.
 */
import React, { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { MicroTitle } from '@/components/ui/MicroTitle';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { MockTokens } from './mockTokens';
import { exportMockElement, EXPORT_FORMATS, type ExportFormat } from './exportMock';
import {
  InstagramFeedMock,
  LinkedInPostMock,
  StoriesMock,
  WebsiteHeroMock,
  EmailHeaderMock,
  PosterMock,
  BusinessCardMock,
} from './BrandMocks';

interface PreviewItem {
  id: string;
  label: string;
  Component: React.FC<{ tokens: MockTokens; className?: string }>;
  /** Caps the mock width so tall/narrow formats don't blow out their card. */
  maxW: string;
}

interface PreviewGroup {
  label: string;
  caption: string;
  items: PreviewItem[];
}

const GROUPS: PreviewGroup[] = [
  {
    label: 'Social',
    caption: 'Feed, profile & stories',
    items: [
      { id: 'instagram', label: 'Instagram', Component: InstagramFeedMock, maxW: 'max-w-[400px]' },
      { id: 'linkedin', label: 'LinkedIn', Component: LinkedInPostMock, maxW: 'max-w-[560px]' },
      { id: 'stories', label: 'Stories', Component: StoriesMock, maxW: 'max-w-[280px]' },
    ],
  },
  {
    label: 'Web & Email',
    caption: 'On-screen surfaces',
    items: [
      { id: 'website', label: 'Website hero', Component: WebsiteHeroMock, maxW: 'max-w-[640px]' },
      { id: 'email', label: 'Email header', Component: EmailHeaderMock, maxW: 'max-w-[640px]' },
    ],
  },
  {
    label: 'Print & Identity',
    caption: 'Tangible touchpoints',
    items: [
      { id: 'poster', label: 'Poster', Component: PosterMock, maxW: 'max-w-[360px]' },
      { id: 'card', label: 'Business card', Component: BusinessCardMock, maxW: 'max-w-[480px]' },
    ],
  },
];

// ── Single preview card ───────────────────────────────────────────────────────

const PreviewCard: React.FC<{ item: PreviewItem; tokens: MockTokens; brandName: string }> = ({
  item,
  tokens,
  brandName,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!ref.current) return;
      setExporting(true);
      try {
        await exportMockElement(ref.current, brandName, item.id, format);
        toast.success(`Exported ${item.label} as ${format.toUpperCase()}`);
      } catch {
        toast.error(`Failed to export as ${format.toUpperCase()}`);
      } finally {
        setExporting(false);
      }
    },
    [brandName, item.id, item.label]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
      className="group flex flex-col"
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-sm font-semibold text-[var(--brand-text)]/85">{item.label}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={exporting}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/40 hover:text-[var(--brand-text)]/80 hover:bg-[var(--brand-text)]/5 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none disabled:opacity-30"
            >
              {exporting ? <GlitchLoader size={11} /> : <Download size={11} />}
              Export
              <ChevronDown size={9} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[120px]">
            {EXPORT_FORMATS.map((f) => (
              <Button key={f.id} variant="menuItem" onClick={() => handleExport(f.id)}>
                <Download size={12} /> {f.label}
              </Button>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 rounded-3xl border border-[var(--brand-text)]/8 bg-[var(--brand-surface)]/15 p-6 lg:p-10 flex items-center justify-center transition-colors group-hover:border-[var(--brand-text)]/15">
        <div ref={ref} className={cn('w-full mx-auto', item.maxW)}>
          <item.Component tokens={tokens} />
        </div>
      </div>
    </motion.div>
  );
};

// ── Gallery ─────────────────────────────────────────────────────────────────

export const BrandPreviewGallery: React.FC<{ tokens: MockTokens; brandName: string }> = ({
  tokens,
  brandName,
}) => (
  <motion.div id="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-24">
    <div className="flex items-baseline justify-between px-1">
      <MicroTitle className="text-[var(--accent)] tracking-[0.15em] font-bold opacity-70">
        Brand Preview
      </MicroTitle>
      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/30">
        Live · local render
      </span>
    </div>

    {GROUPS.map((group) => (
      <section key={group.label} className="space-y-8">
        <div className="flex items-baseline gap-4 border-b border-[var(--brand-text)]/8 pb-5">
          <h3
            className="text-xl font-semibold tracking-tight text-[var(--brand-text)]/90"
            style={{ fontFamily: tokens.headingFamily }}
          >
            {group.label}
          </h3>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/35">
            {group.caption}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          {group.items.map((item) => (
            <PreviewCard key={item.id} item={item} tokens={tokens} brandName={brandName} />
          ))}
        </div>
      </section>
    ))}
  </motion.div>
);
