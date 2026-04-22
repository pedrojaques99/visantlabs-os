import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { identitySchema } from '@/schemas/brandGuideline.schema';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { FileText, RefreshCw, Diamond, Trash2, Loader2, Plus, Globe, Instagram, Linkedin, Briefcase, Twitter } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface IdentitySectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  onReIngest?: () => void;
  onOpenWizard?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  span?: string;
  rowSpan?: string;
}

export const IdentitySection: React.FC<IdentitySectionProps> = ({
  guideline,
  onUpdate,
  onReIngest,
  onOpenWizard,
  onDelete,
  isDeleting,
  span,
  rowSpan,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const form = useForm({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      name: guideline.identity?.name || guideline.name || '',
      website: guideline.identity?.website || '',
      portfolio: guideline.identity?.portfolio || '',
      instagram: guideline.identity?.instagram || '',
      linkedin: guideline.identity?.linkedin || '',
      x: guideline.identity?.x || '',
      tagline: guideline.identity?.tagline || guideline.tagline || '',
      description: guideline.identity?.description || guideline.description || '',
    },
  });

  useEffect(() => {
    form.reset({
      name: guideline.identity?.name || guideline.name || '',
      website: guideline.identity?.website || '',
      portfolio: guideline.identity?.portfolio || '',
      instagram: guideline.identity?.instagram || '',
      linkedin: guideline.identity?.linkedin || '',
      x: guideline.identity?.x || '',
      tagline: guideline.identity?.tagline || guideline.tagline || '',
      description: guideline.identity?.description || guideline.description || '',
    });
  }, [guideline.id]);

  const handleSave = form.handleSubmit((data) => {
    onUpdate({
      identity: { ...guideline.identity, ...data },
      // Keep flat fields in sync for backwards compat
      ...data,
    });
    setIsEditing(false);
  });

  const socialLinks = [
    { key: 'website', icon: <Globe size={16} />, label: 'Website', value: guideline.identity?.website },
    { key: 'portfolio', icon: <Briefcase size={16} />, label: 'Portfolio', value: guideline.identity?.portfolio },
    { key: 'instagram', icon: <Instagram size={16} />, label: 'Instagram', value: guideline.identity?.instagram },
    { key: 'linkedin', icon: <Linkedin size={16} />, label: 'LinkedIn', value: guideline.identity?.linkedin },
    { key: 'x', icon: <Twitter size={16} />, label: 'X (Twitter)', value: guideline.identity?.x },
  ].filter(link => link.value);

  const primaryLogo = guideline.logos?.find(l => l.variant === 'primary') || guideline.logos?.[0];

  return (
    <SectionBlock
      id="identity"
      icon={<FileText size={16} />}
      title="Identity"
      isEditing={isEditing}
      onEdit={() => setIsEditing(true)}
      onSave={handleSave}
      onCancel={() => { form.reset(); setIsEditing(false); }}
      span={span as any}
      rowSpan={rowSpan as any}
      actions={(
        <Button variant="ghost" size="icon" aria-label="Add item" className="h-6 w-6 text-neutral-500 hover:text-white"
          onClick={() => {
            if (!isEditing) setIsEditing(true);
          }}>
          <Plus size={12} aria-hidden="true" />
        </Button>
      )}
    >
      <div className="flex flex-col gap-4 py-2">
        {isEditing ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5 min-w-0">
              <MicroTitle className="text-[11px] opacity-60 uppercase tracking-widest text-neutral-400">Brand Name</MicroTitle>
              <Input
                {...form.register('name')}
                className="h-8 text-sm font-semibold bg-neutral-900/50 border-white/5 text-white placeholder:text-neutral-700 focus:border-brand-cyan/20"
                placeholder="Enter Brand Name"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <MicroTitle className="text-[11px] opacity-60 uppercase tracking-widest text-neutral-400">Website</MicroTitle>
                <Input
                  {...form.register('website')}
                  className="h-7 text-[10px] font-mono bg-neutral-900/50 border-white/5 text-neutral-300 focus:border-brand-cyan/20"
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <MicroTitle className="text-[11px] opacity-60 uppercase tracking-widest text-neutral-400">Portfolio</MicroTitle>
                <Input
                  {...form.register('portfolio')}
                  className="h-7 text-[10px] font-mono bg-neutral-900/50 border-white/5 text-neutral-300 focus:border-brand-cyan/20"
                  placeholder="Portfolio URL"
                />
              </div>
              <div className="space-y-1.5">
                <MicroTitle className="text-[11px] opacity-60 uppercase tracking-widest text-neutral-400">Instagram</MicroTitle>
                <Input
                  {...form.register('instagram')}
                  className="h-7 text-[10px] font-mono bg-neutral-900/50 border-white/5 text-neutral-300 focus:border-brand-cyan/20"
                  placeholder="@handle or URL"
                />
              </div>
              <div className="space-y-1.5">
                <MicroTitle className="text-[11px] opacity-60 uppercase tracking-widest text-neutral-400">LinkedIn</MicroTitle>
                <Input
                  {...form.register('linkedin')}
                  className="h-7 text-[10px] font-mono bg-neutral-900/50 border-white/5 text-neutral-300 focus:border-brand-cyan/20"
                  placeholder="LinkedIn Profile"
                />
              </div>
              <div className="space-y-1.5">
                <MicroTitle className="text-[11px] opacity-60 uppercase tracking-widest text-neutral-400">X (Twitter)</MicroTitle>
                <Input
                  {...form.register('x')}
                  className="h-7 text-[10px] font-mono bg-neutral-900/50 border-white/5 text-neutral-300 focus:border-brand-cyan/20"
                  placeholder="X Profile"
                />
              </div>
            </div>

            <div className="space-y-1.5 min-w-0">
              <MicroTitle className="text-[11px] opacity-60 uppercase tracking-widest text-neutral-400">Tagline</MicroTitle>
              <Input
                {...form.register('tagline')}
                className="h-7 text-[10px] font-mono bg-neutral-900/50 border-white/5 text-neutral-300 focus:border-brand-cyan/20"
                placeholder="Brand Tagline"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <MicroTitle className="text-[11px] opacity-60 uppercase tracking-widest text-neutral-400">Description</MicroTitle>
              <Textarea
                {...form.register('description')}
                className="min-h-[80px] text-[11px] leading-relaxed bg-neutral-900/50 border-white/5 text-neutral-300 focus:border-brand-cyan/20 py-2"
                placeholder="Brand description and values..."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4 px-2">
            <div className="flex flex-col md:flex-row md:items-start gap-8">
              {primaryLogo && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-24 h-24 md:w-32 md:h-32 flex items-center justify-center p-4 rounded-3xl bg-neutral-900/50 border border-white/5 shadow-2xl relative group/logo overflow-hidden"
                >
                  <div className="absolute inset-0 bg-brand-cyan/5 opacity-0 group-hover/logo:opacity-100 transition-opacity" />
                  <img
                    src={primaryLogo.url}
                    alt="Brand Logo"
                    className="max-w-full max-h-full object-contain filter drop-shadow-lg relative z-10"
                  />
                </motion.div>
              )}
              <div className="relative flex-1">
                <div className="space-y-2">
                  <h2 className="text-4xl md:text-5xl font-semibold text-white leading-none tracking-tight">
                    {guideline.identity?.name || guideline.name || 'Company'}
                  </h2>

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    {(guideline.identity?.tagline || guideline.tagline) && (
                      <p className="text-[11px] font-mono text-brand-cyan uppercase tracking-widest opacity-90">
                        {guideline.identity?.tagline || guideline.tagline}
                      </p>
                    )}

                    {socialLinks.length > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-[1px] bg-white/10 mx-1" />
                        {socialLinks.map((link) => (
                          <a
                            key={link.key}
                            href={link.value?.startsWith('http') ? link.value : `https://${link.value}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neutral-400 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-md"
                            title={link.label}
                          >
                            {link.icon}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="h-[1px] w-12 bg-white/10" />
              <p className="text-[13px] md:text-[14px] text-neutral-400 leading-relaxed max-w-xl font-medium tracking-tight">
                {guideline.identity?.description || guideline.description || 'Define your brand essence and core values here.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
