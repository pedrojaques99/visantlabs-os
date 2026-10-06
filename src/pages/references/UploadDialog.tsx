import React, { useState, useMemo } from 'react';
import { Upload, Loader2 } from '@/lib/ui/icons';
import { FlyingPaperLoader } from '@/components/ui/FlyingPaperLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dropzone } from '@/components/ui/Dropzone';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { referencesApi, type ReferenceUploadInput } from '@/services/referencesApi';
import { countryOptions, fileToBase64 } from './helpers';

// ─── Upload Dialog ───────────────────────────────────────────────

export const UploadDialog: React.FC<{
  onClose: () => void;
  onDone: (madePublic: boolean) => void;
}> = ({ onClose, onDone }) => {
  const { t, tOr, locale } = useTranslation();
  // Upload options are taxonomy-wide: a new ref may come from anywhere.
  const uploadCountryOptions = useMemo(() => countryOptions(tOr, locale), [tOr, locale]);
  const [files, setFiles] = useState<File[]>([]);
  const [country, setCountry] = useState('');
  const [designer, setDesigner] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [awardSource, setAwardSource] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [uploading, setUploading] = useState(false);

  const submit = async () => {
    if (files.length === 0) {
      toast.error(t('references.upload.pickOne'));
      return;
    }
    setUploading(true);
    try {
      const images: ReferenceUploadInput[] = [];
      for (const f of files) {
        images.push({
          data: await fileToBase64(f),
          name: f.name.replace(/\.[^.]+$/, ''),
          country: country || undefined,
          designer: designer || undefined,
          sourceUrl: sourceUrl || undefined,
          awardSource: awardSource || undefined,
          isPublic,
        });
      }
      const res = await referencesApi.upload(images);
      // Uploads now await moderation — nothing is public or analysed yet. Saying
      // "ingerida" would overclaim; "em revisão" is the honest state.
      const pending = res.pending ?? res.ingested - (res.deduped || 0);
      const parts = [t('references.upload.pending', { count: pending })];
      if (res.deduped) parts.push(t('references.upload.deduped', { count: res.deduped }));
      if (res.failed) parts.push(t('references.upload.failed', { count: res.failed }));
      toast.success(parts.join(', '));
      onDone(isPublic);
    } catch (e: any) {
      toast.error(e.message || t('references.upload.error'));
    } finally {
      setUploading(false);
    }
  };

  // Ingest is 3 AI calls per image — the app's longest file-processing wait.
  // Same loader the other ingest flows use (BrandIngestModal, Compress, Upscale).
  // No `progress`: the batch is one request, so a bar here would be invented.
  if (uploading) {
    return (
      <Dialog open onOpenChange={() => {}}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>{t('references.upload.sendingTitle')}</DialogTitle>
          </DialogHeader>
          <div className="py-8">
            <FlyingPaperLoader label={t('references.upload.sending', { count: files.length })} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={() => !uploading && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>{t('references.upload.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Dropzone
            accept="image/*"
            multiple
            onFiles={(picked) => setFiles(picked.slice(0, 10))}
            icon={Upload}
            label={
              files.length > 0
                ? t('references.upload.selected', { count: files.length })
                : t('references.upload.pick')
            }
            hint={t('references.upload.hint')}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {t('references.upload.countryOptional')}
              </label>
              <Select
                options={uploadCountryOptions}
                value={country}
                onChange={setCountry}
                placeholder={t('references.upload.auto')}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {t('references.upload.designer')}
              </label>
              <Input
                value={designer}
                onChange={(e) => setDesigner(e.target.value)}
                placeholder={t('references.upload.designerPlaceholder')}
                className="bg-input border-border text-sm h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {t('references.upload.source')}
              </label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="bg-input border-border text-sm h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {t('references.upload.award')}
              </label>
              <Input
                value={awardSource}
                onChange={(e) => setAwardSource(e.target.value)}
                placeholder={t('references.upload.awardPlaceholder')}
                className="bg-input border-border text-sm h-9"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="accent-brand-cyan"
            />
            <span className="text-xs text-muted-foreground">
              {t('references.upload.makePublic')}
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="bg-card border-border text-xs"
              disabled={uploading}
              onClick={onClose}
            >
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="text-xs"
              disabled={uploading || files.length === 0}
              onClick={submit}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {t('references.upload.submit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
