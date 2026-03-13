import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { colorSchema } from '@/schemas/brandGuideline.schema';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Palette, Plus, Trash2, Tag } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';

const colorsFormSchema = z.object({ colors: z.array(colorSchema) });

interface ColorsSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
}

export const ColorsSection: React.FC<ColorsSectionProps> = ({ guideline, onUpdate }) => {
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

  return (
    <SectionBlock
      id="colors"
      icon={<Palette size={14} />}
      title="Colors"
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={handleSave}
      onCancel={() => { form.reset(); setIsEditing(false); }}
      actions={isEditing ? (
        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white"
          onClick={() => append({ hex: '#000000', name: 'New Color' })}>
          <Plus size={12} />
        </Button>
      ) : undefined}
    >
      <div className="py-4">
        {isEditing ? (
          <div className="space-y-2 pt-2">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              {fields.map((field, i) => (
                <div key={field.id} className="flex gap-4 items-center group/color relative py-2">
                  <div className="relative shrink-0">
                    <input
                      type="color"
                      {...form.register(`colors.${i}.hex`)}
                      className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent overflow-hidden hover:scale-110 transition-transform"
                    />
                  </div>
                  <div className="flex-1 flex items-center gap-4 min-w-0">
                    <Input
                      {...form.register(`colors.${i}.name`)}
                      className="h-8 text-[11px] font-mono bg-transparent border-none p-0 focus-visible:ring-0 opacity-60 hover:opacity-100 transition-opacity w-1/2"
                      placeholder="Color name"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-[9px] font-mono text-neutral-600 opacity-40 uppercase shrink-0">Hex:</span>
                      <Input
                        {...form.register(`colors.${i}.hex`)}
                        className="h-8 text-[11px] font-mono bg-transparent border-none p-0 focus-visible:ring-0 text-brand-cyan"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon"
                    className="h-6 w-6 rounded-full text-neutral-700 hover:text-red-400 opacity-0 group-hover/color:opacity-100 transition-all hover:bg-red-400/10"
                    onClick={() => remove(i)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {guideline.colors && guideline.colors.length > 0 ? (
              guideline.colors.slice(0, 8).map((c, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -4 }}
                  className="flex flex-col gap-2 group/color cursor-pointer"
                  onClick={() => {
                    navigator.clipboard.writeText(c.hex);
                    toast.success(`Copied ${c.hex}`);
                  }}
                >
                  <div
                    className="aspect-square rounded-2xl border border-white/5 shadow-xl group-hover/color:border-brand-cyan/40 group-hover/color:shadow-brand-cyan/10 transition-all duration-500 relative overflow-hidden"
                    style={{ backgroundColor: c.hex }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover/color:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/color:opacity-100 transition-all scale-75 group-hover/color:scale-100">
                      <Tag size={12} className="text-white mix-blend-difference" />
                    </div>
                  </div>
                  <div className="px-1 space-y-0.5">
                    <p className="text-[9px] font-bold text-white/90 truncate uppercase tracking-tighter">{c.name || 'Color'}</p>
                    <p className="text-[8px] font-mono text-neutral-600 group-hover:text-brand-cyan/60 transition-colors uppercase tracking-[0.1em]">{c.hex}</p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-4 w-full py-12 text-center opacity-10 italic text-[10px] font-mono tracking-widest uppercase">No Palette</div>
            )}
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
