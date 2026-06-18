import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Sparkles,
  RefreshCw,
  Copy,
  Wand2,
  Plug,
  FileCode,
  CalendarClock,
  Loader2,
  Image as ImageIcon,
  Instagram,
  Megaphone,
  Video,
  FileText,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { cn } from '@/lib/utils';
import {
  brandGuidelineApi,
  type BrandSuggestion,
  type BrandSuggestionKind,
} from '@/services/brandGuidelineApi';

// Each suggestion kind → its icon, label, and how it's executed:
//  · 'inline'  = Visant generates it in-app (only mockups have a clean brand-aware path)
//  · 'ai'      = handed to the brand's connected AI assistant (which has the full
//                Visant MCP toolbelt: campaign/creative/budget/video/naming)
const KIND_META: Record<
  BrandSuggestionKind,
  { label: string; Icon: LucideIcon; mode: 'inline' | 'ai' }
> = {
  mockup: { label: 'Mockup', Icon: ImageIcon, mode: 'inline' },
  social: { label: 'Social', Icon: Instagram, mode: 'ai' },
  campaign: { label: 'Campaign', Icon: Megaphone, mode: 'ai' },
  video: { label: 'Video', Icon: Video, mode: 'ai' },
  budget: { label: 'Budget', Icon: FileText, mode: 'ai' },
  naming: { label: 'Naming', Icon: Type, mode: 'ai' },
};

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

interface SeasonalMoment {
  key: string;
  label: string;
  daysAway: number;
}

interface Props {
  guidelineId: string;
  /** Whether the brand is public (a connect link can be minted). */
  isShared: boolean;
  /** Seed the mockup generator with a suggestion's prompt and open it. */
  onGenerate: (prompt: string) => void;
  /** Existing connect handler (mints MCP connect link, or prompts to share first). */
  onConnect: () => void;
  connecting?: boolean;
  className?: string;
}

function friendlyError(e: unknown): { code?: string; message: string } {
  const code = (e as { code?: string })?.code;
  if (code === 'suggestions_not_configured')
    return { code, message: 'AI ideas aren’t enabled for this workspace yet.' };
  if (code === 'suggestions_unavailable')
    return { code, message: 'AI ideas are temporarily unavailable — try again shortly.' };
  return { code, message: e instanceof Error ? e.message : 'Could not load ideas.' };
}

// Primary action: solid brand accent with the theme's computed contrast text
// (`--accent-text`) — the page's contrast-safe pair, so it reads on any brand color
// (no more dark-on-purple).
const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium ' +
  'bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-90 transition-opacity disabled:opacity-40';

