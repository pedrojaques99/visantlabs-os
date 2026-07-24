import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Masonry, useMasonryColumns } from '@/components/ui/Masonry';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { thumbHashToDataURL } from 'thumbhash';
import {
  Upload,
  Search,
  Image as ImageIcon,
  Globe,
  MapPin,
  X,
  Loader2,
  ExternalLink,
  Sparkles,
  Images,
  ScanSearch,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Bookmark,
  FolderPlus,
  Folder,
  Plus,
  Check,
  Trash2,
  ArrowLeft,
  Lock,
  Pencil,
  CheckSquare,
  Square,
  Save,
  ChevronDown,
  Shuffle,
} from '@/lib/ui/icons';
import { FlyingPaperLoader } from '@/components/ui/FlyingPaperLoader';
import { PageShell } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Modal } from '@/components/ui/Modal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { authService } from '@/services/authService';
import { REGIONS, DESIGN_COUNTRIES, REGION_LABELS, countryFlag } from '@/lib/references/taxonomy';
import { useActiveBrandSafe } from '@/contexts/ActiveBrandContext';
import { useRailSlot } from '@/components/shell/RailSlotContext';
import { brandRankingTerms } from '@/lib/references/brandTerms';
import {
  FACET_DIMENSION_KEYS,
  DIMENSION_LABELS,
  DIMENSION_GROUPS_BY_KIND,
} from '@/constants/referenceDimensions';
import {
  referencesApi,
  type ReferenceItem,
  type ReferenceFacets,
  type ReferenceUploadInput,
  collectionsApi,
  adminReferencesApi,
  type DuplicateReport,
  type PendingReference,
  type ReferenceCollection,
  type CollectionDetail,
  type TasteHint,
} from '@/services/referencesApi';

const PAGE_SIZE = 30;

