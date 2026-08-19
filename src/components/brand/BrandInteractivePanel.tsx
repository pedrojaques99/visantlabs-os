import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Copy, Loader2, Layout, ArrowUpRight, ArrowRight } from '@/lib/ui/icons';
import { BrandRenderDialog } from '@/components/brand/guidelines/BrandRenderDialog';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn } from '@/lib/utils';
import { useBrandSuggestions, SUGGESTION_KIND_META } from '@/hooks/useBrandSuggestions';
import { useTranslation } from '@/hooks/useTranslation';
import { brandGuidelineApi, type BrandSuggestion } from '@/services/brandGuidelineApi';

// Suggestion kind → icon/labelKey/execution mode (SSoT shared with the cockpit).
const KIND_META = SUGGESTION_KIND_META;

// Static, always-available starters shown when live AI ideas are offline. The
// generator injects the brand, so these stay on-brand without any AI call —
// the panel never dead-ends on an error in the hero.
// `prompt` fica em inglês DE PROPÓSITO: é entrada de modelo de imagem, não texto
// de interface. Só titleKey/labelKey são visíveis e por isso traduzidos.
const STATIC_STARTERS: Array<{ titleKey: string; labelKey: string; prompt: string }> = [
  {
    titleKey: 'brandPanel.starter.instagramPost',
    labelKey: 'brandPanel.starter.social',
    prompt: 'A bold, on-brand Instagram feed post announcing what makes this brand special.',
  },
  {
    titleKey: 'brandPanel.starter.promoStory',
    labelKey: 'brandPanel.starter.social',
    prompt: 'A vertical, on-brand Instagram story promoting a current offer or launch.',
  },
  {
    titleKey: 'brandPanel.starter.launchPoster',
    labelKey: 'brandPanel.starter.print',
    prompt: 'A striking on-brand launch poster with the brand logo, a headline and key message.',
  },
  {
    titleKey: 'brandPanel.starter.campaignAd',
    labelKey: 'brandPanel.starter.ad',
    prompt: 'A clean on-brand ad creative with a strong headline and a clear call to action.',
  },
];

/**
 * Owner-only interactive band for the brand overview. Two jobs:
 *  (A) Seasonal/contextual on-brand IDEAS (free, cached) → one-tap into the mockup
 *      generator. The differentiator made tangible: the brand *makes* things.
 *  (B) "Connect to your AI" bento — surfaces connect/context/compile for people
 *      allowed to generate.
 *
 * Glass-minimal, themed off the brand CSS vars (`--brand-surface`, `--brand-text`,
 * `--accent`) exactly like the sibling BrandOverviewBento — accent stays scarce
 * (primary action + selected state only). Reuses GlassPanel + MicroTitle; adds no
 * new primitives.
 */

interface Props {
  guidelineId: string;
  /** Whether the brand is public (a connect link can be minted). */
  isShared: boolean;
  /** Seed the mockup generator with a suggestion's prompt and open it. */
  onGenerate: (prompt: string) => void;
  /** Optional: card "Mockup" persistente entre os starters (usado no cockpit).
   *  Entra como célula IGUAL às outras: mockup é suporte, não herói. */
  onMockup?: () => void;
  /** Optional (cockpit): o que o agente enxerga da marca hoje. Preenche o card
   *  de contexto com ESTADO em vez de repetir o convite. */
  contextStats?: Array<{ labelKey: string; value: number }>;
  /** Optional: the brand's real colors, most-used first — rendered as a dot
   *  strip inside the context card (moved here from the hero, which repeated it). */
  paletteColors?: Array<{ hex: string; name?: string }>;
  /** Existing connect handler (mints MCP connect link, or prompts to share first). */
  onConnect: () => void;
  connecting?: boolean;
  /** Full-bleed (cockpit): remove o max-w-6xl/mx-auto/my-8 do wrapper (que é da
   *  view pública centralizada) — o painel ocupa a largura toda do host. */
  fullWidth?: boolean;
  className?: string;
}

