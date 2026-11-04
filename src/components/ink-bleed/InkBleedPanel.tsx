// ui-scale-ignore-file: raio-sortido — arquivo novo dentro do orçamento de raios; a soma da catraca não distingue isso.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Dices,
  Droplet,
  Film,
  Layers,
  Maximize2,
  Palette,
  Search,
  Type,
} from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { Dropzone } from '@/components/ui/Dropzone';
import { Input } from '@/components/ui/input';
import { NodeSlider, type NodeSliderProps } from '@/components/ui/NodeSlider';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Thumb } from '@/components/ui/Thumb';
import { PanelSectionTabs, type PanelTab } from '@/components/shared/PanelSectionTabs';
import {
  ExpandableColorPicker,
  SectionLabel,
  ToolPanelChip,
  ToolPanelDisclosure,
  ToolPanelSection,
} from '@/components/shared/ToolPanel';
import { useActiveBrandSafe } from '@/contexts/ActiveBrandContext';
import { useTranslation } from '@/hooks/useTranslation';
import { brandHeadingFont, brandLogoUrl } from '@/lib/ink-bleed/brand';
import {
  FORMATS,
  buildArtworkSvg,
  fitFontSize,
  inkBlendMode,
  motionStart,
} from '@/lib/ink-bleed/engine';
import { ensureFont, measureLines } from '@/lib/ink-bleed/fonts';
import { PAPER_STOCKS, drawPaper, drawVeil } from '@/lib/ink-bleed/paper';
import { FONT_CHOICES, INK_SWATCHES, PRESETS, createDefaultDoc } from '@/lib/ink-bleed/presets';
import type {
  DragAxis,
  FormatId,
  InkSettings,
  MotionMode,
  PaperType,
  TextAlign,
} from '@/lib/ink-bleed/types';
import { useInkBleedStore } from '@/stores/inkBleedStore';

/** Neutral thumb: on this panel, cyan is reserved for the selected style. */
const InkSlider: React.FC<NodeSliderProps> = (props) => (
  <NodeSlider className="accent-foreground" {...props} />
);

const pct = (v: number) => `${Math.round(v)}%`;

/** What "back to default" means: the style these values started from. */
function useBaseStyle() {
  const baseId = useInkBleedStore((s) => s.doc.basePresetId);
  return PRESETS.find((preset) => preset.id === baseId) ?? PRESETS[0];
}

const FORMAT_OPTIONS = (Object.keys(FORMATS) as FormatId[]).map((value) => ({
  value,
  label: value,
}));

const MOTION_MODES: MotionMode[] = ['bleed-in', 'pulse', 'capillary-flow', 'xerox-burn'];

/** Real render of each style, at thumbnail scale. */
const THUMB_SCALE = 0.25;
const THUMB_WIDTH = 300;
const THUMB_HEIGHT = 225;

