import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { typographySchema } from '@/schemas/brandGuideline.schema';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { GoogleFontPicker } from '@/components/ui/GoogleFontPicker';
import { Type, Plus, X } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

const typographyFormSchema = z.object({ typography: z.array(typographySchema) });

interface TypographySectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
}

export const TypographySection: React.FC<TypographySectionProps> = ({ guideline, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const form = useForm({
    resolver: zodResolver(typographyFormSchema),
    defaultValues: { typography: guideline.typography || [] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'typography' });

  useEffect(() => {
    form.reset({ typography: guideline.typography || [] });
  }, [guideline.id]);

  const handleSave = form.handleSubmit((data) => {
    onUpdate({ typography: data.typography });
    setIsEditing(false);
  });

  return (
    <SectionBlock
      id="typography"
      icon={<Type size={14} />}
      title="Typography"
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={handleSave}
      onCancel={() => { form.reset(); setIsEditing(false); }}
      actions={isEditing ? (
        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white"
          onClick={() => append({ family: 'Inter', role: 'body font', style: 'Regular', size: 16 })}>
          <Plus size={12} />
        </Button>
      ) : undefined}
    >
      <div className="space-y-6 py-2">
        {isEditing ? (
          <div className="space-y-4 pt-2">
            {fields.map((field, i) => (
              <div key={field.id} className="flex flex-col gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] group/font relative hover:border-brand-cyan/20 transition-all">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <MicroTitle className="text-[9px] opacity-40 uppercase tracking-widest">Label / Role</MicroTitle>
                    <Input
                      {...form.register(`typography.${i}.role`)}
                      className="h-9 bg-neutral-850 border-white/5 text-[11px] font-mono text-white"
                      placeholder="e.g. Primary Heading"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <MicroTitle className="text-[9px] opacity-40 uppercase tracking-widest">Font Family</MicroTitle>
                    <GoogleFontPicker
                      value={form.watch(`typography.${i}.family`)}
                      onChange={(val) => form.setValue(`typography.${i}.family`, val)}
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1.5">
                    <MicroTitle className="text-[9px] opacity-40 uppercase tracking-widest">Style</MicroTitle>
                    <Input
                      {...form.register(`typography.${i}.style`)}
                      className="h-8 bg-neutral-850 border-white/5 text-[10px] font-mono"
                      placeholder="e.g. Regular, Bold"
                    />
                  </div>
                  <div className="w-20 space-y-1.5">
                    <MicroTitle className="text-[9px] opacity-40 uppercase tracking-widest">Size</MicroTitle>
                    <Input
                      type="number"
                      {...form.register(`typography.${i}.size`, { valueAsNumber: true })}
                      className="h-8 bg-neutral-850 border-white/5 text-[10px] font-mono"
                      placeholder="px"
                    />
                  </div>
                </div>
                <Button variant="ghost" size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-neutral-850 border border-white/10 text-neutral-600 hover:text-red-400 opacity-0 group-hover/font:opacity-100 transition-opacity"
                  onClick={() => remove(i)}>
                  <X size={10} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <>
            {guideline.typography && guideline.typography.length > 0 ? (
              <div className="space-y-8">
                {guideline.typography.slice(0, 3).map((f, i) => (
                  <div key={i} className="flex flex-col group/font border-l-2 border-white/[0.03] pl-5 py-0.5 hover:border-brand-cyan/40 transition-all duration-500">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] text-neutral-600 font-mono tracking-[0.2em] uppercase font-bold opacity-40">{f.role}</span>
                      <div className="h-[1px] flex-1 bg-white/[0.02] mx-4" />
                      <span className="text-[9px] text-neutral-700 font-mono">{f.size || '16'}PX</span>
                    </div>
                    <span className="text-3xl font-bold text-white group-hover:text-brand-cyan transition-colors tracking-tight mb-1" style={{ fontFamily: f.family }}>
                      {f.family}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-neutral-500 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/5">{f.style || 'Regular'}</span>
                      <span className="text-[10px] text-neutral-700 font-mono opacity-40 italic">The quick brown fox jumps over the lazy dog.</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center opacity-10 italic text-[10px] font-mono tracking-widest uppercase">No Fonts</div>
            )}
          </>
        )}
      </div>
    </SectionBlock>
  );
};