// Primary action: solid brand accent with the theme's computed contrast text
// (`--accent-text`) — the page's contrast-safe pair, so it reads on any brand color
// (no more dark-on-purple). `group/btn` lets the arrow nudge on hover.
const primaryBtn =
  'group/btn inline-flex items-center gap-2 rounded-lg text-sm font-medium ' +
  'bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-90 transition-opacity disabled:opacity-40';

// Secondary/ghost: readable brand text, hairline border, faint surface fill on hover.
const ghostBtn =
  'inline-flex items-center gap-2 rounded-lg border border-[var(--brand-text)]/12 text-sm ' +
  'text-[var(--brand-text)]/70 hover:text-[var(--brand-text)] hover:bg-[var(--brand-text)]/[0.04] ' +
  'hover:border-[var(--brand-text)]/25 transition-colors disabled:opacity-40';

// Bare monochrome icon action revealed on card hover (render / copy).
const iconBtn =
  'flex items-center justify-center w-7 h-7 rounded-md text-[var(--brand-text)]/40 ' +
  'hover:text-[var(--brand-text)] hover:bg-[var(--brand-text)]/[0.06] transition-colors';

/**
 * Idea tile — type-led, no decorative glyphs. The whole surface is the primary
 * action; a corner arrow signals intent, and secondary tools fade in on hover.
 * Vercel/Apple restraint: hairline border, one weight of type, accent used nowhere
 * at rest.
 */
const IdeaCard: React.FC<{
  kicker: string;
  title: string;
  body?: string;
  onPrimary: () => void;
  actions?: React.ReactNode;
}> = ({ kicker, title, body, onPrimary, actions }) => (
  <div className="group relative">
    <button
      onClick={onPrimary}
      className="w-full min-h-[104px] flex flex-col text-left rounded-xl border border-[var(--brand-text)]/10 bg-transparent p-5 pr-11 hover:border-[var(--brand-text)]/25 hover:bg-[var(--brand-text)]/[0.02] transition-colors"
    >
      <span className="text-xs text-[var(--brand-text)]/40">{kicker}</span>
      <span className="mt-1.5 text-[0.9375rem] font-medium tracking-tight leading-snug text-[var(--brand-text)]">
        {title}
      </span>
      {body && (
        <span className="mt-1.5 text-xs leading-relaxed text-[var(--brand-text)]/45 line-clamp-2">
          {body}
        </span>
      )}
    </button>
    <ArrowUpRight
      size={15}
      aria-hidden
      className="pointer-events-none absolute top-5 right-4 text-[var(--brand-text)]/25 transition-all group-hover:text-[var(--brand-text)]/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
    />
    {actions && (
      <div className="absolute bottom-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {actions}
      </div>
    )}
  </div>
);

// Same cell size/shape as IdeaCard, but styled as an action (dashed border, no
// kicker) — the 4th grid slot that triggers a fresh AI generation instead of
// linking to a static starter.
const GenerateIdeaCard: React.FC<{ label: string; loading?: boolean; onPrimary: () => void }> = ({
  label,
  loading,
  onPrimary,
}) => (
  <button
    onClick={onPrimary}
    disabled={loading}
    className="group w-full min-h-[104px] flex flex-col items-start justify-center text-left rounded-xl border border-dashed border-[var(--brand-text)]/20 bg-[var(--brand-text)]/[0.02] p-5 hover:border-[var(--brand-text)]/40 hover:bg-[var(--brand-text)]/[0.04] transition-colors disabled:opacity-50"
  >
    <span className="flex items-center gap-1.5 text-[0.9375rem] font-medium tracking-tight text-[var(--brand-text)]">
      {label}
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <ArrowRight
          size={14}
          className="transition-transform group-hover:translate-x-0.5"
        />
      )}
    </span>
  </button>
);

