import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Masonry, useMasonryColumns } from '@/components/ui/Masonry';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { thumbHashToDataURL } from 'thumbhash';
import {
  Upload,
  Search,
  Image as ImageIcon,
  Link as LinkIcon,
  Globe,
  MapPin,
  X,
  Loader2,
  ExternalLink,
  Images,
  ScanSearch,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
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
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Thumb } from '@/components/ui/Thumb';
import { MediaTile } from '@/components/ui/MediaTile';
import { Dropzone } from '@/components/ui/Dropzone';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Modal } from '@/components/ui/Modal';
import { ErrorState } from '@/components/ui/ErrorState';
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
import { glassSurface } from '@/lib/ui/glass';
import { authService } from '@/services/authService';
import { REGIONS, DESIGN_COUNTRIES, REGION_LABELS, countryName } from '@/lib/references/taxonomy';
import { useActiveBrandSafe } from '@/contexts/ActiveBrandContext';
import { brandRankingTerms } from '@/lib/references/brandTerms';
import { localizedName, type LocalizableRef } from '@/lib/references/naming';
import { isLowResolution } from '@/lib/references/quality';
import { useTranslation } from '@/hooks/useTranslation';
import { useRailSlot } from '@/components/shell/RailSlotContext';
import { REFERENCES_NAV } from '@/config/navConfig';
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
  type LowResReport,
} from '@/services/referencesApi';

import { ModerationQueue } from './references/ModerationQueue';
import { DuplicateAdminBar, LowResAdminBar } from './references/AdminBars';
import { Lightbox } from './references/Lightbox';
import { UploadDialog } from './references/UploadDialog';
import {
  type Option,
  regionLabel,
  countryOptions,
  regionOptions,
  fileToBase64,
  refTitle,
} from './references/helpers';

// Constante: o servidor pagina por skip=(page-1)*limit, entao o limit nao pode
// variar entre paginas do mesmo feed (geraria buraco/duplicata). Teto do server = 60.
const PAGE_SIZE = 48;

/**
 * Barra de APAGAR. Mais dura que a de AVISAR (MIN_SHORT_SIDE = 400 em
 * src/lib/references/quality.ts): abaixo de 300px o menor lado não sustenta
 * nenhuma leitura de design — são tiras (654×4) e fragmentos de UI raspados.
 */
const LOW_RES_PURGE_BAR = 300;

// O sentinel dispara a proxima pagina enquanto ainda existem ~2.5 telas de feed
// abaixo do fold — assim o usuario nunca alcanca o fim antes do fetch terminar.
const PREFETCH_VIEWPORTS = 2.5;
const PREFETCH_LEAD_MIN = 1200;
function computePrefetchLead(): number {
  if (typeof window === 'undefined') return PREFETCH_LEAD_MIN;
  return Math.max(PREFETCH_LEAD_MIN, Math.round(window.innerHeight * PREFETCH_VIEWPORTS));
}

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

// Dimension filter SSoT — keys/labels/groups shared with the backend.
// (kept as local aliases so the JSX below reads unchanged)
const DIMENSION_FILTER_KEYS = FACET_DIMENSION_KEYS;
const DIM_LABELS = DIMENSION_LABELS;
const DIM_GROUPS_BY_KIND = DIMENSION_GROUPS_BY_KIND;

interface SimilarView {
  label: string;
  items: ReferenceItem[];
  source?: ReferenceItem;
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

/**
 * `embedded` = rota `/refs`: a mesma biblioteca servida como superfície própria
 * (navegador focado, ou painel de plugin do Figma num iframe). Não é uma segunda
 * implementação — é esta, com o chrome do app e as ferramentas de gestão fora.
 *
 * O que sai: hero do PageShell, upload, fila de moderação, barra de duplicatas,
 * ações de admin. O que fica: busca, facetas, grid, lightbox, "parecidas".
 * Ações que exigem conta continuam visíveis e pedem login NO CLIQUE — a rota é
 * pública pra leitura.
 */
export const ReferencesPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Read initial filter state from the URL once (shareable / back-button friendly).
  const initialDims: Record<string, string> = {};
  for (const k of DIMENSION_FILTER_KEYS) {
    const v = searchParams.get(k);
    if (v) initialDims[k] = v;
  }

  // Active brand feeds the feed RANKING (not a hard filter): the BrandSwitcher in
  // the shell is the control. "Todas as marcas" (activeBrandId null) → neutral feed.
  // TEMPORÁRIO — `?src=Z:/Jobs 2.0` isola uma leva de ingest pra inspeção visual
  // antes de decidir o que fazer com ela. Remover junto com a decisão.
  // Permalink: /references/:handle e /refs/:handle abrem o lightbox naquela ref.
  const { handle: permalinkHandle } = useParams<{ handle?: string }>();
  const navigate = useNavigate();

