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
import { SendToButton } from '@/components/shared/SendToButton';
import {
  ToolPanel,
  ToolPanelContent,
  ToolPanelSection,
  ToolPanelDisclosure,
  ToolPanelActions,
  ToolPanelGrid,
  ToolPanelChip,
  ToolPanelRow,
  ChannelRow,
  InlineColorPicker,
} from '@/components/shared/ToolPanel';
import { PresetThumbnailStrip } from '@/components/shared/PresetThumbnailStrip';
import {
  Zap,
  Loader2,
  Focus,
  Download,
  ChevronDown,
  Palette,
  Search,
  FileImage,
  FileType,
  Layers,
  Copy,
} from 'lucide-react';

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

const DITHER_OPTIONS = [
  { value: 'stochastic', label: 'Stochastic' },
  { value: 'atkinson', label: 'Atkinson' },
  { value: 'floydsteinberg', label: 'Floyd-Steinberg' },
  { value: 'bayer', label: 'Bayer' },
  { value: 'halftone', label: 'Halftone' },
];

const HALFTONE_SHAPE_OPTIONS = [
  { value: 'circle', label: 'Circle' },
  { value: 'line', label: 'Line' },
  { value: 'cross', label: 'Cross' },
  { value: 'ellipse', label: 'Ellipse' },
];

