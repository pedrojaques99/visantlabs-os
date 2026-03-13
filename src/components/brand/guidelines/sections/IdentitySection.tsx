import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { identitySchema } from '@/schemas/brandGuideline.schema';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { FileText, RefreshCw, Wand2, Trash2, Loader2 } from 'lucide-react';
import type { BrandGuideline } from '@/lib/figma-types';

interface IdentitySectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  onReIngest?: () => void;
  onOpenWizard?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

export const IdentitySection: React.FC<IdentitySectionProps> = ({
  guideline,
  onUpdate,
  onReIngest,
  onOpenWizard,
  onDelete,
  isDeleting,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const form = useForm({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      name: guideline.name || '',
      tagline: guideline.tagline || '',
      description: guideline.description || '',
    },
  });

  useEffect(() => {
    form.reset({
      name: guideline.name || '',
      tagline: guideline.tagline || '',
      description: guideline.description || '',
    });
  }, [guideline.id]);

  const handleSave = form.handleSubmit((data) => {
    onUpdate(data);
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
    >
      <div className="flex flex-col gap-4 py-2">
        {isEditing ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5 min-w-0">
              <MicroTitle className="text-[9px] opacity-40 uppercase tracking-widest">Brand Name</MicroTitle>
              <Input
                {...form.register('name')}
                className="h-8 text-sm font-semibold bg-neutral-850 border-white/5 text-white placeholder:text-neutral-800"
                placeholder="Enter Brand Name"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <MicroTitle className="text-[9px] opacity-40 uppercase tracking-widest">Tagline</MicroTitle>
              <Input
                {...form.register('tagline')}
                className="h-7 text-[10px] font-mono bg-neutral-850 border-white/5 text-neutral-400 placeholder:text-neutral-800"
                placeholder="Brand Tagline"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <MicroTitle className="text-[9px] opacity-40 uppercase tracking-widest">Description</MicroTitle>
              <Textarea
                {...form.register('description')}
                className="min-h-[80px] text-[11px] leading-relaxed bg-neutral-850 border-white/5 text-neutral-500 placeholder:text-neutral-800 py-2"
                placeholder="Brand description and values..."
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white truncate px-1">
                {guideline.name || 'Untitled Brand'}
              </h2>
              {guideline.tagline && (
                <p className="text-[10px] font-mono text-neutral-600 px-1 border-l border-brand-cyan/20 ml-1">
                  {guideline.tagline}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              {onReIngest && (
                <Button variant="ghost" size="icon" onClick={onReIngest}
                  className="h-8 w-8 text-neutral-800 hover:text-brand-cyan hover:bg-brand-cyan/10 transition-all">
                  <RefreshCw size={13} />
                </Button>
              )}
              {onOpenWizard && (
                <Button variant="ghost" size="icon" onClick={onOpenWizard}
                  className="h-8 w-8 text-neutral-800 hover:text-white hover:bg-white/10">
                  <Wand2 size={13} />
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="icon" onClick={onDelete} disabled={isDeleting}
                  className="h-8 w-8 text-neutral-800 hover:text-red-400 hover:bg-red-500/10 ml-auto">
                  {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
