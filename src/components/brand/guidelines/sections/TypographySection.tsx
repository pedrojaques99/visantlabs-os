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
  span?: string;
}

export const TypographySection: React.FC<TypographySectionProps> = ({ guideline, onUpdate, span }) => {
  const [isEditing, setIsEditing] = useState(false);
  const form = useForm({
    resolver: zodResolver(typographyFormSchema),
    defaultValues: {
      typography: (guideline.typography || []).map((t) => ({
        family: t.family,
        role: t.role || 'Body',
        style: t.style || 'Regular',
        size: t.size || 16,
      }))
    },
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
      span={span as any}
      expandedContent={guideline.typography && guideline.typography.length > 0 ? (
        <div className="space-y-6">
          {guideline.typography.map((f, i) => (
            <div key={i} className="flex items-center gap-6 p-5 rounded-2xl bg-neutral-950/30 border border-white/[0.04] hover:border-brand-cyan/20 transition-all">
              <span className="text-6xl font-bold text-white tracking-tighter shrink-0 w-24 text-center" style={{ fontFamily: f.family }}>
                Aa
              </span>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[11px] text-brand-cyan font-bold font-mono uppercase">{f.role || 'Primary'}</span>
                  <span className="text-[10px] text-neutral-600 font-mono bg-white/[0.03] px-2 py-1 rounded border border-white/5">{f.size || '16'}px</span>
                </div>
                <p className="text-[12px] text-neutral-400 font-mono">{f.family} · {f.style || 'Regular'}</p>
                <p className="text-lg text-neutral-300 mt-2" style={{ fontFamily: f.family }}>
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : undefined}
      actions={(
        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white"
          onClick={() => {
            if (!isEditing) setIsEditing(true);
            append({ family: 'Inter', role: 'Body', style: 'Regular', size: 16 });
          }}>
          <Plus size={12} />
        </Button>
      )}
    >
      <div className="space-y-6 py-2">
        {isEditing ? (
          <div className="space-y-4 pt-2">
            {fields.map((field, i) => (
              <div key={field.id} className="flex flex-col gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] group/font relative hover:border-brand-cyan/20 transition-all shadow-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <MicroTitle className="text-[9px] opacity-40 uppercase pl-1">Label / Role</MicroTitle>
                    <Input
                      {...form.register(`typography.${i}.role`)}
                      className="h-9 bg-neutral-900/50 border-white/5 text-[11px] font-mono text-white focus:border-brand-cyan/20 px-3"
                      placeholder="e.g. Primary Heading"
                    />
                  </div>
                  <div className="space-y-2">
                    <MicroTitle className="text-[9px] opacity-40 uppercase pl-1">Font Family</MicroTitle>
                    <GoogleFontPicker
                      value={form.watch(`typography.${i}.family`)}
                      onChange={(val) => form.setValue(`typography.${i}.family`, val)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <MicroTitle className="text-[9px] opacity-40 uppercase pl-1">Style</MicroTitle>
                    <Input
                      {...form.register(`typography.${i}.style`)}
                      className="h-9 bg-neutral-900/50 border-white/5 text-[10px] font-mono focus:border-brand-cyan/20 px-3"
                      placeholder="e.g. Regular, Bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <MicroTitle className="text-[9px] opacity-40 uppercase pl-1">Size (PX)</MicroTitle>
                    <Input
                      type="number"
                      {...form.register(`typography.${i}.size`, { valueAsNumber: true })}
                      className="h-9 bg-neutral-900/50 border-white/5 text-[10px] font-mono focus:border-brand-cyan/20 px-3"
                      placeholder="px"
                    />
                  </div>
                </div>
                <Button variant="ghost" size="icon"
                  className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-neutral-900 border border-white/10 text-neutral-600 hover:text-red-400 opacity-0 group-hover/font:opacity-100 transition-all hover:scale-110 shadow-2xl"
                  onClick={() => remove(i)}>
                  <X size={12} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {guideline.typography && guideline.typography.length > 0 ? (
              <div className="space-y-4">
                {guideline.typography.map((f, i) => (
                  <div key={i} className="flex items-center gap-4 group/font p-3 rounded-xl hover:bg-white/[0.02] transition-all duration-300 border border-transparent hover:border-white/[0.03]">
                    <span className="text-4xl md:text-5xl font-bold text-white group-hover/font:text-brand-cyan transition-colors duration-300 tracking-tighter shrink-0 w-16 text-center" style={{ fontFamily: f.family }}>
                      Aa
                    </span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-brand-cyan font-bold font-mono uppercase opacity-70">{f.role || 'Primary'}</span>
                        <span className="text-[9px] text-neutral-700 font-mono bg-white/[0.02] px-1.5 py-0.5 rounded border border-white/5">{f.size || '16'}px</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 font-mono truncate">{f.family} · {f.style || 'Regular'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4 w-full h-full flex-1 opacity-30">
                {[
                  { role: 'Heading / Display', size: '48px', weight: 'Bold' },
                  { role: 'Body / Sans', size: '16px', weight: 'Regular' },
                ].map((p, i) => (
                  <div 
                    key={i} 
                    className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.02] bg-white/[0.01] flex-1 cursor-pointer hover:bg-white/[0.03] transition-colors"
                    onClick={() => {
                        setIsEditing(true);
                        append({ family: 'Inter', role: p.role === 'Heading / Display' ? 'Heading' : 'Body', style: p.weight, size: parseInt(p.size.replace('px', '')) });
                    }}
                  >
                    <div className="w-12 h-12 flex items-center justify-center rounded-lg border border-dashed border-white/5 text-neutral-800 font-bold text-xl">
                      Aa
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-600 font-bold">{p.role}</p>
                      <p className="text-[8px] font-mono text-neutral-800 uppercase">{p.size} · {p.weight}</p>
                    </div>
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