// Secondary/ghost: readable brand text, thin border, surface fill on hover.
const ghostBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--brand-text)]/12 ' +
  'text-[var(--brand-text)]/70 hover:text-[var(--brand-text)] hover:bg-[var(--brand-text)]/[0.05] ' +
  'hover:border-[var(--brand-text)]/20 transition-colors disabled:opacity-40';

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
  onConnect,
  connecting,
  className,
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState<BrandSuggestion[]>([]);
  const [seasonal, setSeasonal] = useState<SeasonalMoment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // which connect action is running

  const load = useCallback(
    async (force = false) => {
      if (!guidelineId) return;
      if (force) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await brandGuidelineApi.getSuggestions(guidelineId, { count: 4, force });
        setSuggestions(res.suggestions || []);
        setSeasonal(res.seasonal?.upcoming?.[0] || null);
        setError(null);
      } catch (e) {
        setError(friendlyError(e).message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [guidelineId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

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
        'mx-auto w-full max-w-6xl px-4 sm:px-6 my-8 grid gap-4 lg:grid-cols-3',
        className
      )}
    >
      {/* ── (A) Seasonal ideas ── */}
      <GlassPanel
        padding="md"
        className="lg:col-span-2 bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/10"
      >
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles size={13} className="text-[var(--accent)] shrink-0" />
            <MicroTitle className="text-[var(--brand-text)]/50 tracking-[0.15em]">
              Make something on-brand
            </MicroTitle>
            {seasonal && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono text-[var(--accent)]/80 bg-[var(--accent)]/8 px-2 py-0.5 rounded-full">
                <CalendarClock size={10} />
                {seasonal.label} · ~{seasonal.daysAway}d
              </span>
            )}
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text)]/40 hover:text-[var(--accent)] transition-colors disabled:opacity-40"
            aria-label="Refresh ideas"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--brand-text)]/45 py-10 justify-center">
            <Loader2 size={13} className="animate-spin" /> Reading the brand + what’s coming up…
          </div>
        ) : error && suggestions.length === 0 ? (
          <p className="text-xs text-[var(--brand-text)]/45 py-8 text-center">{error}</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {suggestions.map((s, i) => {
              const meta = KIND_META[s.kind] || KIND_META.mockup;
              const Icon = meta.Icon;
              return (
                <div
                  key={i}
                  className="group flex flex-col gap-2.5 rounded-xl bg-[var(--brand-text)]/[0.03] p-4 hover:bg-[var(--brand-text)]/[0.06] transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-[var(--brand-text)]/40">
                    <Icon size={12} className="shrink-0" />
                    <span className="text-[9px] font-mono uppercase tracking-wider">
                      {meta.label}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-[var(--brand-text)] leading-snug">
                    {s.title}
                  </span>
                  <p className="text-[12px] text-[var(--brand-text)]/55 leading-relaxed line-clamp-2 flex-1">
                    {s.rationale}
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    {meta.mode === 'inline' ? (
                      <button
                        onClick={() => onGenerate(s.prompt)}
                        className={cn(primaryBtn, 'h-7 px-3 text-[11px]')}
                      >
                        <Wand2 size={11} /> Generate
                      </button>
                    ) : (
                      <button
                        onClick={() => sendToAI(s)}
                        className={cn(primaryBtn, 'h-7 px-3 text-[11px]')}
                        title="Copy the brief for your connected AI"
                      >
                        <Sparkles size={11} /> Use in AI
                      </button>
                    )}
                    <button
                      onClick={() => copyPrompt(s.prompt)}
                      className={cn(ghostBtn, 'h-7 w-7')}
                      aria-label="Copy prompt"
                      title="Copy prompt"
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>

      {/* ── (B) Connect to your AI ── */}
      <GlassPanel
        padding="md"
        className="bg-[var(--brand-surface)]/20 border-[var(--brand-text)]/10 flex flex-col"
      >
        <div className="flex items-center gap-2.5 mb-4">
          <Plug size={13} className="text-[var(--accent)]" />
          <MicroTitle className="text-[var(--brand-text)]/50 tracking-[0.15em]">
            Use as live AI context
          </MicroTitle>
        </div>

        {/* Visual hero: the assistants this brand plugs into. */}
        <div className="inline-flex items-center gap-1 self-start p-1.5 mb-4 rounded-2xl bg-[var(--brand-text)]/[0.04] border border-[var(--brand-text)]/10">
          {ASSISTANTS.map((a) => (
            <div
              key={a.id}
              title={a.label}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--brand-surface)]/40"
            >
              {a.node}
            </div>
          ))}
        </div>

        <p className="text-[12px] text-[var(--brand-text)]/55 leading-relaxed mb-5">
          On-brand by default — colors, fonts, logos & voice, automatically.
        </p>

        <div className="flex flex-col gap-2 mt-auto">
          <button
            onClick={onConnect}
            disabled={connecting}
            className={cn(primaryBtn, 'h-9 px-3 text-xs justify-start')}
          >
            {connecting ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />}
            {isShared ? 'Connect to your AI' : 'Share + connect to your AI'}
          </button>
          <button
            onClick={copyContext}
            disabled={busy === 'context'}
            className={cn(ghostBtn, 'h-9 px-3 text-xs justify-start')}
          >
            {busy === 'context' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Copy size={13} />
            )}
            Copy brand context
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => compileTokens('css')}
              disabled={busy === 'css'}
              className={cn(ghostBtn, 'h-9 flex-1 text-[11px]')}
            >
              <FileCode size={12} /> CSS
            </button>
            <button
              onClick={() => compileTokens('tailwind')}
              disabled={busy === 'tailwind'}
              className={cn(ghostBtn, 'h-9 flex-1 text-[11px]')}
            >
              <FileCode size={12} /> Tailwind
            </button>
          </div>
        </div>
        {!aiConfigured && (
          <p className="text-[10px] text-[var(--brand-text)]/40 mt-4 leading-relaxed">
            Tip: set a cheap text-provider key (Groq / NVIDIA NIM) to unlock seasonal idea
            suggestions.
          </p>
        )}
      </GlassPanel>
    </div>
  );
};
