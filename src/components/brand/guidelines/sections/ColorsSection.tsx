import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { colorSchema } from '@/schemas/brandGuideline.schema';
import { SectionBlock } from '../SectionBlock';
import { cn } from '@/lib/utils';
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
      actions={(
        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white"
          onClick={() => {
            if (!isEditing) setIsEditing(true);
            append({ hex: '#000000', name: 'New Color' });
          }}>
          <Plus size={12} />
        </Button>
      )}
    >
      <div className="py-2">
        <div className="grid grid-cols-1 gap-1">
          {(isEditing ? fields : (guideline.colors || [])).map((c, i) => {
            const colorValue = isEditing ? form.watch(`colors.${i}.hex`) : (c as any).hex;
            const nameValue = isEditing ? form.watch(`colors.${i}.name`) : (c as any).name;

            return (
              <div
                key={isEditing ? (c as any).id : i}
                className={cn(
                  "flex items-center gap-4 group/color p-2 rounded-2xl transition-all duration-500",
                  !isEditing && "cursor-pointer hover:bg-white/[0.02] hover:translate-x-1"
                )}
                onClick={() => {
                  if (!isEditing) {
                    navigator.clipboard.writeText(colorValue);
                    toast.success(`Copied ${colorValue}`);
                  }
                }}
              >
                <div className="relative w-12 h-12 shrink-0">
                  <div
                    className="w-full h-full rounded-xl border border-white/5 shadow-2xl relative overflow-hidden transition-all duration-500"
                    style={{ backgroundColor: colorValue }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-30" />
                  </div>
                  {isEditing && (
                    <input
                      type="color"
                      {...form.register(`colors.${i}.hex`)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-0.5">
                  {isEditing ? (
                    <>
                      <Input
                        {...form.register(`colors.${i}.name`)}
                        className="h-6 text-[11px] font-bold text-white bg-transparent border-none p-0 focus-visible:ring-0 uppercase tracking-tight placeholder:text-neutral-700"
                        placeholder="Color Name"
                      />
                      <Input
                        {...form.register(`colors.${i}.hex`)}
                        className="h-5 text-[9px] font-mono text-neutral-500 bg-transparent border-none p-0 focus-visible:ring-0 uppercase tracking-widest placeholder:text-neutral-700"
                        placeholder="#000000"
                      />
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-bold text-white uppercase tracking-tight truncate">{nameValue || 'Color'}</p>
                      <p className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">{colorValue}</p>
                    </>
                  )}
                </div>

                {isEditing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl text-neutral-700 hover:text-red-400 opacity-0 group-hover/color:opacity-100 transition-all hover:bg-red-400/10 shrink-0"
                    onClick={() => remove(i)}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            );
          })}

          {(!isEditing && (!guideline.colors || guideline.colors.length === 0)) && (
            <div className="py-12 text-center opacity-10 italic text-[10px] font-mono tracking-widest uppercase border border-dashed border-white/5 rounded-3xl">
              No Palette Defined
            </div>
          )}

          {(isEditing && fields.length === 0) && (
            <div className="py-12 text-center opacity-20 italic text-[10px] font-mono tracking-widest uppercase">
              Click + to add colors
            </div>
          )}
        </div>
      </div>
    </SectionBlock>
  );
};
