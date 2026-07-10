/**
 * BrandPreviewGallery — the Preview tab. Shows the brand applied across real
 * surfaces, grouped by context (Social / Web & Email / Print & Identity).
 *
 * Single-column showcase: one mockup per row, each centered on its own framed
 * stage with room to breathe, and its own export menu. Mocks are capped by
 * aspect ratio so tall/narrow formats stay fully visible without cropping.
 * Reuses the BrandMocks renderers + exportMock; no new UI primitives.
 */
import React, { useRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Download, ChevronDown, Shuffle, RotateCcw, Pencil } from 'lucide-react';
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
import { buildThemeCombos } from './mockTokens';
import { exportMockElement, EXPORT_FORMATS, type ExportFormat } from './exportMock';
import { useBrandFonts } from './useBrandFonts';
import { useSyncedTemplates } from '@/hooks/queries/useBrandGuidelines';
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

// POC: a preset rendered LIVE from a Figma-extracted schema (no hand-written React).
// Editing the Figma frame → re-parse → this reflects. One source, two renderers.
const SyncedCardScatterMock: React.FC<{
  tokens: MockTokens;
  className?: string;
  exportRef?: React.Ref<HTMLDivElement>;
  variant?: number;
  overrides?: MockOverrides;
}> = (props) => (
  <TemplateRenderer schema={cardScatterSchema as unknown as TemplateSchema} {...props} />
);

interface PreviewItem {
  id: string;
  label: string;
  Component: React.FC<{
    tokens: MockTokens;
    className?: string;
    exportRef?: React.Ref<HTMLDivElement>;
    variant?: number;
    overrides?: MockOverrides;
  }>;
  /** Caps the mock width so tall/narrow formats don't blow out their card. */
  maxW: string;
}

interface PreviewGroup {
  label: string;
  caption: string;
  items: PreviewItem[];
}

// Showcase caps: each mock is stacked one-per-row and centered. The max-width is
// tuned to the mock's aspect ratio so tall formats (stories 9:16, poster 3:4) stay
// fully visible without cropping, while wide formats (website, email) get room to
// breathe. The mock's own aspect-ratio box never crops — these just prevent a mock
// from blowing out its stage on wide viewports.
const GROUPS: PreviewGroup[] = [
  {
    label: 'Social',
    caption: 'Feed, profile & stories',
    items: [
      { id: 'instagram', label: 'Instagram', Component: InstagramFeedMock, maxW: 'max-w-[520px]' },
      { id: 'linkedin', label: 'LinkedIn', Component: LinkedInPostMock, maxW: 'max-w-[760px]' },
      { id: 'stories', label: 'Stories', Component: StoriesMock, maxW: 'max-w-[320px]' },
    ],
  },
  {
    label: 'Web & Email',
    caption: 'On-screen surfaces',
    items: [
      { id: 'website', label: 'Website hero', Component: WebsiteHeroMock, maxW: 'max-w-[860px]' },
      { id: 'email', label: 'Email header', Component: EmailHeaderMock, maxW: 'max-w-[860px]' },
    ],
  },
  {
    label: 'Print & Identity',
    caption: 'Tangible touchpoints',
    items: [
      { id: 'poster', label: 'Poster', Component: PosterMock, maxW: 'max-w-[440px]' },
      { id: 'card', label: 'Business card', Component: BusinessCardMock, maxW: 'max-w-[620px]' },
    ],
  },
  {
    label: 'Editorial',
    caption: 'Signature brand systems',
    items: [
      { id: 'story', label: 'Editorial story', Component: EditorialStoryMock, maxW: 'max-w-[360px]' },
      { id: 'scatter', label: 'Card showcase', Component: CardScatterMock, maxW: 'max-w-[900px]' },
      {
        id: 'scatter-sync',
        label: 'Card scatter · Figma-synced',
        Component: SyncedCardScatterMock,
        maxW: 'max-w-[900px]',
      },
      { id: 'hero', label: 'Editorial hero', Component: EditorialHeroMock, maxW: 'max-w-[900px]' },
      { id: 'pattern', label: 'Brand pattern', Component: BrandPatternMock, maxW: 'max-w-[900px]' },
    ],
  },
];

// ── Single preview card — owns its OWN color combo + text overrides (per design) ──

const SWATCH_KEYS = ['bg', 'primary', 'accent', 'text'] as const;

