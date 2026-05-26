import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { ModelSelector } from '@/components/shared/ModelSelector';
import { ResolutionSelector } from '@/components/reactflow/shared/ResolutionSelector';
import { AspectRatioSelector } from '@/components/reactflow/shared/AspectRatioSelector';
import { mockupApi } from '@/services/mockupApi';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { Image, Download, RotateCcw, Save, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import type { BrandGuideline } from '@/lib/figma-types';
import type { Resolution, AspectRatio, GeminiModel } from '@/types/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guideline: BrandGuideline;
}

interface Suggestion {
  prompt: string;
  category: string;
  aspectRatio: string;
  label: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  stationery: '📇', packaging: '📦', apparel: '👕', signage: '🏪',
  digital: '📱', environmental: '🏢', merchandise: '☕', editorial: '📰',
};

type View = 'form' | 'suggestions' | 'loading' | 'generating' | 'result';

export const BrandMockupDialog: React.FC<Props> = ({ open, onOpenChange, guideline }) => {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<string>(GEMINI_MODELS.IMAGE_NB2);
  const [resolution, setResolution] = useState<Resolution>('1K');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [view, setView] = useState<View>('form');
  const [result, setResult] = useState<{ url: string; creditsDeducted: number; creditsRemaining: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [batchResults, setBatchResults] = useState<Array<{ url: string; prompt: string; label: string } | null>>([]);
  const [batchProgress, setBatchProgress] = useState(0);

  const credits = useMemo(() => getCreditsRequired(model, resolution), [model, resolution]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) { toast.error('Descreva a cena do mockup'); return; }
    setView('generating');
    setResult(null);
    try {
      const res = await mockupApi.generate({
        promptText: prompt,
        model,
        resolution,
        aspectRatio,
        brandGuidelineId: guideline.id,
        provider: model.startsWith('seedream') ? 'seedream' : model.startsWith('gpt-image') ? 'openai' : 'gemini',
        uniqueId: `brand-mockup-${Date.now()}`,
      });
      const url = res.imageUrl || (res.imageBase64 ? `data:image/png;base64,${res.imageBase64}` : '');
      if (url) {
        setResult({ url, creditsDeducted: res.creditsDeducted, creditsRemaining: res.creditsRemaining });
        setView('result');
        toast.success(`Mockup gerado (${res.creditsDeducted} crédito${res.creditsDeducted !== 1 ? 's' : ''})`);
        mockupApi.save({
          imageUrl: res.imageUrl || undefined,
          imageBase64: !res.imageUrl ? res.imageBase64 : undefined,
          prompt,
          designType: 'brand-mockup',
          tags: ['brand-guidelines'],
          brandingTags: [guideline.identity?.name || ''].filter(Boolean),
          aspectRatio,
        } as any).catch(() => {});
      } else {
        toast.error('Nenhuma imagem retornada');
        setView('form');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar mockup');
      setView('form');
    }
  }, [prompt, model, resolution, aspectRatio, guideline.id]);

  const handleSurpriseMe = useCallback(async () => {
    setView('loading');
    setSuggestions([]);
    setSelectedSuggestions(new Set());
    setBatchResults([]);
    try {
      const res = await brandGuidelineApi.suggestMockups(guideline.id!, 10);
      setSuggestions(res.suggestions);
      setSelectedSuggestions(new Set(res.suggestions.slice(0, 3).map((_, i) => i)));
      setView('suggestions');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao sugerir mockups');
      setView('form');
    }
  }, [guideline.id]);

  const toggleSuggestion = useCallback((i: number) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const handleGenerateBatch = useCallback(async () => {
    const selected = Array.from(selectedSuggestions).sort();
    if (selected.length === 0) return;
    setView('generating');
    setBatchProgress(0);
    const results: Array<{ url: string; prompt: string; label: string } | null> = [];

    for (let idx = 0; idx < selected.length; idx++) {
      const s = suggestions[selected[idx]];
      const ar = (['1:1', '16:9', '9:16', '4:3', '4:5'].includes(s.aspectRatio) ? s.aspectRatio : '1:1') as AspectRatio;
      try {
        const res = await mockupApi.generate({
          promptText: s.prompt,
          model,
          resolution,
          aspectRatio: ar,
          brandGuidelineId: guideline.id,
          provider: model.startsWith('seedream') ? 'seedream' : model.startsWith('gpt-image') ? 'openai' : 'gemini',
          uniqueId: `brand-surprise-${Date.now()}-${idx}`,
        });
        const url = res.imageUrl || (res.imageBase64 ? `data:image/png;base64,${res.imageBase64}` : '');
        if (url) {
          results.push({ url, prompt: s.prompt, label: s.label });
          mockupApi.save({
            imageUrl: res.imageUrl || undefined,
            imageBase64: !res.imageUrl ? res.imageBase64 : undefined,
            prompt: s.prompt,
            designType: 'brand-mockup',
            tags: ['brand-guidelines', s.category],
            brandingTags: [guideline.identity?.name || ''].filter(Boolean),
            aspectRatio: ar,
          } as any).catch(() => {});
        } else {
          results.push(null);
        }
      } catch {
        results.push(null);
      }
      setBatchProgress(idx + 1);
    }

    setBatchResults(results);
    const successCount = results.filter(Boolean).length;
    if (successCount > 0) {
      toast.success(`${successCount}/${selected.length} mockups gerados`);
      setView('result');
    } else {
      toast.error('Nenhum mockup gerado');
      setView('suggestions');
    }
  }, [selectedSuggestions, suggestions, model, resolution, guideline.id]);

  const handleSaveToMedia = useCallback(async (url: string, label: string) => {
    if (!guideline.id) return;
    setSaving(true);
    try {
      if (url.startsWith('data:')) {
        await brandGuidelineApi.uploadMedia(guideline.id, url, label);
      } else {
        await brandGuidelineApi.uploadMediaFromUrl(guideline.id, url, label);
      }
      toast.success('Salvo no Media Kit');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }, [guideline.id]);

  const handleSaveAll = useCallback(async () => {
    const valid = batchResults.filter(Boolean) as Array<{ url: string; prompt: string; label: string }>;
    setSaving(true);
    let count = 0;
    for (const r of valid) {
      try {
        if (r.url.startsWith('data:')) {
          await brandGuidelineApi.uploadMedia(guideline.id!, r.url, `Mockup — ${r.label}`);
        } else {
          await brandGuidelineApi.uploadMediaFromUrl(guideline.id!, r.url, `Mockup — ${r.label}`);
        }
        count++;
      } catch { /* skip */ }
    }
    setSaved(true);
    setSaving(false);
    toast.success(`${count} mockup${count !== 1 ? 's' : ''} salvo${count !== 1 ? 's' : ''} no Media Kit`);
  }, [batchResults, guideline.id]);

  const handleDownload = useCallback((url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-${Date.now()}.png`;
    a.click();
  }, []);

  const resetToForm = useCallback(() => {
    setView('form');
    setResult(null);
    setSaved(false);
    setBatchResults([]);
    setSuggestions([]);
  }, []);

  const brandName = guideline.identity?.name || guideline.name || 'Brand';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('transition-all', batchResults.filter(Boolean).length > 1 ? 'max-w-3xl' : 'max-w-lg')}>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <Image size={14} className="text-violet-400" />
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.15em]">
              Create Mockup
            </DialogTitle>
          </div>
          <DialogDescription className="text-[11px] text-neutral-500">
            {brandName} — logos, cores e tipografia são injetados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* ── FORM ── */}
          {view === 'form' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <MicroTitle className="text-neutral-500">Cena</MicroTitle>
                  <button
                    onClick={handleSurpriseMe}
                    className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <Sparkles size={10} />
                    Surprise me
                  </button>
                </div>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="border-neutral-800 bg-transparent text-sm text-neutral-300 min-h-[80px] resize-none placeholder:text-neutral-700"
                  placeholder="ex: cartão de visita em mesa de mármore, iluminação quente, flat lay..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <MicroTitle className="text-neutral-500">Modelo</MicroTitle>
                  <ModelSelector
                    selectedModel={model}
                    onModelChange={(m) => setModel(m)}
                    type="image"
                    resolution={resolution}
                    onSyncResolution={setResolution}
                  />
                </div>
                <div className="space-y-1.5">
                  <MicroTitle className="text-neutral-500">Resolução</MicroTitle>
                  <ResolutionSelector
                    value={resolution}
                    onChange={setResolution}
                    model={model as GeminiModel}
                    compact
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <MicroTitle className="text-neutral-500">Proporção</MicroTitle>
                <AspectRatioSelector
                  value={aspectRatio}
                  onChange={setAspectRatio}
                  compact
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] font-mono text-neutral-600">
                  {credits} crédito{credits !== 1 ? 's' : ''}
                </span>
                <Button
                  onClick={handleGenerate}
                  disabled={!prompt.trim()}
                  className="h-8 px-4 gap-2 text-xs bg-violet-500/20 border border-violet-500/30 text-violet-200 hover:bg-violet-500/30"
                >
                  <Image size={12} />
                  Gerar Mockup
                </Button>
              </div>
            </div>
          )}

          {/* ── SUGGESTIONS ── */}
          {view === 'suggestions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                  Selecione os mockups para gerar
                </p>
                <span className="text-[10px] font-mono text-neutral-600">
                  {selectedSuggestions.size} selecionado{selectedSuggestions.size !== 1 ? 's' : ''}
                  {' · '}{selectedSuggestions.size * credits} crédito{selectedSuggestions.size * credits !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => toggleSuggestion(i)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all',
                      selectedSuggestions.has(i)
                        ? 'border-violet-500/30 bg-violet-500/[0.06]'
                        : 'border-neutral-800 bg-white/[0.03] hover:bg-white/5'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5',
                      selectedSuggestions.has(i) ? 'border-violet-500 bg-violet-500' : 'border-neutral-600'
                    )}>
                      {selectedSuggestions.has(i) && <Check size={9} className="text-black" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs">{CATEGORY_EMOJI[s.category] || '🎨'}</span>
                        <span className="text-xs font-medium text-neutral-200">{s.label}</span>
                        <span className="text-[10px] font-mono text-neutral-600 bg-white/5 px-1.5 py-0.5 rounded">
                          {s.aspectRatio}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 line-clamp-2">{s.prompt}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={resetToForm}
                  className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-neutral-300"
                >
                  ← Voltar
                </button>
                <Button
                  onClick={handleGenerateBatch}
                  disabled={selectedSuggestions.size === 0}
                  className="h-8 px-4 gap-2 text-xs bg-violet-500/20 border border-violet-500/30 text-violet-200 hover:bg-violet-500/30"
                >
                  <Sparkles size={12} />
                  Gerar {selectedSuggestions.size} mockup{selectedSuggestions.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {/* ── LOADING (suggestions) ── */}
          {view === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <GlitchLoader size={20} />
              <p className="text-[11px] text-neutral-500 font-mono uppercase tracking-widest">
                Analisando a marca…
              </p>
            </div>
          )}

          {/* ── GENERATING ── */}
          {view === 'generating' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <GlitchLoader size={20} />
              <p className="text-[11px] text-neutral-500 font-mono uppercase tracking-widest">
                {batchResults.length === 0 && selectedSuggestions.size <= 1
                  ? 'Gerando mockup…'
                  : `Gerando ${batchProgress}/${selectedSuggestions.size}…`
                }
              </p>
            </div>
          )}

          {/* ── RESULT (single) ── */}
          {view === 'result' && result && batchResults.length === 0 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-neutral-800 overflow-hidden bg-neutral-950">
                <img src={result.url} alt="Generated mockup" className="w-full" />
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={resetToForm}
                  className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-neutral-300"
                >
                  <RotateCcw size={10} />
                  Gerar outro
                </button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => handleDownload(result.url, brandName)}
                    className="h-8 px-3 gap-1.5 text-xs text-neutral-400"
                  >
                    <Download size={12} />
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleSaveToMedia(result.url, `Mockup — ${prompt.slice(0, 40)}`)}
                    disabled={saving || saved}
                    className="h-8 px-3 gap-1.5 text-xs text-neutral-400"
                  >
                    <Save size={12} />
                    {saved ? 'Salvo' : saving ? 'Salvando…' : 'Salvar na marca'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── RESULT (batch) ── */}
          {view === 'result' && batchResults.length > 0 && (
            <div className="space-y-4">
              <div className={cn(
                'grid gap-3',
                batchResults.filter(Boolean).length === 1 ? 'grid-cols-1' :
                batchResults.filter(Boolean).length <= 4 ? 'grid-cols-2' : 'grid-cols-3'
              )}>
                {batchResults.map((r, i) => r && (
                  <div key={i} className="group relative rounded-lg border border-neutral-800 overflow-hidden bg-neutral-950">
                    <img src={r.url} alt={r.label} className="w-full aspect-square object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] text-neutral-300 font-medium truncate mr-2">{r.label}</span>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleDownload(r.url, r.label)}
                            className="w-6 h-6 rounded bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                          >
                            <Download size={10} className="text-white" />
                          </button>
                          <button
                            onClick={() => handleSaveToMedia(r.url, `Mockup — ${r.label}`)}
                            disabled={saving}
                            className="w-6 h-6 rounded bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                          >
                            <Save size={10} className="text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={resetToForm}
                  className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-neutral-300"
                >
                  <RotateCcw size={10} />
                  Novo
                </button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleSaveAll}
                    disabled={saving || saved}
                    className="h-8 px-3 gap-1.5 text-xs text-neutral-400"
                  >
                    <Save size={12} />
                    {saved ? 'Todos salvos' : saving ? 'Salvando…' : `Salvar todos (${batchResults.filter(Boolean).length})`}
                  </Button>
                  <Button
                    onClick={() => onOpenChange(false)}
                    className="h-8 px-4 text-xs bg-white/5 border border-white/15 text-neutral-200 hover:bg-white/10"
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
