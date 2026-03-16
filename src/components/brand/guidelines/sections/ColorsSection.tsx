import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { colorSchema } from '@/schemas/brandGuideline.schema';
import { SectionBlock } from '../SectionBlock';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Palette, Plus, Trash2, Copy } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';

const colorsFormSchema = z.object({ colors: z.array(colorSchema) });

interface ColorsSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const ColorsSection: React.FC<ColorsSectionProps> = ({ guideline, onUpdate, span }) => {
  const [isEditing, setIsEditing] = useState(false);
  const form = useForm({
    resolver: zodResolver(colorsFormSchema),
    defaultValues: { colors: guideline.colors || [] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'colors' });

  useEffect(() => {
    form.reset({ colors: guideline.colors || [] });
  }, [guideline.id]);

  const handleSave = form.handleSubmit((data) => {
    onUpdate({ colors: data.colors });
    setIsEditing(false);
  });

  const copyAllColors = (format: 'json' | 'css' | 'tailwind') => {
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
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover/color:opacity-100 transition-opacity" />
              </div>
              <div className="text-center w-full">
                <p className="text-[11px] font-bold text-white uppercase tracking-tight truncate">{c.name || 'Color'}</p>
                <p className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest mt-0.5">{c.hex}</p>
              </div>
            </div>
          ))}
        </div>
      ) : undefined}
      actions={(
        <div className="flex items-center gap-1">
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
                    {...form.register(`colors.${i}.hex`)}
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
                </div>
                <Button variant="ghost" size="icon"
                  className="h-7 w-7 rounded-lg text-neutral-700 hover:text-red-400 opacity-0 group-hover/color:opacity-100 transition-all hover:bg-red-400/10 shrink-0"
                  onClick={() => remove(i)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
            {fields.length === 0 && (
              <div className="py-8 text-center opacity-20 italic text-[10px] font-mono tracking-widest uppercase">
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
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover/color:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-center min-w-0 w-full">
                    <p className="text-[10px] font-bold text-white uppercase tracking-tight truncate">{c.name || 'Color'}</p>
                    <p className="text-[8px] font-mono text-neutral-600 uppercase tracking-widest">{c.hex}</p>
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
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-white/[0.02] bg-white/[0.01] opacity-40 h-full w-full cursor-pointer hover:bg-white/[0.03] transition-colors"
                    onClick={() => {
                        setIsEditing(true);
                        append({ hex: '#000000', name: p.name });
                    }}
                  >
                    <div className={cn("w-full aspect-square max-w-[56px] rounded-lg border border-dashed border-white/10", p.color)} />
                    <span className="text-[8px] font-mono uppercase tracking-widest text-neutral-600">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
