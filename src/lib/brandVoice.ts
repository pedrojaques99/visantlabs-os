/**
 * Brand voice — the one line at the top of the cockpit that could only be said
 * about THIS brand, today (plano `.agent/plans/COCKPIT-BRAND-PANEL.md` §2).
 *
 * Deterministic on purpose. Two reasons, both hard:
 *  1. Toda chamada a provedor pago grava `usage_record` (a lei do repo). Uma linha
 *     de estado que passa por LLM cobra crédito a cada abertura da home.
 *  2. Um modelo alucina data e contagem. Aqui o número vem do dado ou a regra
 *     não dispara.
 *
 * A função é pura e recebe `now` injetado — nada de `Date.now()` aqui dentro,
 * senão o teste vira refém do relógio.
 *
 * Devolve chave + params; QUEM traduz é o componente, sob o namespace
 * `cockpit.voice`. i18n não entra em lib pura.
 *
 * (O exemplo da chamada de `t()` foi tirado deste comentário de propósito: o
 * `i18n:check` varre comentário junto com código e acusava a chave de exemplo
 * como referência não resolvida.)
 */

/** Momento comercial vindo do `seasonalContext` do servidor (via /suggestions). */
export interface VoiceSeasonal {
  key: string;
  label: string;
  daysAway: number;
}

export interface BrandVoiceInput {
  brandName: string;
  hasLogo: boolean;
  /** `isPublic || publicSlug` — a marca pode ser ligada num assistente. */
  isConnected: boolean;
  /** 0..100, do `computeBrandCompleteness`. */
  completeness: number;
  /** Label já traduzido da maior lacuna (`missing[0]`), ou null. */
  topGapLabel: string | null;
  /** Total de peças produzidas com a marca (só os tipos VISÍVEIS na UI). */
  pieceCount: number;
  /** ISO da peça mais recente, ou null. */
  lastPieceAt: string | null;
  seasonal: VoiceSeasonal | null;
  /** Injetado. Sem default de propósito: o chamador decide o relógio. */
  now: number;
}

export type BrandVoiceKey =
  | 'noLogo'
  | 'noPieces'
  | 'seasonal'
  | 'notConnected'
  | 'idle'
  | 'gap'
  | 'neutral';

export interface BrandVoice {
  key: BrandVoiceKey;
  params: Record<string, string | number>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Uma marca só é "pronta pra ligar" acima disso. Abaixo, a lacuna importa mais. */
export const CONNECT_FLOOR = 60;
/** Sazonal só é notícia dentro desta janela. */
export const SEASONAL_HORIZON_DAYS = 21;
/** Abaixo disso "parada" é ruído, não sinal. */
export const IDLE_DAYS = 7;

/** Dias inteiros entre uma data ISO e agora. `null` quando a data não presta. */
export function daysSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const diff = now - then;
  if (diff < 0) return 0;
  return Math.floor(diff / DAY_MS);
}

/**
 * Diretor de frase: prioridade fixa, a primeira regra que casar vence.
 *
 * A ordem não é estética. Regra que expira (sazonal) passa na frente de regra
 * que não expira (conectar), e bloqueio duro (sem logo) passa na frente de tudo,
 * porque sem logo a marca não produz nada decente.
 */
export function selectBrandVoice(input: BrandVoiceInput): BrandVoice {
  const { brandName, hasLogo, isConnected, completeness, topGapLabel, pieceCount, seasonal, now } =
    input;

  // 1. Sem logo: nada do que vier depois adianta.
  if (!hasLogo) return { key: 'noLogo', params: { brand: brandName } };

  // 2. Nunca produziu nada.
  if (pieceCount === 0) return { key: 'noPieces', params: { brand: brandName } };

  // 3. Momento comercial na janela. Expira, então passa na frente.
  if (seasonal && seasonal.daysAway >= 0 && seasonal.daysAway <= SEASONAL_HORIZON_DAYS) {
    return {
      key: 'seasonal',
      params: { brand: brandName, label: seasonal.label, days: seasonal.daysAway },
    };
  }

  // 4. Marca madura e desligada de qualquer assistente. O piso evita empurrar
  //    "conecte" pra uma marca que ainda não tem contexto que valha a pena servir.
  if (!isConnected && completeness >= CONNECT_FLOOR) {
    return { key: 'notConnected', params: { brand: brandName } };
  }

  // 5. Parada. Só conta se existe data de peça: sem data, "0 dias" seria mentira.
  const idle = daysSince(input.lastPieceAt, now);
  if (idle !== null && idle >= IDLE_DAYS) {
    return { key: 'idle', params: { brand: brandName, days: idle } };
  }

  // 6. A maior lacuna, dita como consequência (a copy da chave é que faz isso).
  if (topGapLabel) return { key: 'gap', params: { brand: brandName, gap: topGapLabel } };

  // 7. Fallback com número real. Nunca frase genérica.
  return { key: 'neutral', params: { brand: brandName, count: pieceCount } };
}
