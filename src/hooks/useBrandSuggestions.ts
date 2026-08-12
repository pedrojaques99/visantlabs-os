import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Instagram,
  Megaphone,
  Video,
  FileText,
  Type,
  type LucideIcon,
} from '@/lib/ui/icons';
import {
  brandGuidelineApi,
  type BrandSuggestion,
  type BrandSuggestionKind,
} from '@/services/brandGuidelineApi';
import { translate } from '@/utils/localeUtils';

/**
 * Seasonal/contextual on-brand suggestions — SSoT extracted from
 * `BrandInteractivePanel` (plano Revenue-Centric §4.1) so the brand view panel
 * and the home cockpit consume the exact same loading/refresh/error behavior.
 * Free + cached server-side; `load(true)` forces a refresh.
 */

export interface SeasonalMoment {
  key: string;
  label: string;
  daysAway: number;
}

// Each suggestion kind → its icon, i18n label key, and how it's executed:
//  · 'inline'  = Visant generates it in-app (only mockups have a clean brand-aware path)
//  · 'ai'      = handed to the brand's connected AI assistant (which has the full
//                Visant MCP toolbelt: campaign/creative/budget/video/naming)
// `labelKey` (não `label`) porque o kicker é texto VISÍVEL — inclusive na página
// pública da marca, que um cliente pt-BR abre.
export const SUGGESTION_KIND_META: Record<
  BrandSuggestionKind,
  { labelKey: string; Icon: LucideIcon; mode: 'inline' | 'ai' }
> = {
  mockup: { labelKey: 'brandPanel.kind.mockup', Icon: ImageIcon, mode: 'inline' },
  social: { labelKey: 'brandPanel.kind.social', Icon: Instagram, mode: 'ai' },
  campaign: { labelKey: 'brandPanel.kind.campaign', Icon: Megaphone, mode: 'ai' },
  video: { labelKey: 'brandPanel.kind.video', Icon: Video, mode: 'ai' },
  budget: { labelKey: 'brandPanel.kind.budget', Icon: FileText, mode: 'ai' },
  naming: { labelKey: 'brandPanel.kind.naming', Icon: Type, mode: 'ai' },
};

function friendlyError(e: unknown): { code?: string; message: string } {
  const code = (e as { code?: string })?.code;
  if (code === 'suggestions_not_configured')
    return { code, message: translate('errors.ideasNotEnabled') };
  if (code === 'suggestions_unavailable')
    return { code, message: translate('errors.ideasUnavailable') };
  return { code, message: e instanceof Error ? e.message : translate('errors.couldNotLoadIdeas') };
}

// ── Client-side mirror of the last generated set ──────────────────────────────
// The server already caches weekly in Redis; this local mirror means a returning
// owner sees their ideas instantly with ZERO network + ZERO model spend, and the
// set survives even if the server cache is evicted. Valid for a week.
const LS_PREFIX = 'visant:brand-suggestions:';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type CachedIdeas = {
  savedAt: number;
  suggestions: BrandSuggestion[];
  seasonal: SeasonalMoment | null;
};

function readLocal(id: string): CachedIdeas | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedIdeas;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > WEEK_MS) return null;
    return Array.isArray(parsed.suggestions) ? parsed : null;
  } catch {
    return null;
  }
}
function writeLocal(id: string, suggestions: BrandSuggestion[], seasonal: SeasonalMoment | null) {
  try {
    localStorage.setItem(
      LS_PREFIX + id,
      JSON.stringify({ savedAt: Date.now(), suggestions, seasonal })
    );
  } catch {
    /* quota / private mode — non-fatal */
  }
}

export function useBrandSuggestions(guidelineId: string | null | undefined, count = 4) {
  // Not loading by default — the panel opens on static starters, never on a spinner.
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState<BrandSuggestion[]>([]);
  const [seasonal, setSeasonal] = useState<SeasonalMoment | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Código do erro (não a mensagem) — quem consome decide o que mostrar sem
  // fazer match de substring em texto traduzido (que quebra em outro idioma).
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Guarda de corrida: só a resposta do pedido MAIS RECENTE pode escrever estado.
  // Sem isso, trocar de marca rápido (ou clicar Refresh durante o load inicial)
  // deixa a resposta antiga sobrescrever a nova.
  const requestId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (force = false) => {
      if (!guidelineId) return;
      const myId = ++requestId.current;
      const isStale = () => !mounted.current || myId !== requestId.current;
      if (force) setRefreshing(true);
      else setLoading(true);
      try {
        // force=false → cache-only fetch (free: served from cache or falls back to
        // static starters — never spends a model call). force=true → generate.
        const res = await brandGuidelineApi.getSuggestions(guidelineId, {
          count,
          force,
          cacheOnly: !force,
        });
        const next = res.suggestions || [];
        const nextSeasonal = res.seasonal?.upcoming?.[0] || null;
        // Persist whatever the server gave us (only when it actually has ideas).
        // Fica ANTES do guard: o cache local vale mesmo se o componente saiu.
        if (next.length) writeLocal(guidelineId, next, nextSeasonal);
        if (isStale()) return;
        setSuggestions(next);
        setSeasonal(nextSeasonal);
        setError(null);
        setErrorCode(null);
      } catch (e) {
        if (isStale()) return;
        const friendly = friendlyError(e);
        setError(friendly.message);
        setErrorCode(friendly.code ?? 'unknown');
      } finally {
        if (!isStale()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [guidelineId, count]
  );

  useEffect(() => {
    if (!guidelineId) return;
    // Trocou de marca → o estado da marca ANTERIOR não pode continuar na tela.
    // (Sem isto o painel mostra as ideias da marca velha até a nova responder.)
    setError(null);
    setErrorCode(null);
    // Instant paint from the local mirror — zero network, zero spend.
    const cached = readLocal(guidelineId);
    if (cached && cached.suggestions.length) {
      // Invalida qualquer resposta em voo da marca anterior.
      requestId.current++;
      setSuggestions(cached.suggestions);
      setSeasonal(cached.seasonal);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setSuggestions([]);
    setSeasonal(null);
    // No local copy → a free cache-only probe (server cache or starters).
    load(false);
  }, [guidelineId, load]);

  return { suggestions, seasonal, loading, refreshing, error, errorCode, load };
}
