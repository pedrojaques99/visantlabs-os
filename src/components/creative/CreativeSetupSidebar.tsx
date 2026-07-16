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

// Conjunto de formatos do Creative Studio — passado ao AspectRatioSelector
// compartilhado (SSoT), sem fork de UI.
const CREATIVE_RATIOS: AspectRatio[] = ['1:1', '9:16', '16:9', '4:5'];

// Sementes de prompt ("comece com") — matam a página em branco e ensinam a
// gramática do prompt. Preenchem um scaffold que o usuário completa.
const STARTER_PROMPTS: { label: string; prompt: string }[] = [
  { label: 'Post de feed', prompt: 'Post de feed para redes sociais anunciando ' },
  { label: 'Story de anúncio', prompt: 'Story vertical de anúncio destacando ' },
  { label: 'Banner promo', prompt: 'Banner promocional com desconto para ' },
  { label: 'Lançamento', prompt: 'Peça de lançamento apresentando ' },
];

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

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setUploadedBackgroundUrl(url);
  };

  const handleVaultUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
      toast.success('Asset adicionado à Brand!');
      queryClient.invalidateQueries({ queryKey: ['brand-guidelines'] });
      queryClient.invalidateQueries({ queryKey: ['brand-guideline', selectedGuideline.id] });
    } catch (err) {
      toast.error('Erro ao subir para o Vault');
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
      toast.error(err?.message ?? 'Falha ao gerar criativo');
      setStatus('setup');
    }
  };

  // Ignite nunca fica desabilitado em silêncio: o rótulo diz o próximo passo e
  // o clique guia (foca a ideia / pede a marca) em vez de morrer cinza.
  const igniteLabel = !selectedGuideline
    ? 'Selecione uma marca'
    : !prompt.trim()
      ? 'Escreva sua ideia'
      : 'Ignite';

  const handleIgnite = () => {
    if (!selectedGuideline) {
      toast.error('Selecione uma marca primeiro');
      return;
    }
    if (!prompt.trim()) {
      toast.error('Escreva sua ideia para gerar');
      promptRef.current?.focus();
      return;
    }
    handleGenerate();
  };

  if (showVault && selectedGuideline) {
    return (
      <aside className="w-[420px] h-full bg-neutral-950 border-r border-neutral-800 flex flex-col p-6 gap-6 overflow-y-auto custom-scrollbar anim-fade-in">
        <header className="flex items-center justify-between">
          <button
            onClick={() => setShowVault(false)}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Voltar
          </button>
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-2 py-1 bg-white/5 rounded-full border border-white/10">
            Brand Vault
          </div>
        </header>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-white">
              Adicionar Asset
            </h2>
          </div>
          <label className="cursor-pointer group">
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleVaultUpload}
              disabled={isUploading}
            />
            <div className="w-full h-32 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 bg-neutral-900/20 group-hover:bg-neutral-900/40 group-hover:border-neutral-700 transition-all">
              {isUploading ? (
                <GlitchLoader size={24} />
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-brand-cyan transition-colors">
                    <Plus size={20} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 group-hover:text-neutral-400">
                    Clique para Subir à Brand
                  </span>
                </>
              )}
            </div>
          </label>
        </section>

        <section className="flex flex-col gap-6">
          {(selectedGuideline.logos?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-1">
                Logos
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {selectedGuideline.logos?.map((logo, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setUploadedBackgroundUrl(logo.url!);
                      setShowVault(false);
                    }}
                    className={cn(
                      'aspect-square rounded-xl p-2 hover:border-neutral-700 transition-all group overflow-hidden',
                      glassSurface.tile
                    )}
                  >
                    <img
                      src={getProxiedUrl(logo.url)}
                      alt="Brand logo"
                      className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {(selectedGuideline.media?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-1">
                Brand Media
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {selectedGuideline.media?.map((media, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setUploadedBackgroundUrl(media.url!);
                      setShowVault(false);
                    }}
                    className={cn(
                      'aspect-video rounded-xl p-1.5 hover:border-neutral-700 transition-all group overflow-hidden',
                      glassSurface.tile
                    )}
                  >
                    <img
                      src={getProxiedUrl(media.url)}
                      alt="Brand media"
                      className="w-full h-full object-cover rounded-lg group-hover:scale-110 transition-transform"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {(selectedGuideline.colors?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-1">
                Cores
              </h3>
              <div className="flex flex-wrap gap-2 px-1">
                {selectedGuideline.colors?.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      copyToClipboard(color.hex || '');
                      toast.success(`${color.hex} copiada!`);
                    }}
                    style={{ backgroundColor: color.hex }}
                    className="w-8 h-8 rounded-lg border border-white/10 hover:scale-110 transition-transform"
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

  return (
    <aside
      role="region"
      aria-label="Creative Setup"
      className="w-[420px] h-full bg-neutral-950 border-r border-neutral-800 flex flex-col p-5 gap-5 overflow-y-auto"
      data-vsn-section="setup"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-500">Novo criativo</span>
        <button
          onClick={() => navigate('/create/projects')}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:border-neutral-700 text-[10px] font-mono uppercase tracking-wider text-neutral-400 hover:text-brand-cyan',
            glassSurface.control
          )}
          title="My Creatives"
          data-vsn-action="open-projects"
        >
          <FolderOpen size={12} /> Projects
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 px-1">
          Identidade
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1 group">
            <Select
              value={brandId ?? ''}
              onChange={(val) => selectBrand(val || null)}
              disabled={status !== 'setup'}
              placeholder="Selecione a marca..."
              variant="node"
              className="h-12"
              options={guidelines.map((g) => ({
                value: g.id!,
                label: g.identity?.name || 'Sem nome',
              }))}
            />
          </div>
          <button
            onClick={() => setWizardOpen(true)}
            disabled={status !== 'setup'}
            className={cn(
              'w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-neutral-500 hover:text-brand-cyan hover:border-neutral-700 transition-all hover:bg-neutral-900/60 disabled:opacity-50',
              glassSurface.tile
            )}
            title="Nova marca"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="creative-idea" className="text-[15px] font-semibold text-neutral-100 px-1">
          Ideia
        </label>
        <div className="relative group">
          <textarea
            id="creative-idea"
            ref={promptRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={status !== 'setup'}
            placeholder="O que você quer criar hoje?"
            aria-label="Ideia do criativo"
            rows={4}
            className={cn(
              'w-full rounded-2xl px-4 py-4 text-sm leading-relaxed text-white placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600 focus:bg-neutral-900/60 transition-all resize-none disabled:opacity-50',
              glassSurface.panel
            )}
            data-vsn-input="prompt"
          />
        </div>
        {/* Chips de partida — só enquanto a ideia está vazia (declutter ao digitar) */}
        {status === 'setup' && !prompt.trim() && (
          <div className="flex flex-wrap gap-2 px-1 animate-in fade-in">
            {STARTER_PROMPTS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setPrompt(s.prompt);
                  promptRef.current?.focus();
                }}
                className={cn(
                  'px-3 py-1.5 rounded-full text-[11px] font-medium text-neutral-400 hover:text-brand-cyan hover:border-neutral-700 transition-all',
                  glassSurface.control
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 px-1">
          Formato
        </label>
        <AspectRatioSelector
          value={format as AspectRatio}
          onChange={(r) => setFormat(r as CreativeFormat)}
          disabled={status !== 'setup'}
          ratios={CREATIVE_RATIOS}
        />
      </div>

      {/* Ajustes avançados — colapsado por padrão. Progressive disclosure:
          Identidade → Ideia → Ignite lideram; Fundo/Modelo ficam guardados
          com defaults sãos (IA + top model). */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          disabled={status !== 'setup'}
          className={cn(
            'flex items-center justify-between px-4 py-3 rounded-2xl text-[10px] font-mono uppercase tracking-wider text-neutral-500 hover:text-neutral-300 transition-all disabled:opacity-50',
            glassSurface.control
          )}
        >
          Ajustes avançados
          <ChevronDown
            size={14}
            className={cn('transition-transform', advancedOpen && 'rotate-180')}
          />
        </button>
        {advancedOpen && (
          <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-top-1">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 px-1">
                Fundo
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-900/40 rounded-2xl border border-neutral-800">
                <button
                  onClick={() => setBackgroundMode('ai')}
                  disabled={status !== 'setup'}
                  className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    backgroundMode === 'ai'
                      ? 'bg-neutral-800 text-brand-cyan shadow-xl border border-neutral-800'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <Diamond size={11} strokeWidth={2} /> IA
                </button>
                <button
                  onClick={() => {
                    if (!selectedGuideline) {
                      toast.error('Selecione uma marca primeiro');
                      return;
                    }
                    setBackgroundMode('brand');
                    setShowVault(true);
                  }}
                  disabled={status !== 'setup'}
                  className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    backgroundMode === 'brand'
                      ? 'bg-neutral-800 text-brand-cyan shadow-xl border border-neutral-800'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <Briefcase size={11} strokeWidth={2} /> Vault
                </button>
                <button
                  onClick={() => setBackgroundMode('upload')}
                  disabled={status !== 'setup'}
                  className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    backgroundMode === 'upload'
                      ? 'bg-neutral-800 text-brand-cyan shadow-xl border border-neutral-800'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <Upload size={11} strokeWidth={2} /> Local
                </button>
              </div>
              {backgroundMode === 'upload' && (
                <div className="mt-2 flex flex-col gap-2">
                  <label className="cursor-pointer block relative group">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLocalUpload}
                    />
                    {!uploadedBackgroundUrl ? (
                      <div className="w-full bg-neutral-900/40 border border-dashed border-white/10 rounded-2xl px-4 py-8 text-center text-[10px] font-bold text-neutral-600 hover:text-white hover:border-neutral-700 transition-all flex flex-col items-center gap-2 group-hover:bg-neutral-900/60">
                        <Upload
                          size={16}
                          className="opacity-40 group-hover:text-brand-cyan transition-colors"
                        />
                        <span className="uppercase tracking-widest">Subir Imagem Local</span>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'relative w-full aspect-video rounded-2xl overflow-hidden hover:border-neutral-700 transition-all shadow-2xl',
                          glassSurface.tile
                        )}
                      >
                        <img
                          src={getProxiedUrl(uploadedBackgroundUrl)}
                          alt="Uploaded Asset"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 backdrop-blur-[2px]">
                          <Upload size={18} className="text-white" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                            Trocar Arquivo
                          </span>
                        </div>
                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-300">
                            Local File
                          </span>
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              )}

              {backgroundMode === 'brand' && (
                <div className="mt-2 flex flex-col gap-2">
                  {!uploadedBackgroundUrl ? (
                    <button
                      onClick={() => setShowVault(true)}
                      className="w-full bg-neutral-900/40 border border-dashed border-white/10 rounded-2xl px-4 py-8 text-center text-[10px] font-bold text-neutral-600 hover:text-white hover:border-neutral-700 transition-all flex flex-col items-center gap-2 hover:bg-neutral-900/60"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Briefcase
                          size={16}
                          className="opacity-40 hover:text-brand-cyan transition-colors"
                        />
                        <span className="uppercase tracking-widest">Selecione do Vault</span>
                      </div>
                    </button>
                  ) : (
                    <div
                      onClick={() => setShowVault(true)}
                      className={cn(
                        'group cursor-pointer relative w-full aspect-video rounded-2xl overflow-hidden hover:border-neutral-700 transition-all shadow-2xl',
                        glassSurface.tile
                      )}
                    >
                      <img
                        src={getProxiedUrl(uploadedBackgroundUrl)}
                        alt="Selected Asset"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 backdrop-blur-[2px]">
                        <Briefcase size={18} className="text-white" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                          Trocar Asset
                        </span>
                      </div>
                      <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-300">
                          Vault Asset
                        </span>
                      </div>
                    </div>
                  )}
                </div>
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
          </div>
        )}
      </div>

      <div className="mt-auto pt-4">
        <Button
          variant="brand"
          onClick={handleIgnite}
          className="w-full py-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-brand-cyan/10 group overflow-hidden relative"
        >
          {status === 'generating' ? (
            <div className="flex flex-col items-center gap-1 w-full scale-75">
              <PremiumGlitchLoader color="#00e5ff" className="w-full justify-center" />
            </div>
          ) : (
            <>
              <Diamond size={18} className="group-hover:rotate-12 transition-transform" />
              <span className="uppercase tracking-[0.1em]">{igniteLabel}</span>
              {/* Custo dobrado dentro do CTA (valor antes do preço) — não mais
                  uma linha de fricção depois do botão. */}
              {canGenerate && (
                <span className="text-black/60 font-mono text-[11px] normal-case tracking-normal">
                  · {creditsRequired} {creditsRequired === 1 ? 'crédito' : 'créditos'}
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
