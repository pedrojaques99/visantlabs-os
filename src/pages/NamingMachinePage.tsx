import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { Zap, X, Heart, Gem } from 'lucide-react';
import { toast } from 'sonner';
import { MiniAppShell } from '@/components/shared/MiniAppShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useLayout } from '@/hooks/useLayout';
import { copyToClipboard } from '@/utils/clipboard';
import { BriefingFlow } from '@/components/naming/BriefingFlow';
import { SwipeCard, type SwipeCardHandle } from '@/components/naming/SwipeCard';
import { ShortlistPanel } from '@/components/naming/ShortlistPanel';
import {
  emptyProfile,
  updateProfile,
  undoLast,
  pickTerritories,
  loadSession,
  saveSession,
  clearSession,
  type TasteProfile,
  type NamingCard,
  type Verdict,
  type NamingPhase,
} from '@/lib/naming/tasteProfile';
import {
  generateNaming,
  namingPatternInsight,
  namingDefenseInsight,
  type NamingDefenseInsightResponse,
} from '@/services/namingApi';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';

export const NamingMachinePage: React.FC = () => {
  const navigate = useNavigate();
  const { requireAuth } = useAuthGuard();
  const { onCreditPackagesModalOpen } = useLayout();

  const [phase, setPhase] = useState<NamingPhase>('briefing');
  const [brief, setBrief] = useState<string | null>(null);
  const [briefObj, setBriefObj] = useState<Record<string, unknown> | null>(null);
  const [brandGuidelineId, setBrandGuidelineId] = useState<string | null>(null);
  const [profile, setProfile] = useState<TasteProfile>(emptyProfile);
  const [deck, setDeck] = useState<NamingCard[]>([]);
  const [generating, setGenerating] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const [tasteReading, setTasteReading] = useState<string | undefined>();
  const [defenseCache, setDefenseCache] = useState<
    Record<string, NamingDefenseInsightResponse | undefined>
  >({});
  const [finalists, setFinalists] = useState<string[]>([]);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [lastSwiped, setLastSwiped] = useState<NamingCard | null>(null);

  const cardRef = useRef<SwipeCardHandle>(null);
  const deckRef = useRef<NamingCard[]>(deck);
  const generatingRef = useRef(false);
  const prefetchingRef = useRef(false);
  const territoriesRef = useRef<Set<string>>(new Set());
  const defenseRequested = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  /* ── Restaura sessão ao montar ──────────────────────────────────────── */
  useEffect(() => {
    const s = loadSession();
    if (s) {
      setProfile(s.profile);
      setBrief(s.brief);
      setBriefObj(s.briefObj);
      setPhase(s.phase);
      setTasteReading(s.tasteReading);
      setBrandGuidelineId(s.brandGuidelineId ?? null);
      if (s.deck?.length) setDeck(s.deck);
      const set = new Set<string>();
      [...s.profile.superliked, ...s.profile.liked, ...s.profile.rejected].forEach((c) =>
        set.add(c.territory)
      );
      territoriesRef.current = set;
    }
    hydrated.current = true;
  }, []);

  /* ── Persiste sessão ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!hydrated.current) return;
    if (phase === 'briefing' && profile.history.length === 0) return;
    saveSession({
      profile,
      brief,
      briefObj,
      phase,
      shortlist: [...profile.superliked, ...profile.liked],
      tasteReading,
      deck,
      brandGuidelineId,
    });
  }, [profile, brief, briefObj, phase, tasteReading, deck, brandGuidelineId]);

  /* ── Erro de API ────────────────────────────────────────────────────── */
  const handleApiError = useCallback(
    (err: any, retry: () => void) => {
      const status = err?.status;
      const msg: string = err?.message || 'Algo deu errado.';
      if (status === 402 || /cr[eé]dit/i.test(msg)) {
        onCreditPackagesModalOpen();
        return;
      }
      if (status === 401) {
        toast.error('Faça login para continuar.');
        return;
      }
      toast.error(msg, { action: { label: 'tentar de novo', onClick: retry } });
    },
    [onCreditPackagesModalOpen]
  );

  /* ── Geração de leva (com prefetch calibrado) ───────────────────────── */
  const fetchBatch = useCallback(
    async (isPrefetch: boolean) => {
      if (isPrefetch) {
        if (prefetchingRef.current || generatingRef.current) return;
        prefetchingRef.current = true;
        setPrefetching(true);
      } else {
        if (generatingRef.current) return;
        generatingRef.current = true;
        setGenerating(true);
      }

      try {
        if (!isPrefetch && !(await requireAuth())) return;

        let reading = tasteReading;
        const swipes =
          profile.liked.length + profile.superliked.length + profile.rejected.length;
        if (isPrefetch && swipes > 0) {
          try {
            const r = await namingPatternInsight({
              mode: 'pattern',
              liked: profile.liked,
              superliked: profile.superliked,
              rejected: profile.rejected,
              stats: {
                likeRateByTerritory: profile.likeRateByTerritory,
                likeRateByTechnique: profile.likeRateByTechnique,
                avgLengthLiked: profile.avgLengthLiked,
              },
            });
            reading = r.reading;
            setTasteReading(reading);
          } catch {
            /* leitura é opcional — segue sem ela */
          }
        }

        const territories = pickTerritories(profile, Array.from(territoriesRef.current));
        const resp = await generateNaming({
          brief: brief || '',
          count: 20,
          seen: profile.seen,
          liked: profile.liked.map((c) => c.name),
          superliked: profile.superliked.map((c) => c.name),
          rejected: profile.rejected.map((c) => c.name),
          tasteReading: reading || undefined,
          territories: territories.length ? territories : undefined,
          brandGuidelineId: brandGuidelineId || undefined,
        });

        const existing = new Set([...profile.seen, ...deckRef.current.map((c) => c.name)]);
        const fresh: NamingCard[] = [];
        for (const n of resp.names || []) {
          if (!n?.name || existing.has(n.name)) continue;
          existing.add(n.name);
          if (n.territory) territoriesRef.current.add(n.territory);
          fresh.push(n);
        }

        if (fresh.length) setDeck((d) => [...d, ...fresh]);
        else if (!isPrefetch)
          toast.message('Sem novos nomes por aqui — ajuste o briefing ou tente de novo.');
      } catch (err: any) {
        handleApiError(err, () => fetchBatch(isPrefetch));
      } finally {
        if (isPrefetch) {
          prefetchingRef.current = false;
          setPrefetching(false);
        } else {
          generatingRef.current = false;
          setGenerating(false);
        }
      }
    },
    [brief, profile, tasteReading, brandGuidelineId, requireAuth, handleApiError]
  );

  /* ── Dispara primeira leva + prefetch ≤5 ────────────────────────────── */
  useEffect(() => {
    if (phase !== 'deck') return;
    if (deck.length === 0 && !generatingRef.current) {
      void fetchBatch(false);
    } else if (deck.length > 0 && deck.length <= 5 && !prefetchingRef.current && !generatingRef.current) {
      void fetchBatch(true);
    }
  }, [phase, deck.length, fetchBatch]);

  /* ── Defesa completa dos superlikes (background) ────────────────────── */
  const loadDefense = useCallback(
    async (card: NamingCard) => {
      if (defenseRequested.current.has(card.name)) return;
      defenseRequested.current.add(card.name);
      try {
        const d = await namingDefenseInsight({
          mode: 'defense',
          name: card.name,
          briefText: brief || '',
        });
        setDefenseCache((p) => ({ ...p, [card.name]: d }));
      } catch {
        defenseRequested.current.delete(card.name);
      }
    },
    [brief]
  );

  useEffect(() => {
    profile.superliked.forEach((c) => {
      if (!defenseCache[c.name] && !defenseRequested.current.has(c.name)) void loadDefense(c);
    });
  }, [profile.superliked, defenseCache, loadDefense]);

  /* ── Swipe / undo ───────────────────────────────────────────────────── */
  const handleVerdict = useCallback(
    (card: NamingCard, verdict: Verdict) => {
      setProfile((p) => updateProfile(p, card, verdict));
      setDeck((d) => d.filter((c) => c.name !== card.name));
      setLastSwiped(card);
      if (verdict === 'superlike') void loadDefense(card);

      toast(
        verdict === 'superlike'
          ? `⭐ ${card.name}`
          : verdict === 'like'
            ? `♥ ${card.name}`
            : `✕ ${card.name}`,
        {
          action: {
            label: 'desfazer',
            onClick: () => {
              setProfile((p) => undoLast(p));
              setDeck((d) => (d.some((c) => c.name === card.name) ? d : [card, ...d]));
              setLastSwiped(null);
            },
          },
          duration: 3000,
        }
      );
    },
    [loadDefense]
  );

  const triggerVerdict = useCallback((verdict: Verdict) => {
    if (deckRef.current.length === 0) return;
    cardRef.current?.fly(verdict);
  }, []);

  const undoKey = useCallback(() => {
    if (!lastSwiped) return;
    const card = lastSwiped;
    setProfile((p) => undoLast(p));
    setDeck((d) => (d.some((c) => c.name === card.name) ? d : [card, ...d]));
    setLastSwiped(null);
  }, [lastSwiped]);

  useHotkeys('left', () => phase === 'deck' && triggerVerdict('nope'), [phase, triggerVerdict]);
  useHotkeys('right', () => phase === 'deck' && triggerVerdict('like'), [phase, triggerVerdict]);
  useHotkeys('up', () => phase === 'deck' && triggerVerdict('superlike'), [phase, triggerVerdict]);
  useHotkeys('z', () => phase === 'deck' && undoKey(), [phase, undoKey]);

  /* ── Shortlist callbacks ────────────────────────────────────────────── */
  const handleMoreLikeThis = useCallback(
    (card: NamingCard) => {
      territoriesRef.current.add(card.territory);
      toast.message(`Buscando mais como "${card.name}"…`);
      void fetchBatch(true);
    },
    [fetchBatch]
  );

  const handleRemove = useCallback((card: NamingCard) => {
    setProfile((p) => ({
      ...p,
      superliked: p.superliked.filter((c) => c.name !== card.name),
      liked: p.liked.filter((c) => c.name !== card.name),
    }));
  }, []);

  const showFinalists = useCallback(() => {
    const all = [...profile.superliked, ...profile.liked];
    const ranked = [...all].sort(
      (a, b) =>
        (profile.likeRateByTerritory[b.territory] ?? 0) -
        (profile.likeRateByTerritory[a.territory] ?? 0)
    );
    setFinalists(ranked.slice(0, 3).map((c) => c.name));
    setNudgeDismissed(true);
  }, [profile]);

  const transformToBrand = useCallback(
    async (card: NamingCard) => {
      const payload = `${card.name}\n\n${brief || ''}`.trim();
      await copyToClipboard(payload);
      toast.success('Nome e brief copiados — cole na Branding Machine.');
      navigate('/branding-machine', { state: { name: card.name, brief: brief || '' } });
    },
    [brief, navigate]
  );

  const handleSaveToBrand = useCallback(async () => {
    if (!brandGuidelineId) return;
    const all = [...profile.superliked, ...profile.liked];
    if (all.length === 0) return;
    const lines = all.map((c) => {
      const defense = defenseCache[c.name];
      const summary = defense?.concept || c.rationale;
      const tag = c.territory && c.technique ? ` (${c.territory} · ${c.technique})` : '';
      return `- ${c.name}${tag}: ${summary}`;
    });
    const text = `Shortlist da Naming Machine\n\n${lines.join('\n')}`;
    try {
      await brandGuidelineApi.uploadKnowledge(brandGuidelineId, {
        source: 'text',
        data: text,
        filename: `naming-shortlist-${Date.now()}.txt`,
      });
      toast.success('Shortlist salva na marca.');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao salvar na marca.');
    }
  }, [brandGuidelineId, profile.superliked, profile.liked, defenseCache]);

  /* ── Reset ──────────────────────────────────────────────────────────── */
  const handleReset = useCallback(() => {
    clearSession();
    setProfile(emptyProfile());
    setDeck([]);
    setBrief(null);
    setBriefObj(null);
    setBrandGuidelineId(null);
    setTasteReading(undefined);
    setDefenseCache({});
    setFinalists([]);
    setNudgeDismissed(false);
    setLastSwiped(null);
    territoriesRef.current = new Set();
    defenseRequested.current = new Set();
    setPhase('briefing');
  }, []);

  const onBriefingComplete = useCallback(
    (briefText: string, briefObject: Record<string, unknown>, brandId?: string | null) => {
      setBrief(briefText);
      setBriefObj(briefObject);
      setBrandGuidelineId(brandId ?? null);
      setPhase('deck');
    },
    []
  );

  /* ── Derivados de UI ────────────────────────────────────────────────── */
  const seenCount = profile.seen.length;
  const likedCount = profile.liked.length + profile.superliked.length;
  const showNudge = likedCount >= 10 && !nudgeDismissed;
  const activeCard = deck[0];
  const previewCard = deck[1];

  const panel = (
    <ShortlistPanel
      superliked={profile.superliked}
      liked={profile.liked}
      defenseCache={defenseCache}
      finalists={finalists}
      showNudge={showNudge}
      onShowFinalists={showFinalists}
      onMoreLikeThis={handleMoreLikeThis}
      onRemove={handleRemove}
      onTransformToBrand={transformToBrand}
      brandGuidelineId={brandGuidelineId}
      onSaveToBrand={handleSaveToBrand}
    />
  );

  const statusBar = (
    <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest">
      <span className="text-neutral-400">
        {seenCount} vistos · {likedCount} curtidos
      </span>
      {prefetching && (
        <span className="flex items-center gap-1 text-brand-cyan/80">
          <Zap size={10} className="animate-pulse" /> calibrando pelo seu gosto
        </span>
      )}
    </div>
  );

  return (
    <MiniAppShell
      icon={Zap}
      title="Naming Machine"
      documentTitle="Naming Machine"
      onReset={handleReset}
      panel={phase === 'deck' ? panel : undefined}
      panelLabel="Shortlist"
      statusBar={phase === 'deck' ? statusBar : undefined}
      centerContent={phase === 'briefing'}
    >
      {phase === 'briefing' ? (
        <BriefingFlow onComplete={onBriefingComplete} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-4 py-8">
          {/* Deck */}
          <div className="relative h-[440px] w-full max-w-md">
            {activeCard ? (
              <>
                {previewCard && (
                  <SwipeCard
                    key={previewCard.name}
                    card={previewCard}
                    active={false}
                    onVerdict={handleVerdict}
                  />
                )}
                <SwipeCard
                  key={activeCard.name}
                  ref={cardRef}
                  card={activeCard}
                  active
                  onVerdict={handleVerdict}
                />
              </>
            ) : (
              <DeckSkeleton generating={generating} />
            )}
          </div>

          {/* Botões */}
          {activeCard && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => triggerVerdict('nope')}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-neutral-800 bg-white/[0.03] text-neutral-400 hover:border-destructive/50 hover:text-destructive transition-colors"
                aria-label="Nope (←)"
              >
                <X size={22} />
              </button>
              <button
                onClick={() => triggerVerdict('superlike')}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 transition-colors"
                aria-label="Superlike (↑)"
              >
                <Gem size={18} />
              </button>
              <button
                onClick={() => triggerVerdict('like')}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-neutral-800 bg-white/[0.03] text-neutral-400 hover:border-success/50 hover:text-success transition-colors"
                aria-label="Curti (→)"
              >
                <Heart size={22} />
              </button>
            </div>
          )}

          {activeCard && (
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-700">
              ← nope · → curti · ↑ superlike · Z desfaz
            </p>
          )}
        </div>
      )}
    </MiniAppShell>
  );
};

/* ── Skeleton da primeira leva ──────────────────────────────────────────── */

function DeckSkeleton({ generating }: { generating: boolean }) {
  return (
    <GlassPanel
      intensity="strong"
      className="absolute inset-0 items-center justify-center gap-4 px-8 py-12 text-center"
    >
      <div className="h-4 w-24 animate-pulse rounded-full bg-neutral-800/40" />
      <div className="h-10 w-48 animate-pulse rounded-lg bg-neutral-800/50" />
      <div className="h-3 w-56 animate-pulse rounded-full bg-neutral-800/30" />
      <p className="mt-4 text-[10px] font-mono uppercase tracking-widest text-neutral-600">
        {generating ? 'gerando nomes…' : 'preparando o deck…'}
      </p>
    </GlassPanel>
  );
}

export default NamingMachinePage;
