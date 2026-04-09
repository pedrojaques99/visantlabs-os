import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { colorSchema } from '@/schemas/brandGuideline.schema';
import { SectionBlock } from '../SectionBlock';
import { cn } from '@/lib/utils';
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
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';
import { checkWCAGCompliance, getContrastRatioPublic, hexToCmyk } from '@/utils/colorUtils';

const colorsFormSchema = z.object({ colors: z.array(colorSchema) });

interface ColorsSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

interface ContrastPair {
  fg: string;
  fgName: string;
  bg: string;
  bgName: string;
  ratio: number;
  wcagAA: boolean;
  wcagAAA: boolean;
  largeAA: boolean;
}

export const ColorsSection: React.FC<ColorsSectionProps> = ({ guideline, onUpdate, span }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showWCAG, setShowWCAG] = useState(false);
  const form = useForm({
    resolver: zodResolver(colorsFormSchema),
    defaultValues: { colors: guideline.colors || [] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'colors' });

  // Calculate contrast matrix for WCAG checker
  const contrastMatrix = useMemo((): ContrastPair[] => {
    const colors = guideline.colors || [];
    if (colors.length < 2) return [];

    const pairs: ContrastPair[] = [];
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const ratio = getContrastRatioPublic(colors[i].hex, colors[j].hex);
        const compliance = checkWCAGCompliance(ratio);
        pairs.push({
          fg: colors[i].hex,
          fgName: colors[i].name || `Color ${i + 1}`,
          bg: colors[j].hex,
          bgName: colors[j].name || `Color ${j + 1}`,
          ratio,
          wcagAA: compliance.normalAA,
          wcagAAA: compliance.normalAAA,
          largeAA: compliance.largeAA,
        });
      }
    }
    return pairs.sort((a, b) => b.ratio - a.ratio);
  }, [guideline.colors]);

  useEffect(() => {
    form.reset({ colors: guideline.colors || [] });
  }, [guideline.id]);

  const handleSave = form.handleSubmit((data) => {
    // Auto-compute CMYK for each color on save
    const colorsWithCmyk = data.colors.map(c => ({
      ...c,
      cmyk: hexToCmyk(c.hex),
    }));
    onUpdate({ colors: colorsWithCmyk });
    setIsEditing(false);
  });

  const copyAllColors = (format: 'json' | 'css' | 'tailwind' | 'cmyk') => {
    const colors = guideline.colors || [];
    if (colors.length === 0) {
      toast.error('No colors to copy');
      return;
    }

    let content = '';
    switch (format) {
      case 'json':
        content = JSON.stringify(colors.map(c => ({ name: c.name, hex: c.hex })), null, 2);
        break;
      case 'css':
        content = colors.map(c => {
          const name = (c.name || 'color').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          return `--color-${name}: ${c.hex};`;
        }).join('\n');
        break;
      case 'tailwind':
        const obj: Record<string, string> = {};
        colors.forEach(c => {
          const name = (c.name || 'color').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          obj[name] = c.hex;
        });
        content = JSON.stringify(obj, null, 2);
        break;
      case 'cmyk':
        content = colors.map(c => {
          const cmyk = c.cmyk || hexToCmyk(c.hex);
          return `${c.name || 'Color'}: C${cmyk.c} M${cmyk.m} Y${cmyk.y} K${cmyk.k}`;
        }).join('\n');
        break;
    }

    navigator.clipboard.writeText(content);
    toast.success(`Copied ${colors.length} colors as ${format.toUpperCase()}`);
  };

  return (
    <SectionBlock
      id="colors"
      icon={<Palette size={14} />}
      title="Colors"
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={handleSave}
      onCancel={() => { form.reset(); setIsEditing(false); }}
      span={span as any}
      expandedContent={guideline.colors && guideline.colors.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {guideline.colors.map((c, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-neutral-950/30 border border-white/[0.04] hover:border-brand-cyan/20 transition-all cursor-pointer group/color"
              onClick={() => { navigator.clipboard.writeText(c.hex); toast.success(`Copied ${c.hex}`); }}
            >
              <div
                className="w-full aspect-square rounded-xl border border-white/5 shadow-lg group-hover/color:border-brand-cyan/30 transition-all relative overflow-hidden"
                style={{ backgroundColor: c.hex }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover/color:opacity-300 transition-opacity" />
              </div>
              <div className="text-center w-full">
                <p className="text-[12px] font-bold text-white uppercase tracking-tight truncate">{c.name || 'Color'}</p>
                <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-widest mt-0.5">{c.hex}</p>
                <p className="text-[10px] font-mono text-neutral-500 mt-0.5">
                  {(() => { const cmyk = c.cmyk || hexToCmyk(c.hex); return `C${cmyk.c} M${cmyk.m} Y${cmyk.y} K${cmyk.k}`; })()}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : undefined}
      actions={(
        <div className="flex items-center gap-1">
          {guideline.colors && guideline.colors.length >= 2 && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6 transition-colors",
                showWCAG ? "text-brand-cyan" : "text-neutral-500 hover:text-white"
              )}
              onClick={() => setShowWCAG(!showWCAG)}
              title="Check WCAG Compliance"
            >
              <ShieldCheck size={12} />
            </Button>
          )}
          {guideline.colors && guideline.colors.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white">
                  <Copy size={12} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[120px]">
                <DropdownMenuItem onClick={() => copyAllColors('json')} className="text-xs font-mono">
                  JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copyAllColors('css')} className="text-xs font-mono">
                  CSS Variables
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copyAllColors('tailwind')} className="text-xs font-mono">
                  Tailwind
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copyAllColors('cmyk')} className="text-xs font-mono">
                  CMYK
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white"
            onClick={() => {
              if (!isEditing) setIsEditing(true);
              append({ hex: '#000000', name: 'New Color' });
            }}>
            <Plus size={12} />
          </Button>
        </div>
      )}
    >
      <div className="py-2">
        {isEditing ? (
          <div className="grid grid-cols-1 gap-3 pt-2">
            {fields.map((field, i) => (
              <div key={field.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] group/color relative hover:border-brand-cyan/20 transition-all">
                <div className="relative w-10 h-10 shrink-0">
                  <div
                    className="w-full h-full rounded-lg border border-white/10 shadow-lg relative overflow-hidden"
                    style={{ backgroundColor: form.watch(`colors.${i}.hex`) }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                  </div>
                  <input
                    type="color"
                    value={form.watch(`colors.${i}.hex`) || '#000000'}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      form.setValue(`colors.${i}.hex`, val, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true
                      });
                    }}
                    onInput={(e) => {
                      const val = (e.target as HTMLInputElement).value.toUpperCase();
                      form.setValue(`colors.${i}.hex`, val, {
                        shouldDirty: true,
                        shouldValidate: true
                      });
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <Input
                    {...form.register(`colors.${i}.name`)}
                    className="h-7 bg-transparent border-none p-0 text-[11px] font-bold text-white focus-visible:ring-0 uppercase tracking-tight placeholder:text-neutral-700"
                    placeholder="Color name"
                  />
                  <Input
                    {...form.register(`colors.${i}.hex`)}
                    className="h-6 bg-transparent border-none p-0 text-[10px] font-mono text-brand-cyan/70 focus-visible:ring-0 uppercase  placeholder:text-neutral-700"
                    placeholder="#000000"
                  />
                  <p className="text-[10px] font-mono text-neutral-600 pl-0">
                    {(() => { try { const cmyk = hexToCmyk(form.watch(`colors.${i}.hex`) || '#000000'); return `CMYK ${cmyk.c}/${cmyk.m}/${cmyk.y}/${cmyk.k}`; } catch { return ''; } })()}
                  </p>
                </div>
                <Button variant="ghost" size="icon"
                  className="h-7 w-7 rounded-lg text-neutral-700 hover:text-red-400 opacity-0 group-hover/color:opacity-100 transition-all hover:bg-red-400/10 shrink-0"
                  onClick={() => remove(i)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
            {fields.length === 0 && (
              <div className="py-8 text-center opacity-40  text-[10px] font-mono tracking-widest uppercase">
                Click + to add colors
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 h-full w-full flex-1">
            {guideline.colors && guideline.colors.length > 0 ? (
              guideline.colors.map((c, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -2, scale: 1.02 }}
                  className="flex flex-col items-center gap-2 group/color p-3 rounded-xl transition-all duration-300 cursor-pointer hover:bg-white/[0.02]"
                  onClick={() => {
                    navigator.clipboard.writeText(c.hex);
                    toast.success(`Copied ${c.hex}`);
                  }}
                >
                  <div
                    className="w-full aspect-square max-w-[64px] rounded-xl border border-white/5 shadow-lg group-hover/color:border-white/10 transition-all duration-300 relative overflow-hidden"
                    style={{ backgroundColor: c.hex }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover/color:opacity-300 transition-opacity" />
                  </div>
                  <div className="text-center min-w-0 w-full">
                    <p className="text-[11px] font-bold text-white uppercase tracking-tight truncate">{c.name || 'Color'}</p>
                    <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">{c.hex}</p>
                    <p className="text-[10px] font-mono text-neutral-500 mt-1 uppercase">
                      {(() => { const cmyk = c.cmyk || hexToCmyk(c.hex); return `C${cmyk.c} M${cmyk.m} Y${cmyk.y} K${cmyk.k}`; })()}
                    </p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="grid grid-cols-2 gap-3 w-full h-full min-h-[160px] flex-1">
                {[
                  { name: 'Primary', color: 'bg-neutral-900/40' },
                  { name: 'Secondary', color: 'bg-neutral-900/30' },
                  { name: 'Accent', color: 'bg-neutral-800/20' },
                  { name: 'Surface', color: 'bg-neutral-800/10' },
                ].map((p, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-white/[0.02] bg-white/[0.01] opacity-60 h-full w-full cursor-pointer hover:bg-white/[0.03] transition-colors"
                    onClick={() => {
                      setIsEditing(true);
                      append({ hex: '#000000', name: p.name });
                    }}
                  >
                    <div className={cn("w-full aspect-square max-w-[56px] rounded-lg border border-dashed border-white/10", p.color)} />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* WCAG Contrast Matrix Panel */}
      <AnimatePresence>
        {showWCAG && contrastMatrix.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={12} className="text-brand-cyan" />
                  <span className="text-[11px] font-mono text-neutral-300 uppercase tracking-[0.1em]">
                    WCAG Contrast Matrix
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-neutral-600 hover:text-white"
                  onClick={() => setShowWCAG(false)}
                >
                  <X size={10} />
                </Button>
              </div>

              <div className="space-y-2">
                {contrastMatrix.map((pair, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] border border-white/[0.03]"
                  >
                    {/* Color swatches */}
                    <div className="flex items-center gap-1">
                      <div
                        className="w-6 h-6 rounded border border-white/10"
                        style={{ backgroundColor: pair.fg }}
                        title={pair.fgName}
                      />
                      <span className="text-[10px] text-neutral-600">/</span>
                      <div
                        className="w-6 h-6 rounded border border-white/10"
                        style={{ backgroundColor: pair.bg }}
                        title={pair.bgName}
                      />
                    </div>

                    {/* Names */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono text-neutral-300 truncate tracking-tight">
                        {pair.fgName} / {pair.bgName}
                      </p>
                    </div>

                    {/* Ratio */}
                    <span className="text-[11px] font-mono text-white tabular-nums">
                      {pair.ratio.toFixed(2)}:1
                    </span>

                    {/* Badges */}
                    <div className="flex items-center gap-1">
                      {pair.wcagAAA ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-500/20 text-green-400 border border-green-500/30">
                          AAA
                        </span>
                      ) : pair.wcagAA ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30">
                          AA
                        </span>
                      ) : pair.largeAA ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          AA Large
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
                          Fail
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                <span><span className="text-green-400 font-bold">AAA</span> 7:1+</span>
                <span><span className="text-brand-cyan font-bold">AA</span> 4.5:1+</span>
                <span><span className="text-amber-400 font-bold">AA LG</span> 3:1+</span>
                <span><span className="text-red-400 font-bold">FAIL</span> &lt;3:1</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SectionBlock>
  );
};
