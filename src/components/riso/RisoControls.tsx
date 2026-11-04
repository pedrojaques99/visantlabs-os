import React, { useCallback, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { useRisoStore } from '@/stores/risoStore';
import {
  RISO_INK_PRESETS,
  RISO_FULL_PRESETS,
  RISO_INK_CATALOG,
  type DitherMode,
  type HalftoneShape,
} from '@/components/riso/RisoRenderer';
import { hexToRgb } from '@/utils/colorUtils';
import {
  ToolPanel,
  ToolPanelExportActions,
  ToolPanelGrid,
  ToolPanelChip,
  ToolPanelRow,
  ChannelRow,
  InlineColorPicker,
} from '@/components/shared/ToolPanel';
import { PanelSectionTabs, type PanelTab } from '@/components/shared/PanelSectionTabs';
import { ApplyBrandButton } from '@/components/shared/BrandSwatchRow';
import { PresetThumbnailStrip } from '@/components/shared/PresetThumbnailStrip';
import {
  Zap,
  Loader2,
  Focus,
  ChevronDown,
  Palette,
  Search,
  FileImage,
  FileType,
  Layers,
  SlidersHorizontal,
  Blend,
} from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';

const RISO_PRESET_ITEMS = Object.entries(RISO_FULL_PRESETS).map(([name, p]) => ({
  name,
  colors: p.colors,
}));

const INK_CATEGORIES: Record<string, string[]> = {
  Reds: [
    'Bright Red',
    'Red',
    'Crimson',
    'Scarlet',
    'Tomato',
    'Marine Red',
    'Cranberry',
    'Maroon',
    'Raspberry Red',
    'Brick',
    'Coral',
    'Paprika',
  ],
  Pinks: ['Fluorescent Pink', 'Bubble Gum', 'Light Mauve', 'Dark Mauve', 'Orchid'],
  Blues: [
    'Blue',
    'Medium Blue',
    'Riso Federal Blue',
    'Cornflower',
    'Sky Blue',
    'Sea Blue',
    'Lake',
    'Indigo',
    'Midnight',
    'Steel',
  ],
  Greens: [
    'Green',
    'Hunter Green',
    'Kelly Green',
    'Grass',
    'Forest',
    'Spruce',
    'Moss',
    'Ivy',
    'Pine',
    'Bright Olive Green',
    'Fluorescent Green',
    'Emerald',
  ],
  Teals: ['Teal', 'Light Teal', 'Turquoise', 'Aqua', 'Mint', 'Sea Foam', 'Smoky Teal', 'Lagoon'],
  Purples: ['Purple', 'Violet', 'Plum', 'Raisin', 'Grape', 'Wine', 'Burgundy'],
  Yellows: ['Yellow', 'Sunflower', 'Fluorescent Yellow', 'Light Lime', 'Melon', 'Apricot'],
  Oranges: ['Orange', 'Pumpkin', 'Copper', 'Mahogany'],
  Golds: ['Flat Gold', 'Metallic Gold', 'Bright Gold'],
  Neutrals: [
    'Black',
    'Charcoal',
    'Gray',
    'Light Gray',
    'Granite',
    'Slate',
    'Mist',
    'Brown',
    'White',
  ],
};

interface RisoControlsProps {
  onExport: () => void;
  onExportSvg?: () => void;
  onExportHiRes?: () => void;
  onExportLayer?: (index: number) => void;
  onAiEnhance?: () => void;
  isAiProcessing?: boolean;
  onCopyAsPng?: () => void;
}

export const RisoControls: React.FC<RisoControlsProps> = React.memo(
  ({
    onExport,
    onExportSvg,
    onExportHiRes,
    onExportLayer,
    onAiEnhance,
    isAiProcessing,
    onCopyAsPng,
  }) => {
    const { t, tOr } = useTranslation();
    const store = useRisoStore();
    const [expandedLayer, setExpandedLayer] = useState<number | null>(null);
    const [inkCatalogLayer, setInkCatalogLayer] = useState<number | null>(null);
    const [inkSearch, setInkSearch] = useState('');
    const [inkCategory, setInkCategory] = useState<string | null>(null);

    const set = useCallback(
      <K extends string>(key: K, value: any) => {
        store.updateSetting(key as any, value);
      },
      [store]
    );

    const applyFullPreset = useCallback(
      (name: string) => {
        const preset = RISO_FULL_PRESETS[name];
        if (!preset) return;
        const layers = preset.colors.map((hex, i) => ({
          color: hexToRgb(hex),
          hex,
          visible: true,
          alpha: 0.85,
          angle: i * 22.5,
          offsetX: [1, -1, 1, -1][i],
          offsetY: [-1, 1, 1, -1][i],
        }));
        store.setLayers(layers);
        store.updateSetting('frequency', preset.frequency);
        store.updateSetting('dotSize', preset.dotSize);
        store.updateSetting('paperColor', preset.paperColor);
        store.updateSetting('paperNoise', preset.paperNoise);
        store.updateSetting('inkNoise', preset.inkNoise);
        store.updateSetting('inkDropout', preset.inkDropout);
        store.updateSetting('misregistration', preset.misregistration);
        store.updateSetting('edgeBleed', preset.edgeBleed);
        if (preset.ditherMode) store.updateSetting('ditherMode', preset.ditherMode);
        if (preset.halftoneShape) store.updateSetting('halftoneShape', preset.halftoneShape);
        toast.success(t('toolEditor.presets.applied', { name }));
      },
      [store, t]
    );

    const ditherOptions = [
      { value: 'stochastic', label: t('imagelab.riso.dither.stochastic') },
      { value: 'atkinson', label: 'Atkinson' },
      { value: 'floydsteinberg', label: 'Floyd-Steinberg' },
      { value: 'bayer', label: 'Bayer' },
      { value: 'halftone', label: t('imagelab.controls.halftone') },
    ];
    const halftoneShapeOptions = [
      { value: 'circle', label: t('imagelab.riso.shapes.circle') },
      { value: 'line', label: t('imagelab.riso.shapes.line') },
      { value: 'cross', label: t('imagelab.riso.shapes.cross') },
      { value: 'ellipse', label: t('imagelab.riso.shapes.ellipse') },
    ];
    const layerDitherOptions = [
      { value: '', label: t('imagelab.riso.dither.auto') },
      ...ditherOptions,
    ];

    const filteredInks = useMemo(() => {
      let inks = RISO_INK_CATALOG;
      if (inkCategory) {
        const names = INK_CATEGORIES[inkCategory] || [];
        inks = inks.filter((ink) => names.includes(ink.name));
      }
      if (inkSearch) {
        const q = inkSearch.toLowerCase();
        inks = inks.filter((ink) => ink.name.toLowerCase().includes(q));
      }
      return inks;
    }, [inkSearch, inkCategory]);

    const tabs: PanelTab[] = [
      {
        id: 'screening',
        label: t('imagelab.riso.screening'),
        icon: <SlidersHorizontal size={16} />,
        content: (
          <div className="space-y-3">
            <ToolPanelRow label={t('imagelab.controls.mode')}>
              <Select
                options={ditherOptions}
                value={store.ditherMode}
                onChange={(v) => store.updateSetting('ditherMode', v as DitherMode)}
                variant="node"
              />
            </ToolPanelRow>
            {store.ditherMode === 'halftone' && (
              <ToolPanelRow label={t('imagelab.controls.shape')}>
                <Select
                  options={halftoneShapeOptions}
                  value={store.halftoneShape}
                  onChange={(v) => store.updateSetting('halftoneShape', v as HalftoneShape)}
                  variant="node"
                />
              </ToolPanelRow>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput
                label={t('imagelab.controls.frequency')}
                value={store.frequency}
                min={15}
                max={200}
                step={1}
                onChange={(v) => set('frequency', v)}
              />
              <ScrubInput
                label={t('imagelab.controls.dot')}
                value={store.dotSize}
                min={0.3}
                max={1}
                step={0.01}
                onChange={(v) => set('dotSize', v)}
              />
              <ScrubInput
                label={t('imagelab.controls.space')}
                value={store.dotSpacing ?? 0}
                min={0}
                max={0.8}
                step={0.01}
                onChange={(v) => set('dotSpacing', v)}
              />
              <ScrubInput
                label={t('imagelab.riso.gain')}
                value={store.dotGain ?? 0}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => set('dotGain', v)}
              />
              <ScrubInput
                label={t('imagelab.controls.contrast')}
                value={store.contrast}
                min={0.3}
                max={2.5}
                step={0.01}
                onChange={(v) => set('contrast', v)}
              />
              <ScrubInput
                label={t('imagelab.controls.light')}
                value={store.lightness}
                min={-0.5}
                max={0.5}
                step={0.01}
                onChange={(v) => set('lightness', v)}
              />
            </div>
            <ScrubInput
              label={t('imagelab.riso.misregistration')}
              value={store.misregistration}
              min={0}
              max={8}
              step={0.5}
              suffix="px"
              onChange={(v) => set('misregistration', v)}
            />
          </div>
        ),
      },
      {
        id: 'channels',
        label: t('imagelab.controls.channels'),
        icon: <Layers size={16} />,
        action: (
          <ApplyBrandButton
            onApply={(colors) => {
              store.setLayers(
                colors.map((hex, i) => ({
                  color: hexToRgb(hex),
                  hex,
                  visible: true,
                  alpha: 0.85,
                  angle: (i * 22.5) % 90,
                  offsetX: [1, -1, 1, -1][i % 4],
                  offsetY: [-1, 1, 1, -1][i % 4],
                }))
              );
            }}
          />
        ),
        content: (
          <div className="space-y-3">
            <ToolPanelRow label={t('imagelab.riso.inkLayers')}>
              <div className="flex gap-1">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    aria-label={t('imagelab.riso.setInkLayerCount', { count: n })}
                    onClick={() => store.updateSetting('colorCount', n)}
                    className={cn(
                      'w-8 h-8 rounded-md text-2xs font-mono transition-colors duration-200 border',
                      store.colorCount === n
                        ? 'bg-accent text-foreground border-border'
                        : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </ToolPanelRow>
            {store.layers.length > 0 && (
              <div className="space-y-1">
                {store.layers.map((layer, i) => (
                  <ChannelRow
                    key={i}
                    color={layer.hex}
                    onColorChange={(v) => store.updateLayer(i, { hex: v })}
                    label={layer.hex}
                    visible={layer.visible}
                    onToggleVisible={() => store.updateLayer(i, { visible: !layer.visible })}
                    expanded={expandedLayer === i}
                    onToggleExpand={() => setExpandedLayer(expandedLayer === i ? null : i)}
                    actions={
                      <span
                        role="button"
                        aria-label={t('imagelab.riso.soloLayer', { index: i + 1 })}
                        onClick={(e) => {
                          e.stopPropagation();
                          store.setSoloLayer(i);
                        }}
                        className={cn(
                          'transition-colors p-1 rounded-md',
                          store.soloLayer === i
                            ? 'text-foreground bg-accent'
                            : 'text-muted-foreground hover:text-muted-foreground'
                        )}
                      >
                        <Focus size={14} />
                      </span>
                    }
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      <ScrubInput
                        label={t('imagelab.controls.opacity')}
                        value={layer.alpha}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(v) => store.updateLayer(i, { alpha: v })}
                      />
                      <ScrubInput
                        label={t('imagelab.controls.angle')}
                        value={layer.angle}
                        min={0}
                        max={90}
                        step={2.5}
                        suffix="°"
                        onChange={(v) => store.updateLayer(i, { angle: v })}
                      />
                      <ScrubInput
                        label="X"
                        value={layer.offsetX}
                        min={-5}
                        max={5}
                        step={0.5}
                        suffix="px"
                        onChange={(v) => store.updateLayer(i, { offsetX: v })}
                      />
                      <ScrubInput
                        label="Y"
                        value={layer.offsetY}
                        min={-5}
                        max={5}
                        step={0.5}
                        suffix="px"
                        onChange={(v) => store.updateLayer(i, { offsetY: v })}
                      />
                    </div>
                    <ToolPanelRow label={t('imagelab.shader.labels.Dither')}>
                      <Select
                        options={layerDitherOptions}
                        value={layer.ditherMode ?? ''}
                        onChange={(v) =>
                          store.updateLayer(i, {
                            ditherMode: (v || undefined) as DitherMode | undefined,
                          })
                        }
                        variant="node"
                      />
                    </ToolPanelRow>

                    <button
                      onClick={() => {
                        setInkCatalogLayer(inkCatalogLayer === i ? null : i);
                        setInkSearch('');
                        setInkCategory(null);
                      }}
                      className="flex items-center gap-1.5 text-2xs text-muted-foreground hover:text-muted-foreground transition-colors"
                    >
                      <Palette size={12} />
                      {t('imagelab.riso.inkCatalog')}
                      <ChevronDown
                        size={10}
                        className={cn(
                          'transition-transform',
                          inkCatalogLayer === i && 'rotate-180'
                        )}
                      />
                    </button>
                    {inkCatalogLayer === i && (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Search
                            size={10}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                          />
                          <input
                            type="text"
                            value={inkSearch}
                            onChange={(e) => setInkSearch(e.target.value)}
                            placeholder={t('imagelab.riso.searchInks')}
                            className="w-full h-6 pl-6 pr-2 rounded-md bg-muted border border-border text-2xs text-muted-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                          />
                        </div>
                        <div className="flex gap-0.5 flex-wrap">
                          <button
                            onClick={() => setInkCategory(null)}
                            className={cn(
                              'px-1.5 h-4 rounded text-2xs font-mono border transition-colors',
                              !inkCategory
                                ? 'bg-accent text-foreground border-border'
                                : 'text-muted-foreground border-border hover:text-muted-foreground'
                            )}
                          >
                            {t('imagelab.riso.allInks')}
                          </button>
                          {Object.keys(INK_CATEGORIES).map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setInkCategory(inkCategory === cat ? null : cat)}
                              className={cn(
                                'px-1.5 h-4 rounded text-2xs font-mono border transition-colors',
                                inkCategory === cat
                                  ? 'bg-accent text-foreground border-border'
                                  : 'text-muted-foreground border-border hover:text-muted-foreground'
                              )}
                            >
                              {tOr(`imagelab.riso.inkCategories.${cat}`, cat)}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-8 gap-0.5 max-h-[140px] overflow-y-auto pr-1">
                          {filteredInks.map((ink) => (
                            <button
                              key={ink.name}
                              title={ink.name}
                              onClick={() => {
                                store.updateLayer(i, { hex: ink.hex });
                                setInkCatalogLayer(null);
                              }}
                              className={cn(
                                'w-6 h-6 rounded-md border transition-colors',
                                layer.hex.toLowerCase() === ink.hex.toLowerCase()
                                  ? 'border-ring ring-1 ring-ring/30'
                                  : 'border-border hover:border-border-hover'
                              )}
                              style={{ backgroundColor: ink.hex }}
                            />
                          ))}
                          {filteredInks.length === 0 && (
                            <span className="col-span-8 text-2xs text-muted-foreground font-mono py-2 text-center">
                              {t('imagelab.riso.noInks')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {onExportLayer && (
                      <button
                        onClick={() => onExportLayer(i)}
                        className="flex items-center gap-1.5 text-2xs text-muted-foreground hover:text-muted-foreground transition-colors"
                      >
                        <Layers size={12} />
                        {t('imagelab.riso.exportLayer')}
                      </button>
                    )}
                  </ChannelRow>
                ))}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'paper',
        label: t('imagelab.riso.paperAndTexture'),
        icon: <Blend size={16} />,
        content: (
          <div className="space-y-3">
            <ToolPanelRow label={t('imagelab.controls.paper')}>
              <InlineColorPicker
                value={store.paperColor}
                onChange={(v) => store.updateSetting('paperColor', v)}
                label={t('imagelab.controls.paperColor')}
              />
            </ToolPanelRow>
            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput
                label={t('imagelab.controls.grain')}
                value={store.paperNoise}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => set('paperNoise', v)}
              />
              <ScrubInput
                label={t('imagelab.riso.noise')}
                value={store.inkNoise}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => set('inkNoise', v)}
              />
              <ScrubInput
                label={t('imagelab.riso.dropout')}
                value={store.inkDropout}
                min={0}
                max={0.15}
                step={0.005}
                onChange={(v) => set('inkDropout', v)}
              />
              <ScrubInput
                label={t('imagelab.riso.bleed')}
                value={store.edgeBleed}
                min={0}
                max={4}
                step={0.5}
                suffix="px"
                onChange={(v) => set('edgeBleed', v)}
              />
            </div>
          </div>
        ),
      },
      {
        id: 'palettes',
        label: t('imagelab.riso.inkPalettes'),
        icon: <Palette size={16} />,
        content: (
          <ToolPanelGrid>
            {Object.entries(RISO_INK_PRESETS).map(([name, colors]) => (
              <ToolPanelChip
                key={name}
                onClick={() => {
                  const layers = colors.map((hex, i) => ({
                    color: hexToRgb(hex),
                    hex,
                    visible: true,
                    alpha: 0.85,
                    angle: i * 22.5,
                    offsetX: [1, -1, 1, -1][i],
                    offsetY: [-1, 1, 1, -1][i],
                  }));
                  store.setLayers(layers);
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 shrink-0">
                    {colors.map((c, ci) => (
                      <div
                        key={ci}
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <span className="truncate">{tOr(`imagelab.riso.palettes.${name}`, name)}</span>
                </div>
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
        ),
      },
    ];

    return (
      <ToolPanel>
        <PresetThumbnailStrip
          imageUrl={store.imageUrl}
          presets={RISO_PRESET_ITEMS}
          onSelect={(name) => applyFullPreset(name)}
        />

        <PanelSectionTabs tabs={tabs} />

        <ToolPanelExportActions
          onExport={onExport}
          isExporting={store.isExporting}
          disabled={!store.imageUrl}
          onCopyAsPng={onCopyAsPng}
          sendTo={
            <>
              {onExportSvg && (
                <button
                  onClick={onExportSvg}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-2xs text-muted-foreground hover:bg-accent transition-colors"
                >
                  <FileType size={14} className="text-muted-foreground" />
                  {t('imagelab.riso.exportSvg')}
                </button>
              )}
              {onExportHiRes && (
                <button
                  onClick={onExportHiRes}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-2xs text-muted-foreground hover:bg-accent transition-colors"
                >
                  <FileImage size={14} className="text-muted-foreground" />
                  {t('imagelab.riso.exportHiRes')}
                </button>
              )}
            </>
          }
        >
          {onAiEnhance && (
            <Button
              aria-label={t('imagelab.riso.aiEnhance')}
              onClick={onAiEnhance}
              disabled={isAiProcessing || !store.imageUrl}
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground h-9 text-xs gap-2"
            >
              {isAiProcessing ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> {t('common.processing')}
                </>
              ) : (
                <>
                  <Zap size={14} /> {t('imagelab.riso.aiEnhance')}
                </>
              )}
            </Button>
          )}
        </ToolPanelExportActions>
      </ToolPanel>
    );
  }
);