const LAYER_DITHER_OPTIONS = [{ value: '', label: 'Auto (global)' }, ...DITHER_OPTIONS];

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
    const store = useRisoStore();
    const [expandedLayer, setExpandedLayer] = useState<number | null>(null);
    const [inkCatalogLayer, setInkCatalogLayer] = useState<number | null>(null);
    const [inkSearch, setInkSearch] = useState('');
    const [inkCategory, setInkCategory] = useState<string | null>(null);
    const [exportOpen, setExportOpen] = useState(false);

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
        toast.success(`Applied "${name}"`);
      },
      [store]
    );

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

    return (
      <ToolPanel>
        <PresetThumbnailStrip
          imageUrl={store.imageUrl}
          presets={RISO_PRESET_ITEMS}
          onSelect={(name) => applyFullPreset(name)}
        />

        <ToolPanelContent>
          {/* Screening — core effect parameters */}
          <ToolPanelSection title="SCREENING">
            <ToolPanelRow label="Mode">
              <Select
                options={DITHER_OPTIONS}
                value={store.ditherMode}
                onChange={(v) => store.updateSetting('ditherMode', v as DitherMode)}
                variant="node"
              />
            </ToolPanelRow>
            {store.ditherMode === 'halftone' && (
              <ToolPanelRow label="Shape">
                <Select
                  options={HALFTONE_SHAPE_OPTIONS}
                  value={store.halftoneShape}
                  onChange={(v) => store.updateSetting('halftoneShape', v as HalftoneShape)}
                  variant="node"
                />
              </ToolPanelRow>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput
                label="Freq"
                value={store.frequency}
                min={15}
                max={200}
                step={1}
                onChange={(v) => set('frequency', v)}
              />
              <ScrubInput
                label="Dot"
                value={store.dotSize}
                min={0.3}
                max={1}
                step={0.01}
                onChange={(v) => set('dotSize', v)}
              />
              <ScrubInput
                label="Contrast"
                value={store.contrast}
                min={0.3}
                max={2.5}
                step={0.01}
                onChange={(v) => set('contrast', v)}
              />
              <ScrubInput
                label="Light"
                value={store.lightness}
                min={-0.5}
                max={0.5}
                step={0.01}
                onChange={(v) => set('lightness', v)}
              />
            </div>
            <ScrubInput
              label="Misreg"
              value={store.misregistration}
              min={0}
              max={8}
              step={0.5}
              suffix="px"
              onChange={(v) => set('misregistration', v)}
            />
          </ToolPanelSection>

          {/* Channels — ink layer count + per-layer controls */}
          <ToolPanelSection title="CHANNELS">
            <ToolPanelRow label="Ink Layers">
              <div className="flex gap-1">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    aria-label={`Set ink layer count to ${n}`}
                    onClick={() => store.updateSetting('colorCount', n)}
                    className={cn(
                      'w-8 h-8 rounded-md text-[11px] font-mono transition-all duration-200 border',
                      store.colorCount === n
                        ? 'bg-white/10 text-white border-white/20'
                        : 'bg-neutral-900/50 text-neutral-500 border-neutral-800/50 hover:bg-neutral-800/30'
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
                        aria-label={`Solo layer ${i + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          store.setSoloLayer(i);
                        }}
                        className={cn(
                          'transition-colors p-1 rounded-md',
                          store.soloLayer === i
                            ? 'text-cyan-400 bg-cyan-400/10'
                            : 'text-neutral-600 hover:text-neutral-300'
                        )}
                      >
                        <Focus size={14} />
                      </span>
                    }
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      <ScrubInput
                        label="Opacity"
                        value={layer.alpha}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(v) => store.updateLayer(i, { alpha: v })}
                      />
                      <ScrubInput
                        label="Angle"
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
                    <ToolPanelRow label="Dither">
                      <Select
                        options={LAYER_DITHER_OPTIONS}
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
                      className="flex items-center gap-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 font-mono uppercase transition-colors"
                    >
                      <Palette size={12} />
                      Riso Ink Catalog
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
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-600"
                          />
                          <input
                            type="text"
                            value={inkSearch}
                            onChange={(e) => setInkSearch(e.target.value)}
                            placeholder="Search inks..."
                            className="w-full h-6 pl-6 pr-2 rounded-md bg-neutral-900/80 border border-neutral-800/50 text-[10px] text-neutral-300 font-mono placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600"
                          />
                        </div>
                        <div className="flex gap-0.5 flex-wrap">
                          <button
                            onClick={() => setInkCategory(null)}
                            className={cn(
                              'px-1.5 h-4 rounded text-[10px] font-mono border transition-colors',
                              !inkCategory
                                ? 'bg-white/10 text-white border-white/20'
                                : 'text-neutral-600 border-neutral-800/50 hover:text-neutral-400'
                            )}
                          >
                            All
                          </button>
                          {Object.keys(INK_CATEGORIES).map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setInkCategory(inkCategory === cat ? null : cat)}
                              className={cn(
                                'px-1.5 h-4 rounded text-[10px] font-mono border transition-colors',
                                inkCategory === cat
                                  ? 'bg-white/10 text-white border-white/20'
                                  : 'text-neutral-600 border-neutral-800/50 hover:text-neutral-400'
                              )}
                            >
                              {cat}
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
                                'w-6 h-6 rounded-md border transition-all hover:scale-110',
                                layer.hex.toLowerCase() === ink.hex.toLowerCase()
                                  ? 'border-white ring-1 ring-white/30'
                                  : 'border-neutral-700/50 hover:border-neutral-500'
                              )}
                              style={{ backgroundColor: ink.hex }}
                            />
                          ))}
                          {filteredInks.length === 0 && (
                            <span className="col-span-8 text-[10px] text-neutral-600 font-mono py-2 text-center">
                              No inks found
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {onExportLayer && (
                      <button
                        onClick={() => onExportLayer(i)}
                        className="flex items-center gap-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 font-mono uppercase transition-colors"
                      >
                        <Layers size={12} />
                        Export Layer Separation
                      </button>
                    )}
                  </ChannelRow>
                ))}
              </div>
            )}
          </ToolPanelSection>

          {/* Paper & Texture */}
          <ToolPanelDisclosure label="Paper & Texture">
            <ToolPanelRow label="Paper">
              <InlineColorPicker
                value={store.paperColor}
                onChange={(v) => store.updateSetting('paperColor', v)}
                label="Paper color"
              />
            </ToolPanelRow>
            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput
                label="Grain"
                value={store.paperNoise}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => set('paperNoise', v)}
              />
              <ScrubInput
                label="Noise"
                value={store.inkNoise}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => set('inkNoise', v)}
              />
              <ScrubInput
                label="Dropout"
                value={store.inkDropout}
                min={0}
                max={0.15}
                step={0.005}
                onChange={(v) => set('inkDropout', v)}
              />
              <ScrubInput
                label="Bleed"
                value={store.edgeBleed}
                min={0}
                max={4}
                step={0.5}
                suffix="px"
                onChange={(v) => set('edgeBleed', v)}
              />
            </div>
          </ToolPanelDisclosure>

          {/* Ink Palettes */}
          <ToolPanelDisclosure label="Ink Palettes">
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
                    <span className="truncate">{name}</span>
                  </div>
                </ToolPanelChip>
              ))}
            </ToolPanelGrid>
          </ToolPanelDisclosure>
        </ToolPanelContent>

        <ToolPanelActions>
          <div className="relative w-full">
            <div className="flex gap-2 w-full">
              <Button
                aria-label="Export"
                onClick={onExport}
                disabled={store.isExporting || !store.imageUrl}
                className="flex-1 bg-white hover:bg-neutral-200 text-black font-medium h-9 text-xs gap-2"
              >
                <Download size={14} />
                {store.isExporting ? 'Exporting...' : 'Export'}
              </Button>
              <Button
                aria-label="More options"
                onClick={() => setExportOpen(!exportOpen)}
                disabled={!store.imageUrl}
                variant="outline"
                className="h-9 w-9 p-0 border-neutral-700 text-neutral-400 hover:text-white"
              >
                <ChevronDown
                  size={14}
                  className={cn('transition-transform', exportOpen && 'rotate-180')}
                />
              </Button>
              {onCopyAsPng && (
                <Button
                  onClick={onCopyAsPng}
                  disabled={!store.imageUrl}
                  variant="outline"
                  aria-label="Copy as PNG"
                  title="Copy as PNG"
                  className="h-9 w-9 p-0 border-neutral-700 text-neutral-400 hover:text-white"
                >
                  <Copy size={14} />
                </Button>
              )}
            </div>

            {exportOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-neutral-900 border border-neutral-700 rounded-lg p-1 shadow-xl z-20 animate-fade-in">
                {onExportSvg && (
                  <button
                    onClick={() => {
                      onExportSvg();
                      setExportOpen(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-[11px] text-neutral-300 hover:bg-neutral-800 transition-colors"
                  >
                    <FileType size={14} className="text-neutral-500" />
                    Export SVG (Vector)
                  </button>
                )}
                {onExportHiRes && (
                  <button
                    onClick={() => {
                      onExportHiRes();
                      setExportOpen(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-[11px] text-neutral-300 hover:bg-neutral-800 transition-colors"
                  >
                    <FileImage size={14} className="text-neutral-500" />
                    Export Hi-Res PNG (2x)
                  </button>
                )}
                {store.imageUrl && (
                  <div className="px-1 py-0.5">
                    <SendToButton source="riso" outputMime="image/png" imageUrl={store.imageUrl} />
                  </div>
                )}
              </div>
            )}
          </div>
          {onAiEnhance && (
            <Button
              aria-label="AI Enhance"
              onClick={onAiEnhance}
              disabled={isAiProcessing || !store.imageUrl}
              variant="ghost"
              className="w-full text-neutral-400 hover:text-white h-9 text-xs gap-2"
            >
              {isAiProcessing ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <Zap size={14} /> AI Enhance
                </>
              )}
            </Button>
          )}
        </ToolPanelActions>
      </ToolPanel>
    );
  }
);