const PresetThumb: React.FC<{ preset: (typeof PRESETS)[number] }> = React.memo(({ preset }) => {
  const paperRef = useRef<HTMLCanvasElement>(null);
  const veilRef = useRef<HTMLCanvasElement>(null);

  // One big word shows the ink. The whole sample at this size would only show the layout.
  const doc = useMemo(
    () => ({
      ...createDefaultDoc(),
      ink: preset.ink,
      paper: preset.paper,
      typography: {
        ...preset.typography,
        text: preset.typography.text.split('\n')[0],
        fontSize: Math.min(170, preset.typography.fontSize * 2),
      },
    }),
    [preset]
  );
  const markup = useMemo(
    () => buildArtworkSvg(doc, { filterId: `ink-bleed-thumb-${preset.id}`, scale: THUMB_SCALE }),
    [doc, preset.id]
  );

  useEffect(() => {
    const paper = paperRef.current?.getContext('2d');
    if (paper) drawPaper(paper, THUMB_WIDTH, THUMB_HEIGHT, preset.paper, THUMB_SCALE, doc.seed);
    const veil = veilRef.current?.getContext('2d');
    if (veil) drawVeil(veil, THUMB_WIDTH, THUMB_HEIGHT, preset.paper, doc.seed);
  }, [preset.paper, doc.seed]);

  const layer = 'absolute inset-0 h-full w-full';
  return (
    <div
      aria-hidden
      className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border"
    >
      <canvas ref={paperRef} width={THUMB_WIDTH} height={THUMB_HEIGHT} className={layer} />
      <div
        className={`${layer} [&>svg]:h-full [&>svg]:w-full`}
        style={{ mixBlendMode: inkBlendMode(doc) }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      <canvas ref={veilRef} width={THUMB_WIDTH} height={THUMB_HEIGHT} className={layer} />
    </div>
  );
});
PresetThumb.displayName = 'PresetThumb';

const StylesSection: React.FC = () => {
  const { t } = useTranslation();
  const activeId = useInkBleedStore((s) => s.doc.presetId);
  const applyPreset = useInkBleedStore((s) => s.applyPreset);
  const varyPreset = useInkBleedStore((s) => s.varyPreset);

  useEffect(() => {
    PRESETS.forEach((p) => void ensureFont(p.typography.fontFamily, p.typography.fontWeight));
  }, []);

  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-3">
      {PRESETS.map((preset) => (
        <div key={preset.id} className="group/preset relative">
          <button
            type="button"
            aria-pressed={activeId === preset.id}
            onClick={() => applyPreset(preset)}
            className="group w-full space-y-1.5 text-left focus-visible:outline-none"
          >
            <div
              className={cn(
                'rounded-md ring-offset-2 ring-offset-card transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-ring',
                activeId === preset.id
                  ? 'ring-2 ring-brand-cyan'
                  : 'group-hover:ring-1 group-hover:ring-border-hover'
              )}
            >
              <PresetThumb preset={preset} />
            </div>
            <span
              className={cn(
                'block truncate text-2xs transition-colors',
                activeId === preset.id
                  ? 'text-foreground'
                  : 'text-muted-foreground group-hover:text-foreground'
              )}
            >
              {t(`inkBleed.presets.${preset.id}`)}
            </span>
          </button>
          <Tooltip content={t('inkBleed.varyPreset')}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${t('inkBleed.varyPreset')}: ${t(`inkBleed.presets.${preset.id}`)}`}
              onClick={() => varyPreset(preset)}
              className={cn(
                'absolute right-1 top-1 h-7 w-7 rounded-md border border-border bg-card text-foreground hover:bg-card [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10',
                'opacity-0 transition-opacity group-hover/preset:opacity-100 focus-visible:opacity-100',
                '[@media(hover:none)]:opacity-100'
              )}
            >
              <Dices size={14} />
            </Button>
          </Tooltip>
        </div>
      ))}
    </div>
  );
};

const FontList: React.FC = () => {
  const { t } = useTranslation();
  const family = useInkBleedStore((s) => s.doc.typography.fontFamily);
  const weight = useInkBleedStore((s) => s.doc.typography.fontWeight);
  const setTypography = useInkBleedStore((s) => s.setTypography);
  const activeBrand = useActiveBrandSafe()?.activeBrand;
  const [query, setQuery] = useState('');

  const brandFont = activeBrand ? brandHeadingFont(activeBrand) : null;

  useEffect(() => {
    FONT_CHOICES.forEach((f) => void ensureFont(f.family, f.weights[f.weights.length - 1]));
    if (brandFont) void ensureFont(brandFont);
  }, [brandFont]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = FONT_CHOICES.map((f) => f.family);
    const withBrand = brandFont && !list.includes(brandFont) ? [brandFont, ...list] : list;
    return withBrand.filter((f) => f.toLowerCase().includes(q));
  }, [query, brandFont]);

  const select = async (next: string) => {
    const available = FONT_CHOICES.find((f) => f.family === next)?.weights ?? [400];
    const nextWeight = available.includes(weight) ? weight : available[available.length - 1];
    if (await ensureFont(next, nextWeight)) {
      setTypography({ fontFamily: next, fontWeight: nextWeight });
      setQuery('');
    } else {
      toast.error(t('inkBleed.font.notFound', { family: next }));
    }
  };

  const typed = query.trim();
  const canLoadTyped =
    typed.length > 1 && !matches.some((f) => f.toLowerCase() === typed.toLowerCase());
  const weights = FONT_CHOICES.find((f) => f.family === family)?.weights ?? [];

  return (
    <ToolPanelSection title={t('inkBleed.font.title')}>
      <div className="relative">
        <Search
          size={12}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && typed) void select(matches[0] ?? typed);
          }}
          placeholder={t('inkBleed.font.search')}
          aria-label={t('inkBleed.font.search')}
          className="h-8 pl-7 text-xs [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:text-base"
        />
      </div>

      <div className="max-h-56 overflow-y-auto scrollbar-thin -mx-1 px-1 space-y-0.5">
        {matches.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={f === family}
            onClick={() => void select(f)}
            className={cn(
              'w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
              f === family
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
          >
            <span className="truncate text-sm" style={{ fontFamily: `'${f}', sans-serif` }}>
              {f}
            </span>
            {f === brandFont && f !== family && (
              <span className="shrink-0 text-2xs text-muted-foreground">{t('common.brand')}</span>
            )}
            {f === family && <Check size={12} className="shrink-0" />}
          </button>
        ))}
        {canLoadTyped && (
          <button
            type="button"
            onClick={() => void select(typed)}
            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
          >
            {t('inkBleed.font.loadTyped', { family: typed })}
          </button>
        )}
      </div>

      {weights.length > 1 && (
        <SegmentedControl
          aria-label={t('inkBleed.font.weight')}
          size="xs"
          fullWidth
          value={String(weight)}
          onChange={(v) => {
            const next = Number(v);
            void ensureFont(family, next).then(() => setTypography({ fontWeight: next }));
          }}
          options={weights.map((w) => ({ value: String(w), label: String(w) }))}
        />
      )}
    </ToolPanelSection>
  );
};

interface ContentSectionProps {
  onLogoFiles: (files: FileList | File[]) => void;
  onLogoUrl: (url: string, name: string) => void;
}

const ContentSection: React.FC<ContentSectionProps> = ({ onLogoFiles, onLogoUrl }) => {
  const { t } = useTranslation();
  const doc = useInkBleedStore((s) => s.doc);
  const logo = useInkBleedStore((s) => s.logo);
  const setTypography = useInkBleedStore((s) => s.setTypography);
  const setFormat = useInkBleedStore((s) => s.setFormat);
  const setSource = useInkBleedStore((s) => s.setSource);
  const setLogoScale = useInkBleedStore((s) => s.setLogoScale);
  const activeBrand = useActiveBrandSafe()?.activeBrand;
  const brandLogo = activeBrand ? brandLogoUrl(activeBrand) : null;
  const typo = doc.typography;

  const fitToArtwork = () => {
    setTypography({
      fontSize: fitFontSize(doc, (lines, size) =>
        measureLines(lines, typo.fontFamily, typo.fontWeight, size)
      ),
    });
  };

  return (
    <>
      <div className="space-y-1.5">
        <SectionLabel>{t('inkBleed.content.format')}</SectionLabel>
        <SegmentedControl
          aria-label={t('inkBleed.content.format')}
          size="xs"
          fullWidth
          value={doc.format}
          onChange={setFormat}
          options={FORMAT_OPTIONS}
        />
      </div>

      <SegmentedControl
        aria-label={t('inkBleed.content.source')}
        size="sm"
        fullWidth
        value={doc.source}
        onChange={setSource}
        options={[
          { value: 'text', label: t('inkBleed.content.text') },
          { value: 'logo', label: t('inkBleed.content.logo') },
        ]}
      />

      {doc.source === 'text' ? (
        <>
          <Textarea
            rows={3}
            value={typo.text}
            onChange={(e) => setTypography({ text: e.target.value })}
            aria-label={t('inkBleed.content.text')}
            placeholder={t('inkBleed.content.textPlaceholder')}
            className="resize-none text-sm [@media(pointer:coarse)]:text-base"
          />

          <div className="flex items-center justify-between gap-3">
            <SegmentedControl
              aria-label={t('inkBleed.content.align')}
              size="xs"
              value={typo.textAlign}
              onChange={(textAlign: TextAlign) => setTypography({ textAlign })}
              options={[
                {
                  value: 'left',
                  label: '',
                  icon: AlignLeft,
                  'aria-label': t('inkBleed.content.alignLeft'),
                },
                {
                  value: 'center',
                  label: '',
                  icon: AlignCenter,
                  'aria-label': t('inkBleed.content.alignCenter'),
                },
                {
                  value: 'right',
                  label: '',
                  icon: AlignRight,
                  'aria-label': t('inkBleed.content.alignRight'),
                },
              ]}
            />
            <label className="flex items-center gap-2 text-2xs text-muted-foreground cursor-pointer">
              {t('inkBleed.content.uppercase')}
              <Switch
                checked={typo.uppercase}
                onCheckedChange={(uppercase) => setTypography({ uppercase })}
              />
            </label>
          </div>

          <InkSlider
            label={t('inkBleed.content.size')}
            value={typo.fontSize}
            min={20}
            max={400}
            step={1}
            onChange={(fontSize) => setTypography({ fontSize })}
            formatValue={(v) => `${Math.round(v)}px`}
          />
          <InkSlider
            label={t('inkBleed.content.tracking')}
            value={typo.letterSpacing}
            min={-10}
            max={50}
            step={1}
            onChange={(letterSpacing) => setTypography({ letterSpacing })}
            formatValue={(v) => `${Math.round(v)}px`}
          />
          <InkSlider
            label={t('inkBleed.content.leading')}
            value={typo.lineHeight}
            min={0.7}
            max={1.8}
            step={0.01}
            onChange={(lineHeight) => setTypography({ lineHeight })}
            formatValue={(v) => v.toFixed(2)}
          />
          <ToolPanelChip
            onClick={fitToArtwork}
            className="flex w-full items-center justify-center gap-2 py-1.5"
          >
            <Maximize2 size={12} />
            {t('inkBleed.content.fit')}
          </ToolPanelChip>

          <FontList />
        </>
      ) : (
        <>
          {logo && (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
              <Thumb
                src={logo.dataUrl}
                alt=""
                className="w-10 h-10 rounded object-contain bg-muted shrink-0"
              />
              <span className="flex-1 min-w-0 truncate text-2xs text-muted-foreground">
                {logo.name}
              </span>
            </div>
          )}
          <Dropzone
            onFiles={onLogoFiles}
            accept="image/png,image/svg+xml,image/webp,image/jpeg"
            label={logo ? t('inkBleed.logo.replace') : t('inkBleed.logo.upload')}
            size="sm"
            dropTarget={false}
          />
          {brandLogo && activeBrand && (
            <ToolPanelChip
              className="w-full py-1.5 text-center"
              onClick={() =>
                onLogoUrl(brandLogo, activeBrand.identity?.name || activeBrand.name || 'logo')
              }
            >
              {t('inkBleed.logo.useBrand')}
            </ToolPanelChip>
          )}
          <InkSlider
            label={t('inkBleed.logo.size')}
            value={doc.logoScale}
            min={10}
            max={100}
            step={1}
            onChange={setLogoScale}
            formatValue={pct}
          />
          <p className="text-2xs leading-relaxed text-muted-foreground">
            {t('inkBleed.logo.hint')}
          </p>
        </>
      )}
    </>
  );
};

const InkSection: React.FC = () => {
  const { t } = useTranslation();
  const ink = useInkBleedStore((s) => s.doc.ink);
  const setInk = useInkBleedStore((s) => s.setInk);
  const newVariation = useInkBleedStore((s) => s.newVariation);
  const base = useBaseStyle();

  // Only there when a value in the group differs from the style it started from.
  const resetIfChanged = (keys: (keyof InkSettings)[]) =>
    keys.some((key) => ink[key] !== base.ink[key])
      ? () => setInk(Object.fromEntries(keys.map((key) => [key, base.ink[key]])))
      : undefined;

  return (
    <>
      <ExpandableColorPicker
        label={t('inkBleed.ink.color')}
        color={ink.inkColor}
        onChange={(inkColor) => setInk({ inkColor })}
        presets={INK_SWATCHES}
      />

      <ToolPanelSection
        title={t('inkBleed.ink.bleedTitle')}
        onReset={resetIfChanged(['bleedSpread', 'roughness', 'inkErosion', 'inkOpacity'])}
      >
        <InkSlider
          label={t('inkBleed.ink.spread')}
          value={ink.bleedSpread}
          resetValue={base.ink.bleedSpread}
          min={0}
          max={100}
          step={1}
          onChange={(bleedSpread) => setInk({ bleedSpread })}
          formatValue={pct}
        />
        <InkSlider
          label={t('inkBleed.ink.roughness')}
          value={ink.roughness}
          resetValue={base.ink.roughness}
          min={0}
          max={100}
          step={1}
          onChange={(roughness) => setInk({ roughness })}
          formatValue={pct}
        />
        <InkSlider
          label={t('inkBleed.ink.erosion')}
          value={ink.inkErosion}
          resetValue={base.ink.inkErosion}
          min={0}
          max={100}
          step={1}
          onChange={(inkErosion) => setInk({ inkErosion })}
          formatValue={pct}
        />
        <InkSlider
          label={t('inkBleed.ink.opacity')}
          value={ink.inkOpacity}
          resetValue={base.ink.inkOpacity}
          min={10}
          max={100}
          step={1}
          onChange={(inkOpacity) => setInk({ inkOpacity })}
          formatValue={pct}
        />
        <ToolPanelChip
          onClick={newVariation}
          className="flex w-full items-center justify-center gap-2 py-1.5"
        >
          <Dices size={12} />
          {t('inkBleed.ink.variation')}
        </ToolPanelChip>
      </ToolPanelSection>
      <ToolPanelDisclosure label={t('inkBleed.advanced')}>
        <ToolPanelSection
          title={t('inkBleed.ink.opticsTitle')}
          onReset={resetIfChanged(['defocus', 'halo', 'drag', 'ghost'])}
        >
          <InkSlider
            label={t('inkBleed.ink.defocus')}
            value={ink.defocus}
            resetValue={base.ink.defocus}
            min={0}
            max={100}
            step={1}
            onChange={(defocus) => setInk({ defocus })}
            formatValue={pct}
          />
          <InkSlider
            label={t('inkBleed.ink.halo')}
            value={ink.halo}
            resetValue={base.ink.halo}
            min={0}
            max={100}
            step={1}
            onChange={(halo) => setInk({ halo })}
            formatValue={pct}
          />
          <InkSlider
            label={t('inkBleed.ink.drag')}
            value={ink.drag}
            resetValue={base.ink.drag}
            min={0}
            max={100}
            step={1}
            onChange={(drag) => setInk({ drag })}
            formatValue={pct}
          />
          {ink.drag > 0 && (
            <SegmentedControl
              aria-label={t('inkBleed.ink.dragAxis')}
              size="xs"
              fullWidth
              value={ink.dragAxis}
              onChange={(dragAxis: DragAxis) => setInk({ dragAxis })}
              options={[
                { value: 'vertical', label: t('inkBleed.ink.dragVertical') },
                { value: 'horizontal', label: t('inkBleed.ink.dragHorizontal') },
              ]}
            />
          )}
          <InkSlider
            label={t('inkBleed.ink.ghost')}
            value={ink.ghost}
            resetValue={base.ink.ghost}
            min={0}
            max={100}
            step={1}
            onChange={(ghost) => setInk({ ghost })}
            formatValue={pct}
          />
        </ToolPanelSection>
        <ToolPanelSection
          title={t('inkBleed.ink.fiberTitle')}
          onReset={resetIfChanged(['frequency', 'capillaryStreaks', 'octaves', 'edgeFeather'])}
        >
          <InkSlider
            label={t('inkBleed.ink.frequency')}
            value={ink.frequency * 1000}
            min={8}
            max={80}
            step={1}
            onChange={(v) => setInk({ frequency: v / 1000 })}
            formatValue={(v) => String(Math.round(v))}
          />
          <InkSlider
            label={t('inkBleed.ink.streaks')}
            value={ink.capillaryStreaks}
            resetValue={base.ink.capillaryStreaks}
            min={0}
            max={100}
            step={1}
            onChange={(capillaryStreaks) => setInk({ capillaryStreaks })}
            formatValue={pct}
          />
          <InkSlider
            label={t('inkBleed.ink.detail')}
            value={ink.octaves}
            resetValue={base.ink.octaves}
            min={1}
            max={4}
            step={1}
            onChange={(octaves) => setInk({ octaves })}
            formatValue={(v) => String(Math.round(v))}
          />
          <InkSlider
            label={t('inkBleed.ink.feather')}
            value={ink.edgeFeather}
            resetValue={base.ink.edgeFeather}
            min={0}
            max={100}
            step={1}
            onChange={(edgeFeather) => setInk({ edgeFeather })}
            formatValue={pct}
          />
        </ToolPanelSection>
        <ToolPanelSection
          title={t('inkBleed.ink.wearTitle')}
          onReset={resetIfChanged(['coreFillDensity', 'tonerGrit'])}
        >
          <InkSlider
            label={t('inkBleed.ink.core')}
            value={ink.coreFillDensity}
            resetValue={base.ink.coreFillDensity}
            min={0}
            max={100}
            step={1}
            onChange={(coreFillDensity) => setInk({ coreFillDensity })}
            formatValue={pct}
          />
          <InkSlider
            label={t('inkBleed.ink.grit')}
            value={ink.tonerGrit}
            resetValue={base.ink.tonerGrit}
            min={0}
            max={100}
            step={1}
            onChange={(tonerGrit) => setInk({ tonerGrit })}
            formatValue={pct}
          />
        </ToolPanelSection>
      </ToolPanelDisclosure>
    </>
  );
};

const PaperSection: React.FC = () => {
  const { t } = useTranslation();
  const paper = useInkBleedStore((s) => s.doc.paper);
  const setPaper = useInkBleedStore((s) => s.setPaper);
  const base = useBaseStyle();
  const isTransparent = paper.paperType === 'transparent';

  const selectStock = (type: PaperType, color: string) =>
    setPaper({ paperType: type, baseColor: color || paper.baseColor });

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        {PAPER_STOCKS.map((stock) => (
          <ToolPanelChip
            key={stock.type}
            active={paper.paperType === stock.type}
            onClick={() => selectStock(stock.type, stock.color)}
            className="flex items-center gap-2 px-2"
          >
            <span
              aria-hidden
              className={cn(
                'h-4 w-4 shrink-0 rounded-md border border-border',
                stock.type === 'transparent' &&
                  'bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#fafafa_0%_50%)] bg-[length:8px_8px]'
              )}
              style={stock.color ? { backgroundColor: stock.color } : undefined}
            />
            <span className="truncate text-2xs">{t(`inkBleed.paper.stocks.${stock.type}`)}</span>
          </ToolPanelChip>
        ))}
      </div>

      {isTransparent ? (
        <p className="text-2xs leading-relaxed text-muted-foreground">
          {t('inkBleed.paper.transparentHint')}
        </p>
      ) : (
        <>
          <ExpandableColorPicker
            label={t('inkBleed.paper.color')}
            color={paper.baseColor}
            onChange={(baseColor) => setPaper({ baseColor })}
          />
          <InkSlider
            label={t('inkBleed.paper.sepia')}
            value={paper.agingSepia}
            resetValue={base.paper.agingSepia}
            min={0}
            max={100}
            step={1}
            onChange={(agingSepia) => setPaper({ agingSepia })}
            formatValue={pct}
          />
          <InkSlider
            label={t('inkBleed.paper.grain')}
            value={paper.fiberGrain}
            resetValue={base.paper.fiberGrain}
            min={0}
            max={100}
            step={1}
            onChange={(fiberGrain) => setPaper({ fiberGrain })}
            formatValue={pct}
          />
          <InkSlider
            label={t('inkBleed.paper.vignette')}
            value={paper.vignette}
            resetValue={base.paper.vignette}
            min={0}
            max={100}
            step={1}
            onChange={(vignette) => setPaper({ vignette })}
            formatValue={pct}
          />

          <ToolPanelDisclosure label={t('inkBleed.paper.collageTitle')}>
            <InkSlider
              label={t('inkBleed.paper.patches')}
              value={paper.patches}
              resetValue={base.paper.patches}
              min={0}
              max={100}
              step={1}
              onChange={(patches) => setPaper({ patches })}
              formatValue={pct}
            />
            {paper.patches > 0 && (
              <>
                <InkSlider
                  label={t('inkBleed.paper.veil')}
                  value={paper.veil}
                  resetValue={base.paper.veil}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(veil) => setPaper({ veil })}
                  formatValue={pct}
                />
                <ExpandableColorPicker
                  label={t('inkBleed.paper.patchColor')}
                  color={paper.patchColor || paper.baseColor}
                  onChange={(patchColor) => setPaper({ patchColor })}
                />
              </>
            )}
            <InkSlider
              label={t('inkBleed.paper.scanLines')}
              value={paper.scanLines}
              resetValue={base.paper.scanLines}
              min={0}
              max={100}
              step={1}
              onChange={(scanLines) => setPaper({ scanLines })}
              formatValue={pct}
            />
            <InkSlider
              label={t('inkBleed.paper.dust')}
              value={paper.dust}
              resetValue={base.paper.dust}
              min={0}
              max={100}
              step={1}
              onChange={(dust) => setPaper({ dust })}
              formatValue={pct}
            />
          </ToolPanelDisclosure>
        </>
      )}
    </>
  );
};

const MotionSection: React.FC = () => {
  const { t } = useTranslation();
  const motion = useInkBleedStore((s) => s.doc.motion);
  const setMotion = useInkBleedStore((s) => s.setMotion);
  const setProgress = useInkBleedStore((s) => s.setProgress);
  const setPlaying = useInkBleedStore((s) => s.setPlaying);

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        {MOTION_MODES.map((mode) => (
          <ToolPanelChip
            key={mode}
            active={motion.mode === mode}
            onClick={() => {
              setMotion({ mode });
              // Choosing a motion is asking to see it.
              setProgress(motionStart(mode));
              setPlaying(true);
            }}
            className="text-2xs"
          >
            {t(`inkBleed.motion.modes.${mode}`)}
          </ToolPanelChip>
        ))}
      </div>
      <InkSlider
        label={t('inkBleed.motion.duration')}
        value={motion.duration}
        min={1}
        max={10}
        step={0.5}
        onChange={(duration) => setMotion({ duration })}
        formatValue={(v) => `${v.toFixed(1)}s`}
      />
      <div className="space-y-1.5">
        <SectionLabel>{t('inkBleed.motion.speed')}</SectionLabel>
        <SegmentedControl
          aria-label={t('inkBleed.motion.speed')}
          size="xs"
          fullWidth
          value={String(motion.speed)}
          onChange={(v) => setMotion({ speed: Number(v) })}
          options={[
            { value: '0.5', label: '0.5×' },
            { value: '1', label: '1×' },
            { value: '2', label: '2×' },
          ]}
        />
      </div>
    </>
  );
};

export const InkBleedSections: React.FC<ContentSectionProps> = (props) => {
  const { t } = useTranslation();

  const tab = (id: string, Icon: typeof Palette, label: string, content: React.ReactNode) => ({
    id,
    icon: <Icon size={15} />,
    label,
    content,
  });
  const tabs: PanelTab[] = [
    tab('styles', Palette, t('inkBleed.tabs.styles'), <StylesSection />),
    tab('content', Type, t('inkBleed.tabs.content'), <ContentSection {...props} />),
    tab('ink', Droplet, t('inkBleed.tabs.ink'), <InkSection />),
    tab('paper', Layers, t('inkBleed.tabs.paper'), <PaperSection />),
    tab('motion', Film, t('inkBleed.tabs.motion'), <MotionSection />),
  ];

  return <PanelSectionTabs tabs={tabs} defaultId="styles" ariaLabel={t('inkBleed.tabs.aria')} />;
};
