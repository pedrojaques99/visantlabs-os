import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pipette, Copy, Trash2, Check, ChevronDown, ChevronUp } from '@/lib/ui/icons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useColorConverterStore, type ConvertedColor } from '@/stores/colorConverterStore';
import { MiniAppShell } from '@/components/shared/MiniAppShell';
import { hexToRgb, getContrastRatioPublic, checkWCAGCompliance } from '@/utils/colorUtils';
import { copyToClipboard } from '@/utils/clipboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ralColorsData from '@/data/ralColors.json';
import pantoneColorsData from '@/data/pantoneColors.json';
import { glassSurface } from '@/lib/ui/glass';
import { useTranslation } from '@/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { fade, transitions } from '@/lib/ui/motion';

/* ── Nearest-match helpers (Euclidean distance in RGB) ───── */

interface RalEntry {
  code: string;
  name: string;
  hex: string;
}
interface PantoneEntry {
  code: string;
  hex: string;
}

const ralColors: RalEntry[] = ralColorsData;
const pantoneColors: PantoneEntry[] = pantoneColorsData;

function rgbDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function nearestRal(hex: string): RalEntry {
  const rgb = hexToRgb(hex);
  let best = ralColors[0];
  let bestDist = Infinity;
  for (const entry of ralColors) {
    const d = rgbDistance(rgb, hexToRgb(entry.hex));
    if (d < bestDist) {
      bestDist = d;
      best = entry;
    }
  }
  return best;
}

function nearestPantone(hex: string): PantoneEntry {
  const rgb = hexToRgb(hex);
  let best = pantoneColors[0];
  let bestDist = Infinity;
  for (const entry of pantoneColors) {
    const d = rgbDistance(rgb, hexToRgb(entry.hex));
    if (d < bestDist) {
      bestDist = d;
      best = entry;
    }
  }
  return best;
}

/* ── Tiny copy button ────────────────────────────────────── */

function CopyBtn({ value }: { value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } else toast.error(t('miniTools.copyFailed'));
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
      title={t('miniTools.copy')}
      aria-label={t('miniTools.copy')}
    >
      {copied ? <Check size={10} className="text-success" /> : <Copy size={10} />}
    </button>
  );
}

/* ── WCAG contrast panel ─────────────────────────────────── */

const selectClass =
  'ml-1 rounded border border-border bg-background px-1 py-0.5 text-2xs font-mono text-foreground';

