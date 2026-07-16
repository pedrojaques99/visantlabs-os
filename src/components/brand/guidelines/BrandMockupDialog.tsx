import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GeneratingImageCard } from '@/components/ui/GeneratingImageCard';
import { TurbulenceField } from '@/components/ui/TurbulenceField';
import { ModelSelector, getPreferredImageModel } from '@/components/shared/ModelSelector';
import { ResolutionSelector } from '@/components/reactflow/shared/ResolutionSelector';
import { AspectRatioSelector } from '@/components/reactflow/shared/AspectRatioSelector';
import { GenerationActionButton } from '@/components/shared/GenerationActionButton';
import { mockupApi } from '@/services/mockupApi';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { resolveProvider } from '@/utils/canvas/generationContext';
import { IMAGE_MODEL_REGISTRY } from '@/constants/imageModelRegistry';
import { downloadImage } from '@/utils/imageUtils';
import {
  Image,
  Download,
  RotateCcw,
  Save,
  Dices,
  Pickaxe,
  Check,
  Square,
  AlertCircle,
} from '@/lib/ui/icons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { useCreditValidation } from '@/hooks/useCreditValidation';
import type { BrandGuideline } from '@/lib/figma-types';
import type { Resolution, AspectRatio, GeminiModel } from '@/types/types';

/** Narrow translate signature — matches useTranslation's `t`. */
type TFn = (key: string, params?: Record<string, string | number>) => string;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guideline: BrandGuideline;
  /** Seed the scene prompt (e.g. from an interactive suggestion → one-tap generate). */
  initialPrompt?: string;
}

interface Suggestion {
  prompt: string;
  category: string;
  aspectRatio: string;
  label: string;
}

type View = 'form' | 'suggestions' | 'loading' | 'generating' | 'result' | 'error';

/** The ratio set this dialog offers — passed to the shared AspectRatioSelector. */
const ASPECT_RATIOS: AspectRatio[] = ['1:1', '4:5', '4:3', '16:9', '9:16'];

// Map a backend error code/message to clean, actionable copy. The router only
// surfaces an error when EVERY provider failed (or the prompt itself was
// rejected) — so the message is about the prompt or a transient outage, never a
// raw 500 / model id.
function friendlyMockupError(
  err: any,
  t: TFn
): { title: string; detail: string; refunded: boolean } {
  const code = err?.errorData?.error || err?.code;
  const msg = String(err?.message || '').toLowerCase();
  if (code === 'image_generation_unavailable')
    return {
      title: t('brandMockupDialog.error.unavailable.title'),
      detail: t('brandMockupDialog.error.unavailable.detail'),
      refunded: true,
    };
  if (
    code === 'safety_blocked' ||
    msg.includes('safety') ||
    msg.includes('blocked') ||
    msg.includes('422')
  )
    return {
      title: t('brandMockupDialog.error.safety.title'),
      detail: t('brandMockupDialog.error.safety.detail'),
      refunded: true,
    };
  return {
    title: t('brandMockupDialog.error.generic.title'),
    detail: err?.message || t('brandMockupDialog.error.generic.detail'),
    refunded: true,
  };
}

