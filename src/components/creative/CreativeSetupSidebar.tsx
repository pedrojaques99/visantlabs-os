import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Upload,
  ChevronDown,
  Briefcase,
  ArrowLeft,
  Image as ImageIcon,
  FolderOpen,
  Diamond,
} from '@/lib/ui/icons';
import { useCreativeStore } from './store/creativeStore';
import { useBrandKit } from '@/contexts/BrandKitContext';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { getProxiedUrl } from '@/utils/proxyUtils';
import { BrandGuidelineWizardModal } from '@/components/mockupmachine/BrandGuidelineWizardModal';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { PremiumGlitchLoader } from '@/components/ui/PremiumGlitchLoader';
import { generateCreative } from './lib/generateCreative';
import { ModelSelector } from '@/components/shared/ModelSelector';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { useQueryClient } from '@tanstack/react-query';
import type { CreativeFormat } from './store/creativeTypes';
import type { GeminiModel, SeedreamModel, AspectRatio } from '@/types/types';
import { AspectRatioSelector } from '@/components/reactflow/shared/AspectRatioSelector';
import { copyToClipboard } from '@/utils/clipboard';
import { glassSurface } from '@/lib/ui/glass';
import { cn } from '@/lib/utils';
import { Thumb } from '@/components/ui/Thumb';
import { MediaTile } from '@/components/ui/MediaTile';
import { Dropzone } from '@/components/ui/Dropzone';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useTranslation } from '@/hooks/useTranslation';
import { hoverReveal } from '@/lib/ui/hoverReveal';

// Conjunto de formatos do Creative Studio — passado ao AspectRatioSelector
// compartilhado (SSoT), sem fork de UI.
const CREATIVE_RATIOS: AspectRatio[] = ['1:1', '9:16', '16:9', '4:5'];

// Sementes de prompt ("comece com") — matam a página em branco e ensinam a
// gramática do prompt. Preenchem um scaffold que o usuário completa.
const STARTER_PROMPTS = ['feed', 'story', 'banner', 'launch'] as const;