// Per-session feed seed — persisted so the order is stable across pages/reloads
// within a browser session, but fresh on a new session (or when reshuffled).
const REF_SEED_KEY = 'vsn_ref_seed';
function getSessionSeed(): string {
  try {
    const existing = sessionStorage.getItem(REF_SEED_KEY);
    if (existing) return existing;
    const fresh = Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(REF_SEED_KEY, fresh);
    return fresh;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

const REGION_OPTIONS = [
  { value: '', label: 'Todas as regiões' },
  ...REGIONS.map((r) => ({ value: r.id, label: r.label })),
];
const COUNTRY_OPTIONS = [
  { value: '', label: 'Todos os países' },
  ...DESIGN_COUNTRIES.map((c) => ({ value: c, label: `${countryFlag(c)} ${c}`.trim() })),
];

// Dimension filter SSoT — keys/labels/groups shared with the backend.
// (kept as local aliases so the JSX below reads unchanged)
const DIMENSION_FILTER_KEYS = FACET_DIMENSION_KEYS;
const DIM_LABELS = DIMENSION_LABELS;
const DIM_GROUPS_BY_KIND = DIMENSION_GROUPS_BY_KIND;

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface SimilarView {
  label: string;
  items: ReferenceItem[];
  source?: ReferenceItem;
}

// Generic source labels that aren't real titles (studio field is often just a provenance tag).
const GENERIC_STUDIO = /^(visant|curated|visant\s*curated|reference|ref)$/i;

/** Human-facing title — never surface the raw slug id (ref_urbanstay_56, club_ref_69…). */
function refTitle(item: Pick<ReferenceItem, 'name' | 'studio' | 'provenance'>): string {
  const prov = item.provenance || {};
  const designer = prov.designer?.trim();
  const studio = item.studio?.trim();
  if (designer && !GENERIC_STUDIO.test(designer)) return designer;
  if (studio && !GENERIC_STUDIO.test(studio)) return studio;
  const raw = (item.name || '').trim();
  // Rewrite our internal ref-id slugs; leave real human names untouched.
  const m = raw.match(/^(?:userref[-_]|club[-_]?ref[-_]|ref[-_])(.+)$/i);
  if (m) {
    const cleaned = m[1]
      .replace(/[-_]\d+$/, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    // A meaningful name survived → title-case it; otherwise the slug is just an id (e.g. "69").
    if (cleaned && !/^\d+$/.test(cleaned)) return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
    return studio || designer || 'Referência';
  }
  return raw || 'Referência';
}

/** Dimension values two references share — powers the "why it matches" explanation. */
function sharedDimensions(a?: ReferenceItem, b?: ReferenceItem): string[] {
  if (!a || !b) return [];
  const da = a.dimensions || {};
  const db = b.dimensions || {};
  const out: string[] = [];
  for (const key of Object.keys(da)) {
    const set = new Set(da[key] || []);
    for (const v of db[key] || []) if (set.has(v)) out.push(v);
  }
  return [...new Set(out)].slice(0, 6);
}

/** Decode a base64 thumbhash into a tiny data-URL placeholder (memoized). */
function useThumbPlaceholder(hash?: string): string | null {
  return useMemo(() => {
    if (!hash) return null;
    try {
      const bin = atob(hash);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return thumbHashToDataURL(bytes);
    } catch {
      return null;
    }
  }, [hash]);
}

// Masonry column count now comes from the shared `useMasonryColumns` (src/components/ui/Masonry).

export const ReferencesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Read initial filter state from the URL once (shareable / back-button friendly).
  const initialDims: Record<string, string> = {};
  for (const k of DIMENSION_FILTER_KEYS) {
    const v = searchParams.get(k);
    if (v) initialDims[k] = v;
  }

  // Active brand feeds the feed RANKING (not a hard filter): the BrandSwitcher in
  // the shell is the control. "Todas as marcas" (activeBrandId null) → neutral feed.
  const activeBrand = useActiveBrandSafe();
  const activeBrandId = activeBrand?.activeBrandId ?? null;
  const brandTerms = useMemo(
    () => brandRankingTerms(activeBrand?.activeBrand),
    [activeBrand?.activeBrand]
  );
  // Rail slot — the tag facets live in the drill-in rail, below the categories.
  const railSlot = useRailSlot()?.railSlot ?? null;

  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const [scope, setScope] = useState<'library' | 'collections' | 'mine'>(
    (searchParams.get('scope') as 'library' | 'collections' | 'mine') || 'library'
  );
  const [reloadNonce, setReloadNonce] = useState(0);
  // Session seed — makes the feed order fresh per visit (deterministic WITHIN a
  // session so infinite-scroll pagination stays consistent). Reshuffle = new seed.
  const [seed, setSeed] = useState<string>(getSessionSeed);
  const reshuffle = useCallback(() => {
    const next = Math.random().toString(36).slice(2, 10);
    try {
      sessionStorage.setItem(REF_SEED_KEY, next);
    } catch {
      /* private mode — seed stays in memory only */
    }
    setSeed(next);
  }, []);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  // Semantic (meaning) vs exact (substring) text search. Default on — it's the
  // point; a text embedding per debounced query is cheap.
  const [semanticSearch, setSemanticSearch] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('q') || '');
  const [country, setCountry] = useState(searchParams.get('country') || '');
  const [region, setRegion] = useState(searchParams.get('region') || '');
  const [activeTag, setActiveTag] = useState(searchParams.get('tag') || '');
  const [kind, setKind] = useState<'all' | 'branding' | 'mockup'>(
    (searchParams.get('kind') as 'all' | 'branding' | 'mockup') || 'all'
  );
  const [dims, setDims] = useState<Record<string, string>>(initialDims);
  const [collections, setCollections] = useState<ReferenceCollection[]>([]);
  const [collectionView, setCollectionView] = useState<CollectionDetail | null>(null);
  const [saveTarget, setSaveTarget] = useState<ReferenceItem[] | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [taste, setTaste] = useState<TasteHint[]>([]);

  // Admin curation gate — verified server-side; this only toggles the UI affordances.
  const [isAdmin, setIsAdmin] = useState(false);
  const [dupeMap, setDupeMap] = useState<Map<string, { count: number; isKeeper: boolean }>>(
    new Map()
  );
  const [dupeReport, setDupeReport] = useState<DuplicateReport | null>(null);
  const [deduping, setDeduping] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [moderationOpen, setModerationOpen] = useState(false);
  // Batch multi-select (Set of ref ids) + shift-range anchor.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectAnchor = useRef<number | null>(null);
  // Right-click context menu, anchored at the cursor.
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; item: ReferenceItem } | null>(
    null
  );
  const [editTarget, setEditTarget] = useState<ReferenceItem | null>(null);
  // Progressive disclosure — the facet wall stays folded until asked for.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Items pending an undo-able delete are hidden from the grid but not yet gone.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const [facets, setFacets] = useState<ReferenceFacets | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);

  const [similar, setSimilar] = useState<SimilarView | null>(null);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const searchByImageInput = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);

  const cols = useMasonryColumns();
  const activeDimEntries = Object.entries(dims).filter(([, v]) => v);
  const hasActiveFilters = !!(
    debouncedSearch ||
    country ||
    region ||
    activeTag ||
    kind !== 'all' ||
    activeDimEntries.length
  );

  const setDim = (key: string, value: string) =>
    setDims((prev) => {
      const next = { ...prev };
      if (!value || next[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });

  const clearAllFilters = () => {
    setSearch('');
    setCountry('');
    setRegion('');
    setActiveTag('');
    setKind('all');
    setDims({});
  };
  const baseGrid = collectionView ? collectionView.items : similar ? similar.items : items;
  const grid = useMemo(
    () => (hiddenIds.size ? baseGrid.filter((r) => !hiddenIds.has(r.id)) : baseGrid),
    [baseGrid, hiddenIds]
  );

  // ── Data loading ───────────────────────────────────────────────
  const loadList = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setIsLoadingMore(true);
      else {
        setIsLoading(true);
        setError(false);
      }
      try {
        const data =
          scope === 'mine'
            ? await referencesApi.mine({ page: targetPage, limit: PAGE_SIZE })
            : await referencesApi.list({
                page: targetPage,
                limit: PAGE_SIZE,
                search: debouncedSearch || undefined,
                country: country || undefined,
                region: region || undefined,
                tag: activeTag || undefined,
                kind,
                dimensions: dims,
                seed,
                brandId: activeBrandId || undefined,
                brandTerms: brandTerms || undefined,
                semantic: semanticSearch,
              });
        setItems((prev) => {
          if (!append) return data.references;
          const ids = new Set(prev.map((r) => r.id));
          return [...prev, ...data.references.filter((r) => !ids.has(r.id))];
        });
        setTotal(data.total);
        setPages(data.pages);
        setPage(data.page);
        pageRef.current = data.page;
      } catch {
        if (!append) setError(true);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [
      scope,
      debouncedSearch,
      country,
      region,
      activeTag,
      kind,
      dims,
      seed,
      activeBrandId,
      brandTerms,
      semanticSearch,
    ]
  );

  // facets once
  useEffect(() => {
    referencesApi
      .facets()
      .then(setFacets)
      .catch(() => {});
  }, []);

  // taste hints from the user's saved items (semantic suggestion)
  useEffect(() => {
    if (!authService.isAuthenticated()) return;
    collectionsApi
      .taste()
      .then((d) => setTaste(d.taste))
      .catch(() => {});
  }, []);

  // resolve admin flag (verifyToken is cached/throttled, so this is cheap)
  useEffect(() => {
    if (!authService.isAuthenticated()) return;
    authService
      .verifyToken()
      .then((u) => setIsAdmin(!!u?.isAdmin))
      .catch(() => {});
  }, []);

  // Duplicate map — admin only. The library predates ingest dedup, so identical
  // bytes exist more than once; this marks them in place so the grouping can be
  // eyeballed against the real images before anything is deleted.
  useEffect(() => {
    if (!isAdmin) return;
    adminReferencesApi
      .duplicates()
      .then((report) => {
        const map = new Map<string, { count: number; isKeeper: boolean }>();
        for (const g of report.groups) {
          map.set(g.keep.id, { count: g.count, isKeeper: true });
          for (const d of g.duplicates) map.set(d.id, { count: g.count, isKeeper: false });
        }
        setDupeMap(map);
        setDupeReport(report);
      })
      .catch(() => {});
    // Moderation queue count — how many user uploads await review.
    adminReferencesApi
      .pending(1, 0)
      .then((r) => setPendingCount(r.total))
      .catch(() => {});
  }, [isAdmin]);

  // debounce the search box (instant search)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => clearTimeout(t);
  }, [search]);

  // re-query on any filter/scope change (unless in similarity mode)
  useEffect(() => {
    if (similar || collectionView || scope === 'collections') return;
    loadList(1, false);
  }, [
    scope,
    debouncedSearch,
    country,
    region,
    activeTag,
    kind,
    dims,
    similar,
    collectionView,
    reloadNonce,
    seed,
    activeBrandId,
    brandTerms,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── URL → estado (rail drill-in) ──────────────────────────────────────────
  // O rail-mãe navega pra /references?scope=…&kind=… (tabs da seção). Como a
  // página não remonta, sincroniza esses dois eixos de VOLTA pro estado. Guardado
  // (só atualiza se difere) pra não brigar com o efeito estado→URL abaixo.
  useEffect(() => {
    const urlScope = (searchParams.get('scope') as 'library' | 'collections' | 'mine') || 'library';
    const urlKind = (searchParams.get('kind') as 'all' | 'branding' | 'mockup') || 'all';
    setScope((s) => (s === urlScope ? s : urlScope));
    setKind((k) => (k === urlKind ? k : urlKind));
  }, [searchParams]);

  // ── URL sync — serialize filter state into the querystring (shareable views) ──
  useEffect(() => {
    const p = new URLSearchParams();
    if (debouncedSearch) p.set('q', debouncedSearch);
    if (country) p.set('country', country);
    if (region) p.set('region', region);
    if (activeTag) p.set('tag', activeTag);
    if (kind !== 'all') p.set('kind', kind);
    if (scope !== 'library') p.set('scope', scope);
    for (const k of DIMENSION_FILTER_KEYS) if (dims[k]) p.set(k, dims[k]);
    setSearchParams(p, { replace: true });
  }, [debouncedSearch, country, region, activeTag, kind, scope, dims]); // eslint-disable-line react-hooks/exhaustive-deps

  // infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || similar || collectionView || scope === 'collections') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && !isLoadingMore && pageRef.current < pages) {
          loadList(pageRef.current + 1, true);
        }
      },
      { rootMargin: '900px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [pages, isLoading, isLoadingMore, similar, collectionView, scope, loadList]);

  // ── Auth gate ──────────────────────────────────────────────────
  const requireAuth = (): boolean => {
    if (!authService.isAuthenticated()) {
      toast.error('Faça login para enviar e buscar imagens');
      return false;
    }
    return true;
  };

  // ── Exploration loop ───────────────────────────────────────────
  const runSearchByImage = useCallback(async (file: File | Blob) => {
    if (!requireAuth()) return;
    setLightboxIndex(null);
    setCollectionView(null);
    setSimilarLoading(true);
    setSimilar({ label: 'busca por imagem', items: [] });
    try {
      const base64 = await fileToBase64(file);
      const data = await referencesApi.searchByImage(base64, { limit: 40 });
      setSimilar({ label: 'busca por imagem', items: data.references });
      if (data.references.length === 0) toast.info('Nenhuma referência parecida encontrada');
    } catch (e: any) {
      toast.error(e.message || 'Erro na busca por imagem');
      setSimilar(null);
    } finally {
      setSimilarLoading(false);
    }
  }, []);

  const runSimilarTo = useCallback(async (ref: ReferenceItem) => {
    setLightboxIndex(null);
    setCollectionView(null);
    setSimilarLoading(true);
    setSimilar({ label: `parecidas com "${ref.name}"`, items: [], source: ref });
    try {
      const data = await referencesApi.similarTo(ref.id, 40);
      setSimilar({ label: `parecidas com "${ref.name}"`, items: data.references, source: ref });
      if (data.references.length === 0)
        toast.info('Sem parecidas ainda — popule mais a biblioteca');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao buscar parecidas');
      setSimilar(null);
    } finally {
      setSimilarLoading(false);
    }
  }, []);

  const clearSimilar = () => setSimilar(null);

  // ── Collections ────────────────────────────────────────────────
  const loadCollections = useCallback(async () => {
    if (!authService.isAuthenticated()) return;
    try {
      const data = await collectionsApi.list();
      setCollections(data.collections);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    if (scope === 'collections') {
      setCollectionView(null);
      loadCollections();
    }
  }, [scope, loadCollections]);

  const openBoard = useCallback(async (id: string) => {
    setSimilar(null);
    setLightboxIndex(null);
    try {
      const detail = await collectionsApi.get(id);
      setCollectionView(detail);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao abrir coleção');
    }
  }, []);

  const refreshBoard = useCallback(async () => {
    if (!collectionView) return;
    try {
      setCollectionView(await collectionsApi.get(collectionView.collection.id));
    } catch {
      /* non-fatal */
    }
  }, [collectionView]);

  // ── Tag → pre-filtered route (anyone) ──────────────────────────
  // Click a tag anywhere → drop into the library filtered by it (URL-synced, shareable).
  const handleTagClick = useCallback((tag: string) => {
    setSimilar(null);
    setCollectionView(null);
    setLightboxIndex(null);
    setScope('library');
    setActiveTag(tag);
  }, []);

  // ── Batch multi-select ─────────────────────────────────────────
  const clearSelection = useCallback(() => {
    setSelected(new Set());
    selectAnchor.current = null;
  }, []);

  // Toggle one card; Shift extends a contiguous range from the last anchor.
  const toggleSelect = useCallback(
    (index: number, shiftKey: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (shiftKey && selectAnchor.current !== null) {
          const [lo, hi] = [selectAnchor.current, index].sort((a, b) => a - b);
          for (let i = lo; i <= hi; i++) {
            const id = grid[i]?.id;
            if (id) next.add(id);
          }
        } else {
          const id = grid[index]?.id;
          if (!id) return prev;
          if (next.has(id)) next.delete(id);
          else next.add(id);
          selectAnchor.current = index;
        }
        return next;
      });
    },
    [grid]
  );

  // Clear selection whenever the underlying result set changes.
  useEffect(() => {
    clearSelection();
  }, [
    scope,
    debouncedSearch,
    country,
    region,
    activeTag,
    kind,
    dims,
    similar,
    collectionView,
    clearSelection,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Admin delete (single or batch) — optimistic, with a 5s Undo window ─────────
  const unhide = useCallback((ids: string[]) => {
    setHiddenIds((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => n.delete(id));
      return n;
    });
  }, []);

  const handleAdminDelete = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const plural = ids.length > 1;
      // Hide immediately (feels instant); defer the real delete so Undo can cancel it.
      setHiddenIds((prev) => new Set([...prev, ...ids]));
      setLightboxIndex(null);
      clearSelection();

      const commit = setTimeout(async () => {
        try {
          await Promise.all(ids.map((id) => adminReferencesApi.remove(id)));
          const gone = new Set(ids);
          setItems((prev) => prev.filter((r) => !gone.has(r.id)));
          setSimilar((s) => (s ? { ...s, items: s.items.filter((r) => !gone.has(r.id)) } : s));
          setCollectionView((cv) =>
            cv ? { ...cv, items: cv.items.filter((r) => !gone.has(r.id)) } : cv
          );
          unhide(ids); // now truly removed from the source arrays too
        } catch (e: any) {
          unhide(ids); // restore on failure
          toast.error(e.message || 'Erro ao excluir');
        }
      }, 5000);

      toast(plural ? `${ids.length} referências excluídas` : 'Referência excluída', {
        duration: 5000,
        action: {
          label: 'Desfazer',
          onClick: () => {
            clearTimeout(commit);
            unhide(ids);
          },
        },
      });
    },
    [clearSelection, unhide]
  );

  // Auto-delete redundant copies (keeps the oldest of each group). Confirms
  // first — it's one-way and the server recomputes which ids die, so a stale
  // page can't take a keeper down with it.
  const handleDedupe = useCallback(async () => {
    if (!dupeReport) return;
    const ok = window.confirm(
      `Remover ${dupeReport.redundant} cópia(s) redundante(s)? A mais antiga de cada grupo é mantida. Ação irreversível.`
    );
    if (!ok) return;
    setDeduping(true);
    try {
      const res = await adminReferencesApi.dedupe(false);
      // Drop the deleted ids from the grid without a full refetch.
      const doomed = new Set(dupeReport.groups.flatMap((g) => g.duplicates.map((d) => d.id)));
      setItems((prev) => prev.filter((r) => !doomed.has(r.id)));
      setDupeMap(new Map());
      setDupeReport(null);
      toast.success(`${res.deleted ?? 0} referência(s) duplicada(s) removida(s)`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao remover duplicatas');
    } finally {
      setDeduping(false);
    }
  }, [dupeReport]);

  // ── Drag & paste to search ─────────────────────────────────────
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items || []).find((i) =>
        i.type.startsWith('image/')
      );
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        runSearchByImage(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [runSearchByImage]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
    if (file) runSearchByImage(file);
  };

  // ── Lightbox keyboard nav ──────────────────────────────────────
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      else if (e.key === 'ArrowRight')
        setLightboxIndex((i) => (i === null ? i : Math.min(grid.length - 1, i + 1)));
      else if (e.key === 'ArrowLeft')
        setLightboxIndex((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, grid.length]);

  // ── Grid keyboard navigation (vim + arrows) ────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      // "/" focuses the search box from anywhere
      if (e.key === '/' && !typing) {
        e.preventDefault();
        document.getElementById('ref-search')?.focus();
        return;
      }
      if (typing || lightboxIndex !== null || saveTarget) return;
      if (scope === 'collections' && !collectionView) return;
      const n = grid.length;
      if (!n) return;
      const move = (delta: number) => {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(0, Math.min(n - 1, (i < 0 ? 0 : i) + delta)));
      };
      if (e.key === 'ArrowRight' || e.key === 'l') move(1);
      else if (e.key === 'ArrowLeft' || e.key === 'h') move(-1);
      else if (e.key === 'ArrowDown' || e.key === 'j') move(cols);
      else if (e.key === 'ArrowUp' || e.key === 'k') move(-cols);
      else if (e.key === 'Enter' && focusedIndex >= 0) setLightboxIndex(focusedIndex);
      else if (e.key.toLowerCase() === 's' && focusedIndex >= 0) {
        if (requireAuth()) setSaveTarget([grid[focusedIndex]]);
      } else if (e.key === 'Escape') {
        if (selected.size) clearSelection();
        else setFocusedIndex(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    grid,
    cols,
    focusedIndex,
    lightboxIndex,
    saveTarget,
    scope,
    collectionView,
    selected,
    clearSelection,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset grid focus whenever the result set changes.
  useEffect(() => {
    setFocusedIndex(-1);
  }, [scope, debouncedSearch, country, region, activeTag, kind, dims, similar, collectionView]);

  // Restore grid focus to the card you were viewing when the lightbox closes.
  const prevLightbox = useRef<number | null>(null);
  useEffect(() => {
    if (prevLightbox.current !== null && lightboxIndex === null) {
      setFocusedIndex(prevLightbox.current);
    }
    prevLightbox.current = lightboxIndex;
  }, [lightboxIndex]);

  const filterControls = (
    <FilterControls
      search={search}
      setSearch={setSearch}
      country={country}
      setCountry={(v) => {
        setCountry(v);
        if (v) setRegion('');
      }}
      region={region}
      setRegion={(v) => {
        setRegion(v);
        if (v) setCountry('');
      }}
      semantic={semanticSearch}
      setSemantic={setSemanticSearch}
    />
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <PageShell
        pageId="references"
        seoTitle="Reference Library — Visant Labs"
        seoDescription="Biblioteca curada de referências de design do mundo inteiro, filtrável por tag e por país de origem."
        microTitle="Library // References"
        title="Reference Library"
        description="Referências de design world-class, taggeadas por conteúdo e por país de origem. Suba, arraste ou cole uma imagem para achar parecidas — ou mergulhe de uma ref pra outra."
        width="7xl"
        actions={
          <div className="flex items-center gap-2">
            <input
              ref={searchByImageInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) runSearchByImage(f);
                e.currentTarget.value = '';
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="bg-card border-border text-xs"
              onClick={() => requireAuth() && searchByImageInput.current?.click()}
            >
              <ScanSearch className="h-3.5 w-3.5 mr-1.5" />
              Buscar por imagem
            </Button>
            <Button
              size="sm"
              className="bg-brand-cyan text-black hover:bg-brand-cyan/80 text-xs"
              onClick={() => requireAuth() && setUploadOpen(true)}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Subir referência
            </Button>
          </div>
        }
      >
        {/* Similarity banner */}
        <AnimatePresence>
          {similar && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-border bg-muted px-4 py-2.5"
            >
              <span className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                <ScanSearch className="h-3.5 w-3.5 shrink-0" />
                {similarLoading
                  ? 'Buscando parecidas...'
                  : `${similar.items.length} · ${similar.label}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground shrink-0"
                onClick={clearSimilar}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Voltar à biblioteca
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collection (board) banner */}
        {collectionView && (
          <div className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-border bg-muted px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs text-muted-foreground truncate">
              <Folder className="h-3.5 w-3.5 shrink-0" />
              {collectionView.collection.name} · {collectionView.items.length}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {collectionView.collection.isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  aria-label="Apagar coleção"
                  onClick={() => {
                    const board = collectionView.collection;
                    setCollectionView(null);
                    setScope('collections');
                    const commit = setTimeout(async () => {
                      try {
                        await collectionsApi.remove(board.id);
                        loadCollections();
                      } catch (e: any) {
                        toast.error(e.message || 'Erro ao apagar');
                      }
                    }, 5000);
                    toast('Coleção apagada', {
                      duration: 5000,
                      action: {
                        label: 'Desfazer',
                        onClick: () => {
                          clearTimeout(commit);
                          openBoard(board.id);
                        },
                      },
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setCollectionView(null)}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Coleções
              </Button>
            </div>
          </div>
        )}

        {/* Workbench — busca + país/região + filtros + embaralhar numa barra só.
            Scope (Biblioteca/Coleções/Minhas refs) e kind (Logos/Mockups) são
            NAVEGAÇÃO: vivem na rail drill-in (navConfig REFERENCES_NAV), não aqui. */}
        {!similar && !collectionView && (
          <div className="space-y-3 mb-6">
            {scope === 'library' && (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">{filterControls}</div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Embaralhar feed"
                  title="Embaralhar"
                  className="h-9 shrink-0 border-border bg-card text-muted-foreground hover:text-foreground text-xs"
                  onClick={reshuffle}
                >
                  <Shuffle className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-expanded={filtersOpen}
                  className={cn(
                    'hidden md:inline-flex h-9 shrink-0 border-border text-xs transition-colors',
                    filtersOpen ? 'bg-muted text-foreground' : 'bg-card text-muted-foreground'
                  )}
                  onClick={() => setFiltersOpen((o) => !o)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                  Filtros
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 ml-1.5 transition-transform',
                      filtersOpen && 'rotate-180'
                    )}
                  />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Filtros"
                  className="md:hidden h-9 shrink-0 border-border bg-card text-muted-foreground text-xs"
                  onClick={() => setFilterSheet(true)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Semantic suggestion — based on what the user has saved */}
            {scope === 'library' && !hasActiveFilters && taste.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Pra você</span>
                {taste.map((t) => (
                  <Badge
                    key={t.key + t.value}
                    variant="outline"
                    className="cursor-pointer border-border bg-muted text-muted-foreground hover:bg-muted hover:text-foreground text-xs"
                    onClick={() => setDim(t.key, t.value)}
                  >
                    {t.value}
                  </Badge>
                ))}
              </div>
            )}

            {/* Active filters summary + result count */}
            {scope === 'library' && hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-muted-foreground">
                  {total.toLocaleString('pt-BR')} {total === 1 ? 'ref' : 'refs'}
                </span>
                {kind !== 'all' && (
                  <FilterChip
                    label={kind === 'branding' ? 'Logos' : 'Mockups'}
                    onRemove={() => setKind('all')}
                  />
                )}
                {country && <FilterChip label={country} onRemove={() => setCountry('')} />}
                {region && (
                  <FilterChip
                    label={REGION_LABELS[region] || region}
                    onRemove={() => setRegion('')}
                  />
                )}
                {debouncedSearch && (
                  <FilterChip label={`"${debouncedSearch}"`} onRemove={() => setSearch('')} />
                )}
                {activeTag && <FilterChip label={activeTag} onRemove={() => setActiveTag('')} />}
                {activeDimEntries.map(([k, v]) => (
                  <FilterChip key={k} label={v} onRemove={() => setDim(k, '')} />
                ))}
                <button
                  onClick={clearAllFilters}
                  className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpar tudo
                </button>
              </div>
            )}

            {/* Structured dimension facets — folded until "Filtros" is opened */}
            {scope === 'library' && filtersOpen && facets?.dimensions && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="hidden md:flex flex-col gap-1.5"
              >
                {DIM_GROUPS_BY_KIND[kind].map((dk) => {
                  const vals = facets.dimensions?.[dk];
                  if (!vals || !vals.length) return null;
                  return (
                    <div key={dk} className="flex flex-wrap items-center gap-1.5">
                      <span className="w-[88px] shrink-0 text-xs text-muted-foreground">
                        {DIM_LABELS[dk]}
                      </span>
                      {vals.slice(0, 10).map((v) => {
                        const active = dims[dk] === v.value;
                        return (
                          <Badge
                            key={v.value}
                            variant={active ? 'secondary' : 'outline'}
                            className={cn(
                              'cursor-pointer text-xs',
                              active
                                ? 'bg-muted text-foreground border-border'
                                : 'border-border text-muted-foreground hover:border-ring hover:text-foreground'
                            )}
                            onClick={() => setDim(dk, v.value)}
                          >
                            {v.value}
                            {active ? (
                              <X className="h-2.5 w-2.5 ml-1" />
                            ) : (
                              <span className="ml-1 text-muted-foreground tabular-nums">
                                {v.count}
                              </span>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  );
                })}
              </motion.div>
            )}
            {/* Os tag facets migraram pra rail (portal abaixo das categorias) — ver railTags. */}
          </div>
        )}

        {/* Admin-only: user uploads awaiting moderation. Nothing here is public
            or AI-analysed yet — approving runs enrichment, then reveals it. */}
        {isAdmin && pendingCount > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-cyan/30 bg-brand-cyan/5 px-3 py-2">
            <span className="text-xs font-mono text-brand-cyan">
              {pendingCount} referência(s) aguardando revisão
            </span>
            <Button
              size="sm"
              className="ml-auto h-7 bg-brand-cyan text-black hover:bg-brand-cyan/80 text-xs"
              onClick={() => setModerationOpen(true)}
            >
              Revisar
            </Button>
          </div>
        )}

        {/* Admin-only duplicate calibration bar. Shows what the content-hash
            grouping found; the badges on the cards show WHERE. Delete is
            explicit and one-way, so it confirms first. */}
        {isAdmin && dupeReport && dupeReport.redundant > 0 && (
          <DuplicateAdminBar report={dupeReport} onDedupe={handleDedupe} deduping={deduping} />
        )}

        {/* Content */}
        {scope === 'collections' && !collectionView ? (
          <CollectionsGrid
            collections={collections}
            onOpen={openBoard}
            onCreate={async (name) => {
              try {
                const { collection } = await collectionsApi.create(name);
                setCollections((prev) => [collection, ...prev]);
                toast.success('Coleção criada');
              } catch (e: any) {
                toast.error(e.message || 'Erro ao criar coleção');
              }
            }}
          />
        ) : error ? (
          <ErrorState onRetry={() => loadList(1, false)} />
        ) : (isLoading || similarLoading) && grid.length === 0 ? (
          <MasonrySkeleton cols={cols} />
        ) : grid.length === 0 ? (
          hasActiveFilters ? (
            <NoResults onClear={clearAllFilters} />
          ) : (
            <FirstRun onUpload={() => requireAuth() && setUploadOpen(true)} />
          )
        ) : (
          <Masonry
            items={grid}
            cols={cols}
            gap={12}
            getKey={(item) => item.id}
            renderItem={(item, idx) => (
              <MasonryCard
                item={item}
                dupe={dupeMap.get(item.id)}
                focused={idx === focusedIndex}
                selected={selected.has(item.id)}
                selectionActive={selected.size > 0}
                onToggleSelect={(shiftKey) => toggleSelect(idx, shiftKey)}
                onOpen={() => setLightboxIndex(idx)}
                onSimilar={() => runSimilarTo(item)}
                onSave={() => requireAuth() && setSaveTarget([item])}
                onContextMenu={(x, y) => setCtxMenu({ x, y, item })}
                onRemove={
                  collectionView?.collection.isOwner
                    ? async () => {
                        try {
                          await collectionsApi.removeItem(collectionView.collection.id, item.id);
                          refreshBoard();
                        } catch (e: any) {
                          toast.error(e.message || 'Erro ao remover');
                        }
                      }
                    : undefined
                }
              />
            )}
          />
        )}

        {/* Infinite-scroll sentinel */}
        {!similar && !collectionView && scope !== 'collections' && (
          <div ref={sentinelRef} className="h-1" />
        )}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Carregando mais...</span>
          </div>
        )}
        {!similar &&
          !collectionView &&
          scope !== 'collections' &&
          grid.length > 0 &&
          page >= pages && (
            <p className="text-center text-[10px] text-muted-foreground py-6">
              {grid.length} de {total} referências
            </p>
          )}

        {/* Upload dialog */}
        {uploadOpen && (
          <UploadDialog
            onClose={() => setUploadOpen(false)}
            onDone={(madePublic) => {
              setUploadOpen(false);
              referencesApi
                .facets()
                .then(setFacets)
                .catch(() => {});
              setSimilar(null);
              setScope(madePublic ? 'library' : 'mine');
              setReloadNonce((n) => n + 1);
            }}
          />
        )}

        {/* Mobile filter sheet */}
        {filterSheet && (
          <Dialog open onOpenChange={() => setFilterSheet(false)}>
            <DialogContent className="max-w-sm bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-sm font-mono text-muted-foreground">
                  Filtros
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-1">{filterControls}</div>
            </DialogContent>
          </Dialog>
        )}
      </PageShell>

      {/* Drag overlay */}
      <AnimatePresence>
        {dragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm pointer-events-none"
          >
            <div className="flex flex-col items-center gap-3 text-neutral-200 border-2 border-dashed border-white/20 rounded-2xl px-12 py-10">
              <ImageIcon className="h-8 w-8" />
              <p className="text-sm font-medium">Solte a imagem para achar parecidas</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <Lightbox
        items={grid}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNav={(d) =>
          setLightboxIndex((i) => (i === null ? i : Math.max(0, Math.min(grid.length - 1, i + d))))
        }
        onSimilar={(ref) => runSimilarTo(ref)}
        onSave={(ref) => requireAuth() && setSaveTarget([ref])}
        onTag={handleTagClick}
        isAdmin={isAdmin}
        onEdit={(ref) => setEditTarget(ref)}
        onDelete={(ref) => handleAdminDelete([ref.id])}
        similarSource={similar?.source}
      />

      {/* Admin moderation queue (pending user uploads) */}
      {moderationOpen && (
        <ModerationQueue
          onClose={() => setModerationOpen(false)}
          onResolved={() => setPendingCount((c) => Math.max(0, c - 1))}
        />
      )}

      {/* Right-click context menu (reuses dropdown-menu, anchored at cursor) */}
      {ctxMenu && (
        <CardContextMenu
          menu={ctxMenu}
          isAdmin={isAdmin}
          onClose={() => setCtxMenu(null)}
          onSave={(ref) => requireAuth() && setSaveTarget([ref])}
          onSimilar={(ref) => runSimilarTo(ref)}
          onEdit={(ref) => setEditTarget(ref)}
          onDelete={(ref) => handleAdminDelete([ref.id])}
        />
      )}

      {/* Batch action bar (floating) */}
      <AnimatePresence>
        {selected.size > 0 && (
          <BatchActionBar
            count={selected.size}
            total={grid.length}
            isAdmin={isAdmin}
            onSave={() => {
              if (!requireAuth()) return;
              const chosen = grid.filter((r) => selected.has(r.id));
              if (chosen.length) setSaveTarget(chosen);
            }}
            onSelectAll={() => {
              setSelected(new Set(grid.map((r) => r.id)));
              selectAnchor.current = grid.length - 1;
            }}
            onDelete={() => handleAdminDelete([...selected])}
            onClear={clearSelection}
          />
        )}
      </AnimatePresence>

      {/* Save-to-collection dialog (single or batch) */}
      {saveTarget && (
        <SaveToCollectionDialog
          items={saveTarget}
          onClose={() => {
            setSaveTarget(null);
            clearSelection();
          }}
        />
      )}

      {/* Admin edit dialog */}
      {editTarget && (
        <EditReferenceDialog
          item={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(patch) => {
            const apply = (r: ReferenceItem): ReferenceItem =>
              r.id === editTarget.id ? { ...r, ...patch } : r;
            setItems((prev) => prev.map(apply));
            setSimilar((s) => (s ? { ...s, items: s.items.map(apply) } : s));
            setCollectionView((cv) => (cv ? { ...cv, items: cv.items.map(apply) } : cv));
            setEditTarget(null);
          }}
        />
      )}

      {/* Tag facets — portaled INTO the drill-in rail, below the categories. Tags
          read like sub-categories, so they belong in the nav rail (not the body).
          Clicking one filters the feed via activeTag. */}
      {railSlot &&
        scope === 'library' &&
        !similar &&
        !collectionView &&
        !!facets?.tags?.length &&
        createPortal(
          <div className="px-2 pb-3">
            <p className="px-1 pb-1.5 text-[11px] text-sidebar-foreground/50">Tags</p>
            <div className="flex flex-wrap gap-1">
              {activeTag && (
                <button
                  onClick={() => setActiveTag('')}
                  className="inline-flex items-center gap-1 rounded-md bg-sidebar-accent text-sidebar-accent-foreground px-1.5 py-0.5 text-[11px]"
                >
                  {activeTag}
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
              {facets.tags
                .filter((t) => t.value !== activeTag)
                .slice(0, 24)
                .map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setActiveTag(t.value)}
                    className="rounded-md px-1.5 py-0.5 text-[11px] text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                  >
                    {t.value}
                  </button>
                ))}
            </div>
          </div>,
          railSlot
        )}
    </div>
  );
};

// ─── Filter controls (shared desktop/mobile) ─────────────────────

// ─── Collections (Are.na-like boards) ────────────────────────────

const CollectionsGrid: React.FC<{
  collections: ReferenceCollection[];
  onOpen: (id: string) => void;
  onCreate: (name: string) => void;
}> = ({ collections, onOpen, onCreate }) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onCreate(n);
    setName('');
    setCreating(false);
  };

  if (!authService.isAuthenticated()) {
    return (
      <div className="text-center py-20 text-sm text-muted-foreground">
        Faça login para criar e ver suas coleções.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {creating ? (
        <div className="aspect-[4/3] rounded-xl border border-border bg-card p-3 flex flex-col justify-center gap-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setCreating(false);
            }}
            placeholder="Nome da coleção"
            className="bg-input border-border text-sm h-9"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="bg-brand-cyan text-black hover:bg-brand-cyan/80 text-xs flex-1"
              onClick={submit}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Criar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={() => setCreating(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="aspect-[4/3] rounded-xl border border-dashed border-border hover:border-ring text-muted-foreground hover:text-foreground transition-colors flex flex-col items-center justify-center gap-2"
        >
          <FolderPlus className="h-6 w-6" />
          <span className="text-xs">Nova coleção</span>
        </button>
      )}

      {collections.map((c) => (
        <button
          key={c.id}
          onClick={() => onOpen(c.id)}
          className="group text-left rounded-xl overflow-hidden bg-card ring-1 ring-border hover:ring-ring transition-all hover:-translate-y-0.5"
        >
          <div className="aspect-[4/3] relative bg-muted">
            {c.covers && c.covers.length > 1 ? (
              <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-px">
                {c.covers.slice(0, 4).map((u, i) => (
                  <img
                    key={i}
                    src={u}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ))}
              </div>
            ) : c.coverUrl || c.covers?.[0] ? (
              <img
                src={c.coverUrl || c.covers?.[0]}
                alt={c.name}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-muted-foreground">
                <Folder className="h-8 w-8" />
              </div>
            )}
          </div>
          <div className="p-2.5">
            <p className="text-xs font-medium text-foreground truncate flex items-center gap-1">
              {!c.isPublic && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
              {c.name}
            </p>
            <p className="text-[10px] font-mono text-muted-foreground">
              {c.count} {c.count === 1 ? 'item' : 'itens'}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
};

const SaveToCollectionDialog: React.FC<{ items: ReferenceItem[]; onClose: () => void }> = ({
  items,
  onClose,
}) => {
  const [cols, setCols] = useState<ReferenceCollection[] | null>(null);
  const [creating, setCreating] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const count = items.length;

  useEffect(() => {
    collectionsApi
      .list()
      .then((d) => setCols(d.collections))
      .catch(() => setCols([]));
  }, []);

  const addTo = async (id: string) => {
    if (savedIds.has(id)) return;
    // Optimistic — reflect instantly, roll back only on failure.
    setSavedIds((s) => new Set(s).add(id));
    setCols((p) => p?.map((c) => (c.id === id ? { ...c, count: c.count + count } : c)) ?? p);
    try {
      // addItem is idempotent server-side ($addToSet); run sequentially to keep it simple.
      for (const it of items) await collectionsApi.addItem(id, it.id);
      if (count > 1) toast.success(`${count} referências salvas`);
    } catch (e: any) {
      setSavedIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      setCols(
        (p) => p?.map((c) => (c.id === id ? { ...c, count: Math.max(0, c.count - count) } : c)) ?? p
      );
      toast.error(e.message || 'Erro ao salvar');
    }
  };

  const createAndAdd = async () => {
    const n = creating.trim();
    if (!n) return;
    try {
      const { collection } = await collectionsApi.create(n);
      setCols((p) => [collection, ...(p || [])]);
      setCreating('');
      await addTo(collection.id);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar coleção');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono text-muted-foreground">
            {count > 1 ? `Salvar ${count} em coleção` : 'Salvar em coleção'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-1.5 pt-1">
          <Input
            value={creating}
            onChange={(e) => setCreating(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createAndAdd();
            }}
            placeholder="Nova coleção..."
            className="bg-input border-border text-sm h-9"
          />
          <Button
            size="sm"
            className="bg-brand-cyan text-black hover:bg-brand-cyan/80 text-xs h-9"
            onClick={createAndAdd}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto flex flex-col gap-1 mt-1">
          {cols === null ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Carregando...</p>
          ) : cols.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhuma coleção ainda — crie a primeira acima.
            </p>
          ) : (
            cols.map((c) => (
              <button
                key={c.id}
                onClick={() => addTo(c.id)}
                disabled={savedIds.has(c.id)}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-muted text-left transition-colors"
              >
                <span className="flex items-center gap-2 text-sm text-foreground truncate">
                  <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {c.name}
                </span>
                {savedIds.has(c.id) ? (
                  <Check className="h-4 w-4 text-brand-cyan shrink-0" />
                ) : (
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                    {c.count}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Right-click context menu (reuses dropdown-menu, anchored at cursor) ─────────
const CardContextMenu: React.FC<{
  menu: { x: number; y: number; item: ReferenceItem };
  isAdmin: boolean;
  onClose: () => void;
  onSave: (r: ReferenceItem) => void;
  onSimilar: (r: ReferenceItem) => void;
  onEdit: (r: ReferenceItem) => void;
  onDelete: (r: ReferenceItem) => void;
}> = ({ menu, isAdmin, onClose, onSave, onSimilar, onEdit, onDelete }) => {
  const { x, y, item } = menu;
  return (
    <DropdownMenu
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      {/* Invisible 0×0 anchor placed at the cursor. */}
      <DropdownMenuTrigger asChild>
        <span aria-hidden className="fixed" style={{ left: x, top: y }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="truncate">{refTitle(item)}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onSave(item)}>
          <Bookmark className="h-3.5 w-3.5 mr-2" />
          Salvar em coleção
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSimilar(item)}>
          <Images className="h-3.5 w-3.5 mr-2" />
          Ver parecidas
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onEdit(item)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onDelete(item)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// ─── Batch action bar (floating) ─────────────────────────────────
const BatchActionBar: React.FC<{
  count: number;
  total: number;
  isAdmin: boolean;
  onSave: () => void;
  onSelectAll: () => void;
  onDelete: () => void;
  onClear: () => void;
}> = ({ count, total, isAdmin, onSave, onSelectAll, onDelete, onClear }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 16 }}
    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-border bg-card/95 backdrop-blur px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
    role="toolbar"
    aria-label="Ações da seleção"
  >
    <span className="px-1 text-xs font-mono text-muted-foreground tabular-nums">
      <motion.span
        key={count}
        initial={{ scale: 0.7, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 24 }}
        className="inline-block text-brand-cyan"
      >
        {count}
      </motion.span>{' '}
      {count === 1 ? 'selecionada' : 'selecionadas'}
    </span>
    {count < total && (
      <button
        onClick={onSelectAll}
        className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        Tudo
      </button>
    )}
    <Button
      size="sm"
      className="h-8 bg-brand-cyan text-black hover:bg-brand-cyan/80 text-xs"
      onClick={onSave}
    >
      <Bookmark className="h-3.5 w-3.5 mr-1.5" />
      Salvar em coleção
    </Button>
    {isAdmin && (
      <Button
        size="sm"
        variant="outline"
        className="h-8 bg-card border-border text-xs text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
        Excluir
      </Button>
    )}
    <button
      onClick={onClear}
      title="Concluir seleção"
      aria-label="Concluir seleção"
      className="h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:text-foreground"
    >
      <X className="h-4 w-4" />
    </button>
  </motion.div>
);

// ─── Admin edit dialog ───────────────────────────────────────────
const EditReferenceDialog: React.FC<{
  item: ReferenceItem;
  onClose: () => void;
  onSaved: (patch: Partial<ReferenceItem>) => void;
}> = ({ item, onClose, onSaved }) => {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description || '');
  const [tagsInput, setTagsInput] = useState((item.tags || []).join(', '));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const patch = { name: name.trim(), description: description.trim(), tags };
    try {
      await adminReferencesApi.update(item.id, patch);
      toast.success('Referência atualizada');
      onSaved(patch);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={() => !saving && onClose()}
      title="Editar referência"
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-brand-cyan text-black hover:bg-brand-cyan/80 text-xs"
            disabled={saving}
            onClick={save}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Nome</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-input border-border text-sm h-9"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full bg-input border border-border rounded-md text-sm p-2 text-foreground resize-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Tags (separadas por vírgula)</label>
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="minimalist, line art, warm..."
            className="bg-input border-border text-sm h-9"
          />
        </div>
      </div>
    </Modal>
  );
};

// Removable active-filter pill used in the summary bar.
const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <Badge
    variant="secondary"
    className="cursor-pointer bg-muted text-foreground border-border text-xs"
    onClick={onRemove}
  >
    {label}
    <X className="h-2.5 w-2.5 ml-1" />
  </Badge>
);

// ─── Admin-only moderation queue (pending user uploads) ──────────────────────
const ModerationQueue: React.FC<{ onClose: () => void; onResolved: () => void }> = ({
  onClose,
  onResolved,
}) => {
  const [items, setItems] = useState<PendingReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminReferencesApi.pending(50, 0);
      setItems(res.items);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar fila');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Approval runs AI enrichment server-side, so it's slow — block the row while it works.
  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id);
    try {
      if (action === 'approve') await adminReferencesApi.approve(id);
      else await adminReferencesApi.reject(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
      onResolved();
      toast.success(action === 'approve' ? 'Aprovada e analisada' : 'Rejeitada');
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono text-muted-foreground">
            Fila de moderação · {items.length} aguardando
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Nada para revisar.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto p-1">
            {items.map((ref) => (
              <div
                key={ref.id}
                className="rounded-lg border border-border bg-background/40 overflow-hidden"
              >
                <img
                  src={ref.thumbnailUrl || ref.referenceImageUrl}
                  alt={ref.name}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-2 space-y-2">
                  <p className="text-[11px] truncate" title={ref.name}>
                    {ref.name}
                  </p>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 flex-1 bg-brand-cyan text-black hover:bg-brand-cyan/80 text-[11px]"
                      disabled={busy === ref.id}
                      onClick={() => act(ref.id, 'approve')}
                    >
                      {busy === ref.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Aprovar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 text-[11px]"
                      disabled={busy === ref.id}
                      onClick={() => act(ref.id, 'reject')}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─── Admin-only duplicate calibration bar ────────────────────────────────────
const DuplicateAdminBar: React.FC<{
  report: DuplicateReport;
  onDedupe: () => void;
  deduping: boolean;
}> = ({ report, onDedupe, deduping }) => (
  <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
    <span className="text-xs font-mono text-amber-500">
      {report.groups.length} grupo(s) · {report.redundant} cópia(s) redundante(s)
    </span>
    <span className="text-[11px] text-muted-foreground">
      Marcadas no grid: <span className="text-amber-500">×N</span> = mantida,{' '}
      <span className="text-destructive">dup</span> = removível
      {report.unhashed > 0 && ` · ${report.unhashed} sem hash (não comparáveis)`}
    </span>
    <Button
      size="sm"
      variant="outline"
      className="ml-auto h-7 border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
      disabled={deduping}
      onClick={onDedupe}
    >
      {deduping ? (
        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
      ) : (
        <Trash2 className="mr-1.5 h-3 w-3" />
      )}
      Remover redundantes
    </Button>
  </div>
);

const FilterControls: React.FC<{
  search: string;
  setSearch: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
  region: string;
  setRegion: (v: string) => void;
  semantic: boolean;
  setSemantic: (v: boolean) => void;
}> = ({ search, setSearch, country, setCountry, region, setRegion, semantic, setSemantic }) => (
  <div className="flex flex-col md:flex-row md:items-center gap-2">
    <div className="relative flex-1 min-w-[200px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        id="ref-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={
          semantic
            ? 'Buscar por significado...  ( / )'
            : 'Buscar por nome, estúdio, descrição...  ( / )'
        }
        className="pl-9 pr-24 bg-input border-border text-sm h-9"
      />
      {/* Semantic (meaning) vs exact (substring). Only relevant with a query. */}
      {search.trim() && (
        <button
          type="button"
          onClick={() => setSemantic(!semantic)}
          title={
            semantic
              ? 'Busca por significado (IA). Clique para busca exata.'
              : 'Busca exata (substring). Clique para busca por significado.'
          }
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-mono transition-colors',
            semantic
              ? 'bg-brand-cyan/15 text-brand-cyan'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          {semantic ? 'significado' : 'exata'}
        </button>
      )}
    </div>
    <div className="md:w-[190px]">
      <Select options={COUNTRY_OPTIONS} value={country} onChange={setCountry} placeholder="País" />
    </div>
    <div className="md:w-[190px]">
      <Select options={REGION_OPTIONS} value={region} onChange={setRegion} placeholder="Região" />
    </div>
  </div>
);

// ─── Masonry card with blur-up ───────────────────────────────────

const MasonryCard: React.FC<{
  item: ReferenceItem;
  onOpen: () => void;
  onSimilar: () => void;
  onSave?: () => void;
  onRemove?: () => void;
  focused?: boolean;
  selected?: boolean;
  selectionActive?: boolean;
  onToggleSelect?: (shiftKey: boolean) => void;
  onContextMenu?: (x: number, y: number) => void;
  /** Admin-only duplicate marker. Absent for everyone else. */
  dupe?: { count: number; isKeeper: boolean };
}> = ({
  item,
  onOpen,
  onSimilar,
  onSave,
  onRemove,
  focused,
  selected,
  selectionActive,
  onToggleSelect,
  onContextMenu,
  dupe,
}) => {
  const [loaded, setLoaded] = useState(false);
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const flag = countryFlag(item.country);
  const src = item.thumbnailUrl || item.referenceImageUrl;
  const placeholder = useThumbPlaceholder(item.thumbHash);

  useEffect(() => {
    if (focused)
      cardRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [focused, reduce]);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '120px' }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="group relative"
        ref={cardRef}
        onContextMenu={(e) => {
          if (!onContextMenu) return;
          e.preventDefault();
          onContextMenu(e.clientX, e.clientY);
        }}
      >
        <button
          aria-label={
            selectionActive
              ? `${selected ? 'Desmarcar' : 'Selecionar'} ${refTitle(item)}`
              : `Abrir ${refTitle(item)}`
          }
          onClick={(e) => {
            // Once anything is selected, clicking a card toggles it (fast multi-select).
            if (selectionActive) onToggleSelect?.(e.shiftKey);
            else onOpen();
          }}
          className={cn(
            'block w-full text-left rounded-xl overflow-hidden bg-card ring-1 transition-[box-shadow,transform,opacity] duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] active:scale-[0.985] focus:outline-none',
            selected || focused
              ? 'ring-2 ring-brand-cyan'
              : 'ring-border hover:ring-ring focus-visible:ring-2 focus-visible:ring-brand-cyan/60',
            // In select-mode, dim what isn't chosen so the mode is unmistakable.
            selectionActive && !selected && 'opacity-55 hover:opacity-100'
          )}
        >
          <div className="relative" style={{ aspectRatio: loaded ? undefined : '4 / 5' }}>
            {/* LQIP: thumbhash if available, else a soft shimmer */}
            {!loaded &&
              (placeholder ? (
                <img
                  src={placeholder}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 animate-pulse bg-muted/50" />
              ))}
            <motion.img
              layoutId={`card-${item.id}`}
              transition={
                reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 34 }
              }
              src={src}
              alt={item.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              className={cn(
                'w-full h-auto block transition-[opacity,filter] duration-700 ease-out',
                loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-md'
              )}
            />
            {/* gradient + meta on hover */}
            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <p className="text-[11px] font-medium text-white truncate">{refTitle(item)}</p>
              {item.country && (
                <p className="text-[10px] font-mono text-neutral-300 truncate">
                  {countryFlag(item.country)} {item.country}
                </p>
              )}
            </div>
            {flag && (
              <span
                className={cn(
                  'absolute top-2 left-2 text-base leading-none drop-shadow transition-opacity',
                  selected || selectionActive ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'
                )}
                title={item.country}
              >
                {flag}
              </span>
            )}
            {typeof item.score === 'number' && (
              <span className="absolute top-2 right-2 rounded-full bg-black/60 backdrop-blur px-1.5 py-0.5 text-[10px] font-mono text-neutral-100">
                {Math.round(item.score * 100)}%
              </span>
            )}
            {/* Admin-only: identical bytes ingested more than once (the library
                predates ingest dedup). Amber = the copy that survives a dedupe,
                destructive = the copy that gets deleted. */}
            {dupe && (
              <span
                className={cn(
                  'absolute bottom-2 right-2 rounded-full px-1.5 py-0.5 text-[10px] font-mono backdrop-blur',
                  dupe.isKeeper
                    ? 'bg-amber-500/80 text-black'
                    : 'bg-destructive/80 text-destructive-foreground'
                )}
                title={
                  dupe.isKeeper
                    ? `${dupe.count} cópias idênticas — esta é a mais antiga e seria mantida`
                    : `${dupe.count} cópias idênticas — esta seria removida`
                }
              >
                {dupe.isKeeper ? `×${dupe.count}` : 'dup'}
              </span>
            )}
          </div>
        </button>
        {/* Select checkbox — sibling of the card button (avoids nested <button>) */}
        {onToggleSelect && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(e.shiftKey);
            }}
            title={selected ? 'Desmarcar' : 'Selecionar'}
            aria-label={selected ? 'Desmarcar' : 'Selecionar'}
            aria-pressed={selected}
            className={cn(
              'absolute top-1.5 left-1.5 z-10 h-6 w-6 grid place-items-center rounded-md bg-black/60 backdrop-blur transition-opacity',
              selected || selectionActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              selected ? 'text-brand-cyan' : 'text-neutral-200 hover:text-neutral-100'
            )}
          >
            {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </button>
        )}
        {/* Quick actions */}
        <div
          className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            display: typeof item.score === 'number' || selectionActive ? 'none' : undefined,
          }}
        >
          <button
            onClick={onSimilar}
            title="Ver parecidas"
            aria-label="Ver parecidas"
            className="h-7 w-7 grid place-items-center rounded-full bg-black/70 backdrop-blur text-neutral-200 hover:text-neutral-100"
          >
            <Images className="h-3.5 w-3.5" />
          </button>
          {onRemove ? (
            <button
              onClick={onRemove}
              title="Remover da coleção"
              aria-label="Remover da coleção"
              className="h-7 w-7 grid place-items-center rounded-full bg-black/70 backdrop-blur text-neutral-200 hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : onSave ? (
            <button
              onClick={onSave}
              title="Salvar em coleção"
              aria-label="Salvar em coleção"
              className="h-7 w-7 grid place-items-center rounded-full bg-black/70 backdrop-blur text-neutral-200 hover:text-neutral-100"
            >
              <Bookmark className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Lightbox ────────────────────────────────────────────────────

const Lightbox: React.FC<{
  items: ReferenceItem[];
  index: number | null;
  onClose: () => void;
  onNav: (delta: number) => void;
  onSimilar: (ref: ReferenceItem) => void;
  onSave?: (ref: ReferenceItem) => void;
  onTag?: (tag: string) => void;
  isAdmin?: boolean;
  onEdit?: (ref: ReferenceItem) => void;
  onDelete?: (ref: ReferenceItem) => void;
  similarSource?: ReferenceItem;
}> = ({
  items,
  index,
  onClose,
  onNav,
  onSimilar,
  onSave,
  onTag,
  isAdmin,
  onEdit,
  onDelete,
  similarSource,
}) => {
  const item = index !== null ? items[index] : null;
  const prov = item?.provenance || {};
  const flag = item ? countryFlag(item.country) : '';
  const reduce = useReducedMotion();
  const [showAllTags, setShowAllTags] = useState(false);

  // Collapse the tag list back to the top few whenever the reference changes.
  useEffect(() => {
    setShowAllTags(false);
  }, [item?.id]);

  // Prefetch neighbours so arrow-nav is instant.
  useEffect(() => {
    if (index === null) return;
    for (const n of [index - 1, index + 1]) {
      const url = items[n]?.referenceImageUrl;
      if (url) {
        const img = new Image();
        img.src = url;
      }
    }
  }, [index, items]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-neutral-950/95 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-4 right-4 z-10 h-9 w-9 grid place-items-center rounded-full bg-neutral-900/80 text-neutral-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Prev / Next */}
          {index! > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNav(-1);
              }}
              aria-label="Anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 grid place-items-center rounded-full bg-neutral-900/80 text-neutral-300 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {index! < items.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNav(1);
              }}
              aria-label="Próxima"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 grid place-items-center rounded-full bg-neutral-900/80 text-neutral-300 hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          <div className="h-full w-full flex flex-col lg:flex-row items-stretch">
            {/* Image — clicking the empty space around it closes (backdrop behaviour) */}
            <div
              className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8"
              onClick={onClose}
            >
              <motion.img
                key={item.id}
                layoutId={`card-${item.id}`}
                transition={
                  reduce ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 32 }
                }
                src={item.referenceImageUrl}
                alt={item.name}
                onClick={(e) => e.stopPropagation()}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            </div>

            {/* Meta panel */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card p-5 sm:p-6 overflow-y-auto space-y-4"
            >
              {(() => {
                const title = refTitle(item);
                const sub = item.studio?.trim() || item.provenance?.designer?.trim();
                return (
                  <div>
                    <h3 className="text-base font-semibold text-foreground leading-snug">
                      {title}
                    </h3>
                    {sub && sub !== title && (
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{sub}</p>
                    )}
                  </div>
                );
              })()}

              {/* Why it matches — shared dimensions with the similarity source */}
              {typeof item.score === 'number' &&
                similarSource &&
                (() => {
                  const shared = sharedDimensions(similarSource, item);
                  return shared.length ? (
                    <div className="rounded-lg border border-border bg-muted p-3">
                      <p className="text-xs text-muted-foreground mb-1.5">Por que combina</p>
                      <div className="flex flex-wrap gap-1">
                        {shared.map((s) => (
                          <Badge
                            key={s}
                            variant="outline"
                            className="border-border bg-muted text-muted-foreground text-xs"
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}

              <div className="flex flex-wrap gap-1.5">
                {item.country && (
                  <Badge className="bg-muted text-foreground border-border text-[11px]">
                    {flag ? (
                      <span className="mr-1">{flag}</span>
                    ) : (
                      <MapPin className="h-3 w-3 mr-1" />
                    )}
                    {item.country}
                    {prov.countryInferred && (
                      <span className="ml-1 text-muted-foreground">auto</span>
                    )}
                  </Badge>
                )}
                {item.region && (
                  <Badge
                    variant="outline"
                    className="border-border text-muted-foreground text-[11px]"
                  >
                    <Globe className="h-3 w-3 mr-1" />
                    {REGION_LABELS[item.region] || item.region}
                  </Badge>
                )}
                {prov.year && (
                  <Badge
                    variant="outline"
                    className="border-border text-muted-foreground text-[11px]"
                  >
                    {prov.year}
                  </Badge>
                )}
                {prov.awardSource && (
                  <Badge
                    variant="outline"
                    className="border-border text-muted-foreground text-[11px]"
                  >
                    {prov.awardSource}
                  </Badge>
                )}
              </div>

              {prov.designer && (
                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    Designer
                  </span>
                  <p className="text-sm text-muted-foreground">{prov.designer}</p>
                </div>
              )}

              {item.description && (
                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    Descrição
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-6">
                    {item.description}
                  </p>
                </div>
              )}

              {/* Tags — click to drop into the library filtered by it (shareable route) */}
              {item.tags && item.tags.length > 0 && (
                <div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(showAllTags ? item.tags : item.tags.slice(0, 6)).map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className={cn(
                          'text-[10px] px-1.5 py-0 border-border text-muted-foreground transition-colors',
                          onTag && 'cursor-pointer hover:border-ring hover:text-foreground'
                        )}
                        onClick={onTag ? () => onTag(t) : undefined}
                      >
                        {t}
                      </Badge>
                    ))}
                    {!showAllTags && item.tags.length > 6 && (
                      <button
                        onClick={() => setShowAllTags(true)}
                        className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-1 transition-colors"
                      >
                        +{item.tags.length - 6}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Dimension values not already surfaced as a tag (avoids a duplicate list) */}
              {(() => {
                const extra = [...new Set(Object.values(item.dimensions || {}).flat())].filter(
                  (v) => !(item.tags || []).includes(v)
                );
                return extra.length ? (
                  <div className="flex flex-wrap gap-1">
                    {extra.slice(0, 12).map((v, i) => (
                      <Badge
                        key={`${v}-${i}`}
                        variant="outline"
                        className={cn(
                          'text-[10px] px-1.5 py-0 border-border text-muted-foreground transition-colors',
                          onTag && 'cursor-pointer hover:border-ring hover:text-foreground'
                        )}
                        onClick={onTag ? () => onTag(v) : undefined}
                      >
                        {v}
                      </Badge>
                    ))}
                  </div>
                ) : null;
              })()}

              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <Button
                  size="sm"
                  className="bg-brand-cyan text-black hover:bg-brand-cyan/80 text-xs"
                  onClick={() => onSimilar(item)}
                >
                  <Images className="h-3.5 w-3.5 mr-1.5" />
                  Ver parecidas
                </Button>
                {onSave && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-card border-border text-xs"
                    onClick={() => onSave(item)}
                  >
                    <Bookmark className="h-3.5 w-3.5 mr-1.5" />
                    Salvar em coleção
                  </Button>
                )}
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-card border-border text-xs"
                      onClick={() => onEdit?.(item)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-card border-border text-xs text-destructive hover:text-destructive"
                      onClick={() => onDelete?.(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Excluir
                    </Button>
                  </div>
                )}
                {(item.sourceUrl || prov.sourceUrl) && (
                  <a
                    href={item.sourceUrl || prov.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver fonte original
                  </a>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── States ──────────────────────────────────────────────────────

const MasonrySkeleton: React.FC<{ cols: number }> = ({ cols }) => {
  const heights = useMemo(() => [220, 300, 180, 260, 340, 200, 280, 240, 320, 210, 290, 250], []);
  const columns = Array.from({ length: cols }, (_, ci) =>
    heights.filter((_, i) => i % cols === ci)
  );
  return (
    <div className="flex gap-3 items-start">
      {columns.map((col, ci) => (
        <div key={ci} className="flex-1 min-w-0 flex flex-col gap-3">
          {col.map((h, i) => (
            <div key={i} className="rounded-xl bg-card/60 animate-pulse" style={{ height: h }} />
          ))}
        </div>
      ))}
    </div>
  );
};

const FirstRun: React.FC<{ onUpload: () => void }> = ({ onUpload }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
    <div className="h-14 w-14 grid place-items-center rounded-2xl bg-card ring-1 ring-border">
      <ImageIcon className="h-7 w-7 text-muted-foreground" />
    </div>
    <h3 className="text-lg font-semibold text-foreground">Sua biblioteca de referências</h3>
    <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
      Design world-class do mundo inteiro, taggeado por conteúdo e por país. Suba, arraste ou cole
      uma imagem — o pipeline analisa, taggeia e popula. Depois mergulhe de uma ref pra outra.
    </p>
    <Button
      size="sm"
      className="bg-brand-cyan text-black hover:bg-brand-cyan/80 text-xs mt-1"
      onClick={onUpload}
    >
      <Upload className="h-3.5 w-3.5 mr-1.5" />
      Subir primeira referência
    </Button>
  </div>
);

const NoResults: React.FC<{ onClear: () => void }> = ({ onClear }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
    <Search className="h-8 w-8 text-muted-foreground" />
    <p className="text-sm text-muted-foreground">Nenhuma referência para esse filtro</p>
    <Button variant="outline" size="sm" className="bg-card border-border text-xs" onClick={onClear}>
      <X className="h-3.5 w-3.5 mr-1.5" />
      Limpar filtros
    </Button>
  </div>
);

const ErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
    <AlertTriangle className="h-8 w-8 text-warning/80" />
    <p className="text-sm text-muted-foreground">Não foi possível carregar as referências</p>
    <Button variant="outline" size="sm" className="bg-card border-border text-xs" onClick={onRetry}>
      Tentar de novo
    </Button>
  </div>
);

// ─── Upload Dialog ───────────────────────────────────────────────

const UploadDialog: React.FC<{ onClose: () => void; onDone: (madePublic: boolean) => void }> = ({
  onClose,
  onDone,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [country, setCountry] = useState('');
  const [designer, setDesigner] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [awardSource, setAwardSource] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.onchange = (e) => {
      const list = (e.target as HTMLInputElement).files;
      if (list) setFiles(Array.from(list).slice(0, 10));
    };
    input.click();
  };

  const submit = async () => {
    if (files.length === 0) {
      toast.error('Selecione ao menos 1 imagem');
      return;
    }
    setUploading(true);
    try {
      const images: ReferenceUploadInput[] = [];
      for (const f of files) {
        images.push({
          data: await fileToBase64(f),
          name: f.name.replace(/\.[^.]+$/, ''),
          country: country || undefined,
          designer: designer || undefined,
          sourceUrl: sourceUrl || undefined,
          awardSource: awardSource || undefined,
          isPublic,
        });
      }
      const res = await referencesApi.upload(images);
      // Uploads now await moderation — nothing is public or analysed yet. Saying
      // "ingerida" would overclaim; "em revisão" is the honest state.
      const pending = res.pending ?? res.ingested - (res.deduped || 0);
      const parts = [`${pending} enviada(s) para revisão`];
      if (res.deduped) parts.push(`${res.deduped} já na biblioteca`);
      if (res.failed) parts.push(`${res.failed} falha(s)`);
      toast.success(parts.join(', '));
      onDone(isPublic);
    } catch (e: any) {
      toast.error(e.message || 'Erro no upload');
    } finally {
      setUploading(false);
    }
  };

  // Ingest is 3 AI calls per image — the app's longest file-processing wait.
  // Same loader the other ingest flows use (BrandIngestModal, Compress, Upscale).
  // No `progress`: the batch is one request, so a bar here would be invented.
  if (uploading) {
    return (
      <Dialog open onOpenChange={() => {}}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono text-muted-foreground">
              Analisando referências
            </DialogTitle>
          </DialogHeader>
          <div className="py-8">
            <FlyingPaperLoader label={`Analisando ${files.length} imagem(ns)...`} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={() => !uploading && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono text-muted-foreground">
            Subir referências
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            onClick={pick}
            className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-ring transition-colors cursor-pointer"
          >
            <Upload className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {files.length > 0
                ? `${files.length} imagem(ns) selecionada(s)`
                : 'Clique para selecionar imagens (máx 10)'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Grátis — as imagens entram na fila de revisão. Após aprovação, a IA extrai dimensões e infere a origem.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">
                País (opcional)
              </label>
              <Select
                options={COUNTRY_OPTIONS}
                value={country}
                onChange={setCountry}
                placeholder="Auto"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">
                Designer / Estúdio
              </label>
              <Input
                value={designer}
                onChange={(e) => setDesigner(e.target.value)}
                placeholder="ex: Pentagram"
                className="bg-input border-border text-sm h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">
                Fonte (URL)
              </label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="bg-input border-border text-sm h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">
                Award / Arquivo
              </label>
              <Input
                value={awardSource}
                onChange={(e) => setAwardSource(e.target.value)}
                placeholder="ex: D&AD 2024"
                className="bg-input border-border text-sm h-9"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="accent-brand-cyan"
            />
            <span className="text-xs text-muted-foreground">
              Tornar pública na biblioteca compartilhada
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              className="bg-card border-border text-xs"
              disabled={uploading}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-brand-cyan text-black hover:bg-brand-cyan/80 text-xs"
              disabled={uploading || files.length === 0}
              onClick={submit}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Analisar e popular
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReferencesPage;