export const BrandMockupDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  guideline,
  initialPrompt,
}) => {
  const { t } = useTranslation();
  const { onCreditPackagesModalOpen } = useLayout();
  // Upfront credit gate — mirrors MockupMachinePage so a batch never fires N
  // calls that fail into silent "erro" tiles when the user is out of credits;
  // instead it surfaces the standard credit/subscription modal.
  const { validateCredits } = useCreditValidation(1, onCreditPackagesModalOpen);

  // Seeded from an interactive suggestion when provided. The dialog is mounted
  // fresh on each open (conditionally rendered), so this initializer re-runs.
  const [prompt, setPrompt] = useState(initialPrompt ?? '');
  const [model, setModel] = useState<string>(() => getPreferredImageModel());
  const [resolution, setResolution] = useState<Resolution>('1K');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [view, setView] = useState<View>('form');
  const [errorInfo, setErrorInfo] = useState<ReturnType<typeof friendlyMockupError> | null>(null);
  const [result, setResult] = useState<{
    url: string;
    creditsDeducted: number;
    creditsRemaining: number;
    fellBack?: boolean;
    providerUsed?: string;
  } | null>(null);

  // When a single generation runs long, it's usually because the chosen model is
  // down and the router is cascading to a backup. Reassure instead of leaving a
  // silent spinner — surfaces only after ~6s so the common fast path stays clean.
  const [slowHint, setSlowHint] = useState(false);
  useEffect(() => {
    if (view !== 'generating') {
      setSlowHint(false);
      return;
    }
    const t = setTimeout(() => setSlowHint(true), 6000);
    return () => clearTimeout(t);
  }, [view]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [batchResults, setBatchResults] = useState<
    Array<{ url: string; prompt: string; label: string } | null>
  >([]);
  const [batchProgress, setBatchProgress] = useState(0);

  const batchTotalRef = useRef(0);
  const cancelledRef = useRef(false);

  const credits = useMemo(() => getCreditsRequired(model, resolution), [model, resolution]);

  const modelLabel = useMemo(
    () => IMAGE_MODEL_REGISTRY.find((m) => m.id === model)?.label || model,
    [model]
  );

  // What the brand injects — shown so the user sees *what comes out* before generating.
  const brandPreview = useMemo(() => {
    const colors = (guideline.colors || [])
      .slice()
      .sort((a, b) => (a.usageRank ?? 99) - (b.usageRank ?? 99));
    return {
      colors: colors.slice(0, 5),
      font: guideline.typography?.[0]?.family,
      logo: guideline.logos?.find((l) => l.variant === 'primary') || guideline.logos?.[0],
    };
  }, [guideline.colors, guideline.typography, guideline.logos]);

  const ratioCss = aspectRatio.replace(':', ' / ');
  // Fit the preview inside a fixed square so the modal height stays stable as
  // the aspect ratio changes (no layout jank when toggling 16:9 ↔ 9:16).
  const previewLandscape = (() => {
    const [w, h] = aspectRatio.split(':').map(Number);
    return !w || !h ? true : w >= h;
  })();

  const resetToForm = useCallback(() => {
    setView('form');
    setResult(null);
    setErrorInfo(null);
    setSaved(false);
    setBatchResults([]);
    setBatchProgress(0);
    batchTotalRef.current = 0;
    cancelledRef.current = false;
    setSuggestions([]);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        cancelledRef.current = true;
        resetToForm();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetToForm]
  );

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error(t('brandMockupDialog.toast.describeScene'));
      return;
    }
    // Credit gate before spending anything — validateCredits surfaces the
    // standard toast + upsell/credit-packages modal on shortfall.
    if (
      !(await validateCredits({ creditsNeeded: credits, model: model as GeminiModel, resolution }))
    )
      return;
    setView('generating');
    setResult(null);
    cancelledRef.current = false;
    try {
      const res = await mockupApi.generate({
        promptText: prompt,
        model,
        resolution,
        aspectRatio,
        strategy: 'quality',
        brandGuidelineId: guideline.id,
        provider: resolveProvider(model),
        uniqueId: `brand-mockup-${Date.now()}`,
      });
      if (cancelledRef.current) return;
      const url =
        res.imageUrl || (res.imageBase64 ? `data:image/png;base64,${res.imageBase64}` : '');
      if (url) {
        setResult({
          url,
          creditsDeducted: res.creditsDeducted,
          creditsRemaining: res.creditsRemaining,
          fellBack: res.fellBack,
          providerUsed: res.providerUsed,
        });
        setView('result');
        toast.success(
          t('brandMockupDialog.toast.generated', {
            count: res.creditsDeducted,
            plural: res.creditsDeducted !== 1 ? 's' : '',
          })
        );
        mockupApi
          .save({
            imageUrl: res.imageUrl || undefined,
            imageBase64: !res.imageUrl ? res.imageBase64 : undefined,
            prompt,
            designType: 'brand-mockup',
            tags: ['brand-guidelines'],
            brandingTags: [guideline.identity?.name || ''].filter(Boolean),
            brandGuidelineId: guideline.id,
            aspectRatio,
          } as any)
          .catch(() => {});
      } else {
        setErrorInfo({
          title: t('brandMockupDialog.error.noImage.title'),
          detail: t('brandMockupDialog.error.noImage.detail'),
          refunded: true,
        });
        setView('error');
      }
    } catch (err: any) {
      if (cancelledRef.current) return;
      setErrorInfo(friendlyMockupError(err, t));
      setView('error');
    }
  }, [prompt, model, resolution, aspectRatio, guideline.id, credits, validateCredits, t]);

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
      toast.error(err.message || t('brandMockupDialog.toast.suggestError'));
      setView('form');
    }
  }, [guideline.id, t]);

  const toggleSuggestion = useCallback((i: number) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const toggleAllSuggestions = useCallback(() => {
    setSelectedSuggestions((prev) => {
      if (prev.size === suggestions.length) return new Set();
      return new Set(suggestions.map((_, i) => i));
    });
  }, [suggestions]);

  const handleCancelBatch = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const handleGenerateBatch = useCallback(async () => {
    const selected = Array.from(selectedSuggestions).sort();
    if (selected.length === 0) return;
    // Gate the whole batch upfront — otherwise N calls would each fail into
    // silent "erro" tiles when the user can't afford the run.
    if (
      !(await validateCredits({
        creditsNeeded: selected.length * credits,
        model: model as GeminiModel,
        resolution,
      }))
    )
      return;
    setView('generating');
    setBatchProgress(0);
    setBatchResults(new Array(selected.length).fill(null));
    batchTotalRef.current = selected.length;
    cancelledRef.current = false;

    let successCount = 0;

    for (let idx = 0; idx < selected.length; idx++) {
      if (cancelledRef.current) break;

      const s = suggestions[selected[idx]];
      const ar = (
        ['1:1', '16:9', '9:16', '4:3', '4:5'].includes(s.aspectRatio) ? s.aspectRatio : '1:1'
      ) as AspectRatio;
      try {
        const res = await mockupApi.generate({
          promptText: s.prompt,
          model,
          resolution,
          aspectRatio: ar,
          strategy: 'quality',
          brandGuidelineId: guideline.id,
          provider: resolveProvider(model),
          uniqueId: `brand-surprise-${Date.now()}-${idx}`,
        });
        if (cancelledRef.current) break;
        const url =
          res.imageUrl || (res.imageBase64 ? `data:image/png;base64,${res.imageBase64}` : '');
        if (url) {
          const item = { url, prompt: s.prompt, label: s.label };
          setBatchResults((prev) => {
            const next = [...prev];
            next[idx] = item;
            return next;
          });
          successCount++;
          mockupApi
            .save({
              imageUrl: res.imageUrl || undefined,
              imageBase64: !res.imageUrl ? res.imageBase64 : undefined,
              prompt: s.prompt,
              designType: 'brand-mockup',
              tags: ['brand-guidelines', s.category],
              brandingTags: [guideline.identity?.name || ''].filter(Boolean),
              brandGuidelineId: guideline.id,
              aspectRatio: ar,
            } as any)
            .catch(() => {});
        }
      } catch {
        /* slot stays null */
      }
      setBatchProgress(idx + 1);
    }

    if (cancelledRef.current && successCount > 0) {
      toast.info(
        t('brandMockupDialog.toast.cancelled', {
          count: successCount,
          plural: successCount !== 1 ? 's' : '',
        })
      );
      setView('result');
    } else if (successCount > 0) {
      toast.success(
        t('brandMockupDialog.toast.batchDone', { count: successCount, total: selected.length })
      );
      setView('result');
    } else {
      toast.error(t('brandMockupDialog.toast.noneGenerated'));
      setView('suggestions');
    }
  }, [
    selectedSuggestions,
    suggestions,
    model,
    resolution,
    guideline.id,
    credits,
    validateCredits,
    t,
  ]);

  const handleSaveToMedia = useCallback(
    async (url: string, label: string) => {
      if (!guideline.id) return;
      setSaving(true);
      try {
        if (url.startsWith('data:')) {
          await brandGuidelineApi.uploadMedia(guideline.id, url, label);
        } else {
          await brandGuidelineApi.uploadMediaFromUrl(guideline.id, url, label);
        }
        toast.success(t('brandMockupDialog.toast.savedToMediaKit'));
      } catch (err: any) {
        toast.error(err.message || t('brandMockupDialog.toast.saveError'));
      } finally {
        setSaving(false);
      }
    },
    [guideline.id, t]
  );

  const handleSaveAll = useCallback(async () => {
    const valid = batchResults.filter(Boolean) as Array<{
      url: string;
      prompt: string;
      label: string;
    }>;
    setSaving(true);
    let count = 0;
    for (const r of valid) {
      try {
        const mediaLabel = t('brandMockupDialog.mediaLabel', { label: r.label });
        if (r.url.startsWith('data:')) {
          await brandGuidelineApi.uploadMedia(guideline.id!, r.url, mediaLabel);
        } else {
          await brandGuidelineApi.uploadMediaFromUrl(guideline.id!, r.url, mediaLabel);
        }
        count++;
      } catch {
        /* skip */
      }
    }
    setSaved(true);
    setSaving(false);
    toast.success(
      t('brandMockupDialog.toast.savedAllToMediaKit', {
        count,
        plural: count !== 1 ? 's' : '',
      })
    );
  }, [batchResults, guideline.id, t]);

  const handleDownload = useCallback((url: string, name: string) => {
    downloadImage(url, name);
  }, []);

  const brandName =
    guideline.identity?.name || guideline.name || t('brandMockupDialog.brandFallback');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'transition-all duration-500',
          view === 'suggestions' ||
            view === 'loading' ||
            (view === 'generating' && batchTotalRef.current > 1) ||
            batchResults.filter(Boolean).length > 1
            ? 'max-w-3xl'
            : 'max-w-lg'
        )}
      >
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <Image size={14} className="text-brand-cyan" />
            <DialogTitle className="text-sm font-bold uppercase tracking-[0.15em]">
              {t('brandMockupDialog.title')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-[11px] text-neutral-500">
            {t('brandMockupDialog.description', { brandName })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Keyed wrapper: remounts on every view change so each state animates
              in fluidly (enter transition) instead of a hard swap. */}
          <div
            key={view}
            className="animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-both"
          >
            {/* ── FORM ── */}
            {view === 'form' && (
              <div className="space-y-5">
                {/* Brand chip + live preview: what the generation will carry. The
                  swatch sits in a fixed square so the layout doesn't jump when
                  the aspect ratio changes. */}
                <div className="flex items-stretch gap-3">
                  <div className="shrink-0 w-24 h-24 rounded-lg border border-neutral-800 bg-neutral-950 flex items-center justify-center overflow-hidden">
                    <div
                      className="relative flex items-center justify-center overflow-hidden"
                      style={{
                        aspectRatio: ratioCss,
                        width: previewLandscape ? '100%' : 'auto',
                        height: previewLandscape ? 'auto' : '100%',
                        background:
                          brandPreview.colors.length > 1
                            ? `linear-gradient(135deg, ${brandPreview.colors[0].hex}, ${brandPreview.colors[1].hex})`
                            : brandPreview.colors[0]?.hex || '#0a0a0a',
                      }}
                      title={t('brandMockupDialog.form.brandPreviewTitle', {
                        aspectRatio,
                        resolution,
                      })}
                    >
                      {brandPreview.logo ? (
                        <img
                          src={brandPreview.logo.url}
                          alt=""
                          className="max-w-[60%] max-h-[60%] object-contain opacity-90"
                        />
                      ) : (
                        <span className="text-[10px] font-mono uppercase tracking-wider text-white/70 px-1 text-center">
                          {brandName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-center gap-2">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-600">
                      {t('brandMockupDialog.form.injectedFromBrand', { aspectRatio })}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {brandPreview.colors.map((c) => (
                        <span
                          key={c.hex}
                          className="w-4 h-4 rounded-full border border-white/10"
                          style={{ backgroundColor: c.hex }}
                          title={`${c.name} ${c.hex}`}
                        />
                      ))}
                    </div>
                    {brandPreview.font && (
                      <p
                        className="text-[11px] text-neutral-400 truncate"
                        style={{ fontFamily: brandPreview.font }}
                      >
                        {brandPreview.font}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <MicroTitle className="text-neutral-500">
                      {t('brandMockupDialog.form.scene')}
                    </MicroTitle>
                    <button
                      onClick={handleSurpriseMe}
                      className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-brand-cyan hover:text-brand-cyan/80 transition-colors"
                    >
                      <Dices size={10} />
                      {t('brandMockupDialog.form.surpriseMe')}
                    </button>
                  </div>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="border-neutral-800 bg-transparent text-sm text-neutral-300 min-h-[80px] resize-none placeholder:text-neutral-700"
                    placeholder={t('brandMockupDialog.form.scenePlaceholder')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <MicroTitle className="text-neutral-500">
                      {t('brandMockupDialog.form.model')}
                    </MicroTitle>
                    <ModelSelector
                      selectedModel={model}
                      onModelChange={(m) => setModel(m)}
                      type="image"
                      resolution={resolution}
                      onSyncResolution={setResolution}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <MicroTitle className="text-neutral-500">
                      {t('brandMockupDialog.form.resolution')}
                    </MicroTitle>
                    <ResolutionSelector
                      value={resolution}
                      onChange={setResolution}
                      model={model as GeminiModel}
                      compact
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <MicroTitle className="text-neutral-500">
                    {t('brandMockupDialog.form.aspectRatio')}
                  </MicroTitle>
                  <AspectRatioSelector
                    value={aspectRatio}
                    onChange={setAspectRatio}
                    ratios={ASPECT_RATIOS}
                  />
                </div>

                <div className="flex items-center justify-between border-t border-neutral-800/60 pt-4">
                  <span className="text-[10px] font-mono text-neutral-600">
                    {t('brandMockupDialog.form.summary', {
                      modelLabel,
                      resolution,
                      aspectRatio,
                      credits,
                      plural: credits !== 1 ? 's' : '',
                    })}
                  </span>
                  <GenerationActionButton
                    variant="primary"
                    onClick={handleGenerate}
                    disabled={!prompt.trim()}
                    icon={<Pickaxe size={16} />}
                    label={t('brandMockupDialog.form.generate')}
                    credits={credits}
                  />
                </div>
              </div>
            )}

            {/* ── ERROR (only when all providers failed / prompt rejected) ── */}
            {view === 'error' && errorInfo && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <AlertCircle size={22} className="text-neutral-500" />
                <p className="text-sm font-medium text-neutral-200">{errorInfo.title}</p>
                <p className="text-[12px] text-neutral-500 max-w-xs leading-relaxed">
                  {errorInfo.detail}
                </p>
                {errorInfo.refunded && (
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-600">
                    {t('brandMockupDialog.error.noCreditsCharged')}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    onClick={() => setView('form')}
                    variant="ghost"
                    className="h-8 px-3 text-xs text-neutral-400"
                  >
                    {t('brandMockupDialog.back')}
                  </Button>
                  <GenerationActionButton
                    variant="primary"
                    onClick={() => {
                      setErrorInfo(null);
                      handleGenerate();
                    }}
                    icon={<RotateCcw size={16} />}
                    label={t('brandMockupDialog.tryAgain')}
                  />
                </div>
              </div>
            )}

            {/* ── SUGGESTIONS ── */}
            {view === 'suggestions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                      {t('brandMockupDialog.suggestions.select')}
                    </p>
                    <button
                      onClick={toggleAllSuggestions}
                      className="text-[10px] font-mono text-brand-cyan hover:text-brand-cyan/80 transition-colors"
                    >
                      {selectedSuggestions.size === suggestions.length
                        ? t('brandMockupDialog.suggestions.none')
                        : t('brandMockupDialog.suggestions.all')}
                    </button>
                  </div>
                  <span className="text-[10px] font-mono text-neutral-600">
                    {t('brandMockupDialog.suggestions.creditsSummary', {
                      used: selectedSuggestions.size,
                      total: suggestions.length,
                      credits: selectedSuggestions.size * credits,
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto overflow-x-hidden pr-1">
                  {suggestions.map((s, i) => {
                    const selected = selectedSuggestions.has(i);
                    return (
                      <button
                        key={i}
                        onClick={() => toggleSuggestion(i)}
                        style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                        className={cn(
                          'group relative flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 fill-mode-both hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950',
                          selected
                            ? 'border-brand-cyan/40 bg-brand-cyan/[0.05] ring-1 ring-brand-cyan/20'
                            : 'border-neutral-800 bg-white/5 hover:border-neutral-700 hover:bg-white/10'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                            {s.aspectRatio}
                          </span>
                          <div
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                              selected ? 'border-brand-cyan bg-brand-cyan' : 'border-neutral-600'
                            )}
                          >
                            {selected && (
                              <Check
                                size={9}
                                className="text-black animate-in zoom-in-50 duration-200"
                              />
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-medium text-neutral-200">{s.label}</span>
                        <p className="line-clamp-3 text-[11px] leading-relaxed text-neutral-500">
                          {s.prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={resetToForm}
                    className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-neutral-300"
                  >
                    {t('brandMockupDialog.suggestions.back')}
                  </button>
                  <GenerationActionButton
                    variant="primary"
                    onClick={handleGenerateBatch}
                    disabled={selectedSuggestions.size === 0}
                    icon={<Pickaxe size={16} />}
                    label={t('brandMockupDialog.suggestions.generateCount', {
                      count: selectedSuggestions.size,
                      plural: selectedSuggestions.size !== 1 ? 's' : '',
                    })}
                    credits={selectedSuggestions.size * credits}
                  />
                </div>
              </div>
            )}

            {/* ── LOADING (suggestions) — skeleton grid with the same fog SSoT ── */}
            {view === 'loading' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <GlitchLoader size={12} />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                    {t('brandMockupDialog.loading.analyzing')}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      style={{ animationDelay: `${i * 60}ms` }}
                      className="relative flex flex-col gap-2 overflow-hidden rounded-xl border border-neutral-800 bg-white/5 p-3.5 animate-in fade-in fill-mode-both"
                    >
                      <TurbulenceField intensity={0.1} />
                      <div className="relative z-10 flex flex-col gap-2">
                        <div className="h-3.5 w-12 rounded bg-white/10" />
                        <div className="h-3 w-2/3 rounded bg-white/10" />
                        <div className="h-2.5 w-full rounded bg-white/5" />
                        <div className="h-2.5 w-5/6 rounded bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── GENERATING (single) ── */}
            {view === 'generating' && batchTotalRef.current <= 1 && (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <GeneratingImageCard
                  isLoading
                  variant="tile"
                  aspectRatio="1/1"
                  className="w-full max-w-[280px]"
                />
                {slowHint && (
                  <p className="text-[10px] text-neutral-600 max-w-[16rem] text-center leading-relaxed animate-in fade-in duration-500">
                    {t('brandMockupDialog.generating.slowHint', {
                      strategy: t('brandMockupDialog.generating.byQuality'),
                    })}
                  </p>
                )}
              </div>
            )}

            {/* ── GENERATING (batch — streaming grid) ── */}
            {view === 'generating' && batchTotalRef.current > 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GlitchLoader size={12} />
                    <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                      {t('brandMockupDialog.generating.batch', {
                        done: batchProgress,
                        total: batchTotalRef.current,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-1 w-[100px] rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-brand-cyan rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${(batchProgress / batchTotalRef.current) * 100}%` }}
                      />
                    </div>
                    <button
                      onClick={handleCancelBatch}
                      className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-destructive hover:text-destructive transition-colors"
                    >
                      <Square size={8} />
                      {t('brandMockupDialog.generating.stop')}
                    </button>
                  </div>
                </div>

                <div
                  className={cn(
                    'grid gap-3',
                    batchTotalRef.current <= 4 ? 'grid-cols-2' : 'grid-cols-3'
                  )}
                >
                  {batchResults.map((r, i) => (
                    <div
                      key={i}
                      className="relative aspect-square rounded-xl border border-neutral-800 overflow-hidden bg-neutral-950"
                    >
                      {r ? (
                        <img
                          src={r.url}
                          alt={r.label}
                          className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500"
                        />
                      ) : i < batchProgress ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-mono text-neutral-700">
                            {t('brandMockupDialog.generating.errorTile')}
                          </span>
                        </div>
                      ) : i === batchProgress ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <GeneratingImageCard isLoading variant="inline" />
                        </div>
                      ) : (
                        <div className="absolute inset-0">
                          <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-neutral-950" />
                          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_25%,rgba(255,255,255,0.03)_50%,transparent_75%)] bg-[length:200%_100%] animate-[shimmer_2s_infinite]" />
                        </div>
                      )}
                      {r && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end p-2">
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] text-neutral-300 font-medium truncate mr-2">
                              {r.label}
                            </span>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => handleDownload(r.url, r.label)}
                                className="w-6 h-6 rounded bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                              >
                                <Download size={10} className="text-white" />
                              </button>
                              <button
                                onClick={() =>
                                  handleSaveToMedia(
                                    r.url,
                                    t('brandMockupDialog.mediaLabel', { label: r.label })
                                  )
                                }
                                disabled={saving}
                                className="w-6 h-6 rounded bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                              >
                                <Save size={10} className="text-white" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── RESULT (single) ── */}
            {view === 'result' && result && batchResults.length === 0 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-neutral-800 overflow-hidden bg-neutral-950">
                  <img
                    src={result.url}
                    alt={t('brandMockupDialog.result.alt')}
                    className="w-full animate-in fade-in zoom-in-95 duration-500 fill-mode-both"
                  />
                </div>
                {result.fellBack && result.providerUsed && (
                  <p className="text-[10px] text-neutral-600 leading-relaxed">
                    {t('brandMockupDialog.result.fellBack', { provider: result.providerUsed })}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <button
                    onClick={resetToForm}
                    className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-neutral-300"
                  >
                    <RotateCcw size={10} />
                    {t('brandMockupDialog.result.generateAnother')}
                  </button>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => handleDownload(result.url, brandName)}
                      className="h-8 px-3 gap-1.5 text-xs text-neutral-400"
                    >
                      <Download size={12} />
                      {t('brandMockupDialog.result.download')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        handleSaveToMedia(
                          result.url,
                          t('brandMockupDialog.mediaLabel', { label: prompt.slice(0, 40) })
                        )
                      }
                      disabled={saving || saved}
                      className="h-8 px-3 gap-1.5 text-xs text-neutral-400"
                    >
                      <Save size={12} />
                      {saved
                        ? t('brandMockupDialog.result.saved')
                        : saving
                          ? t('brandMockupDialog.result.saving')
                          : t('brandMockupDialog.result.saveToBrand')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ── RESULT (batch) ── */}
            {view === 'result' && batchResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-success">
                    {t('brandMockupDialog.result.batchCount', {
                      count: batchResults.filter(Boolean).length,
                      plural: batchResults.filter(Boolean).length !== 1 ? 's' : '',
                    })}
                  </p>
                </div>

                <div
                  className={cn(
                    'grid gap-3',
                    batchTotalRef.current <= 4 ? 'grid-cols-2' : 'grid-cols-3'
                  )}
                >
                  {batchResults.map(
                    (r, i) =>
                      r && (
                        <div
                          key={i}
                          style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                          className="group relative aspect-square rounded-xl border border-neutral-800 overflow-hidden bg-neutral-950 animate-in fade-in zoom-in-95 fill-mode-both"
                        >
                          <img src={r.url} alt={r.label} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] text-neutral-300 font-medium truncate mr-2">
                                {r.label}
                              </span>
                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => handleDownload(r.url, r.label)}
                                  className="w-6 h-6 rounded bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                                >
                                  <Download size={10} className="text-white" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleSaveToMedia(
                                      r.url,
                                      t('brandMockupDialog.mediaLabel', { label: r.label })
                                    )
                                  }
                                  disabled={saving}
                                  className="w-6 h-6 rounded bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                                >
                                  <Save size={10} className="text-white" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={resetToForm}
                    className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-neutral-300"
                  >
                    <RotateCcw size={10} />
                    {t('brandMockupDialog.result.new')}
                  </button>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={handleSaveAll}
                      disabled={saving || saved}
                      className="h-8 px-3 gap-1.5 text-xs text-neutral-400"
                    >
                      <Save size={12} />
                      {saved
                        ? t('brandMockupDialog.result.allSaved')
                        : saving
                          ? t('brandMockupDialog.result.saving')
                          : t('brandMockupDialog.result.saveAll', {
                              count: batchResults.filter(Boolean).length,
                            })}
                    </Button>
                    <Button
                      onClick={() => handleOpenChange(false)}
                      className="h-8 px-4 text-xs bg-white/5 border border-white/15 text-neutral-200 hover:bg-white/10"
                    >
                      {t('brandMockupDialog.result.close')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
