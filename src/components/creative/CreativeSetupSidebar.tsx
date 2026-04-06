import React, { useState } from 'react';
import { Plus, Upload, Sparkles } from 'lucide-react';
import { useCreativeStore } from './store/creativeStore';
import { useBrandKit } from '@/contexts/BrandKitContext';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { BrandGuidelineWizardModal } from '@/components/mockupmachine/BrandGuidelineWizardModal';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { generateCreative } from './lib/generateCreative';
import { toast } from 'sonner';
import type { CreativeFormat } from './store/creativeTypes';

const FORMATS: CreativeFormat[] = ['1:1', '9:16', '16:9', '4:5'];

export const CreativeSetupSidebar: React.FC = () => {
  const {
    brandId,
    prompt,
    format,
    backgroundMode,
    uploadedBackgroundUrl,
    status,
    setBrandId,
    setPrompt,
    setFormat,
    setBackgroundMode,
    setUploadedBackgroundUrl,
    setStatus,
    hydrateFromAI,
  } = useCreativeStore();

  const { data: guidelines = [] } = useBrandGuidelines();
  const { activeGuideline } = useBrandKit();
  const [wizardOpen, setWizardOpen] = useState(false);

  // Use either explicitly selected brand or context-active brand
  const selectedGuideline =
    guidelines.find((g) => g.id === brandId) ?? activeGuideline ?? null;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setUploadedBackgroundUrl(url);
  };

  const canGenerate =
    !!selectedGuideline && prompt.trim().length > 0 && status === 'setup';

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setStatus('generating');
    try {
      if (backgroundMode === 'upload' && uploadedBackgroundUrl) {
        const result = await generateCreative({
          prompt,
          format,
          guideline: selectedGuideline,
        });
        hydrateFromAI({
          backgroundUrl: uploadedBackgroundUrl,
          overlay: result.overlay,
          layers: result.layers,
        });
      } else {
        const result = await generateCreative({
          prompt,
          format,
          guideline: selectedGuideline,
        });
        hydrateFromAI(result);
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Falha ao gerar criativo');
      setStatus('setup');
    }
  };

  return (
    <aside className="w-[360px] h-full bg-neutral-950 border-r border-white/5 flex flex-col p-5 gap-5 overflow-y-auto">
      <div>
        <h1 className="text-white font-mono text-sm font-bold uppercase tracking-wider">
          Creative Studio
        </h1>
        <p className="text-neutral-500 font-mono text-[10px] mt-1 lowercase">
          prompt → brand → gerar → editar
        </p>
      </div>

      {/* Brand */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
          Marca
        </label>
        <div className="flex gap-2">
          <select
            value={brandId ?? ''}
            onChange={(e) => setBrandId(e.target.value || null)}
            disabled={status !== 'setup'}
            className="flex-1 bg-neutral-900/60 border border-white/10 rounded-md px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-brand-cyan/50"
          >
            <option value="">Selecione...</option>
            {guidelines.map((g) => (
              <option key={g.id} value={g.id}>
                {g.identity?.name || 'Sem nome'}
              </option>
            ))}
          </select>
          <button
            onClick={() => setWizardOpen(true)}
            disabled={status !== 'setup'}
            className="px-3 bg-neutral-900/60 border border-white/10 rounded-md text-neutral-400 hover:text-brand-cyan hover:border-brand-cyan/30 transition-colors"
            title="Nova marca"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Prompt */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={status !== 'setup'}
          placeholder="Descreva seu criativo..."
          rows={4}
          className="w-full bg-neutral-900/60 border border-white/10 rounded-md px-3 py-2.5 text-sm font-mono text-white placeholder:text-neutral-700 focus:outline-none focus:border-brand-cyan/50 resize-none"
        />
      </div>

      {/* Format */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
          Formato
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              disabled={status !== 'setup'}
              className={`px-2 py-2 rounded text-[11px] font-mono border transition-all ${
                format === f
                  ? 'bg-brand-cyan/10 border-brand-cyan/50 text-brand-cyan'
                  : 'bg-neutral-900/60 border-white/10 text-neutral-500 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Background mode */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
          Fundo
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setBackgroundMode('ai')}
            disabled={status !== 'setup'}
            className={`px-2 py-2 rounded text-[11px] font-mono border transition-all flex items-center justify-center gap-1.5 ${
              backgroundMode === 'ai'
                ? 'bg-brand-cyan/10 border-brand-cyan/50 text-brand-cyan'
                : 'bg-neutral-900/60 border-white/10 text-neutral-500 hover:text-white'
            }`}
          >
            <Sparkles size={12} /> IA
          </button>
          <button
            onClick={() => setBackgroundMode('upload')}
            disabled={status !== 'setup'}
            className={`px-2 py-2 rounded text-[11px] font-mono border transition-all flex items-center justify-center gap-1.5 ${
              backgroundMode === 'upload'
                ? 'bg-brand-cyan/10 border-brand-cyan/50 text-brand-cyan'
                : 'bg-neutral-900/60 border-white/10 text-neutral-500 hover:text-white'
            }`}
          >
            <Upload size={12} /> Subir
          </button>
        </div>
        {backgroundMode === 'upload' && (
          <label className="mt-1 cursor-pointer block bg-neutral-900/60 border border-dashed border-white/10 rounded-md px-3 py-3 text-center text-[11px] font-mono text-neutral-500 hover:text-white hover:border-brand-cyan/30">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            {uploadedBackgroundUrl ? 'Imagem carregada ✓' : 'Clique para subir imagem'}
          </label>
        )}
      </div>

      {/* Generate */}
      <div className="mt-auto">
        <Button
          variant="brand"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="w-full py-3 font-mono text-sm font-bold flex items-center justify-center gap-2"
        >
          {status === 'generating' ? (
            <>
              <GlitchLoader size={14} />
              <span>Gerando...</span>
            </>
          ) : (
            <>
              <Sparkles size={14} />
              <span>Gerar Criativo</span>
            </>
          )}
        </Button>
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