// Marcas oficiais dos assistentes. Não são ícones de interface: são logotipos
// de terceiro, então saem de arquivo em /models e não da biblioteca de ícones.
const ASSISTANTS: Array<{ id: string; label: string; node: React.ReactNode }> = [
  {
    id: 'claude',
    label: 'Claude',
    node: <img src="/models/claude-color.svg" alt="Claude" className="w-5 h-5" />,
  },
  {
    id: 'openai',
    label: 'ChatGPT',
    node: <img src="/models/openai.svg" alt="ChatGPT" className="w-5 h-5" />,
  },
  {
    id: 'cursor',
    label: 'Cursor',
    // EXCEÇÃO ao ruido-scan/icone-desenhado-a-mao: a marca do Cursor é
    // monocromática e precisa seguir `--brand-text` pra não sumir no tema da
    // marca ativa. Como <img> ela perderia `currentColor` e viraria uma cor
    // fixa que some em metade das marcas. As outras duas têm cor própria e
    // por isso saem de arquivo.
    node: (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5 text-[var(--brand-text)]/80"
        fill="currentColor"
        aria-hidden
      >
        <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
      </svg>
    ),
  },
];

export const BrandInteractivePanel: React.FC<Props> = ({
  guidelineId,
  isShared,
  onGenerate,
  onMockup,
  contextStats,
  paletteColors,
  onConnect,
  connecting,
  fullWidth,
  className,
}) => {
  const { t } = useTranslation();
  // Seasonal suggestions — shared SSoT hook (also powers the home cockpit).
  const { suggestions, seasonal, loading, refreshing, error, errorCode, load } =
    useBrandSuggestions(guidelineId, 4);
  const [busy, setBusy] = useState<string | null>(null); // which connect action is running
  const [renderOpen, setRenderOpen] = useState(false);
  const [renderInitial, setRenderInitial] = useState<
    { template?: string; h1?: string; brief?: string } | undefined
  >(undefined);

  const copyPrompt = useCallback(
    async (prompt: string) => {
      try {
        await navigator.clipboard.writeText(prompt);
        toast.success(t('brandPanel.promptCopied'));
      } catch {
        toast.error(t('brandPanel.copyFailed'));
      }
    },
    [t]
  );

  // Non-mockup kinds: copy the ready-to-run brief and point the user at their
  // connected AI (which executes it via the Visant MCP toolbelt).
  const sendToAI = useCallback(
    async (s: BrandSuggestion) => {
      try {
        await navigator.clipboard.writeText(s.prompt);
        const kind = t(KIND_META[s.kind]?.labelKey ?? KIND_META.mockup.labelKey).toLowerCase();
        toast.success(t('brandPanel.briefCopied', { kind }));
      } catch {
        toast.error(t('brandPanel.copyFailed'));
      }
    },
    [t]
  );

  const copyContext = useCallback(async () => {
    setBusy('context');
    try {
      const ctx = await brandGuidelineApi.getContext(guidelineId, 'prompt');
      await navigator.clipboard.writeText(typeof ctx === 'string' ? ctx : JSON.stringify(ctx));
      toast.success(t('brandPanel.contextCopied'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('brandPanel.contextCopyFailed'));
    } finally {
      setBusy(null);
    }
  }, [guidelineId, t]);

  const compileTokens = useCallback(
    async (format: 'css' | 'tailwind') => {
      setBusy(format);
      try {
        const { outputs } = await brandGuidelineApi.compile(guidelineId, format);
        const out = outputs?.[0];
        if (!out) throw new Error(t('brandPanel.nothingToCompile'));
        const blob = new Blob([out.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = out.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t('brandPanel.tokensDownloaded', { format: format.toUpperCase() }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('brandPanel.compileFailed'));
      } finally {
        setBusy(null);
      }
    },
    [guidelineId, t]
  );

  // Antes isto era um match de SUBSTRING na mensagem traduzida ("aren’t enabled"),
  // que nunca batia com o texto real ("are not enabled") — a dica de configuração
  // jamais aparecia. Agora vai pelo CÓDIGO do erro, imune a idioma e a copy.
  const aiConfigured = errorCode !== 'suggestions_not_configured';

  return (
    <div
      className={cn(
        'grid gap-4 lg:grid-cols-3',
        fullWidth ? 'w-full' : 'mx-auto w-full max-w-6xl px-4 sm:px-6 my-8',
        className
      )}
    >
      {/* ── (A) Seasonal ideas ── */}
      <GlassPanel
        padding="lg"
        className="lg:col-span-2 bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/10"
      >
        <div className="flex items-baseline justify-between gap-4 mb-8">
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="text-sm font-medium tracking-tight text-[var(--brand-text)]">
              {t('brandPanel.makeSomething')}
            </span>
            {seasonal && (
              <span className="hidden sm:inline truncate text-xs text-[var(--brand-text)]/35">
                {seasonal.label} · {t('brandPanel.daysOut', { n: seasonal.daysAway })}
              </span>
            )}
          </div>
          {suggestions.length > 0 && (
            <button
              onClick={() => load(true)}
              disabled={loading || refreshing}
              className="flex items-center gap-1.5 shrink-0 text-xs text-[var(--brand-text)]/40 hover:text-[var(--brand-text)]/80 transition-colors disabled:opacity-40"
              aria-label={t('brandPanel.refreshAria')}
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
              {t('brandPanel.refresh')}
            </button>
          )}
        </div>

        {loading || refreshing ? (
          // Skeletons while generating — reads as intent, never "stuck".
          <div className="grid sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[104px] rounded-xl border border-[var(--brand-text)]/[0.06] bg-[var(--brand-text)]/[0.02] animate-pulse"
              />
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          // Default: obvious, always-on-brand starters — zero model spend. Tailored,
          // seasonal ideas are generated only when the owner explicitly asks.
          <div className="space-y-4">
            {/* 4 células fechadas: mockup (se houver) + starters cobrem 3, a 4a
                é sempre o CTA de gerar ideia sob medida — no mesmo tamanho, não
                mais um botão largo separado embaixo. */}
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Mockup entra como célula IGUAL às outras. Era uma faixa larga
                  sozinha no topo, o maior elemento do painel — hierarquia que
                  contrariava o próprio plano (mockup é suporte, e é a dor com
                  evidência mais fraca). Só o cockpit passa `onMockup`. */}
              {onMockup && (
                <IdeaCard
                  kicker={t('brandPanel.kind.mockup')}
                  title={t('brandPanel.mockupTitle')}
                  onPrimary={onMockup}
                />
              )}
              {STATIC_STARTERS.slice(0, onMockup ? 2 : 3).map((s, i) => (
                <IdeaCard
                  key={i}
                  kicker={t(s.labelKey)}
                  title={t(s.titleKey)}
                  onPrimary={() => onGenerate(s.prompt)}
                />
              ))}
              <GenerateIdeaCard
                label={
                  seasonal
                    ? t('brandPanel.generateFor', { label: seasonal.label })
                    : t('brandPanel.generateTailored')
                }
                loading={refreshing}
                onPrimary={() => load(true)}
              />
            </div>
            {/* O erro das ideias ao vivo PRECISA aparecer: sem isto uma falha real
                fica indistinguível de "ainda não gerei ideias" — os starters
                estáticos escondiam a quebra (silent-empty). */}
            {error && (
              <p role="status" className="text-xs leading-relaxed text-[var(--brand-text)]/45">
                {t('brandPanel.ideasError', { message: error })}
              </p>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {onMockup && (
              <IdeaCard
                kicker={t('brandPanel.kind.mockup')}
                title={t('brandPanel.mockupTitle')}
                onPrimary={onMockup}
              />
            )}
            {suggestions.map((s, i) => {
              const meta = KIND_META[s.kind] || KIND_META.mockup;
              const isInline = meta.mode === 'inline';
              return (
                <IdeaCard
                  key={i}
                  kicker={t(meta.labelKey)}
                  title={s.title}
                  body={s.rationale}
                  onPrimary={() => (isInline ? onGenerate(s.prompt) : sendToAI(s))}
                  actions={
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenderInitial({
                            h1: s.title,
                            brief: `${s.title}. ${s.rationale}`,
                            template: 'Post/Launch',
                          });
                          setRenderOpen(true);
                        }}
                        className={iconBtn}
                        aria-label={t('brandPanel.renderAria')}
                        title={t('brandPanel.renderTitle')}
                      >
                        <Layout size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyPrompt(s.prompt);
                        }}
                        className={iconBtn}
                        aria-label={t('brandPanel.copyPrompt')}
                        title={t('brandPanel.copyPrompt')}
                      >
                        <Copy size={12} />
                      </button>
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </GlassPanel>

      {/* ── (B) Connect to your AI ── */}
      <GlassPanel
        padding="lg"
        className="bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/10 flex flex-col"
      >
        <span className="mb-6 block text-sm font-medium tracking-tight text-[var(--brand-text)]">
          {t('brandPanel.liveAiContext')}
        </span>

        {/* The assistants this brand plugs into — real marks, no chrome. */}
        <div className="flex items-center gap-2 mb-6">
          {ASSISTANTS.map((a) => (
            <div
              key={a.id}
              title={a.label}
              className="w-11 h-11 rounded-xl flex items-center justify-center border border-[var(--brand-text)]/10 bg-[var(--brand-surface)]/40"
            >
              {a.node}
            </div>
          ))}
        </div>

        <p className="text-sm text-[var(--brand-text)]/50 leading-relaxed mb-6 max-w-xs">
          {t('brandPanel.assistantsBlurb')}
        </p>

        {/* O que o agente enxerga HOJE. Este card é uma coluna só ao lado de um
            painel de duas, então o `mt-auto` abaixo abria um vão vertical morto
            de ~150px no meio da tela — bem no elemento que carrega a tese do
            produto. Estado ocupa o espaço; convite repetido não. */}
        {contextStats && contextStats.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-3">
            {contextStats.map((s) => (
              <div key={s.labelKey} className="flex flex-col">
                <span className="text-lg font-medium tabular-nums leading-none text-[var(--brand-text)]/80">
                  {s.value}
                </span>
                <span className="mt-1 text-xs text-[var(--brand-text)]/40">{t(s.labelKey)}</span>
              </div>
            ))}
          </div>
        )}

        {paletteColors && paletteColors.length > 0 && (
          <div
            className="flex items-center gap-1.5 mb-6"
            role="img"
            aria-label={t('cockpit.hero.palette')}
          >
            {paletteColors.map((c) => (
              <span
                key={c.hex}
                title={c.name || c.hex}
                className="w-4 h-4 rounded-full border border-[var(--brand-text)]/15 shrink-0"
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 mt-auto">
          <button
            onClick={onConnect}
            disabled={connecting}
            className={cn(isShared ? ghostBtn : primaryBtn, 'h-10 px-4 justify-between')}
          >
            <span>{isShared ? t('brandPanel.connect') : t('brandPanel.shareConnect')}</span>
            {connecting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArrowRight
                size={14}
                className="transition-transform group-hover/btn:translate-x-0.5"
              />
            )}
          </button>
          {/* `busy` é um slot ÚNICO pras três ações: desabilitar só a própria
              deixava a segunda clicada sobrescrever o slot, o spinner da primeira
              sumia e ela voltava clicável no meio do request (pedido duplicado).
              Enquanto qualquer uma roda, as três ficam travadas. */}
          <button
            onClick={copyContext}
            disabled={!!busy}
            className={cn(ghostBtn, 'h-10 px-4 justify-between')}
          >
            <span>{t('brandPanel.copyContext')}</span>
            {busy === 'context' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Copy size={13} />
            )}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => compileTokens('css')}
              disabled={!!busy}
              className={cn(ghostBtn, 'h-10 flex-1 justify-center text-xs font-mono')}
            >
              {busy === 'css' ? <Loader2 size={12} className="animate-spin" /> : 'CSS'}
            </button>
            <button
              onClick={() => compileTokens('tailwind')}
              disabled={!!busy}
              className={cn(ghostBtn, 'h-10 flex-1 justify-center text-xs font-mono')}
            >
              {busy === 'tailwind' ? <Loader2 size={12} className="animate-spin" /> : 'Tailwind'}
            </button>
          </div>
        </div>
        {!aiConfigured && (
          <p className="text-xs text-[var(--brand-text)]/40 mt-5 leading-relaxed">
            {t('brandPanel.notConfigured')}
          </p>
        )}
      </GlassPanel>

      {renderOpen && (
        <BrandRenderDialog
          open={renderOpen}
          onOpenChange={setRenderOpen}
          guidelineId={guidelineId}
          initial={renderInitial}
        />
      )}
    </div>
  );
};
