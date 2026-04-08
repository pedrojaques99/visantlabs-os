import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Smartphone, Monitor, Square, LayoutTemplate, ChevronDown, Briefcase, ArrowLeft, Image as ImageIcon, Loader2, FolderOpen, Diamond } from 'lucide-react';
import { useCreativeStore } from './store/creativeStore';
import { useBrandKit } from '@/contexts/BrandKitContext';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { getProxiedUrl } from '@/utils/proxyUtils';
import { BrandGuidelineWizardModal } from '@/components/mockupmachine/BrandGuidelineWizardModal';
import { Button } from '@/components/ui/button';
import { PremiumGlitchLoader } from '@/components/ui/PremiumGlitchLoader';
import { generateCreative } from './lib/generateCreative';
import { ModelSelector } from '@/components/shared/ModelSelector';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { useQueryClient } from '@tanstack/react-query';
import { Gem } from 'lucide-react';
import type { CreativeFormat } from './store/creativeTypes';

const FORMAT_OPTS = [
  { id: '1:1', label: 'Quadrado', icon: Square, sub: 'Feed Social' },
  { id: '4:5', label: 'Retrato', icon: LayoutTemplate, sub: 'Ads & Feed' },
  { id: '9:16', label: 'Story', icon: Smartphone, sub: 'Reels & TT' },
  { id: '16:9', label: 'Largo', icon: Monitor, sub: 'Desktop' },
] as const;

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
  const queryClient = useQueryClient();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Use either explicitly selected brand or context-active brand
  const selectedGuideline =
    guidelines.find((g) => g.id === brandId) ?? activeGuideline ?? null;

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
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        await brandGuidelineApi.uploadMedia(selectedGuideline.id!, base64, file.name, file.type);
        toast.success('Asset adicionado à Brand!');
        queryClient.invalidateQueries({ queryKey: ['brand-guidelines'] });
        queryClient.invalidateQueries({ queryKey: ['brand-guideline', selectedGuideline.id] });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('Erro ao subir para o Vault');
    } finally {
      setIsUploading(false);
    }
  };

  const canGenerate =
    !!selectedGuideline && prompt.trim().length > 0 && (status === 'setup' || status === 'generating');

  const isExistingBg = (backgroundMode === 'upload' || backgroundMode === 'brand') && !!uploadedBackgroundUrl;
  const creditsRequired = 1 + (isExistingBg ? 0 : getCreditsRequired(modelId || '', resolution, provider));

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setStatus('generating');

    const isExistingBg = (backgroundMode === 'upload' || backgroundMode === 'brand') && !!uploadedBackgroundUrl;

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
    } catch (err: any) {
      toast.error(err?.message ?? 'Falha ao gerar criativo');
      setStatus('setup');
    }
  };

  if (showVault && selectedGuideline) {
    return (
      <aside className="w-[360px] h-full bg-neutral-950 border-r border-white/5 flex flex-col p-6 gap-6 overflow-y-auto custom-scrollbar anim-fade-in">
        <header className="flex items-center justify-between">
          <button
            onClick={() => setShowVault(false)}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Voltar
          </button>
          <div className="text-[10px] font-bold uppercase tracking-widest text-brand-cyan px-2 py-1 bg-brand-cyan/10 rounded-full border border-brand-cyan/20">
            Brand Vault
          </div>
        </header>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white">Adicionar Asset</h2>
          </div>
          <label className="cursor-pointer group">
            <input type="file" className="hidden" accept="image/*" onChange={handleVaultUpload} disabled={isUploading} />
            <div className="w-full h-32 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 bg-neutral-900/20 group-hover:bg-neutral-900/40 group-hover:border-brand-cyan/30 transition-all">
              {isUploading ? (
                <Loader2 size={24} className="text-brand-cyan animate-spin" />
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-500 group-hover:text-brand-cyan transition-colors">
                    <Plus size={20} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 group-hover:text-neutral-400">Clique para Subir à Brand</span>
                </>
              )}
            </div>
          </label>
        </section>

        <section className="flex flex-col gap-6">
          {(selectedGuideline.logos?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-1">Logos</h3>
              <div className="grid grid-cols-3 gap-2">
                {selectedGuideline.logos?.map((logo, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setUploadedBackgroundUrl(logo.url!);
                      setShowVault(false);
                    }}
                    className="aspect-square rounded-xl border border-white/5 bg-neutral-900/40 p-2 hover:border-brand-cyan/40 transition-all group overflow-hidden"
                  >
                    <img src={getProxiedUrl(logo.url)} alt="Brand logo" className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {(selectedGuideline.media?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-1">Brand Media</h3>
              <div className="grid grid-cols-2 gap-2">
                {selectedGuideline.media?.map((media, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setUploadedBackgroundUrl(media.url!);
                      setShowVault(false);
                    }}
                    className="aspect-video rounded-xl border border-white/5 bg-neutral-900/40 p-1.5 hover:border-brand-cyan/40 transition-all group overflow-hidden"
                  >
                    <img src={getProxiedUrl(media.url)} alt="Brand media" className="w-full h-full object-cover rounded-lg group-hover:scale-110 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {(selectedGuideline.colors?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-1">Cores</h3>
              <div className="flex flex-wrap gap-2 px-1">
                {selectedGuideline.colors?.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      navigator.clipboard.writeText(color.hex || '');
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
      className="w-[360px] h-full bg-neutral-950 border-r border-white/5 flex flex-col p-5 gap-5 overflow-y-auto"
      data-vsn-section="setup"
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-white font-bold text-sm tracking-[0.2em] uppercase">
              Visant Labs<span className="text-brand-cyan">®</span>
            </h1>
            <span className="px-1.5 py-0.5 rounded-full bg-neutral-900 border border-white/5 text-[10px] font-bold text-neutral-600 uppercase">
              v1.1
            </span>
          </div>
          <p className="text-[10px] text-neutral-600 font-mono mt-1 lowercase tracking-tight">
            conceito → sincronia → produção
          </p>
        </div>
        <button
          onClick={() => navigate('/create/projects')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-neutral-900/60 border border-white/5 hover:border-brand-cyan/30 text-[10px] font-mono uppercase tracking-wider text-neutral-400 hover:text-brand-cyan transition-colors"
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
              onChange={(val) => setBrandId(val || null)}
              disabled={status !== 'setup'}
              placeholder="Selecione a marca..."
              variant="node"
              className="h-12"
              options={guidelines.map(g => ({
                value: g.id!,
                label: g.identity?.name || 'Sem nome'
              }))}
            />
          </div>
          <button
            onClick={() => setWizardOpen(true)}
            disabled={status !== 'setup'}
            className="w-12 h-12 shrink-0 bg-neutral-950/40 border border-white/5 rounded-xl flex items-center justify-center text-neutral-500 hover:text-brand-cyan hover:border-brand-cyan/30 transition-all hover:bg-neutral-900/60 disabled:opacity-50"
            title="Nova marca"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 px-1">
          Ideia
        </label>
        <div className="relative group">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={status !== 'setup'}
            placeholder="O que você quer criar hoje?"
            rows={4}
            className="w-full bg-neutral-900/40 border border-white/5 rounded-2xl px-4 py-4 text-sm leading-relaxed text-white placeholder:text-neutral-700 focus:outline-none focus:border-brand-cyan/40 focus:bg-neutral-900/60 transition-all resize-none disabled:opacity-50"
            data-vsn-input="prompt"
          />
          <div className="absolute bottom-3 right-3 text-[10px] font-mono text-neutral-700 pointer-events-none uppercase tracking-tighter">
            {prompt.length} letras
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 px-1">
          Formato
        </label>
        <div className="grid grid-cols-2 gap-2">
          {FORMAT_OPTS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFormat(opt.id as CreativeFormat)}
              disabled={status !== 'setup'}
              className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 group ${format === opt.id
                ? 'bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan shadow-lg shadow-brand-cyan/5'
                : 'bg-neutral-900/40 border-white/5 text-neutral-500 hover:text-white hover:bg-neutral-900/60 hover:border-white/10'
                }`}
            >
              <opt.icon size={18} strokeWidth={format === opt.id ? 2 : 1.5} className="transition-transform group-hover:scale-110" />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">{opt.label}</span>
                <span className="text-[10px] opacity-40 font-mono lowercase tracking-tighter">{opt.sub}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 px-1">
          Fundo
        </label>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-900/40 rounded-2xl border border-white/5">
          <button
            onClick={() => setBackgroundMode('ai')}
            disabled={status !== 'setup'}
            className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${backgroundMode === 'ai'
              ? 'bg-neutral-800 text-brand-cyan shadow-xl border border-white/5'
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
            className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${backgroundMode === 'brand'
              ? 'bg-neutral-800 text-brand-cyan shadow-xl border border-white/5'
              : 'text-neutral-500 hover:text-neutral-300'
              }`}
          >
            <Briefcase size={11} strokeWidth={2} /> Vault
          </button>
          <button
            onClick={() => setBackgroundMode('upload')}
            disabled={status !== 'setup'}
            className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${backgroundMode === 'upload'
              ? 'bg-neutral-800 text-brand-cyan shadow-xl border border-white/5'
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
                <div className="w-full bg-neutral-900/40 border border-dashed border-white/10 rounded-2xl px-4 py-8 text-center text-[10px] font-bold text-neutral-600 hover:text-white hover:border-brand-cyan/30 transition-all flex flex-col items-center gap-2 group-hover:bg-neutral-900/60">
                  <Upload size={16} className="opacity-40 group-hover:text-brand-cyan transition-colors" />
                  <span className="uppercase tracking-widest">Subir Imagem Local</span>
                </div>
              ) : (
                <div className="relative w-full aspect-video rounded-2xl border border-white/5 overflow-hidden bg-neutral-900/40 hover:border-brand-cyan/30 transition-all shadow-2xl">
                  <img
                    src={getProxiedUrl(uploadedBackgroundUrl)}
                    alt="Uploaded Asset"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 backdrop-blur-[2px]">
                    <Upload size={18} className="text-brand-cyan" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white">Trocar Arquivo</span>
                  </div>
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-cyan/80">Local File</span>
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
                className="w-full bg-neutral-900/40 border border-dashed border-white/10 rounded-2xl px-4 py-8 text-center text-[10px] font-bold text-neutral-600 hover:text-white hover:border-brand-cyan/30 transition-all flex flex-col items-center gap-2 hover:bg-neutral-900/60"
              >
                <div className="flex flex-col items-center gap-2">
                  <Briefcase size={16} className="opacity-40 hover:text-brand-cyan transition-colors" />
                  <span className="uppercase tracking-widest">Selecione do Vault</span>
                </div>
              </button>
            ) : (
              <div
                onClick={() => setShowVault(true)}
                className="group cursor-pointer relative w-full aspect-video rounded-2xl border border-white/5 overflow-hidden bg-neutral-900/40 hover:border-brand-cyan/30 transition-all shadow-2xl"
              >
                <img
                  src={getProxiedUrl(uploadedBackgroundUrl)}
                  alt="Selected Asset"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 backdrop-blur-[2px]">
                  <Briefcase size={18} className="text-brand-cyan" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white">Trocar Asset</span>
                </div>
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-cyan/80">Vault Asset</span>
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
          onModelChange={(m, p) => setModel(m, p)}
          resolution={resolution}
          onSyncResolution={setResolution}
          disabled={status !== 'setup'}
          className="model-selector-creative"
        />
      </div>

      <div className="mt-auto pt-4">
        <div className="flex flex-col gap-3">
          <Button
            variant="brand"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full py-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-brand-cyan/10 group overflow-hidden relative"
          >
            {status === 'generating' ? (
              <div className="flex flex-col items-center gap-1 w-full scale-75">
                <PremiumGlitchLoader color="#00e5ff" className="w-full justify-center" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-2">
                  <Diamond size={18} className="group-hover:rotate-12 transition-transform" />
                  <span className="uppercase tracking-[0.2em]">Ignite</span>
                </div>
              </div>
            )}
          </Button>

          {!status || status === 'setup' && (
            <div className="flex items-center justify-center gap-1.5 animate-in fade-in slide-in-from-bottom-2">
              <Gem size={10} className="text-brand-cyan opacity-80" />
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                Esta geração custará <span className="text-white font-bold">{creditsRequired}</span> {creditsRequired === 1 ? 'crédito' : 'créditos'}
              </span>
            </div>
          )}
        </div>
      </div>

      <BrandGuidelineWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={(id) => {
          setBrandId(id);
          setWizardOpen(false);
        }}
      />
    </aside>
  );
};
