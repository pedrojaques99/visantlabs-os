import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pipette, Copy, Trash2, Check, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useColorConverterStore, type ConvertedColor } from '@/stores/colorConverterStore';
import { MiniToolShell } from '@/components/shared/MiniToolShell';
import { hexToRgb, getContrastRatioPublic, checkWCAGCompliance } from '@/utils/colorUtils';
import { copyToClipboard } from '@/utils/clipboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ralColorsData from '@/data/ralColors.json';
import pantoneColorsData from '@/data/pantoneColors.json';

const ease = [0.4, 0, 0.2, 1] as const;
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease },
};
const fadeScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: 0.3, ease },
};

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
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } else toast.error('Copy failed');
  };
  return (
    <motion.button
      onClick={handleCopy}
      whileTap={{ scale: 0.95 }}
      className="ml-1 text-neutral-600 hover:text-neutral-300 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={10} className="text-success" /> : <Copy size={10} />}
    </motion.button>
  );
}

/* ── WCAG contrast panel ─────────────────────────────────── */

function ContrastPanel({ colors }: { colors: ConvertedColor[] }) {
  const [a, setA] = useState(0);
  const [b, setB] = useState(1);

  if (colors.length < 2) return null;

  const ratio = getContrastRatioPublic(colors[a]?.hex ?? '#000', colors[b]?.hex ?? '#FFF');
  const wcag = checkWCAGCompliance(ratio);

  return (
    <motion.div
      {...fadeUp}
      className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 space-y-3"
    >
      <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
        WCAG Contrast Check
      </h3>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[10px] font-mono text-neutral-500">
          Color A
          <select
            value={a}
            onChange={(e) => setA(+e.target.value)}
            className="ml-1 bg-neutral-900 border border-neutral-700 rounded text-[10px] text-neutral-300 px-1 py-0.5"
          >
            {colors.map((c, i) => (
              <option key={i} value={i}>
                {c.hex}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-mono text-neutral-500">
          Color B
          <select
            value={b}
            onChange={(e) => setB(+e.target.value)}
            className="ml-1 bg-neutral-900 border border-neutral-700 rounded text-[10px] text-neutral-300 px-1 py-0.5"
          >
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
          className="flex items-center justify-center rounded-lg px-4 py-2 text-xs font-mono font-bold"
          style={{ backgroundColor: colors[a]?.hex, color: colors[b]?.hex }}
        >
          Aa Sample
        </div>
        <div
          className="flex items-center justify-center rounded-lg px-4 py-2 text-xs font-mono font-bold"
          style={{ backgroundColor: colors[b]?.hex, color: colors[a]?.hex }}
        >
          Aa Sample
        </div>
      </div>

      {/* Results */}
      <div className="flex flex-wrap gap-3 text-[10px] font-mono">
        <span className="text-neutral-300">
          Ratio: <strong>{ratio.toFixed(2)}:1</strong>
        </span>
        <Badge pass={wcag.normalAA} label="AA" />
        <Badge pass={wcag.normalAAA} label="AAA" />
        <Badge pass={wcag.largeAA} label="AA Large" />
        <Badge pass={wcag.largeAAA} label="AAA Large" />
      </div>
    </motion.div>
  );
}

function Badge({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold',
        pass ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
      )}
    >
      {label}: {pass ? 'Pass' : 'Fail'}
    </span>
  );
}

/* ── Main page ───────────────────────────────────────────── */

export const ColorConverterPage: React.FC = () => {
  const inputColor = useColorConverterStore((s) => s.inputColor);
  const inputFormat = useColorConverterStore((s) => s.inputFormat);
  const colors = useColorConverterStore((s) => s.colors);
  const setInputColor = useColorConverterStore((s) => s.setInputColor);
  const addColor = useColorConverterStore((s) => s.addColor);
  const removeColor = useColorConverterStore((s) => s.removeColor);
  const reset = useColorConverterStore((s) => s.reset);

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
      if (ok) toast.success(`Copied as ${format.toUpperCase()}`);
      else toast.error('Copy failed');
    },
    [colors]
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

  return (
    <MiniToolShell
      icon={Pipette}
      title="Color Converter"
      countLabel={
        colors.length > 0 ? `${colors.length} color${colors.length > 1 ? 's' : ''}` : undefined
      }
      onReset={reset}
      showReset={colors.length > 0}
    >
      {/* Input */}
      <motion.div {...fadeUp} className="flex gap-2 items-center">
        {livePreview && (
          <div
            className="w-9 h-9 rounded-lg border border-neutral-700 flex-shrink-0"
            style={{ backgroundColor: livePreview }}
          />
        )}
        <Input
          value={inputColor}
          onChange={(e) => setInputColor(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter color: #FF5500, rgb(255,85,0), cmyk(0,67,100,0), hsl(32,100,50)"
          className="flex-1 font-mono text-sm bg-neutral-950/40 border-neutral-800 placeholder:text-neutral-600"
        />
        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 w-10 text-center">
          {inputColor.trim() ? inputFormat : ''}
        </span>
        <Button
          onClick={() => inputColor.trim() && addColor(inputColor)}
          disabled={!inputColor.trim()}
          className="bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
        >
          Add
        </Button>
      </motion.div>

      {/* Color rows */}
      {colors.length > 0 && (
        <div className="space-y-2">
          {colors.map((c, i) => (
            <motion.div
              key={`${c.hex}-${i}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05, ease }}
            >
              <ColorRow color={c} index={i} onRemove={removeColor} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Batch actions */}
      <AnimatePresence>
        {colors.length > 0 && (
          <motion.div {...fadeUp} exit={{ opacity: 0, y: 8 }} className="flex gap-2 flex-wrap">
            <Button
              onClick={() => handleCopyAll('json')}
              variant="outline"
              className="font-mono text-xs uppercase tracking-widest border-neutral-700"
            >
              <Copy size={12} className="mr-1" /> Copy JSON
            </Button>
            <Button
              onClick={() => handleCopyAll('csv')}
              variant="outline"
              className="font-mono text-xs uppercase tracking-widest border-neutral-700"
            >
              <Copy size={12} className="mr-1" /> Copy CSV
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WCAG contrast check */}
      <AnimatePresence>{colors.length >= 2 && <ContrastPanel colors={colors} />}</AnimatePresence>
    </MiniToolShell>
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
  const [expanded, setExpanded] = useState(false);

  const ral = useMemo(() => nearestRal(color.hex), [color.hex]);
  const pantone = useMemo(() => nearestPantone(color.hex), [color.hex]);

  const { rgb, cmyk, hsl, hex } = color;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        {/* Swatch */}
        <div
          className="w-10 h-10 rounded-lg border border-neutral-700 flex-shrink-0"
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
          onClick={() => setExpanded((v) => !v)}
          className="text-neutral-600 hover:text-neutral-300 transition-colors flex-shrink-0"
          title="Details"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <button
          onClick={() => onRemove(index)}
          className="text-neutral-600 hover:text-neutral-300 transition-colors flex-shrink-0"
          title="Remove"
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
            transition={{ duration: 0.25, ease }}
            className="overflow-hidden"
          >
            <div className="border-t border-neutral-800 px-3 py-2 flex flex-wrap gap-4 text-[10px] font-mono text-neutral-400">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded border border-neutral-700"
                  style={{ backgroundColor: ral.hex }}
                />
                <span>
                  Nearest RAL: <strong className="text-neutral-200">{ral.code}</strong> {ral.name} (
                  {ral.hex})
                </span>
                <CopyBtn value={ral.code} />
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded border border-neutral-700"
                  style={{ backgroundColor: pantone.hex }}
                />
                <span>
                  Nearest Pantone: <strong className="text-neutral-200">{pantone.code}</strong> (
                  {pantone.hex})
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
      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 w-8 flex-shrink-0">
        {label}
      </span>
      <span className="text-[11px] font-mono text-neutral-300 truncate">{value}</span>
      <CopyBtn value={value} />
    </div>
  );
}
