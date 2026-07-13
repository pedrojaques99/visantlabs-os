import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Copy, Loader2, Layout, ArrowUpRight, ArrowRight } from 'lucide-react';
import { BrandRenderDialog } from '@/components/brand/guidelines/BrandRenderDialog';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { cn } from '@/lib/utils';
import { useBrandSuggestions, SUGGESTION_KIND_META } from '@/hooks/useBrandSuggestions';
import { brandGuidelineApi, type BrandSuggestion } from '@/services/brandGuidelineApi';

// Suggestion kind → icon/label/execution mode (SSoT shared with the cockpit).
const KIND_META = SUGGESTION_KIND_META;

// Static, always-available starters shown when live AI ideas are offline. The
// generator injects the brand, so these stay on-brand without any AI call —
// the panel never dead-ends on an error in the hero.
const STATIC_STARTERS: Array<{ title: string; label: string; prompt: string }> = [
  {
    title: 'Instagram feed post',
    label: 'Social',
    prompt: 'A bold, on-brand Instagram feed post announcing what makes this brand special.',
  },
  {
    title: 'Promo story',
    label: 'Social',
    prompt: 'A vertical, on-brand Instagram story promoting a current offer or launch.',
  },
  {
    title: 'Launch poster',
    label: 'Print',
    prompt: 'A striking on-brand launch poster with the brand logo, a headline and key message.',
  },
  {
    title: 'Campaign ad',
    label: 'Ad',
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
  /** Optional: mostra um card "Mockup" persistente no topo de "Make something"
   *  (usado no cockpit — mockup é ação de produção importante). */
  onMockup?: () => void;
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
      className="w-full min-h-[104px] flex flex-col text-left rounded-xl border border-[var(--brand-text)]/10 bg-transparent p-5 pr-11 hover:border-[var(--brand-text)]/25 hover:bg-[var(--brand-text)]/[0.02] transition-all"
    >
      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--brand-text)]/35">
        {kicker}
      </span>
      <span className="mt-2 text-[15px] font-medium tracking-tight leading-snug text-[var(--brand-text)]">
        {title}
      </span>
      {body && (
        <span className="mt-1.5 text-[12px] leading-relaxed text-[var(--brand-text)]/45 line-clamp-2">
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

// Official assistant marks (reuse the same assets as the public connect page).
const ASSISTANTS: Array<{ id: string; label: string; node: React.ReactNode }> = [
  {
    id: 'claude',
    label: 'Claude',
    node: <img src="/models/claude-color.svg" alt="Claude" className="w-5 h-5" />,
  },
  {
    id: 'openai',
    label: 'ChatGPT',
    node: (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#10A37F]" fill="currentColor" aria-hidden>
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
      </svg>
    ),
  },
  {
    id: 'cursor',
    label: 'Cursor',
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
  onConnect,
  connecting,
  fullWidth,
  className,
}) => {
  // Seasonal suggestions — shared SSoT hook (also powers the home cockpit).
  const { suggestions, seasonal, loading, refreshing, error, load } = useBrandSuggestions(
    guidelineId,
    4
  );
  const [busy, setBusy] = useState<string | null>(null); // which connect action is running
  const [renderOpen, setRenderOpen] = useState(false);
  const [renderInitial, setRenderInitial] = useState<
    { template?: string; h1?: string; brief?: string } | undefined
  >(undefined);

  const copyPrompt = useCallback(async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success('Prompt copied');
    } catch {
      toast.error('Couldn’t copy');
    }
  }, []);

  // Non-mockup kinds: copy the ready-to-run brief and point the user at their
  // connected AI (which executes it via the Visant MCP toolbelt).
  const sendToAI = useCallback(async (s: BrandSuggestion) => {
    try {
      await navigator.clipboard.writeText(s.prompt);
      const label = (KIND_META[s.kind]?.label || 'asset').toLowerCase();
      toast.success(`Brief copied — run it in your connected AI to build the ${label}.`);
    } catch {
      toast.error('Couldn’t copy');
    }
  }, []);

  const copyContext = useCallback(async () => {
    setBusy('context');
    try {
      const ctx = await brandGuidelineApi.getContext(guidelineId, 'prompt');
      await navigator.clipboard.writeText(typeof ctx === 'string' ? ctx : JSON.stringify(ctx));
      toast.success('Brand context copied — paste it into your AI');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t copy context');
    } finally {
      setBusy(null);
    }
  }, [guidelineId]);

  const compileTokens = useCallback(
    async (format: 'css' | 'tailwind') => {
      setBusy(format);
      try {
        const { outputs } = await brandGuidelineApi.compile(guidelineId, format);
        const out = outputs?.[0];
        if (!out) throw new Error('Nothing to compile');
        const blob = new Blob([out.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = out.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${format.toUpperCase()} tokens downloaded`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Couldn’t compile tokens');
      } finally {
        setBusy(null);
      }
    },
    [guidelineId]
  );

  const aiConfigured = !error || !error.includes('aren’t enabled');

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
            <MicroTitle className="text-[var(--brand-text)]/50">Make something</MicroTitle>
            {seasonal && (
              <span className="hidden sm:inline truncate text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/30">
                {seasonal.label} · {seasonal.daysAway}d out
              </span>
            )}
          </div>
          {suggestions.length > 0 && (
            <button
              onClick={() => load(true)}
              disabled={loading || refreshing}
              className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/35 hover:text-[var(--brand-text)]/80 transition-colors disabled:opacity-40"
              aria-label="Regenerate ideas"
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          )}
        </div>

        {/* Mockup — starter de produção persistente (não sazonal). Só aparece
            quando o host passa onMockup (cockpit); a view pública não usa. */}
        {onMockup && (
          <div className="mb-3">
            <IdeaCard
              kicker="Mockup"
              title="Aplicar a marca em produtos reais"
              onPrimary={onMockup}
            />
          </div>
        )}

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
            <div className="grid sm:grid-cols-2 gap-3">
              {STATIC_STARTERS.map((s, i) => (
                <IdeaCard
                  key={i}
                  kicker={s.label}
                  title={s.title}
                  onPrimary={() => onGenerate(s.prompt)}
                />
              ))}
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className={cn(primaryBtn, 'h-9 px-4 w-full sm:w-auto justify-center')}
            >
              <span>
                {seasonal ? `Generate ideas for ${seasonal.label}` : 'Generate tailored ideas'}
              </span>
              <ArrowRight
                size={13}
                className="transition-transform group-hover/btn:translate-x-0.5"
              />
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {suggestions.map((s, i) => {
              const meta = KIND_META[s.kind] || KIND_META.mockup;
              const isInline = meta.mode === 'inline';
              return (
                <IdeaCard
                  key={i}
                  kicker={meta.label}
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
                            brief: `${s.title} — ${s.rationale}`,
                            template: 'Post/Launch',
                          });
                          setRenderOpen(true);
                        }}
                        className={iconBtn}
                        aria-label="Render on-brand"
                        title="Render on-brand (web — no Figma)"
                      >
                        <Layout size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyPrompt(s.prompt);
                        }}
                        className={iconBtn}
                        aria-label="Copy prompt"
                        title="Copy prompt"
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
        <MicroTitle className="text-[var(--brand-text)]/50 mb-6">Live AI context</MicroTitle>

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

        <p className="text-[13px] text-[var(--brand-text)]/50 leading-relaxed mb-6 max-w-xs">
          Your colors, type, logos and voice — loaded into any assistant, automatically.
        </p>

        <div className="flex flex-col gap-2 mt-auto">
          <button
            onClick={onConnect}
            disabled={connecting}
            className={cn(primaryBtn, 'h-10 px-4 justify-between')}
          >
            <span>{isShared ? 'Connect to your AI' : 'Share + connect'}</span>
            {connecting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <ArrowRight
                size={14}
                className="transition-transform group-hover/btn:translate-x-0.5"
              />
            )}
          </button>
          <button
            onClick={copyContext}
            disabled={busy === 'context'}
            className={cn(ghostBtn, 'h-10 px-4 justify-between')}
          >
            <span>Copy brand context</span>
            {busy === 'context' ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => compileTokens('css')}
              disabled={busy === 'css'}
              className={cn(ghostBtn, 'h-10 flex-1 justify-center text-xs font-mono')}
            >
              {busy === 'css' ? <Loader2 size={12} className="animate-spin" /> : 'CSS'}
            </button>
            <button
              onClick={() => compileTokens('tailwind')}
              disabled={busy === 'tailwind'}
              className={cn(ghostBtn, 'h-10 flex-1 justify-center text-xs font-mono')}
            >
              {busy === 'tailwind' ? <Loader2 size={12} className="animate-spin" /> : 'Tailwind'}
            </button>
          </div>
        </div>
        {!aiConfigured && (
          <p className="text-[10px] text-[var(--brand-text)]/40 mt-5 leading-relaxed">
            Set a cheap text-provider key (Groq / NVIDIA NIM) to unlock seasonal idea suggestions.
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