export const CreativeSetupSidebar: React.FC = () => {
  const {
    brandId,
    prompt,
    format,
    backgroundMode,
    uploadedBackgroundUrl,
    modelId,
    provider,
    resolution,
    status,
    setBrandId,
    setPrompt,
    setFormat,
    setBackgroundMode,
    setUploadedBackgroundUrl,
    setModel,
    setResolution,
    setStatus,
    hydrateFromAI,
  } = useCreativeStore();

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: guidelines = [] } = useBrandGuidelines();
  const { activeGuideline } = useBrandKit();
  const { setActiveBrand } = useActiveBrand();
  const queryClient = useQueryClient();

  // A marca ativa do app é o SSoT: escolher marca aqui também atualiza o cockpit
  // (e vice-versa). Sem isso, studio e cockpit divergem ("persiste uma marca").
  const selectBrand = (id: string | null) => {
    setBrandId(id);
    if (id) setActiveBrand(id);
  };

  const [wizardOpen, setWizardOpen] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Use either explicitly selected brand or context-active brand
  const selectedGuideline = guidelines.find((g) => g.id === brandId) ?? activeGuideline ?? null;

  const handleLocalFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setUploadedBackgroundUrl(url);
  };

  const handleVaultUpload = async (file: File | undefined) => {
    if (!file || !selectedGuideline?.id) return;

    setIsUploading(true);
    try {
      // Awaita o FileReader de verdade: antes o upload vivia dentro de
      // reader.onloadend (não-awaited) — o loader mentia e a rejeição virava
      // unhandled (o catch nunca via a falha real).
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await brandGuidelineApi.uploadMedia(selectedGuideline.id!, base64, file.name, file.type);
      toast.success(t('creativeSetup.assetAdded'));
      queryClient.invalidateQueries({ queryKey: ['brand-guidelines'] });
      queryClient.invalidateQueries({ queryKey: ['brand-guideline', selectedGuideline.id] });
    } catch (err) {
      toast.error(t('creativeSetup.assetUploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const canGenerate =
    !!selectedGuideline &&
    prompt.trim().length > 0 &&
    (status === 'setup' || status === 'generating');

  const isExistingBg =
    (backgroundMode === 'upload' || backgroundMode === 'brand') && !!uploadedBackgroundUrl;
  const creditsRequired =
    1 + (isExistingBg ? 0 : getCreditsRequired(modelId || '', resolution, provider));

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setStatus('generating');

    const isExistingBg =
      (backgroundMode === 'upload' || backgroundMode === 'brand') && !!uploadedBackgroundUrl;

    try {
      const result = await generateCreative({
        prompt,
        format,
        guideline: selectedGuideline,
        brandId,
        modelId: isExistingBg ? undefined : (modelId as string),
        provider: isExistingBg ? undefined : provider,
        resolution: isExistingBg ? undefined : resolution,
        existingBackgroundUrl: isExistingBg ? uploadedBackgroundUrl : null,
      });

      hydrateFromAI(result);
      // O criativo recém-gerado é o baseline do undo — sem isso, um Ctrl+Z
      // revertia a geração inteira e deixava o canvas vazio (LAYERS 0).
      useCreativeStore.temporal.getState().clear();
    } catch (err: any) {
      toast.error(err?.message ?? t('creativeSetup.generateFailed'));
      setStatus('setup');
    }
  };

  // Ignite nunca fica desabilitado em silêncio: o rótulo diz o próximo passo e
  // o clique guia (foca a ideia / pede a marca) em vez de morrer cinza.
  const igniteLabel = !selectedGuideline
    ? t('creativeSetup.selectBrand')
    : !prompt.trim()
      ? t('creativeSetup.writeIdea')
      : t('creativeSetup.generate');

  const handleIgnite = () => {
    if (!selectedGuideline) {
      toast.error(t('creativeSetup.selectBrandFirst'));
      return;
    }
    if (!prompt.trim()) {
      toast.error(t('creativeSetup.writeIdeaFirst'));
      promptRef.current?.focus();
      return;
    }
    handleGenerate();
  };

  if (showVault && selectedGuideline) {
    return (
      <aside className="w-[420px] h-full bg-background border-r border-border flex flex-col p-6 gap-6 overflow-y-auto custom-scrollbar anim-fade-in">
        <header className="flex items-center justify-between">
          <button
            onClick={() => setShowVault(false)}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> {t('common.back')}
          </button>
          <span className="text-xs font-medium text-muted-foreground">
            {t('creativeSetup.vault')}
          </span>
        </header>

        {isUploading ? (
          <div className="flex h-32 w-full items-center justify-center rounded-xl border border-border">
            <GlitchLoader size={24} />
          </div>
        ) : (
          <Dropzone
            accept="image/*"
            icon={Plus}
            label={t('creativeSetup.addAssetToBrand')}
            onFiles={(files) => handleVaultUpload(files[0])}
            className="h-32"
          />
        )}

        <section className="flex flex-col gap-6">
          {(selectedGuideline.logos?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-medium text-muted-foreground px-1">
                {t('creativeSetup.logos')}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {selectedGuideline.logos?.map((logo, i) => (
                  <MediaTile
                    key={i}
                    layout="overlay"
                    src={getProxiedUrl(logo.url)}
                    alt={logo.label || t('creativeSetup.logos')}
                    imageClassName="object-contain p-2"
                    onClick={() => {
                      setUploadedBackgroundUrl(logo.url!);
                      setShowVault(false);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {(selectedGuideline.media?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-medium text-muted-foreground px-1">
                {t('creativeSetup.media')}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {selectedGuideline.media?.map((media, i) => (
                  <MediaTile
                    key={i}
                    layout="overlay"
                    src={getProxiedUrl(media.url)}
                    alt={media.label || t('creativeSetup.media')}
                    aspectRatio="16 / 9"
                    onClick={() => {
                      setUploadedBackgroundUrl(media.url!);
                      setShowVault(false);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {(selectedGuideline.colors?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-medium text-muted-foreground px-1">
                {t('creativeSetup.colors')}
              </h3>
              <div className="flex flex-wrap gap-2 px-1">
                {selectedGuideline.colors?.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      copyToClipboard(color.hex || '');
                      toast.success(t('creativeSetup.colorCopied', { hex: color.hex || '' }));
                    }}
                    style={{ backgroundColor: color.hex }}
                    className="w-8 h-8 rounded-md border border-border"
                    title={color.hex}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </aside>
    );
  }

  const fieldLabel = 'text-xs font-medium text-muted-foreground px-1';

  return (
    <aside
      role="region"
      aria-label={t('creativeSetup.newCreative')}
      className="w-[420px] h-full bg-background border-r border-border flex flex-col p-5 gap-5 overflow-y-auto"
      data-vsn-section="setup"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {t('creativeSetup.newCreative')}
        </span>
        <button
          onClick={() => navigate('/create/projects')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground',
            glassSurface.control
          )}
          data-vsn-action="open-projects"
        >
          <FolderOpen size={12} /> {t('creative.projects.title')}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label className={fieldLabel}>{t('creativeSetup.brand')}</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Select
              value={brandId ?? ''}
              onChange={(val) => selectBrand(val || null)}
              disabled={status !== 'setup'}
              placeholder={t('creativeSetup.selectBrandPlaceholder')}
              variant="node"
              className="h-12"
              options={guidelines.map((g) => ({
                value: g.id!,
                label: g.identity?.name || t('creativeSetup.untitledBrand'),
              }))}
            />
          </div>
          <button
            onClick={() => setWizardOpen(true)}
            disabled={status !== 'setup'}
            className={cn(
              'w-12 h-12 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50',
              glassSurface.tile
            )}
            title={t('creativeSetup.newBrand')}
            aria-label={t('creativeSetup.newBrand')}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="creative-idea" className="text-base font-medium text-foreground px-1">
          {t('creativeSetup.idea')}
        </label>
        <textarea
          id="creative-idea"
          ref={promptRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={status !== 'setup'}
          placeholder={t('creativeSetup.ideaPlaceholder')}
          rows={4}
          className={cn(
            'w-full rounded-xl px-4 py-4 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-colors resize-none disabled:opacity-50',
            glassSurface.surface
          )}
          data-vsn-input="prompt"
        />
        {/* Chips de partida — só enquanto a ideia está vazia (declutter ao digitar) */}
        {status === 'setup' && !prompt.trim() && (
          <div className="flex flex-wrap gap-2 px-1">
            {STARTER_PROMPTS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setPrompt(t(`creativeSetup.starters.${key}.prompt`));
                  promptRef.current?.focus();
                }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-2xs font-medium text-muted-foreground hover:text-foreground transition-colors',
                  glassSurface.control
                )}
              >
                {t(`creativeSetup.starters.${key}.label`)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className={fieldLabel}>{t('creativeSetup.format')}</label>
        <AspectRatioSelector
          value={format as AspectRatio}
          onChange={(r) => setFormat(r as CreativeFormat)}
          disabled={status !== 'setup'}
          ratios={CREATIVE_RATIOS}
        />
      </div>

      {/* Ajustes avançados — colapsado por padrão. Progressive disclosure:
          Marca → Ideia → Gerar lideram; Fundo/Modelo ficam guardados
          com defaults sãos (IA + top model). */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          disabled={status !== 'setup'}
          aria-expanded={advancedOpen}
          className={cn(
            'flex items-center justify-between px-4 py-3 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50',
            glassSurface.control
          )}
        >
          {t('creativeSetup.advanced')}
          <ChevronDown
            size={14}
            className={cn('transition-transform', advancedOpen && 'rotate-180')}
          />
        </button>
        {advancedOpen && (
          <fieldset disabled={status !== 'setup'} className="flex flex-col gap-5 min-w-0">
            <div className="flex flex-col gap-2">
              <span className={fieldLabel}>{t('creativeSetup.background')}</span>
              <SegmentedControl
                size="sm"
                fullWidth
                aria-label={t('creativeSetup.background')}
                value={backgroundMode}
                onChange={(v) => {
                  if (v !== 'brand') {
                    setBackgroundMode(v as typeof backgroundMode);
                    return;
                  }
                  if (!selectedGuideline) {
                    toast.error(t('creativeSetup.selectBrandFirst'));
                    return;
                  }
                  setBackgroundMode('brand');
                  setShowVault(true);
                }}
                options={[
                  { value: 'ai', label: t('creativeSetup.bgAi') },
                  { value: 'brand', label: t('creativeSetup.vault') },
                  { value: 'upload', label: t('creativeSetup.bgLocal') },
                ]}
              />
              {backgroundMode === 'upload' &&
                (!uploadedBackgroundUrl ? (
                  <Dropzone
                    accept="image/*"
                    icon={Upload}
                    label={t('creativeSetup.uploadLocal')}
                    onFiles={(files) => handleLocalFile(files[0])}
                    className="mt-2"
                  />
                ) : (
                  <label className="group relative mt-2 block cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => handleLocalFile(e.target.files?.[0])}
                    />
                    <BackgroundPreview
                      url={uploadedBackgroundUrl}
                      icon={Upload}
                      action={t('creativeSetup.replaceFile')}
                    />
                  </label>
                ))}

              {backgroundMode === 'brand' && (
                <button
                  type="button"
                  onClick={() => setShowVault(true)}
                  className="mt-2 block w-full text-left group"
                >
                  {!uploadedBackgroundUrl ? (
                    <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-border px-4 py-8 text-xs font-medium text-muted-foreground transition-colors group-hover:border-border-hover group-hover:text-foreground">
                      <Briefcase size={16} />
                      {t('creativeSetup.pickFromVault')}
                    </div>
                  ) : (
                    <BackgroundPreview
                      url={uploadedBackgroundUrl}
                      icon={Briefcase}
                      action={t('creativeSetup.replaceAsset')}
                    />
                  )}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5 min-h-[70px]">
              <ModelSelector
                type="image"
                variant="node"
                selectedModel={modelId}
                onModelChange={(m, p) => setModel(m as GeminiModel | SeedreamModel, p!)}
                resolution={resolution}
                onSyncResolution={setResolution}
                disabled={status !== 'setup'}
                className="model-selector-creative"
              />
            </div>
          </fieldset>
        )}
      </div>

      <div className="mt-auto pt-4">
        <Button
          variant="primary"
          size="lg"
          onClick={handleIgnite}
          className="relative w-full gap-2.5 overflow-hidden px-4 text-sm font-medium"
        >
          {status === 'generating' ? (
            <div className="flex flex-col items-center gap-1 w-full scale-75">
              <PremiumGlitchLoader color="currentColor" className="w-full justify-center" />
            </div>
          ) : (
            <>
              <Diamond size={18} />
              <span>{igniteLabel}</span>
              {/* Custo dobrado dentro do CTA (valor antes do preço) — não mais
                  uma linha de fricção depois do botão. */}
              {canGenerate && (
                <span className="text-2xs text-muted-foreground">
                  {t(
                    creditsRequired === 1 ? 'creativeSetup.creditOne' : 'creativeSetup.creditMany',
                    {
                      count: creditsRequired,
                    }
                  )}
                </span>
              )}
            </>
          )}
        </Button>
      </div>

      <BrandGuidelineWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={(id) => {
          selectBrand(id);
          setWizardOpen(false);
        }}
      />
    </aside>
  );
};

/** Fundo já escolhido: preview com a ação de troca revelada no hover/foco. */
const BackgroundPreview: React.FC<{
  url: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  action: string;
}> = ({ url, icon: Icon, action }) => (
  <div
    className={cn(
      'relative w-full aspect-video rounded-xl overflow-hidden group-hover:border-border-hover transition-colors',
      glassSurface.tile
    )}
  >
    <Thumb
      src={getProxiedUrl(url)}
      alt=""
      aspectRatio="16 / 9"
      className="w-full h-full object-cover"
    />
    <div
      className={cn(
        'absolute inset-0 bg-neutral-950/60 flex flex-col items-center justify-center gap-2',
        hoverReveal
      )}
    >
      <Icon size={18} className="text-white" />
      <span className="text-xs font-medium text-white">{action}</span>
    </div>
  </div>
);
