import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { Zap, X, Heart, Bookmark } from '@/lib/ui/icons';
import { toast } from 'sonner';
import { MiniAppShell } from '@/components/shared/MiniAppShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useLayout } from '@/hooks/useLayout';
import { copyToClipboard } from '@/utils/clipboard';
import { BriefingFlow } from '@/components/naming/BriefingFlow';
import { SwipeCard, type SwipeCardHandle } from '@/components/naming/SwipeCard';
import {
  ShortlistPanel,
  isDefenseFailure,
  type DefenseFailure,
} from '@/components/naming/ShortlistPanel';
import { NamingSettingsPopover } from '@/components/naming/NamingSettingsPopover';
import { NamingHistoryPopover } from '@/components/naming/NamingHistoryPopover';
import {
  emptyProfile,
  updateProfile,
  undoLast,
  pickTerritories,
  deriveTasteRules,
  loadSession,
  saveSession,
  clearSession,
  type TasteProfile,
  type NamingCard,
  type Verdict,
  type NamingPhase,
  type NamingSession,
} from '@/lib/naming/tasteProfile';
import {
  DEFAULT_NAMING_SETTINGS,
  normalizeAvailabilityFilter,
  type NamingSettings,
} from '@/lib/naming/constants';
import {
  generateNaming,
  namingEvent,
  namingPatternInsight,
  namingDefenseInsight,
  type NamingSettingsPayload,
  type NamingDefenseInsightResponse,
} from '@/services/namingApi';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { authService } from '@/services/authService';
import { namingSessionApi, type NamingSessionScalars } from '@/services/namingSessionApi';
import { getNamingSettings, updateNamingSettings } from '@/services/userSettingsService';

/** Backend valida cada lista (seen/liked/superliked/rejected) em ≤200 itens e
 *  dá 400 se passar — capa nos mais RECENTES antes de enviar. */
const MAX_SENT = 200;

/**
 * Monta o payload de configurações do generate-naming.
 *
 * Envia SEMPRE todos os campos. A versão antiga mandava só o que diferia de
 * `DEFAULT_NAMING_SETTINGS` para deixar o request enxuto — mas como as settings
 * salvas do usuário são carregadas como estado inicial, qualquer preferência que
 * coincidisse com o default de fábrica nunca era transmitida, e a geração caía
 * no default do servidor. O ganho de bytes não valia a config fantasma.
 */
function buildSettingsPayload(s: NamingSettings): NamingSettingsPayload {
  return {
    ruler: s.ruler,
    maxLength: s.maxLength, // 0 = "livre", valor legítimo — nunca usar falsy-check
    language: s.language,
    techniques: s.techniques, // [] = todas
    availabilityFilter: normalizeAvailabilityFilter(s.availabilityFilter),
  };
}

/**
 * Deriva os campos escalares "promovidos" (título, contadores) que a lista de
 * sessões anteriores exibe sem carregar o blob pesado. Título = melhor nome +N.
 */
function deriveScalars(s: NamingSession): NamingSessionScalars {
  const liked = s.profile.superliked.length + s.profile.liked.length;
  const top = s.profile.superliked[0]?.name || s.profile.liked[0]?.name;
  const name = top
    ? liked > 1
      ? `${top} +${liked - 1}`
      : top
    : s.brief?.trim().slice(0, 48) || 'Nova sessão';
  return {
    name,
    brief: s.brief ?? null,
    phase: s.phase,
    brandGuidelineId: s.brandGuidelineId ?? null,
    likedCount: liked,
    seenCount: s.profile.seen.length,
  };
}

