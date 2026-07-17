/**
 * References — pull images off the canvas into the reference library, and browse
 * what's already there.
 *
 * Lives in the Extract group: you end up with canvas work captured as a
 * reference. The server does the tagging (3 AI calls per image), so this only
 * ever ships pixels and shows what came back.
 */

import { useState, useCallback, useEffect } from 'react';
import { Images, Upload, X, Search } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { usePluginStore } from '../../store';
import { useClient } from '../../lib/ClientProvider';
import { useApi, ApiTimeoutError } from '../../hooks/useApi';

/** client.request is hard-capped at 30s — chunk or a big selection times out. */
const EXPORT_CHUNK = 20;
/** POST /references/upload rejects batches over 10. */
const UPLOAD_CHUNK = 10;
const EXPORT_SCALE = 2;

/**
 * Generous on purpose: the server runs ~3 AI calls per image at INGEST_CONCURRENCY=3, so a
 * full batch of 10 legitimately takes tens of seconds. This is not a latency budget — it's
 * the guarantee that the button cannot spin forever if the connection dies.
 */
const UPLOAD_TIMEOUT_MS = 180_000;
/** A search that took this long is stale anyway. */
const SEARCH_TIMEOUT_MS = 15_000;

interface Shot {
  nodeId: string;
  name: string;
  data: string;
}

/** Deep link back to the exact node — Figma wants `1-23`, not `1:23`. */
function nodeDeepLink(fileId: string, nodeId: string): string {
  return `https://www.figma.com/file/${fileId}?node-id=${encodeURIComponent(nodeId.replace(':', '-'))}`;
}

interface LibraryRef {
  id: string;
  name?: string;
  thumbnailUrl?: string;
  referenceImageUrl?: string;
}

