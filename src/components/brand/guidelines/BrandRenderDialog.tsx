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
import { Layout, Download, Save, RotateCcw, Zap, Pencil } from '@/lib/ui/icons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { downloadImage } from '@/utils/imageUtils';
import { useTranslation } from '@/hooks/useTranslation';
import { Thumb } from '@/components/ui/Thumb';

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
  const { t } = useTranslation();
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
        setTemplate((cur) => cur || r.presets?.[0]?.id || '');
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
      toast.error(t('brandRender.needTemplate'));
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
      toast.error(e instanceof Error ? e.message : t('brandRender.failed'));
      setView('form');
    }
  }, [guidelineId, template, h1, h2, infos, brief, halftone, t]);

  const saveToMedia = useCallback(async () => {
    if (!result) return;
    setSaving(true);
    try {
      await brandGuidelineApi.uploadMediaFromUrl(
        guidelineId,
        result.url,
        `Post: ${h1.slice(0, 40)}`
      );
      setSaved(true);
      toast.success(t('brandRender.saved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('brandRender.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [result, guidelineId, h1, t]);

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
            <Layout size={14} className="text-muted-foreground" />
            <DialogTitle>{t('brandRender.title')}</DialogTitle>
          </div>
          <DialogDescription>{t('brandRender.description')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          {view === 'form' && (
            <div className="space-y-4">
              {presets.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('brandRender.template')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setTemplate(p.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-xl text-xs border transition-colors',
                          template === p.id
                            ? 'border-ring bg-muted text-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted/50'
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
                placeholder={t('brandRender.headline')}
                className="text-sm"
              />
              <Input
                value={h2}
                onChange={(e) => setH2(e.target.value)}
                placeholder={t('brandRender.subtitle')}
                className="text-sm"
              />
              <Textarea
                value={infos}
                onChange={(e) => setInfos(e.target.value)}
                placeholder={t('brandRender.infos')}
                className="text-sm min-h-[64px] resize-none"
              />
              <Input
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder={t('brandRender.brief')}
                className="text-sm"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={halftone}
                  onChange={(e) => setHalftone(e.target.checked)}
                />
                <Zap size={12} /> {t('brandRender.halftone')}
              </label>
              <div className="flex justify-end pt-1">
                <Button
                  onClick={render}
                  disabled={!h1.trim() || !template}
                  className="h-8 px-4 gap-2 text-xs"
                >
                  <Pencil size={12} /> {t('brandRender.render')}
                </Button>
              </div>
            </div>
          )}

          {view === 'rendering' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <GlitchLoader size={20} />
              <p className="text-xs text-muted-foreground">{t('brandRender.rendering')}</p>
            </div>
          )}

          {view === 'result' && result && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border overflow-hidden bg-muted/40">
                <Thumb src={result.url} alt={h1} className="w-full" />
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw size={12} /> {t('brandRender.another')}
                </button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => downloadImage(result.url, h1 || 'post')}
                    className="h-8 px-3 gap-1.5 text-xs"
                  >
                    <Download size={12} /> {t('common.download')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={saveToMedia}
                    disabled={saving || saved}
                    className="h-8 px-3 gap-1.5 text-xs"
                  >
                    <Save size={12} />{' '}
                    {saved
                      ? t('brandRender.savedShort')
                      : saving
                        ? t('common.saving')
                        : t('brandRender.saveToBrand')}
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