function ContrastPanel({ colors }: { colors: ConvertedColor[] }) {
  const { t } = useTranslation();
  const [aSel, setA] = useState(0);
  const [bSel, setB] = useState(1);

  if (colors.length < 2) return null;

  // Removing a color can leave a stale index past the end; clamp to the list.
  const a = Math.min(aSel, colors.length - 1);
  const b = Math.min(bSel, colors.length - 1);

  const ratio = getContrastRatioPublic(colors[a].hex, colors[b].hex);
  const wcag = checkWCAGCompliance(ratio);

  return (
    <motion.div {...fade} className={cn('rounded-xl p-4 space-y-3', glassSurface.surface)}>
      <h3 className="text-xs font-medium text-muted-foreground">
        {t('miniTools.colorConverter.contrastTitle')}
      </h3>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-muted-foreground">
          {t('miniTools.colorConverter.colorA')}
          <select value={a} onChange={(e) => setA(+e.target.value)} className={selectClass}>
            {colors.map((c, i) => (
              <option key={i} value={i}>
                {c.hex}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          {t('miniTools.colorConverter.colorB')}
          <select value={b} onChange={(e) => setB(+e.target.value)} className={selectClass}>
            {colors.map((c, i) => (
              <option key={i} value={i}>
                {c.hex}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Preview */}
      <div className="flex gap-2">
        <div
          className="flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold"
          style={{ backgroundColor: colors[a].hex, color: colors[b].hex }}
        >
          Aa
        </div>
        <div
          className="flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold"
          style={{ backgroundColor: colors[b].hex, color: colors[a].hex }}
        >
          Aa
        </div>
      </div>

      {/* Results */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-foreground">
          {t('miniTools.colorConverter.ratio')}:{' '}
          <strong className="font-mono tabular-nums">{ratio.toFixed(2)}:1</strong>
        </span>
        <WcagBadge pass={wcag.normalAA} label="AA" />
        <WcagBadge pass={wcag.normalAAA} label="AAA" />
        <WcagBadge
          pass={wcag.largeAA}
          label={t('miniTools.colorConverter.large', { level: 'AA' })}
        />
        <WcagBadge
          pass={wcag.largeAAA}
          label={t('miniTools.colorConverter.large', { level: 'AAA' })}
        />
      </div>
    </motion.div>
  );
}

function WcagBadge({ pass, label }: { pass: boolean; label: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant={pass ? 'success' : 'destructive'} className="px-1.5 text-2xs">
      {label}: {pass ? t('miniTools.colorConverter.pass') : t('miniTools.colorConverter.fail')}
    </Badge>
  );
}

/* ── Main page ───────────────────────────────────────────── */

export const ColorConverterPage: React.FC = () => {
  const { t } = useTranslation();
  const inputColor = useColorConverterStore((s) => s.inputColor);
  const inputFormat = useColorConverterStore((s) => s.inputFormat);
  const colors = useColorConverterStore((s) => s.colors);
  const setInputColor = useColorConverterStore((s) => s.setInputColor);
  const addColor = useColorConverterStore((s) => s.addColor);
  const removeColor = useColorConverterStore((s) => s.removeColor);
  const reset = useColorConverterStore((s) => s.reset);

  const handleReset = useCallback(() => {
    reset();
    setInputColor('');
  }, [reset, setInputColor]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && inputColor.trim()) {
        addColor(inputColor);
      }
    },
    [inputColor, addColor]
  );

  const handleCopyAll = useCallback(
    async (format: 'json' | 'csv') => {
      if (!colors.length) return;
      let text: string;
      if (format === 'json') {
        text = JSON.stringify(
          colors.map((c) => ({ hex: c.hex, rgb: c.rgb, cmyk: c.cmyk, hsl: c.hsl })),
          null,
          2
        );
      } else {
        const rows = [
          'HEX,R,G,B,C,M,Y,K,H,S,L',
          ...colors.map(
            (c) =>
              `${c.hex},${c.rgb.join(',')},${c.cmyk.c},${c.cmyk.m},${c.cmyk.y},${c.cmyk.k},${
                c.hsl.h
              },${c.hsl.s},${c.hsl.l}`
          ),
        ];
        text = rows.join('\n');
      }
      const ok = await copyToClipboard(text);
      if (ok)
        toast.success(t('miniTools.colorConverter.copiedAs', { format: format.toUpperCase() }));
      else toast.error(t('miniTools.copyFailed'));
    },
    [colors, t]
  );

  /* Live preview of current input */
  const livePreview = useMemo(() => {
    if (!inputColor.trim()) return null;
    const s = inputColor.trim();
    // Try parsing
    const hexMatch = s.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (hexMatch) {
      let h = hexMatch[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return `#${h}`;
    }
    // RGB
    const rgbMatch = s.match(/^(?:rgb\s*\(\s*)?(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)?$/i);
    if (rgbMatch) {
      const [r, g, b] = [+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]];
      if (r <= 255 && g <= 255 && b <= 255) {
        const toHex = (v: number) => v.toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      }
    }
    return null;
  }, [inputColor]);

  /* Panel: input + batch actions + WCAG contrast */
  const panel = (
    <div className="space-y-6">
      <div>
        <label
          htmlFor="color-converter-input"
          className="block text-xs font-medium text-muted-foreground mb-2"
        >
          {t('miniTools.colorConverter.enterColor')}
        </label>
        <div className="flex gap-2 items-center">
          {livePreview && (
            <div
              className="w-9 h-9 rounded-lg border border-border flex-shrink-0"
              style={{ backgroundColor: livePreview }}
            />
          )}
          <Input
            id="color-converter-input"
            value={inputColor}
            onChange={(e) => setInputColor(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="#FF5500, rgb(255,85,0)…"
            className="flex-1 font-mono text-sm"
          />
        </div>
        {inputColor.trim() && (
          <p className="mt-1 text-2xs font-mono text-muted-foreground">
            {inputFormat.toUpperCase()}
          </p>
        )}
      </div>

      <Button
        onClick={() => inputColor.trim() && addColor(inputColor)}
        disabled={!inputColor.trim()}
        className="w-full bg-brand-cyan/10 hover:bg-brand-cyan/20 text-foreground border border-brand-cyan/30 text-xs font-medium"
      >
        {t('common.addColor')}
      </Button>

      <AnimatePresence>
        {colors.length > 0 && (
          <motion.div {...fade} className="space-y-3">
            <h2 className="text-xs font-medium text-muted-foreground">{t('common.export')}</h2>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => handleCopyAll('json')}
                variant="outline"
                className="text-xs font-medium"
              >
                <Copy size={12} className="mr-1" /> {t('miniTools.colorConverter.copyJson')}
              </Button>
              <Button
                onClick={() => handleCopyAll('csv')}
                variant="outline"
                className="text-xs font-medium"
              >
                <Copy size={12} className="mr-1" /> {t('miniTools.colorConverter.copyCsv')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{colors.length >= 2 && <ContrastPanel colors={colors} />}</AnimatePresence>
    </div>
  );

  /* Status bar: color count summary */
  const statusBar =
    colors.length > 0 ? (
      <span className="text-2xs tabular-nums text-muted-foreground">
        {t('miniTools.colorConverter.colorsCount', { count: colors.length })}
      </span>
    ) : undefined;

  return (
    <MiniAppShell
      icon={Pipette}
      title={t('apps.colorConverter.name')}
      toolId="color-converter"
      documentTitle={t('apps.colorConverter.name')}
      onReset={colors.length > 0 || inputColor ? handleReset : undefined}
      panel={panel}
      panelLabel={t('miniTools.settings')}
      statusBar={statusBar}
      centerContent={false}
    >
      <div className="max-w-2xl mx-auto w-full py-8 px-4">
        <AnimatePresence mode="wait">
          {colors.length > 0 ? (
            <motion.div key="color-list" {...fade} className="space-y-2">
              {colors.map((c, i) => (
                <ColorRow key={`${c.hex}-${i}`} color={c} index={i} onRemove={removeColor} />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty-state"
              {...fade}
              className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground"
            >
              <Pipette className="w-10 h-10 mx-auto mb-4" />
              <p className="text-sm">{t('miniTools.colorConverter.emptyHint')}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MiniAppShell>
  );
};

/* ── Single color row ────────────────────────────────────── */

function ColorRow({
  color,
  index,
  onRemove,
}: {
  color: ConvertedColor;
  index: number;
  onRemove: (i: number) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const ral = useMemo(() => nearestRal(color.hex), [color.hex]);
  const pantone = useMemo(() => nearestPantone(color.hex), [color.hex]);

  const { rgb, cmyk, hsl, hex } = color;

  return (
    <div className={cn('rounded-xl overflow-hidden', glassSurface.surface)}>
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        {/* Swatch */}
        <div
          className="w-10 h-10 rounded-lg border border-border flex-shrink-0"
          style={{ backgroundColor: hex }}
        />

        {/* Values */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 min-w-0">
          <ValueCell label="HEX" value={hex} />
          <ValueCell label="RGB" value={`${rgb[0]}, ${rgb[1]}, ${rgb[2]}`} />
          <ValueCell label="CMYK" value={`${cmyk.c}, ${cmyk.m}, ${cmyk.y}, ${cmyk.k}`} />
          <ValueCell label="HSL" value={`${hsl.h}, ${hsl.s}%, ${hsl.l}%`} />
        </div>

        {/* Actions */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title={t('miniTools.colorConverter.details')}
          aria-label={t('miniTools.colorConverter.details')}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          title={t('miniTools.remove')}
          aria-label={t('miniTools.remove')}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitions.base}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-3 py-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded border border-border"
                  style={{ backgroundColor: ral.hex }}
                />
                <span>
                  {t('miniTools.colorConverter.nearestRal')}{' '}
                  <strong className="font-mono text-foreground">{ral.code}</strong> {ral.name} (
                  <span className="font-mono">{ral.hex}</span>)
                </span>
                <CopyBtn value={ral.code} />
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded border border-border"
                  style={{ backgroundColor: pantone.hex }}
                />
                <span>
                  {t('miniTools.colorConverter.nearestPantone')}{' '}
                  <strong className="font-mono text-foreground">{pantone.code}</strong> (
                  <span className="font-mono">{pantone.hex}</span>)
                </span>
                <CopyBtn value={pantone.code} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ValueCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-2xs font-mono text-muted-foreground w-8 flex-shrink-0">{label}</span>
      <span className="text-2xs font-mono text-foreground truncate">{value}</span>
      <CopyBtn value={value} />
    </div>
  );
}
