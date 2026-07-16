import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ImagePlus, Loader2, Check, Pencil, Palette, X } from '@/lib/ui/icons';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { cn } from '@/lib/utils';
import { useLayout } from '@/hooks/useLayout';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import {
  namingBriefing,
  uploadNamingImage,
  type BriefingQuestion,
  type BriefingAnswer,
} from '@/services/namingApi';
import type { UploadedImage } from '@/types/types';

const ease = [0.4, 0, 0.2, 1] as const;
const screenAnim = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.32, ease },
};

type Step = 'concept' | 'confirm' | 'question';

interface BriefingFlowProps {
  onComplete: (
    briefText: string,
    brief: Record<string, unknown>,
    brandGuidelineId?: string | null
  ) => void;
}

/** Extrai pares string legíveis do brief para os chips pré-confirmados. */
function briefChips(brief: Record<string, unknown>): { key: string; value: string }[] {
  const skip = new Set(['faltando', 'confianca', 'idioma']);
  return Object.entries(brief)
    .filter(([k, v]) => !skip.has(k) && typeof v === 'string' && (v as string).trim().length > 0)
    .map(([key, value]) => ({ key, value: String(value) }));
}

export const BriefingFlow: React.FC<BriefingFlowProps> = ({ onComplete }) => {
  const { isAuthenticated } = useLayout();
  const { data: brandGuidelines = [] } = useBrandGuidelines(!!isAuthenticated);

  const [step, setStep] = useState<Step>('concept');
  const [concept, setConcept] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [showUploader, setShowUploader] = useState(false);
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [brandGuidelineId, setBrandGuidelineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [brief, setBrief] = useState<Record<string, unknown>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [briefText, setBriefText] = useState('');
  const [question, setQuestion] = useState<BriefingQuestion | null>(null);
  const [answers, setAnswers] = useState<BriefingAnswer[]>([]);

  const applyResponse = useCallback(
    (resp: Awaited<ReturnType<typeof namingBriefing>>, onFirst?: boolean) => {
      setBrief(resp.brief || {});
      setBriefText(resp.briefText || '');
      if (resp.done || !resp.nextQuestion) {
        onComplete(resp.briefText || '', resp.brief || {}, brandGuidelineId);
        return;
      }
      setQuestion(resp.nextQuestion);
      if (onFirst) setStep('confirm');
      else setStep('question');
    },
    [onComplete, brandGuidelineId]
  );

  const submitConcept = useCallback(async () => {
    if (!concept.trim()) {
      toast.error('Descreva o que você está criando.');
      return;
    }
    setLoading(true);
    try {
      const resp = await namingBriefing({ concept: concept.trim(), imageUrl });
      applyResponse(resp, true);
    } catch (err: any) {
      toast.error(err?.message || 'Não consegui interpretar o briefing.');
    } finally {
      setLoading(false);
    }
  }, [concept, imageUrl, applyResponse]);

  const advance = useCallback(
    async (nextAnswers: BriefingAnswer[]) => {
      setLoading(true);
      try {
        const resp = await namingBriefing({
          concept: concept.trim(),
          answers: nextAnswers,
          brief,
        });
        applyResponse(resp);
      } catch (err: any) {
        toast.error(err?.message || 'Falha ao seguir o briefing.');
      } finally {
        setLoading(false);
      }
    },
    [concept, brief, applyResponse]
  );

  const answerQuestion = useCallback(
    (value: string) => {
      if (!question) return;
      const next = [...answers, { id: question.id, value }];
      setAnswers(next);
      void advance(next);
    },
    [question, answers, advance]
  );

  const skipQuestion = useCallback(() => {
    if (!question) return;
    const next = [...answers, { id: question.id, value: '' }];
    setAnswers(next);
    void advance(next);
  }, [question, answers, advance]);

  const confirmChips = useCallback(() => {
    // Reenvia edições como respostas antes de seguir para as perguntas.
    const editAnswers = Object.entries(edits).map(([id, value]) => ({ id, value }));
    if (editAnswers.length > 0) void advance([...answers, ...editAnswers]);
    else setStep('question');
  }, [edits, answers, advance]);

  const handleImage = useCallback(async (img: UploadedImage) => {
    if (!img.base64) return;
    try {
      const url = await uploadNamingImage(img.base64, img.mimeType);
      setImageUrl(url);
      setShowUploader(false);
      toast.success('Referência anexada.');
    } catch (err: any) {
      toast.error(err?.message || 'Falha no upload da imagem.');
    }
  }, []);

  const chips = briefChips(brief);

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-10">
      <AnimatePresence mode="wait">
        {/* ── Ato 1: conceito ─────────────────────────────────────────── */}
        {step === 'concept' && (
          <motion.div key="concept" {...screenAnim} className="space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100">
                O que você está criando?
              </h1>
              <p className="text-sm text-neutral-500">Uma frase basta. A IA cuida do resto.</p>
            </div>

            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitConcept();
              }}
              rows={3}
              autoFocus
              placeholder="app de matchmaking para esportes de raquete…"
              className="w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950/40 px-4 py-3 text-base text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none transition-colors"
            />

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowUploader((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs transition-colors',
                  imageUrl ? 'text-brand-cyan' : 'text-neutral-600 hover:text-neutral-400'
                )}
              >
                {imageUrl ? <Check size={13} /> : <ImagePlus size={13} />}
                {imageUrl ? 'Referência anexada' : 'imagem de referência'}
              </button>

              <Button
                variant="brand"
                onClick={submitConcept}
                disabled={loading || !concept.trim()}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ArrowRight size={15} />
                )}
                Continuar
              </Button>
            </div>

            <AnimatePresence>
              {showUploader && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease }}
                  className="overflow-hidden"
                >
                  <ImageUploader onImageUpload={handleImage} onProceedWithoutImage={() => {}} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Marca existente (discreto, zero pedágio) ────────────── */}
            {brandGuidelines.length > 0 && (
              <div className="flex justify-center">
                {brandGuidelineId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBrandGuidelineId(null);
                      setShowBrandPicker(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1 text-xs text-brand-cyan transition-colors hover:bg-brand-cyan/20"
                  >
                    <BrandAvatar
                      brand={brandGuidelines.find((g: any) => g.id === brandGuidelineId)}
                      size={14}
                      rounded="sm"
                    />
                    {(brandGuidelines.find((g: any) => g.id === brandGuidelineId) as any)?.identity
                      ?.name || 'Marca selecionada'}
                    <X size={11} />
                  </button>
                ) : showBrandPicker ? (
                  <div className="flex items-center gap-1.5">
                    <Palette size={11} className="text-neutral-500" />
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) setBrandGuidelineId(e.target.value);
                        setShowBrandPicker(false);
                      }}
                      autoFocus
                      className="rounded-md border border-neutral-800 bg-neutral-950/40 px-2 py-1 text-xs text-neutral-300 outline-none focus:border-neutral-600"
                    >
                      <option value="" disabled>
                        Escolher marca…
                      </option>
                      {brandGuidelines.map((g: any) => (
                        <option key={g.id} value={g.id}>
                          {g.identity?.name || g.name || 'Sem nome'}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowBrandPicker(true)}
                    className="text-xs text-neutral-600 transition-colors hover:text-neutral-400"
                  >
                    ou nomear para uma marca existente
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Chips pré-confirmados ───────────────────────────────────── */}
        {step === 'confirm' && (
          <motion.div key="confirm" {...screenAnim} className="space-y-6">
            <div className="space-y-1 text-center">
              <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-600">
                Entendi isso
              </p>
              <h2 className="text-xl font-semibold text-neutral-200">Confere pra mim?</h2>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {chips.map(({ key, value }) => {
                const current = edits[key] ?? value;
                const isEditing = editingKey === key;
                return (
                  <div key={key}>
                    {isEditing ? (
                      <Input
                        value={current}
                        autoFocus
                        onChange={(e) => setEdits((p) => ({ ...p, [key]: e.target.value }))}
                        onBlur={() => setEditingKey(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingKey(null)}
                        className="h-8 w-48 text-sm bg-neutral-950/40 border-neutral-700"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingKey(key)}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-white/[0.03] px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-700 transition-colors"
                      >
                        {current}
                        <Pencil
                          size={11}
                          className="text-neutral-600 group-hover:text-brand-cyan transition-colors"
                        />
                      </button>
                    )}
                  </div>
                );
              })}
              {chips.length === 0 && (
                <p className="text-sm text-neutral-500">Vamos afinar com algumas perguntas.</p>
              )}
            </div>

            <div className="flex justify-center">
              <Button variant="brand" onClick={confirmChips} disabled={loading} className="gap-2">
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ArrowRight size={15} />
                )}
                Continuar
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Perguntas dinâmicas ─────────────────────────────────────── */}
        {step === 'question' && question && (
          <motion.div key={question.id} {...screenAnim} className="space-y-8">
            <h2 className="text-center text-xl sm:text-2xl font-semibold text-neutral-100">
              {question.prompt}
            </h2>

            <QuestionBody question={question} onAnswer={answerQuestion} disabled={loading} />

            <div className="flex justify-center">
              <button
                type="button"
                onClick={skipQuestion}
                disabled={loading}
                className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors disabled:opacity-40"
              >
                pular
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Render por kind ──────────────────────────────────────────────────────── */

function QuestionBody({
  question,
  onAnswer,
  disabled,
}: {
  question: BriefingQuestion;
  onAnswer: (value: string) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const options = question.options ?? [];

  const toggle = (opt: string) =>
    setSelected((p) => (p.includes(opt) ? p.filter((o) => o !== opt) : [...p, opt]));

  switch (question.kind) {
    case 'binary':
      return (
        <div className="grid grid-cols-2 gap-3">
          {options.slice(0, 2).map((opt) => (
            <motion.button
              key={opt}
              whileTap={{ scale: 0.97 }}
              disabled={disabled}
              onClick={() => onAnswer(opt)}
              className="rounded-2xl border border-neutral-800 bg-white/[0.03] px-4 py-10 text-lg font-medium text-neutral-200 hover:border-neutral-700 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              {opt}
            </motion.button>
          ))}
        </div>
      );

    case 'toggle':
      return (
        <div className="flex justify-center gap-3">
          {(options.length ? options : ['Sim', 'Não']).map((opt) => (
            <Button
              key={opt}
              variant="surface"
              disabled={disabled}
              onClick={() => onAnswer(opt)}
              className="px-6 py-2"
            >
              {opt}
            </Button>
          ))}
        </div>
      );

    case 'cards':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {options.map((opt) => {
              const isSel = selected.includes(opt);
              return (
                <button
                  key={opt}
                  disabled={disabled}
                  onClick={() => toggle(opt)}
                  className={cn(
                    'rounded-xl border px-4 py-4 text-left transition-colors disabled:opacity-50',
                    isSel
                      ? 'border-brand-cyan/50 bg-brand-cyan/5'
                      : 'border-neutral-800 bg-white/[0.03] hover:border-neutral-700'
                  )}
                >
                  <span className="text-sm font-medium text-neutral-200">{opt}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-center">
            <Button
              variant="brand"
              disabled={disabled}
              onClick={() => onAnswer(selected.join(', ') || 'deixa a IA variar')}
              className="gap-2"
            >
              <ArrowRight size={15} /> Continuar
            </Button>
          </div>
        </div>
      );

    case 'text':
      return (
        <div className="space-y-4">
          <Input
            value={text}
            autoFocus
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && text.trim() && onAnswer(text.trim())}
            placeholder="Escreva aqui…"
            className="text-base bg-neutral-950/40 border-neutral-800"
          />
          <div className="flex justify-center">
            <Button
              variant="brand"
              disabled={disabled || !text.trim()}
              onClick={() => onAnswer(text.trim())}
              className="gap-2"
            >
              <ArrowRight size={15} /> Continuar
            </Button>
          </div>
        </div>
      );

    case 'chips':
    default:
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-center gap-2">
            {options.map((opt) => {
              const isSel = selected.includes(opt);
              return (
                <button
                  key={opt}
                  disabled={disabled}
                  onClick={() => toggle(opt)}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-sm transition-colors disabled:opacity-50',
                    isSel
                      ? 'border-brand-cyan/50 bg-brand-cyan/10 text-brand-cyan'
                      : 'border-neutral-800 bg-white/[0.03] text-neutral-300 hover:border-neutral-700'
                  )}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          <div className="flex justify-center">
            <Button
              variant="brand"
              disabled={disabled || selected.length === 0}
              onClick={() => onAnswer(selected.join(', '))}
              className="gap-2"
            >
              <ArrowRight size={15} /> Continuar
            </Button>
          </div>
        </div>
      );
  }
}
