import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from '@/hooks/useTranslation';
import { typographySchema } from '@/schemas/brandGuideline.schema';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { GoogleFontPicker } from '@/components/ui/GoogleFontPicker';
import { Type, Plus, X, GripVertical, Trash2, Eye } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';
import { cn } from '@/lib/utils';

const typographyFormSchema = z.object({ typography: z.array(typographySchema) });

interface TypographySectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const TypographySection: React.FC<TypographySectionProps> = ({ guideline, onUpdate, span }) => {
  const { t } = useTranslation();
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
      icon={<Type size={14} className="text-brand-cyan" />}
      title={t('designSystem.tabs.typography')}
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={handleSave}
      onCancel={() => { form.reset(); setIsEditing(false); }}
      span={span as any}
      actions={(
        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white"
          onClick={() => {
            if (!isEditing) setIsEditing(true);
            append({ family: 'Inter', role: 'Main Header', style: 'Bold', size: 48 });
          }}>
          <Plus size={12} />
        </Button>
      )}
      expandedContent={guideline.typography && guideline.typography.length > 0 ? (
        <div className="space-y-8 p-4">
          {guideline.typography.map((f, i) => (
            <div key={i} className="flex flex-col md:flex-row md:items-center gap-8 p-8 rounded-3xl bg-neutral-950/40 border border-white/[0.03] hover:border-brand-cyan/20 transition-all group overflow-hidden relative">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Type size={120} className="text-brand-cyan -rotate-12 translate-x-12 translate-y-4" />
              </div>
              
              <div className="flex items-center justify-center shrink-0 w-32 h-32 rounded-2xl bg-white/[0.02] border border-white/[0.05] group-hover:bg-brand-cyan group-hover:text-black transition-all duration-500">
                <span className="text-7xl font-bold tracking-tighter" style={{ fontFamily: f.family }}>
                  Aa
                </span>
              </div>
              
              <div className="flex-1 min-w-0 space-y-4 relative z-10">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="px-3 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/20">
                    <span className="text-[10px] text-brand-cyan font-bold font-mono uppercase tracking-widest">{f.role || 'Primary'}</span>
                  </div>
                  <div className="px-2 py-1 rounded bg-white/[0.03] border border-white/5">
                     <span className="text-[10px] text-neutral-500 font-mono italic">{f.size || '16'}px</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-2xl font-medium text-white group-hover:text-brand-cyan transition-colors" style={{ fontFamily: f.family }}>
                    {f.family} {f.style || 'Regular'}
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-mono tracking-wide uppercase">
                    System / Digital Branding Token
                  </p>
                </div>

                <div className="pt-2">
                  <p className="text-3xl md:text-4xl text-neutral-400 group-hover:text-neutral-200 transition-colors leading-tight" style={{ fontFamily: f.family, fontWeight: f.style?.toLowerCase().includes('bold') ? 700 : 400 }}>
                    The quick brown fox jumps over the lazy dog
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : undefined}
    >
      <div className="space-y-6">
        {isEditing ? (
          <div className="space-y-4 pt-2">
            {fields.map((field, i) => {
              const currentFamily = form.watch(`typography.${i}.family`);
              
              return (
                <div key={field.id} className="flex flex-col gap-6 p-6 rounded-2xl bg-white/[0.01] border border-white/[0.04] group/font relative hover:border-brand-cyan/30 transition-all shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Visual Preview Section */}
                    <div className="lg:w-24 shrink-0 flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-neutral-900/50 border border-white/5">
                       <span className="text-4xl font-bold text-white transition-all duration-500" style={{ fontFamily: currentFamily }}>
                        Aa
                      </span>
                      <MicroTitle className="text-[7px] text-neutral-600 uppercase">{t('mockup.typography.preview')}</MicroTitle>
                    </div>

                    <div className="flex-1 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <MicroTitle className="text-[9px] opacity-40 uppercase pl-1 tracking-widest">{t('mockup.typography.role')}</MicroTitle>
                          <Input
                            {...form.register(`typography.${i}.role`)}
                            className="bg-neutral-950/80 border-white/5 text-[11px] font-mono text-white focus:border-brand-cyan/30 focus:bg-neutral-950 transition-all h-10 rounded-xl"
                            placeholder="e.g. Primary Heading"
                          />
                        </div>
                        <div className="space-y-2">
                          <MicroTitle className="text-[9px] opacity-40 uppercase pl-1 tracking-widest">{t('mockup.typography.family')}</MicroTitle>
                          <GoogleFontPicker
                            value={currentFamily}
                            onChange={(val) => form.setValue(`typography.${i}.family`, val)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2 space-y-2">
                          <MicroTitle className="text-[9px] opacity-40 uppercase pl-1 tracking-widest">{t('mockup.typography.style')}</MicroTitle>
                          <Input
                            {...form.register(`typography.${i}.style`)}
                            className="bg-neutral-950/80 border-white/5 text-[10px] font-mono text-white focus:border-brand-cyan/30 focus:bg-neutral-950 h-10 rounded-xl"
                            placeholder="e.g. Regular, Bold, Black..."
                          />
                        </div>
                        <div className="space-y-2">
                          <MicroTitle className="text-[9px] opacity-40 uppercase pl-1 tracking-widest">{t('mockup.typography.size')}</MicroTitle>
                          <Input
                            type="number"
                            {...form.register(`typography.${i}.size`, { valueAsNumber: true })}
                            className="bg-neutral-950/80 border-white/5 text-[10px] font-mono text-white focus:border-brand-cyan/30 focus:bg-neutral-950 h-10 rounded-xl"
                            placeholder="px"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Absolute positioning for remove button - more discreet but accessible */}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 rounded-full text-neutral-700 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/font:opacity-100 transition-all"
                    onClick={() => remove(i)}
                    type="button"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              );
            })}
            
            <Button
              variant="outline"
              onClick={() => append({ family: 'Inter', role: 'Label', style: 'Regular', size: 12 })}
              className="w-full h-12 border-dashed border-white/10 hover:border-brand-cyan/30 bg-transparent text-neutral-500 hover:text-brand-cyan group transition-all rounded-2xl"
              type="button"
            >
              <Plus size={16} className="mr-2 group-hover:scale-125 transition-transform" />
              <span className="text-[10px] font-mono uppercase tracking-widest">{t('mockup.typography.addToken')}</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {guideline.typography && guideline.typography.length > 0 ? (
              <div className="space-y-1">
                {guideline.typography.map((f, i) => (
                  <div 
                    key={i} 
                    className="flex items-center gap-5 p-4 rounded-2xl bg-white/[0.01] hover:bg-white/[0.03] border border-transparent hover:border-white/5 group/row transition-all duration-500 cursor-pointer"
                    onClick={() => setIsEditing(true)}
                  >
                    <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-neutral-950/40 border border-white/5 group-hover/row:bg-brand-cyan group-hover/row:text-black transition-all duration-500 shrink-0">
                      <span className="text-2xl font-bold tracking-tighter" style={{ fontFamily: f.family }}>
                        Aa
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-brand-cyan font-bold font-mono uppercase tracking-tight">{f.role || 'Primary'}</span>
                        <div className="w-1 h-1 rounded-full bg-neutral-800" />
                        <span className="text-[10px] text-neutral-400 font-mono">{f.size || '16'}px</span>
                      </div>
                      <p className="text-sm font-medium text-neutral-200 truncate" style={{ fontFamily: f.family }}>
                        {f.family} <span className="text-neutral-500 font-normal ml-1">· {f.style || 'Regular'}</span>
                      </p>
                    </div>

                    <div className="opacity-0 group-hover/row:opacity-100 transition-opacity">
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-700">
                          <Eye size={14} />
                       </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-40">
                {[
                  { role: 'Heading / 01', size: '64px', weight: 'Bold', family: 'Inter' },
                  { role: 'Paragraph / Sans', size: '16px', weight: 'Regular', family: 'Inter' },
                ].map((p, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-4 p-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.03] hover:border-brand-cyan/20 transition-all cursor-pointer group"
                    onClick={() => {
                      setIsEditing(true);
                      append({ family: p.family, role: p.role, style: p.weight, size: parseInt(p.size.replace('px', '')) });
                    }}
                  >
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg border border-white/5 text-neutral-700 text-xl font-bold group-hover:text-brand-cyan transition-colors">
                      Aa
                    </div>
                    <div className="space-y-1">
                      <MicroTitle className="text-[10px] uppercase tracking-widest text-neutral-400">{p.role}</MicroTitle>
                      <p className="text-[10px] font-mono text-neutral-500 uppercase">{p.family} · {p.weight} · {p.size}</p>
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
