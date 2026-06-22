import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Layout, Download, Save, RotateCcw, Zap, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { downloadImage } from '@/utils/imageUtils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guidelineId: string;
  /** Prefill (e.g. from a seasonal suggestion). */
  initial?: { template?: string; h1?: string; brief?: string };
}

interface WebPreset {
  id: string;
  width: number;
  height: number;
}
type View = 'form' | 'rendering' | 'result';

export const BrandRenderDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  guidelineId,
  initial,
}) => {
  const [presets, setPresets] = useState<WebPreset[]>([]);
  const [template, setTemplate] = useState(initial?.template || '');
  const [h1, setH1] = useState(initial?.h1 || '');
  const [h2, setH2] = useState('');
  const [infos, setInfos] = useState('');
  const [brief, setBrief] = useState(initial?.brief || '');
  const [halftone, setHalftone] = useState(false);
  const [view, setView] = useState<View>('form');
  const [result, setResult] = useState<{ url: string; width: number; height: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open || !guidelineId) return;
    brandGuidelineApi
      .getWebPresets(guidelineId)
      .then((r) => {
        setPresets(r.presets || []);
        setTemplate((t) => t || r.presets?.[0]?.id || '');
      })
      .catch(() => {});
  }, [open, guidelineId]);

  useEffect(() => {
    if (open && initial) {
      if (initial.h1) setH1(initial.h1);
      if (initial.brief) setBrief(initial.brief);
      if (initial.template) setTemplate(initial.template);
    }
  }, [open, initial]);

  const render = useCallback(async () => {
    if (!h1.trim() || !template) {
      toast.error('Escolha um template e escreva a manchete');
      return;
    }
    setView('rendering');
    setSaved(false);
    try {
      const res = await brandGuidelineApi.renderPreset(guidelineId, {
        template,
        text: {
          h1: h1.trim(),
          ...(h2.trim() ? { h2: h2.trim() } : {}),
          ...(infos.trim()
            ? {
                infos: infos
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean),
              }
            : {}),
        },
        brief: brief.trim() || undefined,
        effect: halftone ? { mode: 'halftone' } : undefined,
      });
      setResult({ url: res.url, width: res.width, height: res.height });
      setView('result');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao renderizar');
      setView('form');
    }
  }, [guidelineId, template, h1, h2, infos, brief, halftone]);

  const saveToMedia = useCallback(async () => {
    if (!result) return;
    setSaving(true);
    try {
      await brandGuidelineApi.uploadMediaFromUrl(
        guidelineId,
        result.url,
        `Post — ${h1.slice(0, 40)}`
      );
      setSaved(true);
      toast.success('Salvo no Media Kit');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }, [result, guidelineId, h1]);

  const reset = useCallback(() => {
    setView('form');
    setResult(null);
    setSaved(false);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <Layout size={14} className="text-violet-400" />
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.15em]">
              Render on-brand
            </DialogTitle>
          </div>
          <DialogDescription className="text-[11px] text-neutral-500">
            Cores, fontes, logo e foto da marca — renderizado full-web, sem Figma.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {view === 'form' && (
            <div className="space-y-4">
              {presets.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                    Template
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setTemplate(p.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[11px] border transition-colors',
                          template === p.id
                            ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                            : 'border-neutral-800 text-neutral-400 hover:bg-white/5'
                        )}
                      >
                        {p.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Input
                value={h1}
                onChange={(e) => setH1(e.target.value)}
                placeholder="Manchete (h1)"
                className="text-sm"
              />
              <Input
                value={h2}
                onChange={(e) => setH2(e.target.value)}
                placeholder="Subtítulo (opcional)"
                className="text-sm"
              />
              <Textarea
                value={infos}
                onChange={(e) => setInfos(e.target.value)}
                placeholder="Infos — uma por linha (data, preço, @perfil)…"
                className="border-neutral-800 bg-transparent text-sm min-h-[64px] resize-none"
              />
              <Input
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Brief da foto (vibe — opcional)"
                className="text-sm"
              />
              <label className="flex items-center gap-2 text-[12px] text-neutral-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={halftone}
                  onChange={(e) => setHalftone(e.target.checked)}
                />
                <Zap size={12} className="text-violet-400" /> Efeito halftone na foto
              </label>
              <div className="flex justify-end pt-1">
                <Button
                  onClick={render}
                  disabled={!h1.trim() || !template}
                  className="h-8 px-4 gap-2 text-xs bg-violet-500/20 border border-violet-500/30 text-violet-200 hover:bg-violet-500/30"
                >
                  <Pencil size={12} /> Renderizar
                </Button>
              </div>
            </div>
          )}

          {view === 'rendering' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <GlitchLoader size={20} />
              <p className="text-[11px] text-neutral-500 font-mono uppercase tracking-widest">
                Renderizando…
              </p>
            </div>
          )}

          {view === 'result' && result && (
            <div className="space-y-4">
              <div className="rounded-lg border border-neutral-800 overflow-hidden bg-neutral-950">
                <img src={result.url} alt="Render" className="w-full" />
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-neutral-300"
                >
                  <RotateCcw size={10} /> Outro
                </button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => downloadImage(result.url, h1 || 'post')}
                    className="h-8 px-3 gap-1.5 text-xs text-neutral-400"
                  >
                    <Download size={12} /> Download
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={saveToMedia}
                    disabled={saving || saved}
                    className="h-8 px-3 gap-1.5 text-xs text-neutral-400"
                  >
                    <Save size={12} /> {saved ? 'Salvo' : saving ? 'Salvando…' : 'Salvar na marca'}
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
