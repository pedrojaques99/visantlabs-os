import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Gem } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
  const fileRef = useRef<HTMLInputElement>(null);

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
  const labelCls = 'text-[10px] font-mono uppercase tracking-widest text-neutral-600 mb-2';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto bg-neutral-950 border-white/10"
      >
        <SheetHeader>
          <SheetTitle className="text-neutral-200">
            {t('cockpit.changeLogoDialog.title')}
          </SheetTitle>
        </SheetHeader>

        <div
          className={cn(
            'mx-auto w-full max-w-3xl px-1 py-4 space-y-6',
            busy && 'opacity-60 pointer-events-none'
          )}
        >
          {/* Upload */}
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-24 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 text-neutral-500 hover:border-brand-cyan/40 hover:text-neutral-300 transition-colors"
          >
            <Upload size={18} />
            <span className="text-xs">{t('cockpit.changeLogoDialog.upload')}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.svg"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
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
                      'relative aspect-square rounded-md border p-2 flex items-center justify-center bg-white/[0.03] transition-colors',
                      l.variant === 'primary'
                        ? 'border-brand-cyan/50 ring-1 ring-brand-cyan/20 cursor-default'
                        : 'border-neutral-800 hover:border-white/20'
                    )}
                  >
                    <img src={l.url} alt="" className="max-h-full max-w-full object-contain" />
                    {l.variant === 'primary' && (
                      <Gem
                        size={11}
                        className="absolute top-1 left-1 text-brand-cyan fill-brand-cyan"
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
                    title={m.label || 'Usar como logo'}
                    className="aspect-square rounded-md border border-neutral-800 hover:border-brand-cyan/40 bg-white/[0.03] overflow-hidden transition-colors"
                  >
                    <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
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
