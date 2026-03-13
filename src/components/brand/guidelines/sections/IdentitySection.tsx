import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { identitySchema } from '@/schemas/brandGuideline.schema';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { FileText, RefreshCw, Wand2, Trash2, Loader2, Plus } from 'lucide-react';
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
      tagline: guideline.identity?.tagline || guideline.tagline || '',
      description: guideline.identity?.description || guideline.description || '',
    },
  });

  useEffect(() => {
    form.reset({
      name: guideline.identity?.name || guideline.name || '',
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
        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white"
          onClick={() => {
            if (!isEditing) setIsEditing(true);
          }}>
          <Plus size={12} />
        </Button>
      )}
    >
      <div className="flex flex-col gap-4 py-2">
        {isEditing ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5 min-w-0">
              <MicroTitle className="text-[9px] opacity-40 uppercase">Brand Name</MicroTitle>
              <Input
                {...form.register('name')}
                className="h-8 text-sm font-semibold bg-neutral-850 border-white/5 text-white placeholder:text-neutral-800"
                placeholder="Enter Brand Name"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <MicroTitle className="text-[9px] opacity-40 uppercase">Tagline</MicroTitle>
              <Input
                {...form.register('tagline')}
                className="h-7 text-[10px] font-mono bg-neutral-850 border-white/5 text-neutral-400 placeholder:text-neutral-800"
                placeholder="Brand Tagline"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <MicroTitle className="text-[9px] opacity-40 uppercase">Description</MicroTitle>
              <Textarea
                {...form.register('description')}
                className="min-h-[80px] text-[11px] leading-relaxed bg-neutral-850 border-white/5 text-neutral-500 placeholder:text-neutral-800 py-2"
                placeholder="Brand description and values..."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-8 py-6 px-2">
            <div className="relative">
              <div className="space-y-2">
                <h2 className="text-4xl md:text-5xl font-semibold text-white leading-none transition-colors duration-700">
                  {guideline.identity?.name || guideline.name || 'Company' || 'Untitled Brand'}
                </h2>
                {(guideline.identity?.tagline || guideline.tagline) && (
                  <p className="text-xs font-mono text-brand-cyan uppercase tracking-[0.4em] opacity-80 pt-1">
                    {guideline.identity?.tagline || guideline.tagline}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="h-[1px] w-12 bg-white/10" />
              <p className="text-sm md:text-base text-neutral-400 leading-relaxed max-w-xl font-medium tracking-tight">
                {guideline.identity?.description || guideline.description || 'Define your brand essence and core values here. This space represents the identity that drives every visual decision.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
