/**
 * BrandQuickEditDialog — compact "core" editor for a brand, opened from the
 * dashboard card's ⋯ menu so owners can fix the essentials (name, tagline,
 * positioning, website, primary color, logo) without entering the full view.
 *
 * Composition only — reuses ui/dialog, ui/input, ui/button, BrandAvatar, the
 * shared useUpdateGuideline() mutation (optimistic) and brandGuidelineApi.uploadLogo.
 * The uploaded logo becomes the brand's primary mark → its avatar everywhere.
 */
import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload } from '@/lib/ui/icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { useUpdateGuideline } from '@/hooks/queries/useBrandGuidelines';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface Props {
  guideline: BrandGuideline;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    {children}
  </label>
);

export const BrandQuickEditDialog: React.FC<Props> = ({ guideline, open, onOpenChange }) => {
  const { t } = useTranslation();
  const update = useUpdateGuideline();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // The primary color drives the avatar's initial chip — surface it for editing.
  const primaryIndex = useMemo(() => {
    const colors = guideline.colors || [];
    const i = colors.findIndex((c) => c.role?.toUpperCase() === 'PRIMARY');
    return i >= 0 ? i : colors.length ? 0 : -1;
  }, [guideline.colors]);

  const [name, setName] = useState(guideline.identity?.name || guideline.name || '');
  const [tagline, setTagline] = useState(guideline.identity?.tagline || '');
  const [description, setDescription] = useState(guideline.identity?.description || '');
  const [website, setWebsite] = useState(guideline.identity?.website || '');
  const [primaryHex, setPrimaryHex] = useState(
    (primaryIndex >= 0 ? guideline.colors?.[primaryIndex]?.hex : '') || ''
  );

  const hexValid = !primaryHex || HEX.test(primaryHex);

  const handleUploadLogo = async (file: File) => {
    if (!guideline.id) return;
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      await brandGuidelineApi.uploadLogo(guideline.id, base64, 'primary', 'Primary');
      await qc.invalidateQueries({ queryKey: ['brand-guidelines'] });
      toast.success(t('brandQuickEdit.logoUpdated'));
    } catch {
      toast.error(t('brandQuickEdit.logoFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!guideline.id || !hexValid) return;
    const patch: Partial<BrandGuideline> = {
      identity: {
        ...(guideline.identity || {}),
        name: name.trim(),
        tagline: tagline.trim(),
        description: description.trim(),
        website: website.trim(),
      },
    };
    // Persist the primary color edit without disturbing the rest of the palette.
    if (primaryHex && HEX.test(primaryHex)) {
      const colors = [...(guideline.colors || [])];
      if (primaryIndex >= 0) {
        colors[primaryIndex] = { ...colors[primaryIndex], hex: primaryHex };
      } else {
        colors.unshift({ hex: primaryHex, name: 'Primary', role: 'primary' });
      }
      patch.colors = colors;
    }
    update.mutate(
      { id: guideline.id, data: patch },
      {
        onSuccess: () => {
          toast.success(t('brandQuickEdit.saved'));
          onOpenChange(false);
        },
        onError: () => toast.error(t('brandQuickEdit.saveFailed')),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('brandQuota.quickEdit')}</DialogTitle>
          <DialogDescription>{t('brandQuickEdit.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {/* Logo → brand mark / avatar */}
          <div className="flex items-center gap-4">
            <div className="ring-1 ring-border rounded-xl">
              <BrandAvatar brand={guideline} size={56} rounded="md" preference="primary" />
            </div>
            <div className="space-y-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? t('brandQuickEdit.uploading') : t('brandQuickEdit.uploadLogo')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('brandQuickEdit.logoHint')}</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadLogo(f);
                e.target.value = '';
              }}
            />
          </div>

          <Field label={t('brandQuickEdit.name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t('brandQuickEdit.tagline')}>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </Field>
          <Field label={t('brandQuickEdit.positioning')}>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="min-h-0"
            />
          </Field>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label={t('brandQuickEdit.website')}>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
              />
            </Field>
            <Field label={t('brandQuickEdit.primary')}>
              <div className="flex items-center gap-2">
                <span
                  className="w-9 h-9 rounded-xl border border-border shrink-0"
                  style={{ backgroundColor: hexValid && primaryHex ? primaryHex : 'transparent' }}
                />
                <Input
                  value={primaryHex}
                  onChange={(e) => setPrimaryHex(e.target.value)}
                  placeholder="#000000"
                  className={cn('w-28 font-mono', !hexValid && 'border-destructive')}
                />
              </div>
            </Field>
          </div>
        </DialogBody>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={update.isPending || !hexValid || !name.trim()}>
            {update.isPending && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