  const sourcePrefix = searchParams.get('src') || '';
  /** Navegação por cor — na URL, então um recorte por cor é compartilhável. */
  const color = searchParams.get('color') || '';

  const activeBrand = useActiveBrandSafe();
  const activeBrandId = activeBrand?.activeBrandId ?? null;
  const brandTerms = useMemo(
    () => brandRankingTerms(activeBrand?.activeBrand),
    [activeBrand?.activeBrand]
  );
  // Só nomeia a lente quando ela REALMENTE muda a ordem: marca sem termos
  // utilizáveis cai no feed neutro, e anunciar afinidade ali seria mentira.
  const activeBrandName = brandTerms ? activeBrand?.activeBrand?.name?.trim() || '' : '';
  const { t, tOr, locale } = useTranslation();

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
  // Slot do rail montado = rail desktop expandido mostrando as tabs da seção.
  const railSlot = useRailSlot()?.railSlot ?? null;
  const activeNavId =
    scope !== 'library'
      ? scope
      : kind === 'branding'
        ? 'logos'
        : kind === 'mockup'
          ? 'mockups'
          : 'library';
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
  const [lowResReport, setLowResReport] = useState<LowResReport | null>(null);
  const [purgingLowRes, setPurgingLowRes] = useState(false);
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

  // Distancia (px) antes do fim do feed em que a proxima pagina ja comeca a carregar.
  const [prefetchLead, setPrefetchLead] = useState(() => computePrefetchLead());
  useEffect(() => {
    const onResize = () => setPrefetchLead(computePrefetchLead());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const cols = useMasonryColumns();
  const activeDimEntries = Object.entries(dims).filter(([, v]) => v);
  const hasActiveFilters = !!(
    debouncedSearch ||
    country ||
    region ||
    activeTag ||
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
                sourcePrefix: sourcePrefix || undefined,
                color: color || undefined,
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
      sourcePrefix,
      color,
    ]
  );

  // facets per kind: the counts must match the grid the user is looking at
  useEffect(() => {
    referencesApi
      .facets(kind)
      .then(setFacets)
      .catch(() => {});
  }, [kind]);

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
      .then((u) => setIsAdmin(!embedded && !!u?.isAdmin))
      .catch(() => {});
  }, [embedded]);

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
    // Referências pequenas demais pra servir de referência.
    adminReferencesApi
      .lowRes(LOW_RES_PURGE_BAR)
      .then(setLowResReport)
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
    // `src` é inspeção, não filtro de usuário — mas some daqui se não for
    // reescrito, porque esta serialização monta a query do zero.
    if (sourcePrefix) p.set('src', sourcePrefix);
    if (color) p.set('color', color);
    setSearchParams(p, { replace: true });
  }, [debouncedSearch, country, region, activeTag, kind, scope, dims, sourcePrefix, color]); // eslint-disable-line react-hooks/exhaustive-deps

  // infinite scroll — prefetch com margem proporcional a viewport.
  // Um lead fixo (900px) sumia em telas altas e em scroll rapido: o usuario
  // chegava no fim do grid antes da proxima pagina existir. Aqui a proxima
  // pagina comeca a carregar enquanto ainda ha ~2.5 telas de conteudo abaixo.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || similar || collectionView || scope === 'collections') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && !isLoadingMore && pageRef.current < pages) {
          loadList(pageRef.current + 1, true);
        }
      },
      { rootMargin: `${prefetchLead}px 0px` }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [pages, isLoading, isLoadingMore, similar, collectionView, scope, loadList, prefetchLead]);

  // Permalink → abre o lightbox naquela referência. Ela é prefixada no grid em
  // vez de esperar o feed conter, porque um link compartilhado tem que resolver
  // mesmo quando a ref não está na primeira página (ou nem no recorte atual).
  useEffect(() => {
    if (!permalinkHandle) return;
    let cancelled = false;
    (async () => {
      try {
        const { reference } = await referencesApi.item(permalinkHandle);
        if (cancelled) return;
        setItems((prev) => (prev.some((r) => r.id === reference.id) ? prev : [reference, ...prev]));
        setLightboxIndex(0);
      } catch {
        if (!cancelled) toast.error(t('references.toast.notFound'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [permalinkHandle, t]);

  // ── Auth gate ──────────────────────────────────────────────────
  const requireAuth = (): boolean => {
    if (!authService.isAuthenticated()) {
      toast.error(t('references.toast.loginForImages'));
      return false;
    }
    return true;
  };

  // ── Exploration loop ───────────────────────────────────────────
  const runSearchByImage = useCallback(
    async (file: File | Blob) => {
      if (!requireAuth()) return;
      setLightboxIndex(null);
      setCollectionView(null);
      setSimilarLoading(true);
      setSimilar({ label: t('references.imageSearch'), items: [] });
      try {
        const base64 = await fileToBase64(file);
        const data = await referencesApi.searchByImage(base64, { limit: 40 });
        setSimilar({ label: t('references.imageSearch'), items: data.references });
        if (data.references.length === 0) toast.info(t('references.toast.noSimilarImage'));
      } catch (e: any) {
        toast.error(e.message || t('references.toast.imageSearchError'));
        setSimilar(null);
      } finally {
        setSimilarLoading(false);
      }
    },
    [t]
  );

  const runSimilarTo = useCallback(
    async (ref: ReferenceItem) => {
      const label = t('references.similarTo', {
        title: refTitle(ref, locale, t('references.fallbackTitle')),
      });
      setLightboxIndex(null);
      setCollectionView(null);
      setSimilarLoading(true);
      setSimilar({ label, items: [], source: ref });
      try {
        const data = await referencesApi.similarTo(ref.id, 40);
        setSimilar({ label, items: data.references, source: ref });
        if (data.references.length === 0) toast.info(t('references.toast.noSimilar'));
      } catch (e: any) {
        toast.error(e.message || t('references.toast.similarError'));
        setSimilar(null);
      } finally {
        setSimilarLoading(false);
      }
    },
    [locale, t]
  );

  const clearSimilar = () => setSimilar(null);

  // ── Collections ────────────────────────────────────────────────
  const [collectionsError, setCollectionsError] = useState(false);
  const loadCollections = useCallback(async () => {
    if (!authService.isAuthenticated()) return;
    setCollectionsError(false);
    try {
      const data = await collectionsApi.list();
      setCollections(data.collections);
    } catch {
      setCollectionsError(true);
    }
  }, []);

  useEffect(() => {
    if (scope === 'collections') {
      setCollectionView(null);
      loadCollections();
    }
  }, [scope, loadCollections]);

  const openBoard = useCallback(
    async (id: string) => {
      setSimilar(null);
      setLightboxIndex(null);
      try {
        const detail = await collectionsApi.get(id);
        setCollectionView(detail);
      } catch (e: any) {
        toast.error(e.message || t('references.toast.openCollectionError'));
      }
    },
    [t]
  );

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
          toast.error(e.message || t('references.toast.deleteError'));
        }
      }, 5000);

      toast(
        plural
          ? t('references.toast.deletedMany', { count: ids.length })
          : t('references.toast.deletedOne'),
        {
          duration: 5000,
          action: {
            label: t('references.undo'),
            onClick: () => {
              clearTimeout(commit);
              unhide(ids);
            },
          },
        }
      );
    },
    [clearSelection, unhide, t]
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

  // Limpeza de baixa resolução. Confirma com o número REAL de apagáveis (o
  // servidor exclui as que estão em coleção), e o servidor recomputa os ids —
  // uma página velha não consegue mandar apagar o que ela acha que é pequeno.
  const handlePurgeLowRes = useCallback(async () => {
    if (!lowResReport) return;
    const deletable = lowResReport.total - lowResReport.protected;
    if (!deletable) return;
    const ok = window.confirm(
      `Apagar ${deletable} referência(s) com menor lado abaixo de ${lowResReport.maxShortSide}px?` +
        (lowResReport.protected
          ? `\n\n${lowResReport.protected} está(ão) em coleção e será(ão) preservada(s).`
          : '') +
        '\n\nAção irreversível.'
    );
    if (!ok) return;
    setPurgingLowRes(true);
    try {
      const res = await adminReferencesApi.purgeLowRes(lowResReport.maxShortSide, false);
      setLowResReport(null);
      // Refetch em vez de filtrar em memória: os ids apagados são recomputados
      // no servidor, então a lista local não sabe quais morreram.
      await loadList(1, false);
      toast.success(`${res.deleted ?? 0} referência(s) de baixa resolução removida(s)`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao apagar baixa resolução');
    } finally {
      setPurgingLowRes(false);
    }
  }, [lowResReport, loadList]);

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

  const countryOpts = useMemo(
    () => countryOptions(tOr, locale, facets?.countries),
    [tOr, locale, facets?.countries]
  );
  const regionOpts = useMemo(() => regionOptions(tOr, facets?.regions), [tOr, facets?.regions]);
  const pickCountry = (v: string) => {
    setCountry(v);
    if (v) setRegion('');
  };
  const countrySelect = (
    <Select
      options={countryOpts}
      value={country}
      onChange={pickCountry}
      placeholder={t('references.country')}
    />
  );
  const searchByImageButton = (
    <button
      type="button"
      aria-label={t('references.searchByImage')}
      title={t('references.searchByImage')}
      onClick={() => requireAuth() && searchByImageInput.current?.click()}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <ScanSearch className="h-3.5 w-3.5" />
    </button>
  );
  const filterControls = (
    <FilterControls
      searchByImage={searchByImageButton}
      regionOptions={regionOpts}
      search={search}
      setSearch={setSearch}
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
        seoTitle={t('nav.references.label')}
        seoDescription={t('references.seoDescription')}
        title={t('nav.references.label')}
        width={embedded ? 'full' : '7xl'}
        hideHeader={embedded}
        actions={
          embedded ? undefined : (
            <Button
              variant="outline"
              size="sm"
              title={t('references.uploadCta')}
              className="shrink-0 text-xs px-2 sm:px-3"
              onClick={() => requireAuth() && setUploadOpen(true)}
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('references.uploadCta')}</span>
            </Button>
          )
        }
      >
        {/* Busca por imagem: o botão vive na barra de busca (aparece também no
            /refs embedded, onde as `actions` do shell não renderizam). */}
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
        {/* Lente do feed — o que está moldando a ordem, dito em uma linha.
            A marca ativa JÁ ranqueava o feed e isso não aparecia em lugar
            nenhum: um default silencioso é uma recomendação anônima. Só
            renderiza quando há de fato uma lente (nada é "zero informação"). */}
        {(activeBrandName || sourcePrefix || color) && !similar && !collectionView && (
          <div className="flex flex-wrap items-center gap-2 mb-4 text-2xs text-muted-foreground">
            {activeBrandName && (
              <span>
                {t('references.rankedBy')}{' '}
                <strong className="font-medium text-foreground">{activeBrandName}</strong>
              </span>
            )}
            {color && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ring bg-muted px-2.5 py-1">
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-md border border-border"
                  style={{ backgroundColor: color }}
                />
                {t('references.colorLabel')}{' '}
                <code className="font-mono text-foreground">{color}</code>
                <button
                  type="button"
                  aria-label={t('references.removeColorFilter')}
                  className="ml-0.5 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  onClick={() => {
                    const p = new URLSearchParams(searchParams);
                    p.delete('color');
                    setSearchParams(p, { replace: true });
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {sourcePrefix && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ring bg-muted px-2.5 py-1">
                <Folder className="h-3 w-3" />
                {t('references.sourceLabel')}{' '}
                <code className="font-mono text-foreground">{sourcePrefix}</code>
                <button
                  type="button"
                  aria-label={t('references.removeSourceFilter')}
                  className="ml-0.5 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  onClick={() => {
                    const p = new URLSearchParams(searchParams);
                    p.delete('src');
                    setSearchParams(p, { replace: true });
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Similarity banner */}
        <AnimatePresence>
          {similar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-border bg-muted px-4 py-2.5"
            >
              <span className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                <ScanSearch className="h-3.5 w-3.5 shrink-0" />
                {similarLoading
                  ? 'Buscando parecidas...'
                  : `${similar.label}: ${similar.items.length}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground shrink-0"
                onClick={clearSimilar}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                {t('references.backToLibrary')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collection (board) banner */}
        {collectionView && (
          <div className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-border bg-muted px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs text-muted-foreground truncate">
              <Folder className="h-3.5 w-3.5 shrink-0" />
              {collectionView.collection.name} ({collectionView.items.length})
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {collectionView.collection.isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  aria-label={t('references.deleteCollection')}
                  onClick={() => {
                    const board = collectionView.collection;
                    setCollectionView(null);
                    setScope('collections');
                    const commit = setTimeout(async () => {
                      try {
                        await collectionsApi.remove(board.id);
                        loadCollections();
                      } catch (e: any) {
                        toast.error(e.message || t('references.toast.deleteCollectionError'));
                      }
                    }, 5000);
                    toast(t('references.toast.collectionDeleted'), {
                      duration: 5000,
                      action: {
                        label: t('references.undo'),
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
                {t('references.collections')}
              </Button>
            </div>
          </div>
        )}

        {/* Workbench — busca + país/região + filtros + embaralhar numa barra só.
            Scope (Biblioteca/Coleções/Minhas refs) e kind (Logos/Mockups) são
            NAVEGAÇÃO: vivem na rail drill-in (navConfig REFERENCES_NAV), não aqui. */}
        {!similar && !collectionView && (
          <div className="space-y-3 mb-6">
            {/* Tabs da seção = fallback do rail. Sem slot (rail recolhido, mobile
                ou fora do shell) aparecem sempre; com slot, só abaixo de md
                (mesma regra da AppsPage). */}
            <nav
              aria-label={t('nav.references.label')}
              className={cn(
                '-mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto scrollbar-none',
                railSlot && 'md:hidden'
              )}
            >
              <div className="flex items-center gap-1.5 w-max">
                {REFERENCES_NAV.map((item) => {
                  const active = item.id === activeNavId;
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => navigate(item.to)}
                      className={cn(
                        badgeVariants({ variant: 'outline' }),
                        'gap-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        active
                          ? 'bg-muted text-foreground border-border'
                          : 'border-border text-muted-foreground hover:border-border-hover hover:text-foreground'
                      )}
                    >
                      {Icon && <Icon className="h-3 w-3" />}
                      {t(item.labelKey)}
                    </button>
                  );
                })}
              </div>
            </nav>
            {scope === 'library' && (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">{filterControls}</div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t('references.shuffleFeed')}
                  title={t('references.shuffle')}
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
                  {t('references.filters')}
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
                  aria-label={t('references.filters')}
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
                <span className="text-xs text-muted-foreground">{t('references.forYou')}</span>
                {taste.map((hint) => (
                  <button
                    type="button"
                    key={hint.key + hint.value}
                    className={cn(
                      badgeVariants({ variant: 'neutral' }),
                      'text-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                    )}
                    onClick={() => setDim(hint.key, hint.value)}
                  >
                    {hint.value}
                  </button>
                ))}
              </div>
            )}

            {/* Active filters summary + result count */}
            {scope === 'library' && hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-muted-foreground">
                  {t(total === 1 ? 'references.countOne' : 'references.countMany', {
                    count: total.toLocaleString(locale),
                  })}
                </span>
                {country && (
                  <FilterChip
                    label={countryName(country, locale)}
                    onRemove={() => setCountry('')}
                  />
                )}
                {region && (
                  <FilterChip label={regionLabel(region, tOr)} onRemove={() => setRegion('')} />
                )}
                {debouncedSearch && (
                  <FilterChip label={`"${debouncedSearch}"`} onRemove={() => setSearch('')} />
                )}
                {activeTag && <FilterChip label={activeTag} onRemove={() => setActiveTag('')} />}
                {activeDimEntries.map(([k, v]) => (
                  <FilterChip key={k} label={v} onRemove={() => setDim(k, '')} />
                ))}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('references.clearAll')}
                </button>
              </div>
            )}

            {/* Structured dimension facets — folded until "Filtros" is opened */}
            {scope === 'library' && filtersOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.16 }}
                className="hidden md:flex flex-col gap-1.5"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-[88px] shrink-0 text-xs text-muted-foreground">
                    {t('references.country')}
                  </span>
                  <div className="w-56">{countrySelect}</div>
                </div>
                {DIM_GROUPS_BY_KIND[kind].map((dk) => {
                  const vals = facets?.dimensions?.[dk];
                  if (!vals || !vals.length) return null;
                  return (
                    <div key={dk} className="flex flex-wrap items-center gap-1.5">
                      <span className="w-[88px] shrink-0 text-xs text-muted-foreground">
                        {DIM_LABELS[dk]}
                      </span>
                      {vals.slice(0, 10).map((v) => {
                        const active = dims[dk] === v.value;
                        return (
                          <button
                            type="button"
                            key={v.value}
                            aria-pressed={active}
                            className={cn(
                              badgeVariants({ variant: 'outline' }),
                              'text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                              active
                                ? 'bg-muted text-foreground border-border'
                                : 'border-border text-muted-foreground hover:border-border-hover hover:text-foreground'
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
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </div>
        )}

        {/* Admin-only: user uploads awaiting moderation. Nothing here is public
            or AI-analysed yet — approving runs enrichment, then reveals it. */}
        {/* Curadoria (só admin): uma linha discreta, sem cor de alerta. A
            duplicata e a baixa resolução confirmam antes de apagar. */}
        {isAdmin &&
          (pendingCount > 0 ||
            (dupeReport && dupeReport.redundant > 0) ||
            (lowResReport && lowResReport.total > 0)) && (
            <div className="mb-4 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
              {pendingCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setModerationOpen(true)}
                >
                  {pendingCount} para revisar
                </Button>
              )}
              {dupeReport && dupeReport.redundant > 0 && (
                <DuplicateAdminBar
                  report={dupeReport}
                  onDedupe={handleDedupe}
                  deduping={deduping}
                />
              )}
              {lowResReport && lowResReport.total > 0 && (
                <LowResAdminBar
                  report={lowResReport}
                  onPurge={handlePurgeLowRes}
                  purging={purgingLowRes}
                />
              )}
            </div>
          )}

        {/* Content */}
        {scope === 'collections' && !collectionView ? (
          <CollectionsGrid
            collections={collections}
            error={collectionsError}
            onRetry={loadCollections}
            onOpen={openBoard}
            onCreate={async (name) => {
              try {
                const { collection } = await collectionsApi.create(name);
                setCollections((prev) => [collection, ...prev]);
                toast.success(t('references.toast.collectionCreated'));
              } catch (e: any) {
                toast.error(e.message || t('references.toast.createCollectionError'));
              }
            }}
          />
        ) : error ? (
          <ErrorState title={t('references.loadError')} onRetry={() => loadList(1, false)} />
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
                          toast.error(e.message || t('references.toast.removeError'));
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
            <span className="text-xs">{t('references.loadingMore')}</span>
          </div>
        )}
        {/* Upload dialog */}
        {uploadOpen && (
          <UploadDialog
            onClose={() => setUploadOpen(false)}
            onDone={(madePublic) => {
              setUploadOpen(false);
              referencesApi
                .facets(kind)
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
                <DialogTitle>{t('references.filters')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-1">
                {filterControls}
                {countrySelect}
              </div>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 pointer-events-none"
          >
            <div className="flex flex-col items-center gap-3 text-foreground border-2 border-dashed border-border rounded-xl px-12 py-10">
              <ImageIcon className="h-8 w-8" />
              <p className="text-sm font-medium">{t('references.dropToSearch')}</p>
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
        onColor={(hex) => {
          const p = new URLSearchParams(searchParams);
          p.set('color', hex);
          setSearchParams(p, { replace: false });
          setLightboxIndex(null);
        }}
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
    </div>
  );
};

// ─── Filter controls (shared desktop/mobile) ─────────────────────

// ─── Collections (Are.na-like boards) ────────────────────────────

const CollectionsGrid: React.FC<{
  collections: ReferenceCollection[];
  error?: boolean;
  onRetry?: () => void;
  onOpen: (id: string) => void;
  onCreate: (name: string) => void;
}> = ({ collections, error, onRetry, onOpen, onCreate }) => {
  const { t } = useTranslation();
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
        {t('references.loginForCollections')}
      </div>
    );
  }

  if (error) {
    return <ErrorState title={t('references.collectionsLoadError')} onRetry={onRetry} />;
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
            placeholder={t('references.collectionName')}
            className="bg-input border-border text-sm h-9"
          />
          <div className="flex gap-1.5">
            <Button size="sm" variant="primary" className="text-xs flex-1" onClick={submit}>
              <Check className="h-3.5 w-3.5 mr-1" />
              {t('references.create')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={() => setCreating(false)}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          type="button"
          className="aspect-[4/3] rounded-xl border border-dashed border-border hover:border-border-hover text-muted-foreground hover:text-foreground transition-colors flex flex-col items-center justify-center gap-2"
        >
          <FolderPlus className="h-6 w-6" />
          <span className="text-xs">{t('references.newCollection')}</span>
        </button>
      )}

      {collections.map((c) => (
        <MediaTile
          key={c.id}
          layout="stacked"
          aspectRatio={4 / 3}
          src={c.coverUrl || c.covers?.[0]}
          alt={c.name}
          fallbackIcon={Folder}
          title={
            <span className="flex items-center gap-1">
              {!c.isPublic && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
              <span className="truncate">{c.name}</span>
            </span>
          }
          actionLabel={c.name}
          subtitle={
            <span className="tabular-nums">
              {c.count} {c.count === 1 ? 'item' : 'itens'}
            </span>
          }
          onClick={() => onOpen(c.id)}
        />
      ))}
    </div>
  );
};

const SaveToCollectionDialog: React.FC<{ items: ReferenceItem[]; onClose: () => void }> = ({
  items,
  onClose,
}) => {
  const { t } = useTranslation();
  const [cols, setCols] = useState<ReferenceCollection[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const count = items.length;

  const loadCols = useCallback(() => {
    setLoadError(false);
    setCols(null);
    collectionsApi
      .list()
      .then((d) => setCols(d.collections))
      .catch(() => setLoadError(true));
  }, []);
  useEffect(() => {
    loadCols();
  }, [loadCols]);

  const addTo = async (id: string) => {
    if (savedIds.has(id)) return;
    // Optimistic — reflect instantly, roll back only on failure.
    setSavedIds((s) => new Set(s).add(id));
    setCols((p) => p?.map((c) => (c.id === id ? { ...c, count: c.count + count } : c)) ?? p);
    try {
      // addItem is idempotent server-side ($addToSet); run sequentially to keep it simple.
      for (const it of items) await collectionsApi.addItem(id, it.id);
      if (count > 1) toast.success(t('references.toast.savedMany', { count }));
    } catch (e: any) {
      setSavedIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      setCols(
        (p) => p?.map((c) => (c.id === id ? { ...c, count: Math.max(0, c.count - count) } : c)) ?? p
      );
      toast.error(e.message || t('references.toast.saveError'));
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
      toast.error(e.message || t('references.toast.createCollectionError'));
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle>
            {count > 1
              ? t('references.saveManyToCollection', { count })
              : t('references.saveToCollection')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-1.5 pt-1">
          <Input
            value={creating}
            onChange={(e) => setCreating(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createAndAdd();
            }}
            placeholder={t('references.newCollectionPlaceholder')}
            className="bg-input border-border text-sm h-9"
          />
          <Button size="sm" variant="primary" className="text-xs h-9" onClick={createAndAdd}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto flex flex-col gap-1 mt-1">
          {loadError ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-xs text-muted-foreground">
                {t('references.collectionsLoadErrorShort')}
              </p>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadCols}>
                {t('references.retry')}
              </Button>
            </div>
          ) : cols === null ? (
            <p className="text-xs text-muted-foreground py-4 text-center">{t('common.loading')}</p>
          ) : cols.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              {t('references.noCollections')}
            </p>
          ) : (
            cols.map((c) => (
              <button
                key={c.id}
                onClick={() => addTo(c.id)}
                disabled={savedIds.has(c.id)}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-muted text-left transition-colors"
              >
                <span className="flex items-center gap-2 text-sm text-foreground truncate">
                  <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {c.name}
                </span>
                {savedIds.has(c.id) ? (
                  <Check className="h-4 w-4 text-foreground shrink-0" />
                ) : (
                  <span className="text-2xs text-muted-foreground tabular-nums">{c.count}</span>
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
  const { t, locale } = useTranslation();
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
        <DropdownMenuLabel className="truncate">
          {refTitle(item, locale, t('references.fallbackTitle'))}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onSave(item)}>
          <Bookmark className="h-3.5 w-3.5 mr-2" />
          {t('references.saveToCollection')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSimilar(item)}>
          <Images className="h-3.5 w-3.5 mr-2" />
          {t('references.viewSimilar')}
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onEdit(item)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              {t('common.edit')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onDelete(item)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              {t('common.delete')}
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
}> = ({ count, total, isAdmin, onSave, onSelectAll, onDelete, onClear }) => {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full px-3 py-2',
        glassSurface.panel
      )}
      role="toolbar"
      aria-label={t('references.selectionActions')}
    >
      <span className="px-1 text-xs text-muted-foreground tabular-nums">
        <span className="text-foreground">{count}</span>{' '}
        {count === 1 ? t('references.selectedOne') : t('references.selectedMany')}
      </span>
      {count < total && (
        <button
          onClick={onSelectAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('references.selectAll')}
        </button>
      )}
      <Button size="sm" variant="primary" className="h-8 text-xs" onClick={onSave}>
        <Bookmark className="h-3.5 w-3.5 mr-1.5" />
        {t('references.saveToCollection')}
      </Button>
      {isAdmin && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 bg-card border-border text-xs text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          {t('common.delete')}
        </Button>
      )}
      <button
        onClick={onClear}
        title={t('references.finishSelection')}
        aria-label={t('references.finishSelection')}
        className="h-7 w-7 grid place-items-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
};

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
          <Button size="sm" variant="primary" className="text-xs" disabled={saving} onClick={save}>
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
const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-label={t('references.removeFilter', { label })}
      className={cn(
        badgeVariants({ variant: 'secondary' }),
        'bg-muted text-foreground border-border text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
      )}
      onClick={onRemove}
    >
      {label}
      <X className="h-2.5 w-2.5 ml-1" />
    </button>
  );
};

const FilterControls: React.FC<{
  search: string;
  setSearch: (v: string) => void;
  region: string;
  setRegion: (v: string) => void;
  regionOptions: Option[];
  semantic: boolean;
  setSemantic: (v: boolean) => void;
  /** Busca por imagem: ícone dentro do campo (a busca é uma só). */
  searchByImage?: React.ReactNode;
}> = ({
  search,
  setSearch,
  region,
  setRegion,
  regionOptions,
  semantic,
  setSemantic,
  searchByImage,
}) => {
  const { t } = useTranslation();
  const hasQuery = !!search.trim();
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2 min-w-0">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          id="ref-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('references.searchPlaceholder')}
          className={cn(
            'pl-9 bg-input border-border text-sm h-9',
            hasQuery ? 'pr-32' : searchByImage ? 'pr-10' : 'pr-3'
          )}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Significado (IA) vs exata (substring). Só faz sentido com texto. */}
          {hasQuery && (
            <button
              type="button"
              onClick={() => setSemantic(!semantic)}
              title={semantic ? t('references.semanticTitle') : t('references.exactTitle')}
              className="rounded-full bg-muted px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {semantic ? t('references.semantic') : t('references.exact')}
            </button>
          )}
          {searchByImage}
        </div>
      </div>
      <div className="min-w-0 md:w-44 md:shrink-0">
        <Select
          options={regionOptions}
          value={region}
          onChange={setRegion}
          placeholder={t('references.regionPlaceholder')}
        />
      </div>
    </div>
  );
};

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
  const { t, locale } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  // Thumb que falha cai pra imagem cheia; se ela também falhar, o Thumb mostra o
  // estado quebrado dentro da MESMA caixa (nunca borrão eterno nem tile vazio).
  const [useFull, setUseFull] = useState(false);
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const thumbSrc = item.thumbnailUrl || item.referenceImageUrl;
  const src = useFull ? item.referenceImageUrl : thumbSrc;
  const placeholder = useThumbPlaceholder(item.thumbHash);
  const title = refTitle(item, locale, t('references.fallbackTitle'));
  const showQuickActions = typeof item.score !== 'number' && !selectionActive;

  useEffect(() => {
    if (focused)
      cardRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [focused, reduce]);

  return (
    <MediaTile
      ref={cardRef}
      layout="masonry"
      src={src}
      alt={title}
      // LQIP: o thumbhash pinta o fundo do <img> até a imagem carregar.
      placeholder={placeholder ?? undefined}
      onImageLoad={() => setLoaded(true)}
      // Thumb que falha cai pra imagem cheia; se ela também falhar, o Thumb
      // mostra o estado quebrado na mesma caixa.
      onImageError={() => {
        if (!useFull && item.referenceImageUrl && item.referenceImageUrl !== thumbSrc) {
          setUseFull(true);
        }
      }}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        onContextMenu(e.clientX, e.clientY);
      }}
      // Reserva a caixa com a proporção REAL (gravada no ingest por
      // extractImageFacts); sem ela, 4/5 até carregar e depois a natural.
      aspectRatio={item.aspectRatio || (loaded ? undefined : '4 / 5')}
      title={title}
      subtitle={item.country ? countryName(item.country, locale) : undefined}
      actionLabel={
        selectionActive ? `${selected ? 'Desmarcar' : 'Selecionar'} ${title}` : `Abrir ${title}`
      }
      // Só vira toggle em modo seleção: fora dele o clique abre o lightbox.
      selected={selectionActive ? !!selected : undefined}
      onClick={(e) => {
        // Once anything is selected, clicking a card toggles it (fast multi-select).
        if (selectionActive) onToggleSelect?.(e.shiftKey);
        else onOpen();
      }}
      // Em modo seleção o toggle fica sempre à vista (sem depender de hover).
      actionsVisible={selectionActive ? 'always' : 'hover'}
      className={cn(
        focused && !selected && 'border-ring',
        // In select-mode, dim what isn't chosen so the mode is unmistakable.
        selectionActive && !selected && 'opacity-55 hover:opacity-100'
      )}
      badge={
        (selected || typeof item.score === 'number' || dupe) && (
          <>
            {selected && (
              <Badge variant="neutral" className="px-1 text-foreground">
                <CheckSquare className="h-3.5 w-3.5" aria-hidden />
              </Badge>
            )}
            {typeof item.score === 'number' && (
              <Badge variant="neutral" className="tabular-nums">
                {Math.round(item.score * 100)}%
              </Badge>
            )}
            {/* Admin-only: identical bytes ingested more than once (the library
                  predates ingest dedup). Neutral = the copy that survives a dedupe,
                  destructive = the copy that gets deleted. */}
            {dupe && (
              <Badge
                variant={dupe.isKeeper ? 'neutral' : 'destructive'}
                className="tabular-nums"
                aria-label={
                  dupe.isKeeper
                    ? `${dupe.count} cópias idênticas. Esta é a mais antiga e fica.`
                    : `${dupe.count} cópias idênticas. Esta sai na limpeza.`
                }
              >
                {dupe.isKeeper ? `×${dupe.count}` : 'dup'}
              </Badge>
            )}
          </>
        )
      }
      actions={
        <>
          {/* Select toggle — sibling of the main action (no nested <button>). */}
          {onToggleSelect && (
            <Button
              variant="surface"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(e.shiftKey);
              }}
              title={selected ? t('references.deselect') : t('references.select')}
              aria-label={selected ? t('references.deselect') : t('references.select')}
              aria-pressed={selected}
            >
              {selected ? <CheckSquare /> : <Square />}
            </Button>
          )}
          {showQuickActions && (
            <>
              <Button
                variant="surface"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSimilar();
                }}
                title={t('references.viewSimilar')}
                aria-label={t('references.viewSimilar')}
              >
                <Images />
              </Button>
              {onRemove ? (
                <Button
                  variant="surface"
                  size="icon-sm"
                  className="hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  title={t('references.removeFromCollection')}
                  aria-label={t('references.removeFromCollection')}
                >
                  <X />
                </Button>
              ) : onSave ? (
                <Button
                  variant="surface"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSave();
                  }}
                  title={t('references.saveToCollection')}
                  aria-label={t('references.saveToCollection')}
                >
                  <Bookmark />
                </Button>
              ) : null}
            </>
          )}
        </>
      }
    />
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

const FirstRun: React.FC<{ onUpload: () => void }> = ({ onUpload }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="h-14 w-14 grid place-items-center rounded-xl bg-card ring-1 ring-border">
        <ImageIcon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{t('references.firstRunTitle')}</h3>
      <Button size="sm" variant="primary" className="text-xs mt-1" onClick={onUpload}>
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        {t('references.firstRunCta')}
      </Button>
    </div>
  );
};

const NoResults: React.FC<{ onClear: () => void }> = ({ onClear }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <Search className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{t('references.noResults')}</p>
      <Button
        variant="outline"
        size="sm"
        className="bg-card border-border text-xs"
        onClick={onClear}
      >
        <X className="h-3.5 w-3.5 mr-1.5" />
        {t('references.clearFilters')}
      </Button>
    </div>
  );
};

export default ReferencesPage;
