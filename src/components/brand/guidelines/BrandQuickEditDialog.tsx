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
import { Button } from '@/components/ui/button';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { useUpdateGuideline } from '@/hooks/queries/useBrandGuidelines';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';

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
    <span className="text-2xs uppercase tracking-widest text-neutral-500">{label}</span>
    {children}
  </label>
);

export const BrandQuickEditDialog: React.FC<Props> = ({ guideline, open, onOpenChange }) => {
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
      toast.success('Logo updated');
    } catch {
      toast.error('Failed to upload logo');
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
          toast.success('Brand updated');
          onOpenChange(false);
        },
        onError: () => toast.error('Failed to save changes'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick edit</DialogTitle>
          <DialogDescription>
            The core of this brand — the rest lives in the full view.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {/* Logo → brand mark / avatar */}
          <div className="flex items-center gap-4">
            <div className="ring-2 ring-neutral-800 rounded-lg">
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
                {uploading ? 'Uploading…' : 'Upload logo'}
              </Button>
              <p className="text-2xs text-neutral-500">
                Becomes the brand&apos;s avatar everywhere.
              </p>
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

          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Brand name"
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="A short, memorable line"
            />
          </Field>
          <Field label="Positioning">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One or two lines on what the brand is"
              rows={2}
              className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/10"
            />
          </Field>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Website">
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
              />
            </Field>
            <Field label="Primary">
              <div className="flex items-center gap-2">
                <span
                  className="w-9 h-9 rounded-lg border border-neutral-800 shrink-0"
                  style={{ backgroundColor: hexValid && primaryHex ? primaryHex : 'transparent' }}
                />
                <Input
                  value={primaryHex}
                  onChange={(e) => setPrimaryHex(e.target.value)}
                  placeholder="#000000"
                  className={cnHex(hexValid)}
                />
              </div>
            </Field>
          </div>
        </DialogBody>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={update.isPending || !hexValid || !name.trim()}>
            {update.isPending && <Loader2 size={14} className="animate-spin mr-1.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Small helper so the hex input flags an invalid value inline.
function cnHex(valid: boolean): string {
  return valid ? 'w-28 font-mono' : 'w-28 font-mono border-destructive focus:ring-destructive/30';
}
