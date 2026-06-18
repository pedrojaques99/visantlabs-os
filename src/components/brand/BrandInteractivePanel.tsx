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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { brandGuidelineApi, type BrandSuggestion } from '@/services/brandGuidelineApi';

/**
 * Owner-only interactive band for the brand overview. Two jobs:
 *  (A) Seasonal/contextual on-brand IDEAS (free, cached) → one-tap into the mockup
 *      generator. This is the differentiator made tangible: the brand *makes* things.
 *  (B) "Connect to your AI" bento — surfaces the connect/context/compile actions
 *      that were buried in menus, for people allowed to generate.
 *
 * Composes existing primitives only. Renders nothing destructive: if AI text isn't
 * configured the ideas block degrades to a quiet note and the connect bento stays.
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
        'mx-auto w-full max-w-6xl px-4 sm:px-6 my-6 grid gap-4 lg:grid-cols-3',
        className
      )}
    >
      {/* ── (A) Seasonal ideas ── */}
      <div className="lg:col-span-2 rounded-2xl border border-violet-500/15 bg-violet-500/[0.03] p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={14} className="text-violet-400 shrink-0" />
            <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-neutral-300">
              Make something on-brand
            </h3>
            {seasonal && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono text-violet-300/80 bg-violet-500/10 px-2 py-0.5 rounded-full">
                <CalendarClock size={10} />
                {seasonal.label} · ~{seasonal.daysAway}d
              </span>
            )}
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-40"
            aria-label="Refresh ideas"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-[11px] text-neutral-500 py-8 justify-center">
            <Loader2 size={13} className="animate-spin" /> Reading the brand + what’s coming up…
          </div>
        ) : error && suggestions.length === 0 ? (
          <p className="text-[11px] text-neutral-500 py-6 text-center">{error}</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2.5">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="group flex flex-col gap-2 rounded-xl border border-neutral-800 bg-white/[0.02] p-3.5 hover:border-violet-500/25 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-200 leading-snug">
                    {s.title}
                  </span>
                  <span className="shrink-0 text-[9px] font-mono uppercase text-neutral-600 bg-white/5 px-1.5 py-0.5 rounded">
                    {s.aspectRatio}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed line-clamp-2 flex-1">
                  {s.rationale}
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <Button
                    onClick={() => onGenerate(s.prompt)}
                    className="h-7 px-3 gap-1.5 text-[11px] bg-violet-500/20 border border-violet-500/30 text-violet-200 hover:bg-violet-500/30"
                  >
                    <Wand2 size={11} /> Generate
                  </Button>
                  <button
                    onClick={() => copyPrompt(s.prompt)}
                    className="h-7 w-7 flex items-center justify-center rounded-md border border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:border-neutral-700 transition-colors"
                    aria-label="Copy prompt"
                    title="Copy prompt"
                  >
                    <Copy size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── (B) Connect to your AI ── */}
      <div className="rounded-2xl border border-neutral-800 bg-white/[0.02] p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <Plug size={14} className="text-emerald-400" />
          <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-neutral-300">
            Use as live AI context
          </h3>
        </div>
        <p className="text-[11px] text-neutral-500 leading-relaxed mb-4">
          Plug this brand into Claude, ChatGPT or Cursor so everything they make comes out on-brand.
        </p>

        <div className="flex flex-col gap-2 mt-auto">
          <Button
            onClick={onConnect}
            disabled={connecting}
            className="h-9 justify-start gap-2 text-xs bg-emerald-500/15 border border-emerald-500/25 text-emerald-200 hover:bg-emerald-500/25"
          >
            {connecting ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />}
            {isShared ? 'Connect to your AI' : 'Share + connect to your AI'}
          </Button>
          <Button
            variant="ghost"
            onClick={copyContext}
            disabled={busy === 'context'}
            className="h-9 justify-start gap-2 text-xs text-neutral-400 border border-neutral-800 hover:bg-white/5"
          >
            {busy === 'context' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Copy size={13} />
            )}
            Copy brand context
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => compileTokens('css')}
              disabled={busy === 'css'}
              className="h-9 flex-1 justify-center gap-1.5 text-[11px] text-neutral-400 border border-neutral-800 hover:bg-white/5"
            >
              <FileCode size={12} /> CSS
            </Button>
            <Button
              variant="ghost"
              onClick={() => compileTokens('tailwind')}
              disabled={busy === 'tailwind'}
              className="h-9 flex-1 justify-center gap-1.5 text-[11px] text-neutral-400 border border-neutral-800 hover:bg-white/5"
            >
              <FileCode size={12} /> Tailwind
            </Button>
          </div>
        </div>
        {!aiConfigured && (
          <p className="text-[10px] text-neutral-600 mt-3 leading-relaxed">
            Tip: set a cheap text-provider key (Groq / NVIDIA NIM) to unlock seasonal idea
            suggestions.
          </p>
        )}
      </div>
    </div>
  );
};
