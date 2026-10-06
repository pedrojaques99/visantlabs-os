import React, { useState } from 'react';
import { toast } from 'sonner';
import { Gem } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Thumb } from '@/components/ui/Thumb';
import { Dropzone } from '@/components/ui/Dropzone';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { useUpdateGuideline } from '@/hooks/queries/useBrandGuidelines';
import { useTranslation } from '@/hooks/useTranslation';
import type { BrandGuideline } from '@/lib/figma-types';

type Logos = NonNullable<BrandGuideline['logos']>;

interface ChangeLogoDialogProps {
  guideline: BrandGuideline;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Trocar o logo PRINCIPAL da marca (o `variant === 'primary'` usado em avatars +
 * mockups). Três caminhos: enviar arquivo (image/svg), pegar da biblioteca de
 * media, ou promover um logo existente. Reusa a API (`uploadLogo` /
 * `uploadLogoFromUrl`) + `useUpdateGuideline` (persist + invalidate → o avatar
 * atualiza sozinho). O dance de variant (novo vira primary, antigo → custom) é
 * o mesmo do LogosSection.
 */
export const ChangeLogoDialog: React.FC<ChangeLogoDialogProps> = ({
  guideline,
  open,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const id = guideline.id ?? '';
  const logos = (guideline.logos ?? []) as Logos;
  const media = (guideline.media ?? []).filter((m) => m.type === 'image');
  const updateGuideline = useUpdateGuideline();
  const [busy, setBusy] = useState(false);

  const fileToBase64 = (f: File) =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(f);
    });

  // Promove targetId a 'primary' e rebaixa o primary anterior pra 'custom'.
  const setPrimary = (arr: Logos, targetId: string): Logos =>
    arr.map((l) =>
      l.id === targetId
        ? { ...l, variant: 'primary' as const }
        : l.variant === 'primary'
          ? { ...l, variant: 'custom' as const }
          : l
    ) as Logos;

  const run = async (fn: () => Promise<void>, okMsg: string) => {
    if (busy || !id) return;
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('cockpit.changeLogoDialog.failed'));
    } finally {
      setBusy(false);
    }
  };

  const onFile = (file?: File | null) => {
    if (!file) return;
    run(async () => {
      const b64 = await fileToBase64(file);
      const { logo, allLogos } = await brandGuidelineApi.uploadLogo(id, b64, 'custom', file.name);
      await updateGuideline.mutateAsync({
        id,
        data: { logos: setPrimary(allLogos as Logos, logo.id) },
      });
    }, t('cockpit.changeLogoDialog.updated'));
  };

  const onPickMedia = (url: string) =>
    run(async () => {
      const { logo, allLogos } = await brandGuidelineApi.uploadLogoFromUrl(id, url, 'custom');
      await updateGuideline.mutateAsync({
        id,
        data: { logos: setPrimary(allLogos as Logos, logo.id) },
      });
    }, t('cockpit.changeLogoDialog.updated'));

  const onPickExisting = (logoId: string) =>
    run(async () => {
      await updateGuideline.mutateAsync({ id, data: { logos: setPrimary(logos, logoId) } });
    }, t('cockpit.changeLogoDialog.primarySet'));

  const gridCls = 'grid grid-cols-3 sm:grid-cols-5 gap-2';
  const labelCls = 'text-xs font-medium text-muted-foreground mb-2';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('cockpit.changeLogoDialog.title')}</SheetTitle>
        </SheetHeader>

        <div
          className={cn(
            'mx-auto w-full max-w-3xl px-1 py-4 space-y-6',
            busy && 'opacity-60 pointer-events-none'
          )}
        >
          {/* Upload */}
          <Dropzone
            accept="image/*,.svg"
            onFiles={(files) => onFile(files[0])}
            label={t('cockpit.changeLogoDialog.upload')}
            className="h-24 text-xs"
          />

          {/* Logos existentes → promover a principal */}
          {logos.length > 0 && (
            <div>
              <p className={labelCls}>{t('cockpit.changeLogoDialog.brandLogos')}</p>
              <div className={gridCls}>
                {logos.map((l) => (
                  <button
                    key={l.id}
                    // Já é a principal → clicar disparava um PUT completo e um
                    // toast de "definido" sem nada ter mudado.
                    onClick={() => l.variant !== 'primary' && onPickExisting(l.id)}
                    disabled={l.variant === 'primary'}
                    aria-current={l.variant === 'primary' ? 'true' : undefined}
                    title={
                      l.variant === 'primary'
                        ? t('cockpit.changeLogoDialog.currentPrimary')
                        : t('cockpit.changeLogoDialog.setPrimary')
                    }
                    className={cn(
                      'relative aspect-square rounded-md border p-2 flex items-center justify-center bg-muted/40 transition-colors',
                      l.variant === 'primary'
                        ? 'border-ring cursor-default'
                        : 'border-border hover:border-ring'
                    )}
                  >
                    <Thumb src={l.url} alt="" className="max-h-full max-w-full object-contain" />
                    {l.variant === 'primary' && (
                      <Gem
                        size={11}
                        weight="fill"
                        className="absolute top-1 left-1 text-foreground"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Da biblioteca de media */}
          {media.length > 0 && (
            <div>
              <p className={labelCls}>{t('cockpit.changeLogoDialog.fromMedia')}</p>
              <div className={gridCls}>
                {media.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onPickMedia(m.url)}
                    title={m.label || t('cockpit.changeLogoDialog.setPrimary')}
                    className="aspect-square rounded-md border border-border hover:border-ring bg-muted/40 overflow-hidden transition-colors"
                  >
                    <Thumb
                      src={m.url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