export function ReferencesSection() {
  const { t } = useTranslation();
  const client = useClient();
  const { call } = useApi();
  const showToast = usePluginStore((s) => s.showToast);
  const brandGuideline = usePluginStore((s) => s.brandGuideline);
  const fileId = usePluginStore((s) => s.fileId);

  const [picked, setPicked] = useState<Shot[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pulling, setPulling] = useState(false);

  const [library, setLibrary] = useState<LibraryRef[]>([]);
  const [search, setSearch] = useState('');
  const [brandOnly, setBrandOnly] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  const brandId = (brandGuideline as any)?.id as string | undefined;

  // ── Browse ────────────────────────────────────────────────────────────────
  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      const params = new URLSearchParams({ limit: '12' });
      // Search by meaning (same engine as the web app) — semantic only matters
      // with a query, so the empty-query library browse stays on the cheap path.
      if (search.trim()) {
        params.set('search', search.trim());
        params.set('semantic', '1');
      }
      // Brand filter is an association tag, not ownership — refs stay global.
      if (brandOnly && brandId) params.set('brandGuidelineId', brandId);
      // Last-one-wins: this is the only call here that should cancel its predecessor.
      const res = await call(
        `/api/references?${params}`,
        {},
        {
          abortPrevious: true,
          timeoutMs: SEARCH_TIMEOUT_MS,
        }
      );
      // null = a newer search superseded this one — keep the old list.
      if (res) setLibrary(res.references || []);
    } catch (err: any) {
      showToast(err?.message || t('plugin.tools.references.loadFailed'), 'error');
    } finally {
      setLoadingLibrary(false);
    }
  }, [call, search, brandOnly, brandId, showToast, t]);

  // Debounced: the section mounts on first open, then reacts to filter changes.
  useEffect(() => {
    const id = setTimeout(loadLibrary, 300);
    return () => clearTimeout(id);
  }, [loadLibrary]);

  // ── Pull from canvas ──────────────────────────────────────────────────────
  const pullSelection = useCallback(async () => {
    setPulling(true);
    try {
      const ids = usePluginStore.getState().selectionDetails.map((s) => s.id);
      if (!ids.length) {
        showToast(t('plugin.tools.references.selectFirst'), 'warning');
        return;
      }

      const images: any[] = [];
      for (let i = 0; i < ids.length; i += EXPORT_CHUNK) {
        const batch = await client.request('image.exportNodes', {
          nodeIds: ids.slice(i, i + EXPORT_CHUNK),
          scale: EXPORT_SCALE,
        });
        images.push(...batch.images);
      }

      // A layer that fails to export comes back without `data` — one bad node
      // must not sink the whole selection.
      const ok: Shot[] = images.filter((i) => !!i.data);
      const failed = images.length - ok.length;

      setPicked((prev) => {
        const seen = new Set(prev.map((s) => s.nodeId));
        return [...prev, ...ok.filter((s) => !seen.has(s.nodeId))];
      });
      if (failed > 0) {
        showToast(t('plugin.tools.references.someFailed', { count: failed }), 'warning');
      }
    } catch (err: any) {
      showToast(err?.message || t('plugin.tools.references.exportFailed'), 'error');
    } finally {
      setPulling(false);
    }
  }, [client, showToast, t]);

  // ── Save to library ───────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!picked.length) return;
    setSaving(true);
    const totalChunks = Math.ceil(picked.length / UPLOAD_CHUNK);
    setProgress({ done: 0, total: totalChunks });
    try {
      let ingested = 0;
      let deduped = 0;

      for (let i = 0; i < picked.length; i += UPLOAD_CHUNK) {
        const chunk = picked.slice(i, i + UPLOAD_CHUNK);
        const res = await call(
          '/api/references/upload',
          {
            method: 'POST',
            body: JSON.stringify({
              images: chunk.map((s) => ({
                data: s.data,
                name: s.name,
                // Provenance is free here — the image came from a known node in a
                // known Figma file, so record where instead of asking later.
                ...(fileId ? { sourceUrl: nodeDeepLink(fileId, s.nodeId) } : {}),
              })),
              ...(brandId ? { brandGuidelineId: brandId } : {}),
            }),
          },
          // No abortPrevious: the server charges credits up-front and ingests, so a
          // cancelled upload still costs — it must never be collateral of a search.
          { timeoutMs: UPLOAD_TIMEOUT_MS }
        );
        if (!res) continue;
        // Uploads await moderation now — nothing is public or analysed on save.
        ingested += res.pending ?? res.ingested ?? 0;
        deduped += res.deduped || 0;
        setProgress({ done: Math.floor(i / UPLOAD_CHUNK) + 1, total: totalChunks });
      }

      // Deduped isn't a failure — the server recognised the bytes. Saying so is
      // the difference between "sent for review" and a claim that overreaches.
      showToast(
        deduped > 0
          ? t('plugin.tools.references.savedWithDupes', { count: ingested, deduped })
          : t('plugin.tools.references.saved', { count: ingested }),
        'success'
      );
      setPicked([]);
      loadLibrary();
    } catch (err: any) {
      // A timeout doesn't mean nothing happened — the upload may still be landing.
      showToast(
        err instanceof ApiTimeoutError
          ? t('plugin.tools.references.saveTimedOut')
          : err?.message || t('plugin.tools.references.saveFailed'),
        'error'
      );
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }, [picked, call, brandId, fileId, showToast, t, loadLibrary]);

  const remove = (nodeId: string) => setPicked((p) => p.filter((s) => s.nodeId !== nodeId));

  return (
    <div className="space-y-3 p-1">
      <div className="flex gap-2">
        <Button
          onClick={pullSelection}
          disabled={pulling || saving}
          variant="brand"
          size="sm"
          className="flex-1"
        >
          {pulling ? <GlitchLoader size={14} /> : <Upload size={14} />}
          {pulling
            ? t('plugin.tools.references.pulling')
            : t('plugin.tools.references.pullSelection')}
        </Button>
      </div>

      {picked.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-border/50 bg-muted/40 p-2">
            {picked.map((shot, i) => (
              <div
                key={shot.nodeId}
                className="group relative aspect-square overflow-hidden rounded bg-background/40"
                title={shot.name}
              >
                <img src={shot.data} alt="" className="size-full object-cover" />
                <span className="absolute bottom-0.5 left-0.5 rounded bg-background/70 px-1 font-mono text-[8px] text-foreground">
                  {i + 1}
                </span>
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => remove(shot.nodeId)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t('plugin.common.remove')}
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-brand-cyan/20 text-[11px] text-brand-cyan disabled:opacity-40"
          >
            {saving && <GlitchLoader size={12} />}
            {!saving
              ? t('plugin.tools.references.saveCount', { count: picked.length })
              : progress && progress.total > 1
                ? t('plugin.tools.references.savingProgress', {
                    done: progress.done + 1,
                    total: progress.total,
                  })
                : /* The server tags each image with AI, so this is tens of seconds by design.
                     A bare "Saving…" reads as stuck; naming the work makes the wait legible. */
                  t('plugin.tools.references.savingAnalyzing')}
          </button>
        </>
      )}

      {/* ── Library ─────────────────────────────────────────────────────── */}
      <div className="space-y-2 border-t border-border/50 pt-3">
        <div className="relative">
          <Search
            size={12}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('plugin.tools.references.searchPlaceholder')}
            className="h-8 w-full rounded-md border border-border/50 bg-background/40 pl-7 pr-2 text-[11px] outline-none focus:border-brand-cyan/40"
          />
        </div>

        {brandId && (
          <button
            onClick={() => setBrandOnly((v) => !v)}
            className={`h-6 rounded-full border px-2 text-[10px] transition-colors ${
              brandOnly
                ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan'
                : 'border-border/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('plugin.tools.references.brandOnly', {
              brand: (brandGuideline as any)?.brandName || '',
            })}
          </button>
        )}

        {loadingLibrary && library.length === 0 ? (
          <div className="flex justify-center py-4">
            <GlitchLoader size={14} />
          </div>
        ) : library.length === 0 ? (
          <p className="py-4 text-center text-[10px] text-muted-foreground">
            {t('plugin.tools.references.empty')}
          </p>
        ) : (
          <div className="grid max-h-[240px] grid-cols-3 gap-1.5 overflow-y-auto scrollbar-thin">
            {library.map((ref) => (
              <div
                key={ref.id}
                className="aspect-square overflow-hidden rounded border border-border/50 bg-background/40"
                title={ref.name}
              >
                <img
                  src={ref.thumbnailUrl || ref.referenceImageUrl}
                  alt=""
                  className="size-full object-cover opacity-70 transition-opacity hover:opacity-100"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const ReferencesIcon = Images;
