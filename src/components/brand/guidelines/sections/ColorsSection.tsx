import React, { useState, useCallback, useMemo } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Palette, Plus, Trash2, Copy, ShieldCheck, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';
import { checkWCAGCompliance, getContrastRatioPublic, hexToCmyk } from '@/utils/colorUtils';

interface ColorsSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

interface ContrastPair {
  fg: string; fgName: string; bg: string; bgName: string;
  ratio: number; wcagAA: boolean; wcagAAA: boolean; largeAA: boolean;
}

export const ColorsSection: React.FC<ColorsSectionProps> = ({ guideline, onUpdate, span }) => {
  const local = guideline.colors || [];
  const [showWCAG, setShowWCAG] = useState(false);

  const persist = useCallback((colors: typeof local) => {
    const withCmyk = colors.map(c => ({ ...c, cmyk: hexToCmyk(c.hex) }));
    onUpdate({ colors: withCmyk });
  }, [onUpdate]);

  const updateColor = (i: number, patch: Partial<typeof local[0]>) => {
    const next = local.map((c, idx) => idx === i ? { ...c, ...patch } : c);
    persist(next);
  };

  const addColor = () => {
    const next = [...local, { hex: '#888888', name: '' }];
    persist(next);
  };

  const removeColor = (i: number) => {
    const next = local.filter((_, idx) => idx !== i);
    persist(next);
  };

  const contrastMatrix = useMemo((): ContrastPair[] => {
    if (local.length < 2) return [];
    const pairs: ContrastPair[] = [];
    for (let i = 0; i < local.length; i++) {
      for (let j = i + 1; j < local.length; j++) {
        const ratio = getContrastRatioPublic(local[i].hex, local[j].hex);
        const c = checkWCAGCompliance(ratio);
        pairs.push({ fg: local[i].hex, fgName: local[i].name || `Color ${i + 1}`, bg: local[j].hex, bgName: local[j].name || `Color ${j + 1}`, ratio, wcagAA: c.normalAA, wcagAAA: c.normalAAA, largeAA: c.largeAA });
      }
    }
    return pairs.sort((a, b) => b.ratio - a.ratio);
  }, [local]);

  const copyAll = (format: 'json' | 'css' | 'tailwind' | 'cmyk') => {
    if (!local.length) { toast.error('No colors to copy'); return; }
    let content = '';
    if (format === 'json') content = JSON.stringify(local.map(c => ({ name: c.name, hex: c.hex })), null, 2);
    else if (format === 'css') content = local.map(c => `--color-${(c.name || 'color').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}: ${c.hex};`).join('\n');
    else if (format === 'tailwind') { const o: Record<string, string> = {}; local.forEach(c => { o[(c.name || 'color').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')] = c.hex; }); content = JSON.stringify(o, null, 2); }
    else content = local.map(c => { const cm = c.cmyk || hexToCmyk(c.hex); return `${c.name || 'Color'}: C${cm.c} M${cm.m} Y${cm.y} K${cm.k}`; }).join('\n');
    navigator.clipboard.writeText(content);
    toast.success(`Copied ${local.length} colors as ${format.toUpperCase()}`);
  };

  return (
    <SectionBlock
      id="colors"
      icon={<Palette size={14} />}
      title="Colors"
      span={span as any}
      actions={(
        <div className="flex items-center gap-1">
          {local.length >= 2 && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setShowWCAG(!showWCAG)} title="WCAG Contrast" aria-label="Toggle WCAG matrix">
              <ShieldCheck size={12} />
            </Button>
          )}
          {local.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" aria-label="Copy all colors">
                  <Copy size={12} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[120px]">
                {(['json', 'css', 'tailwind', 'cmyk'] as const).map(f => (
                  <DropdownMenuItem key={f} onClick={() => copyAll(f)} className="text-xs font-mono uppercase">{f === 'css' ? 'CSS Variables' : f}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={addColor} aria-label="Add color">
            <Plus size={12} />
          </Button>
        </div>
      )}
    >
      <div className="space-y-1.5 py-1">
        {local.length === 0 && (
          <p className="text-[11px] text-neutral-700 py-2">No colors yet. Click + to add.</p>
        )}
        {local.map((c, i) => (
          <div key={i} className="flex items-center gap-3 group/color">
            {/* Color swatch + picker */}
            <div className="relative w-8 h-8 shrink-0 cursor-pointer" title="Click to change color">
              <div className="w-full h-full rounded-md border border-white/10" style={{ backgroundColor: c.hex }} />
              <input
                type="color"
                value={c.hex}
                onChange={(e) => updateColor(i, { hex: e.target.value.toUpperCase() })}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            {/* Name */}
            <Input
              value={c.name || ''}
              onChange={(e) => updateColor(i, { name: e.target.value })}
              className="h-7 flex-1 bg-transparent border-none p-0 text-xs font-medium text-neutral-200 focus-visible:ring-0 placeholder:text-neutral-700"
              placeholder="Color name"
            />
            {/* Hex */}
            <span
              className="text-[10px] font-mono text-neutral-500 w-16 text-right cursor-pointer hover:text-neutral-300 transition-colors"
              onClick={() => { navigator.clipboard.writeText(c.hex); toast.success(`Copied ${c.hex}`); }}
              title="Copy hex"
            >
              {c.hex}
            </span>
            {/* CMYK */}
            <span className="text-[10px] font-mono text-neutral-700 w-28 text-right hidden sm:block">
              {(() => { try { const cm = c.cmyk || hexToCmyk(c.hex); return `C${cm.c} M${cm.m} Y${cm.y} K${cm.k}`; } catch { return ''; } })()}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-800 hover:text-red-400 opacity-0 group-hover/color:opacity-100 transition-all shrink-0" onClick={() => removeColor(i)} aria-label="Remove color">
              <Trash2 size={11} />
            </Button>
          </div>
        ))}
      </div>

      {/* WCAG panel */}
      <AnimatePresence>
        {showWCAG && contrastMatrix.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <MicroTitle className="text-neutral-500">WCAG Contrast</MicroTitle>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-neutral-600 hover:text-white" onClick={() => setShowWCAG(false)} aria-label="Close"><X size={10} /></Button>
              </div>
              {contrastMatrix.map((pair, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-white/[0.02] border border-white/[0.03]">
                  <div className="w-5 h-5 rounded border border-white/10 shrink-0" style={{ backgroundColor: pair.fg }} />
                  <div className="w-5 h-5 rounded border border-white/10 shrink-0" style={{ backgroundColor: pair.bg }} />
                  <span className="text-[10px] font-mono text-neutral-400 flex-1 truncate">{pair.fgName} / {pair.bgName}</span>
                  <span className="text-[10px] font-mono text-neutral-300 tabular-nums">{pair.ratio.toFixed(2)}:1</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pair.wcagAAA ? 'bg-green-500/20 text-green-400' : pair.wcagAA ? 'bg-white/10 text-neutral-300' : pair.largeAA ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                    {pair.wcagAAA ? 'AAA' : pair.wcagAA ? 'AA' : pair.largeAA ? 'AA Lg' : 'Fail'}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SectionBlock>
  );
};