const PreviewCard: React.FC<{
  item: PreviewItem;
  tokens: MockTokens;
  brandName: string;
}> = ({ item, tokens, brandName }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const combos = useMemo(() => buildThemeCombos(tokens), [tokens]);
  const [variant, setVariant] = useState(0);
  const [overrides, setOverrides] = useState<MockOverrides>({});
  const [editing, setEditing] = useState(false);

  const idx = ((variant % combos.length) + combos.length) % combos.length;
  const combo = combos[idx];
  const hasOverrides = Object.values(overrides).some((v) => v && v.trim());
  const setField =
    (k: keyof MockOverrides) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setOverrides((o) => ({ ...o, [k]: e.target.value }));

  const ctrlBtn =
    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/40 hover:text-[var(--brand-text)]/80 hover:bg-[var(--brand-text)]/5 transition-all focus:outline-none disabled:opacity-30';
  const labelCls = 'text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/40';
  const inputCls =
    'w-full rounded-lg border border-[var(--brand-text)]/12 bg-transparent px-3 py-2 text-sm text-[var(--brand-text)] placeholder:text-[var(--brand-text)]/30 focus:border-[var(--accent)]/50 focus:outline-none transition-colors';

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
        <div className="flex items-center gap-1 opacity-100 can-hover:opacity-0 can-hover:group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => setVariant((v) => v + 1)}
            className={ctrlBtn}
            title="Trocar combinação de cores"
          >
            <span className="flex items-center gap-0.5">
              {SWATCH_KEYS.map((k) => (
                <span
                  key={k}
                  className="w-2.5 h-2.5 rounded-full border border-[var(--brand-text)]/15"
                  style={{ background: combo[k] }}
                />
              ))}
            </span>
            <Shuffle size={11} />
          </button>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className={cn(ctrlBtn, (editing || hasOverrides) && 'text-[var(--accent)]')}
            title="Editar textos deste design"
          >
            <Pencil size={11} /> Editar
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" disabled={exporting} className={ctrlBtn}>
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
      </div>

      {editing && (
        <div className="mb-4 rounded-2xl border border-[var(--brand-text)]/10 bg-[var(--brand-surface)]/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className={labelCls}>Textos deste design</span>
            {hasOverrides && (
              <button type="button" onClick={() => setOverrides({})} className={ctrlBtn}>
                <RotateCcw size={10} /> Resetar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5 block">
              <span className={labelCls}>Marca</span>
              <input className={inputCls} value={overrides.name || ''} placeholder={tokens.name} onChange={setField('name')} />
            </label>
            <label className="space-y-1.5 block">
              <span className={labelCls}>Tagline</span>
              <input
                className={inputCls}
                value={overrides.tagline || ''}
                placeholder={tokens.tagline || '—'}
                onChange={setField('tagline')}
              />
            </label>
            <label className="space-y-1.5 block">
              <span className={labelCls}>Headline</span>
              <input
                className={inputCls}
                value={overrides.headline || ''}
                placeholder="1ª frase do manifesto"
                onChange={setField('headline')}
              />
            </label>
            <label className="space-y-1.5 block">
              <span className={labelCls}>Corpo</span>
              <textarea
                className={cn(inputCls, 'resize-none')}
                rows={2}
                value={overrides.body || ''}
                placeholder="Descrição da marca"
                onChange={setField('body')}
              />
            </label>
          </div>
        </div>
      )}

      <div className="flex-1 rounded-3xl border border-[var(--brand-text)]/8 bg-[var(--brand-surface)]/15 p-6 lg:p-10 flex items-center justify-center transition-colors group-hover:border-[var(--brand-text)]/15">
        <div className={cn('w-full mx-auto', item.maxW)}>
          <item.Component tokens={tokens} exportRef={ref} variant={variant} overrides={overrides} />
        </div>
      </div>
    </motion.div>
  );
};

// ── Gallery ─────────────────────────────────────────────────────────────────

export const BrandPreviewGallery: React.FC<{
  tokens: MockTokens;
  brandName: string;
  brandId?: string;
}> = ({ tokens, brandName, brandId }) => {
  // Load the brand's real fonts so mocks render in-brand, not a system fallback.
  useBrandFonts(tokens.headingFamily, tokens.bodyFamily);

  // Layout schemas synced from the brand's Figma [Template] frames — rendered live
  // by <TemplateRenderer>, no hand-written React. Empty until the plugin syncs.
  const synced = useSyncedTemplates(brandId);
  const syncedItems = useMemo<PreviewItem[]>(
    () =>
      (synced.data ?? []).map((s, i) => ({
        id: `synced-${s.id || i}`,
        label: `${s.name.replace(/^\[Template\]\s*/, '')} · Figma`,
        Component: (props) => <TemplateRenderer schema={s} {...props} />,
        maxW: s.width >= s.height ? 'max-w-[900px]' : 'max-w-[360px]',
      })),
    [synced.data]
  );

  return (
  <motion.div id="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-24">
    <div className="flex items-baseline justify-between px-1">
      <MicroTitle className="text-[var(--accent)] font-bold opacity-70">Brand Preview</MicroTitle>
      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/30">
        Cada design · cores + textos próprios
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

        <div className="flex flex-col items-stretch gap-12 lg:gap-16">
          {group.items.map((item) => (
            <PreviewCard key={item.id} item={item} tokens={tokens} brandName={brandName} />
          ))}
        </div>
      </section>
    ))}

    {syncedItems.length > 0 && (
      <section className="space-y-8">
        <div className="flex items-baseline gap-4 border-b border-[var(--brand-text)]/8 pb-5">
          <h3
            className="text-xl font-semibold tracking-tight text-[var(--brand-text)]/90"
            style={{ fontFamily: tokens.headingFamily }}
          >
            Sincronizado do Figma
          </h3>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/35">
            Renderizado do frame · sem código
          </span>
        </div>
        <div className="flex flex-col items-stretch gap-12 lg:gap-16">
          {syncedItems.map((item) => (
            <PreviewCard key={item.id} item={item} tokens={tokens} brandName={brandName} />
          ))}
        </div>
      </section>
    )}
  </motion.div>
  );
};