export const NamingMachinePage: React.FC = () => {
  const navigate = useNavigate();
  const { requireAuth } = useAuthGuard();
  const { onCreditPackagesModalOpen } = useLayout();

  const [phase, setPhase] = useState<NamingPhase>('briefing');
  const [brief, setBrief] = useState<string | null>(null);
  const [briefObj, setBriefObj] = useState<Record<string, unknown> | null>(null);
  const [brandGuidelineId, setBrandGuidelineId] = useState<string | null>(null);
  const [profile, setProfile] = useState<TasteProfile>(emptyProfile);
  const [settings, setSettings] = useState<NamingSettings>(DEFAULT_NAMING_SETTINGS);
  const [deck, setDeck] = useState<NamingCard[]>([]);
  const [generating, setGenerating] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const [tasteReading, setTasteReading] = useState<string | undefined>();
  const [defenseCache, setDefenseCache] = useState<
    Record<string, NamingDefenseInsightResponse | DefenseFailure | undefined>
  >({});
  const [finalists, setFinalists] = useState<string[]>([]);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [lastSwiped, setLastSwiped] = useState<NamingCard | null>(null);
  /** id do registro backend da sessão atual (null = ainda não persistida / anônimo). */
  const [sessionId, setSessionId] = useState<string | null>(null);

  const cardRef = useRef<SwipeCardHandle>(null);
  const deckRef = useRef<NamingCard[]>(deck);
  const generatingRef = useRef(false);
  const prefetchingRef = useRef(false);
  const territoriesRef = useRef<Set<string>>(new Set());
  /**
   * Nomes que foram descartados sem julgamento pelo "gerar novamente". Continuam
   * na lista de exclusão para o LLM não devolver o mesmo nome na leva seguinte —
   * eles saíram do deck, mas já apareceram na tela.
   */
  const retiredRef = useRef<Set<string>>(new Set());
  const defenseRequested = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const creatingRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Default de settings do usuário (backend) — sessões novas herdam daqui. */
  const userDefaultSettingsRef = useRef<NamingSettings | null>(null);
  const settingsRef = useRef(settings);
  const settingsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  /** Persiste as settings como default do usuário (sticky, debounced). Só é
   *  chamado em edições explícitas do popover — restaurar sessão NÃO altera o default. */
  const scheduleDefaultSave = useCallback((next: NamingSettings) => {
    if (!authService.isAuthenticated()) return;
    userDefaultSettingsRef.current = next;
    if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    settingsSaveTimer.current = setTimeout(() => {
      void updateNamingSettings(next).catch(() => {
        /* preferência é best-effort — não trava a UX */
      });
    }, 800);
  }, []);

  /* ── Aplica uma sessão (do backend ou do localStorage) no estado ──────── */
  const applySession = useCallback((s: NamingSession) => {
    setProfile(s.profile);
    setBrief(s.brief);
    setBriefObj(s.briefObj);
    setPhase(s.phase);
    setTasteReading(s.tasteReading);
    setBrandGuidelineId(s.brandGuidelineId ?? null);
    if (s.settings) setSettings({ ...DEFAULT_NAMING_SETTINGS, ...s.settings });
    if (s.deck?.length) setDeck(s.deck);
    const set = new Set<string>();
    [...s.profile.superliked, ...s.profile.liked, ...s.profile.rejected].forEach((c) =>
      set.add(c.territory)
    );
    territoriesRef.current = set;
  }, []);

  /* ── Persiste no backend (create na 1ª vez, update depois) ────────────── */
  const persistToBackend = useCallback(async (session: NamingSession) => {
    const scalars = deriveScalars(session);
    try {
      if (sessionIdRef.current) {
        await namingSessionApi.save(sessionIdRef.current, session, scalars);
      } else if (!creatingRef.current) {
        creatingRef.current = true;
        try {
          const created = await namingSessionApi.create(session, scalars);
          sessionIdRef.current = created.id;
          setSessionId(created.id);
        } finally {
          creatingRef.current = false;
        }
      }
    } catch {
      /* backend indisponível — não trava a UX; o próximo autosave tenta de novo */
    }
  }, []);

  /* ── Restaura sessão ao montar ──────────────────────────────────────────
   * Logado: backend é a fonte da verdade — restaura a sessão mais recente e,
   * se não houver nenhuma, migra uma sessão local pendente (login em outro
   * device). Anônimo (ou backend fora): cai pro localStorage.
   */
  useEffect(() => {
    let cancelled = false;
    const done = () => {
      if (!cancelled) hydrated.current = true;
    };

    void (async () => {
      if (!authService.isAuthenticated()) {
        const s = loadSession();
        if (s && !cancelled) applySession(s);
        done();
        return;
      }

      // Baseline: default de settings do usuário (sessões novas herdam daqui).
      // Uma sessão restaurada logo abaixo sobrescreve com as settings dela.
      try {
        const pref = await getNamingSettings();
        if (!cancelled && pref && typeof pref === 'object' && Object.keys(pref).length > 0) {
          const merged = { ...DEFAULT_NAMING_SETTINGS, ...pref };
          userDefaultSettingsRef.current = merged;
          setSettings(merged);
        }
      } catch {
        /* segue com o default de fábrica */
      }
      if (cancelled) return;

      try {
        const sessions = await namingSessionApi.list();
        if (cancelled) return;

        if (sessions.length > 0) {
          const rec = await namingSessionApi.get(sessions[0].id);
          if (cancelled) return;
          applySession(rec.data);
          setSessionId(rec.id);
          done();
          return;
        }

        // Sem sessão no backend — migra a local (se houver) uma única vez.
        const local = loadSession();
        if (local) {
          applySession(local);
          try {
            const created = await namingSessionApi.create(local, deriveScalars(local));
            if (!cancelled) setSessionId(created.id);
            clearSession(); // migrada: LS deixa de ser fonte da verdade p/ logados
          } catch {
            /* mantém a local como fallback */
          }
        }
        done();
      } catch {
        // Backend indisponível: usa o cache local.
        const s = loadSession();
        if (s && !cancelled) applySession(s);
        done();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  /* ── Persiste sessão ─────────────────────────────────────────────────────
   * Logado: autosave no backend com debounce (não martela a API a cada swipe).
   * Anônimo: grava síncrono no localStorage (comportamento legado).
   */
  useEffect(() => {
    if (!hydrated.current) return;
    if (phase === 'briefing' && profile.history.length === 0) return;

    const session: NamingSession = {
      profile,
      brief,
      briefObj,
      phase,
      shortlist: [...profile.superliked, ...profile.liked],
      tasteReading,
      deck,
      brandGuidelineId,
      settings,
    };

    if (authService.isAuthenticated()) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void persistToBackend(session), 800);
    } else {
      saveSession(session);
    }
  }, [
    profile,
    brief,
    briefObj,
    phase,
    tasteReading,
    deck,
    brandGuidelineId,
    settings,
    persistToBackend,
  ]);

  /* Flush do debounce ao desmontar. */
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    },
    []
  );

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
        const swipes = profile.liked.length + profile.superliked.length + profile.rejected.length;
        if (isPrefetch && swipes > 0) {
          try {
            const r = await namingPatternInsight({
              mode: 'pattern',
              liked: profile.liked.map((c) => c.name).slice(-MAX_SENT),
              superliked: profile.superliked.map((c) => c.name).slice(-MAX_SENT),
              rejected: profile.rejected.map((c) => c.name).slice(-MAX_SENT),
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

        // Exclusão = TUDO já superficiado nesta sessão (swipado ∪ deck ainda não
        // julgado) — não só o que foi swipado. Impede o LLM de regenerar nomes que
        // já estão na tela. Backend valida ≤200: mantém os mais recentes.
        const surfaced = Array.from(
          new Set([...profile.seen, ...deckRef.current.map((c) => c.name), ...retiredRef.current])
        );
        const resp = await generateNaming({
          brief: brief || '',
          count: settings.batchSize,
          seen: surfaced.slice(-MAX_SENT),
          liked: profile.liked.map((c) => c.name).slice(-MAX_SENT),
          superliked: profile.superliked.map((c) => c.name).slice(-MAX_SENT),
          rejected: profile.rejected.map((c) => c.name).slice(-MAX_SENT),
          tasteReading: reading || undefined,
          territories: territories.length ? territories : undefined,
          brandGuidelineId: brandGuidelineId || undefined,
          settings: buildSettingsPayload(settings),
          // Régua adaptativa: null enquanto a amostra for pequena (< 5 swipes),
          // para não travar o gosto em cima de ruído.
          tasteRules: deriveTasteRules(profile) || undefined,
          model: settings.model || undefined,
        });

        // Dedup normalizado (case + espaços): o card renderiza em CAIXA ALTA, então
        // "Tecta"/"TECTA"/"tecta " são o MESMO nome — comparar cru deixava duplicata passar.
        const norm = (s: string) => s.toLowerCase().trim();
        const existing = new Set(
          [...profile.seen, ...deckRef.current.map((c) => c.name), ...retiredRef.current].map(norm)
        );
        const fresh: NamingCard[] = [];
        for (const n of resp.names || []) {
          if (!n?.name) continue;
          const key = norm(n.name);
          if (existing.has(key)) continue;
          existing.add(key);
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
    [brief, profile, tasteReading, brandGuidelineId, settings, requireAuth, handleApiError]
  );

  /**
   * "Gerar novamente" — descarta o deck ainda não julgado e refaz a leva com os
   * parâmetros atuais. Existe porque mudança de configuração só valia na PRÓXIMA
   * leva: quem trocava a régua ficava preso aos nomes gerados pela régua antiga.
   * Os nomes descartados seguem excluídos para não voltarem repetidos.
   */
  const regenerateDeck = useCallback(async () => {
    if (generatingRef.current) return;
    for (const c of deckRef.current) retiredRef.current.add(c.name);
    deckRef.current = [];
    setDeck([]);
    await fetchBatch(false);
  }, [fetchBatch]);

  /* ── Dispara primeira leva + prefetch ≤5 ────────────────────────────── */
  useEffect(() => {
    if (phase !== 'deck') return;
    if (deck.length === 0 && !generatingRef.current) {
      void fetchBatch(false);
    } else if (
      deck.length > 0 &&
      deck.length <= 5 &&
      !prefetchingRef.current &&
      !generatingRef.current
    ) {
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
        // Grava sentinela de falha (em vez de só limpar `defenseRequested`) para a
        // linha mostrar retry em vez de spinner eterno. Como a sentinela é truthy,
        // o effect abaixo NÃO re-dispara sozinho — só o retry manual reprocessa.
        defenseRequested.current.delete(card.name);
        setDefenseCache((p) => ({ ...p, [card.name]: { failed: true } }));
      }
    },
    [brief]
  );

  /** Retry manual: apaga a sentinela de falha → o effect abaixo re-dispara a defesa. */
  const retryDefense = useCallback((card: NamingCard) => {
    defenseRequested.current.delete(card.name);
    setDefenseCache((p) => {
      const next = { ...p };
      delete next[card.name];
      return next;
    });
  }, []);

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
      // Beacon analítico fire-and-forget (nunca afeta a UX). Não é enviado no
      // undo — a leve imprecisão de contagem é aceitável por design.
      namingEvent(verdict);
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

  // Setas (legado) + letras da ref (N/C/S/D) como aliases.
  useHotkeys('left,n', () => phase === 'deck' && triggerVerdict('nope'), [phase, triggerVerdict]);
  useHotkeys('right,c', () => phase === 'deck' && triggerVerdict('like'), [phase, triggerVerdict]);
  useHotkeys('up,s', () => phase === 'deck' && triggerVerdict('superlike'), [
    phase,
    triggerVerdict,
  ]);
  useHotkeys('z,d', () => phase === 'deck' && undoKey(), [phase, undoKey]);

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
      const summary =
        (defense && !isDefenseFailure(defense) ? defense.concept : undefined) || c.rationale;
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

  /* ── Reset ────────────────────────────────────────────────────────────────
   * Logado: a sessão atual já está salva no histórico — só começamos uma nova
   * (dropa o sessionId → o próximo autosave cria outro registro). Anônimo: limpa
   * o localStorage. Em ambos, cancela o autosave pendente pra não gravar o
   * estado zerado no registro antigo.
   */
  const handleReset = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (authService.isAuthenticated()) {
      setSessionId(null);
      sessionIdRef.current = null;
    } else {
      clearSession();
    }
    setProfile(emptyProfile());
    // Sessão nova herda o default do usuário (não o de fábrica).
    setSettings(userDefaultSettingsRef.current || DEFAULT_NAMING_SETTINGS);
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
    retiredRef.current = new Set();
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

  /* ── Restaura uma sessão anterior (do popover de histórico) ──────────── */
  const restoreBackendSession = useCallback(
    async (id: string) => {
      try {
        const rec = await namingSessionApi.get(id);
        applySession(rec.data);
        setSessionId(rec.id);
        setFinalists([]);
        setNudgeDismissed(false);
        setLastSwiped(null);
      } catch {
        toast.error('Não foi possível abrir a sessão.');
      }
    },
    [applySession]
  );

  /* ── Configurações avançadas (aplicam na próxima leva) ──────────────── */
  const updateSettings = useCallback(
    (patch: Partial<NamingSettings>) => {
      const next = { ...settingsRef.current, ...patch };
      setSettings(next);
      scheduleDefaultSave(next); // edição no popover vira o default do usuário
    },
    [scheduleDefaultSave]
  );
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_NAMING_SETTINGS);
    scheduleDefaultSave(DEFAULT_NAMING_SETTINGS); // "restaurar padrão" também reseta o default
  }, [scheduleDefaultSave]);

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
      onRetryDefense={retryDefense}
      onTransformToBrand={transformToBrand}
      brandGuidelineId={brandGuidelineId}
      onSaveToBrand={handleSaveToBrand}
    />
  );

  const statusBar = (
    <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest">
      {seenCount > 0 && (
        <span className="text-neutral-400">
          {seenCount} vistos{likedCount > 0 && ` · ${likedCount} curtidos`}
        </span>
      )}
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
          {/* Topo do deck: histórico (esq., só logado) + config avançada (dir.) */}
          <div className="flex w-full max-w-md items-center justify-between">
            {authService.isAuthenticated() ? (
              <NamingHistoryPopover
                currentId={sessionId}
                onRestore={restoreBackendSession}
                onNew={handleReset}
              />
            ) : (
              <span />
            )}
            <NamingSettingsPopover
              settings={settings}
              onChange={updateSettings}
              onReset={resetSettings}
              onRegenerate={phase === 'deck' ? regenerateDeck : undefined}
              regenerating={generating}
            />
          </div>

          {/* Deck */}
          <div className="relative h-[420px] w-full max-w-md">
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

          {/* Botões — label embaixo, paleta suave (só "Salvar" carrega o acento) */}
          {activeCard && (
            <div className="flex items-start justify-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => triggerVerdict('nope')}
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-neutral-300 transition-colors hover:border-destructive/50 hover:text-destructive"
                  aria-label="Não é isso (N)"
                >
                  <X size={22} />
                </button>
                <span className="text-[11px] text-neutral-500">Não é isso</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => triggerVerdict('like')}
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-neutral-100 transition-colors hover:border-white/25 hover:bg-white/10"
                  aria-label="Gostei (C)"
                >
                  <Heart size={22} />
                </button>
                <span className="text-[11px] text-neutral-300">Gostei</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => triggerVerdict('superlike')}
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-brand-cyan/30 bg-brand-cyan/[0.08] text-brand-cyan transition-colors hover:border-neutral-700 hover:bg-brand-cyan/15"
                  aria-label="Salvar (S)"
                >
                  <Bookmark size={22} />
                </button>
                <span className="text-[11px] text-neutral-500">Salvar</span>
              </div>
            </div>
          )}

          {activeCard && (
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-700">
              N não é isso · C gostei · S salvar · D desfaz
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
