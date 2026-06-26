import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
} from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { authService } from '@/services/authService';
import { REGIONS, DESIGN_COUNTRIES, REGION_LABELS, countryFlag } from '@/lib/references/taxonomy';
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
  type ReferenceCollection,
  type CollectionDetail,
  type TasteHint,
} from '@/services/referencesApi';

const PAGE_SIZE = 30;

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

/** Responsive column count for the JS masonry (stable on append — no reflow). */
function useColumns(): number {
  const get = () => {
    if (typeof window === 'undefined') return 4;
    const w = window.innerWidth;
    if (w < 640) return 2;
    if (w < 1024) return 3;
    if (w < 1280) return 4;
    return 5;
  };
  const [cols, setCols] = useState(get);
  useEffect(() => {
    const onResize = () => setCols(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return cols;
}

export const ReferencesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  // Read initial filter state from the URL once (shareable / back-button friendly).
  const initialDims: Record<string, string> = {};
  for (const k of DIMENSION_FILTER_KEYS) {
    const v = searchParams.get(k);
    if (v) initialDims[k] = v;
  }

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
  const [search, setSearch] = useState(searchParams.get('q') || '');
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
  const [saveTarget, setSaveTarget] = useState<ReferenceItem | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [taste, setTaste] = useState<TasteHint[]>([]);

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

  const cols = useColumns();
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
  const grid = collectionView ? collectionView.items : similar ? similar.items : items;

  // Round-robin distribution → each item keeps a fixed column, so appending
  // pages never reflows existing cards (Apple-smooth infinite feed).
  const columns = useMemo(() => {
    const out: Array<Array<{ item: ReferenceItem; idx: number }>> = Array.from(
      { length: cols },
      () => []
    );
    grid.forEach((item, idx) => out[idx % cols].push({ item, idx }));
    return out;
  }, [grid, cols]);

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
    [scope, debouncedSearch, country, region, activeTag, kind, dims]
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

  // debounce the search box (instant search)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => clearTimeout(t);
  }, [search]);

  // re-query on any filter/scope change (unless in similarity mode)
  useEffect(() => {
    if (similar || collectionView || scope === 'collections') return;
    loadList(1, false);
  }, [scope, debouncedSearch, country, region, activeTag, kind, dims, similar, collectionView, reloadNonce]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
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
        if (requireAuth()) setSaveTarget(grid[focusedIndex]);
      } else if (e.key === 'Escape') setFocusedIndex(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [grid, cols, focusedIndex, lightboxIndex, saveTarget, scope, collectionView]); // eslint-disable-line react-hooks/exhaustive-deps

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
              className="bg-neutral-900 border-neutral-700 text-xs"
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
              className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-2.5"
            >
              <span className="flex items-center gap-2 text-xs text-brand-cyan truncate">
                <ScanSearch className="h-3.5 w-3.5 shrink-0" />
                {similarLoading
                  ? 'Buscando parecidas...'
                  : `${similar.items.length} · ${similar.label}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-neutral-400 hover:text-neutral-200 shrink-0"
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
          <div className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs text-brand-cyan truncate">
              <Folder className="h-3.5 w-3.5 shrink-0" />
              {collectionView.collection.name} · {collectionView.items.length}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {collectionView.collection.isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-neutral-400 hover:text-red-400"
                  onClick={async () => {
                    if (!window.confirm('Apagar esta coleção?')) return;
                    try {
                      await collectionsApi.remove(collectionView.collection.id);
                      setCollectionView(null);
                      loadCollections();
                      toast.success('Coleção apagada');
                    } catch (e: any) {
                      toast.error(e.message || 'Erro ao apagar');
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-neutral-400 hover:text-neutral-200"
                onClick={() => setCollectionView(null)}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Coleções
              </Button>
            </div>
          </div>
        )}

        {/* Scope toggle + filters */}
        {!similar && !collectionView && (
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {(['library', 'collections', 'mine'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      if (s !== 'library' && !authService.isAuthenticated()) {
                        toast.error('Faça login para ver isso');
                        return;
                      }
                      setScope(s);
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors',
                      scope === s
                        ? 'bg-neutral-800 text-neutral-100'
                        : 'text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    {s === 'library' ? 'Biblioteca' : s === 'collections' ? 'Coleções' : 'Minhas refs'}
                  </button>
                ))}
                {/* Kind filter — logos vs mockups */}
                {scope === 'library' && (
                  <div className="ml-2 flex items-center gap-1 border-l border-neutral-800 pl-2">
                    {(['all', 'branding', 'mockup'] as const).map((k) => (
                      <button
                        key={k}
                        onClick={() => setKind(k)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors',
                          kind === k
                            ? 'bg-neutral-800 text-neutral-100'
                            : 'text-neutral-500 hover:text-neutral-300'
                        )}
                      >
                        {k === 'all' ? 'Tudo' : k === 'branding' ? 'Logos' : 'Mockups'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Mobile filter trigger */}
              {scope === 'library' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="md:hidden h-8 bg-neutral-900 border-neutral-700 text-xs"
                  onClick={() => setFilterSheet(true)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                  Filtros
                </Button>
              )}
            </div>

            {/* Desktop inline filters */}
            {scope === 'library' && <div className="hidden md:block">{filterControls}</div>}

            {/* Semantic suggestion — based on what the user has saved */}
            {scope === 'library' && !hasActiveFilters && taste.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-600">
                  Pra você
                </span>
                {taste.map((t) => (
                  <Badge
                    key={t.key + t.value}
                    variant="outline"
                    className="cursor-pointer border-brand-cyan/30 text-brand-cyan hover:bg-brand-cyan/10 text-[10px]"
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
                <span className="mr-1 text-[11px] font-mono text-neutral-500">
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
                {activeDimEntries.map(([k, v]) => (
                  <FilterChip key={k} label={v} onRemove={() => setDim(k, '')} />
                ))}
                <button
                  onClick={clearAllFilters}
                  className="ml-1 text-[10px] font-mono uppercase tracking-wider text-neutral-500 hover:text-brand-cyan transition-colors"
                >
                  Limpar tudo
                </button>
              </div>
            )}

            {/* Structured dimension facets — designer-friendly groups (additive) */}
            {scope === 'library' && facets?.dimensions && (
              <div className="hidden md:flex flex-col gap-1.5">
                {DIM_GROUPS_BY_KIND[kind].map((dk) => {
                  const vals = facets.dimensions?.[dk];
                  if (!vals || !vals.length) return null;
                  return (
                    <div key={dk} className="flex flex-wrap items-center gap-1.5">
                      <span className="w-[88px] shrink-0 text-[10px] font-mono uppercase tracking-wider text-neutral-600">
                        {DIM_LABELS[dk]}
                      </span>
                      {vals.slice(0, 10).map((v) => {
                        const active = dims[dk] === v.value;
                        return (
                          <Badge
                            key={v.value}
                            variant={active ? 'secondary' : 'outline'}
                            className={cn(
                              'cursor-pointer text-[10px]',
                              active
                                ? 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/30'
                                : 'border-neutral-800 text-neutral-400 hover:border-brand-cyan/40 hover:text-brand-cyan'
                            )}
                            onClick={() => setDim(dk, v.value)}
                          >
                            {v.value}
                            {active ? (
                              <X className="h-2.5 w-2.5 ml-1" />
                            ) : (
                              <span className="ml-1 text-neutral-600">{v.count}</span>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tag facets */}
            {scope === 'library' && facets && facets.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activeTag && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer bg-brand-cyan/20 text-brand-cyan border-brand-cyan/30 text-[10px]"
                    onClick={() => setActiveTag('')}
                  >
                    {activeTag}
                    <X className="h-2.5 w-2.5 ml-1" />
                  </Badge>
                )}
                {facets.tags
                  .filter((t) => t.value !== activeTag)
                  .slice(0, 18)
                  .map((t) => (
                    <Badge
                      key={t.value}
                      variant="outline"
                      className="cursor-pointer border-neutral-700 text-neutral-400 hover:border-brand-cyan/40 hover:text-brand-cyan text-[10px]"
                      onClick={() => setActiveTag(t.value)}
                    >
                      {t.value}
                      <span className="ml-1 text-neutral-600">{t.count}</span>
                    </Badge>
                  ))}
              </div>
            )}
          </div>
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
          <div className="flex gap-3 items-start">
            {columns.map((col, ci) => (
              <div key={ci} className="flex-1 min-w-0 flex flex-col gap-3">
                {col.map(({ item, idx }) => (
                  <MasonryCard
                    key={item.id}
                    item={item}
                    focused={idx === focusedIndex}
                    onOpen={() => setLightboxIndex(idx)}
                    onSimilar={() => runSimilarTo(item)}
                    onSave={() => requireAuth() && setSaveTarget(item)}
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
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Infinite-scroll sentinel */}
        {!similar && !collectionView && scope !== 'collections' && (
          <div ref={sentinelRef} className="h-1" />
        )}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-6 gap-2 text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Carregando mais...</span>
          </div>
        )}
        {!similar && !collectionView && scope !== 'collections' && grid.length > 0 && page >= pages && (
          <p className="text-center text-[10px] text-neutral-600 py-6">
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
            <DialogContent className="max-w-sm bg-neutral-950 border-neutral-800">
              <DialogHeader>
                <DialogTitle className="text-sm font-mono text-neutral-300">Filtros</DialogTitle>
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
            className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm pointer-events-none"
          >
            <div className="flex flex-col items-center gap-3 text-brand-cyan border-2 border-dashed border-brand-cyan/50 rounded-2xl px-12 py-10">
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
        onSave={(ref) => requireAuth() && setSaveTarget(ref)}
        similarSource={similar?.source}
      />

      {/* Save-to-collection dialog */}
      {saveTarget && (
        <SaveToCollectionDialog
          item={saveTarget}
          onClose={() => setSaveTarget(null)}
        />
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
      <div className="text-center py-20 text-sm text-neutral-500">
        Faça login para criar e ver suas coleções.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {creating ? (
        <div className="aspect-[4/3] rounded-xl border border-brand-cyan/30 bg-neutral-900 p-3 flex flex-col justify-center gap-2">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setCreating(false);
            }}
            placeholder="Nome da coleção"
            className="bg-neutral-950 border-neutral-700 text-sm h-9"
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
              className="text-xs text-neutral-400"
              onClick={() => setCreating(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="aspect-[4/3] rounded-xl border border-dashed border-neutral-700 hover:border-brand-cyan/50 text-neutral-500 hover:text-brand-cyan transition-colors flex flex-col items-center justify-center gap-2"
        >
          <FolderPlus className="h-6 w-6" />
          <span className="text-xs font-mono uppercase tracking-wider">Nova coleção</span>
        </button>
      )}

      {collections.map((c) => (
        <button
          key={c.id}
          onClick={() => onOpen(c.id)}
          className="group text-left rounded-xl overflow-hidden bg-neutral-900 ring-1 ring-white/5 hover:ring-white/15 transition-all hover:-translate-y-0.5"
        >
          <div className="aspect-[4/3] relative bg-neutral-800">
            {c.covers && c.covers.length > 1 ? (
              <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-px">
                {c.covers.slice(0, 4).map((u, i) => (
                  <img key={i} src={u} alt="" loading="lazy" className="w-full h-full object-cover" />
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
              <div className="w-full h-full grid place-items-center text-neutral-700">
                <Folder className="h-8 w-8" />
              </div>
            )}
          </div>
          <div className="p-2.5">
            <p className="text-xs font-medium text-neutral-200 truncate flex items-center gap-1">
              {!c.isPublic && <Lock className="h-3 w-3 text-neutral-500 shrink-0" />}
              {c.name}
            </p>
            <p className="text-[10px] font-mono text-neutral-500">
              {c.count} {c.count === 1 ? 'item' : 'itens'}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
};

const SaveToCollectionDialog: React.FC<{ item: ReferenceItem; onClose: () => void }> = ({
  item,
  onClose,
}) => {
  const [cols, setCols] = useState<ReferenceCollection[] | null>(null);
  const [creating, setCreating] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

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
    setCols((p) => p?.map((c) => (c.id === id ? { ...c, count: c.count + 1 } : c)) ?? p);
    try {
      await collectionsApi.addItem(id, item.id);
    } catch (e: any) {
      setSavedIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      setCols((p) => p?.map((c) => (c.id === id ? { ...c, count: Math.max(0, c.count - 1) } : c)) ?? p);
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
      <DialogContent className="max-w-sm bg-neutral-950 border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono text-neutral-300">Salvar em coleção</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-1.5 pt-1">
          <Input
            value={creating}
            onChange={(e) => setCreating(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createAndAdd();
            }}
            placeholder="Nova coleção..."
            className="bg-neutral-900 border-neutral-700 text-sm h-9"
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
            <p className="text-xs text-neutral-500 py-4 text-center">Carregando...</p>
          ) : cols.length === 0 ? (
            <p className="text-xs text-neutral-500 py-4 text-center">
              Nenhuma coleção ainda — crie a primeira acima.
            </p>
          ) : (
            cols.map((c) => (
              <button
                key={c.id}
                onClick={() => addTo(c.id)}
                disabled={savedIds.has(c.id)}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-neutral-900 text-left transition-colors"
              >
                <span className="flex items-center gap-2 text-sm text-neutral-200 truncate">
                  <Folder className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                  {c.name}
                </span>
                {savedIds.has(c.id) ? (
                  <Check className="h-4 w-4 text-brand-cyan shrink-0" />
                ) : (
                  <span className="text-[10px] font-mono text-neutral-600">{c.count}</span>
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Removable active-filter pill used in the summary bar.
const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <Badge
    variant="secondary"
    className="cursor-pointer bg-brand-cyan/20 text-brand-cyan border-brand-cyan/30 text-[10px]"
    onClick={onRemove}
  >
    {label}
    <X className="h-2.5 w-2.5 ml-1" />
  </Badge>
);

const FilterControls: React.FC<{
  search: string;
  setSearch: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
  region: string;
  setRegion: (v: string) => void;
}> = ({ search, setSearch, country, setCountry, region, setRegion }) => (
  <div className="flex flex-col md:flex-row md:items-center gap-2">
    <div className="relative flex-1 min-w-[200px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
      <Input
        id="ref-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome, estúdio, descrição...  ( / )"
        className="pl-9 bg-neutral-900 border-neutral-700 text-sm h-9"
      />
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
}> = ({ item, onOpen, onSimilar, onSave, onRemove, focused }) => {
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
      <div className="group relative" ref={cardRef}>
        <button
          onClick={onOpen}
          className={cn(
            'block w-full text-left rounded-xl overflow-hidden bg-neutral-900 ring-1 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] focus:outline-none',
            focused
              ? 'ring-2 ring-brand-cyan'
              : 'ring-white/5 hover:ring-white/15 focus-visible:ring-2 focus-visible:ring-brand-cyan/60'
          )}
        >
          <div className="relative" style={{ aspectRatio: loaded ? undefined : '4 / 5' }}>
            {/* LQIP: thumbhash if available, else a soft shimmer */}
            {!loaded &&
              (placeholder ? (
                <img src={placeholder} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 animate-pulse bg-neutral-800/50" />
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
              <p className="text-[11px] font-medium text-white truncate">{item.name}</p>
              {item.studio && (
                <p className="text-[10px] font-mono text-neutral-300 truncate">{item.studio}</p>
              )}
            </div>
            {flag && (
              <span
                className="absolute top-2 left-2 text-base leading-none drop-shadow"
                title={item.country}
              >
                {flag}
              </span>
            )}
            {typeof item.score === 'number' && (
              <span className="absolute top-2 right-2 rounded-full bg-brand-cyan/90 px-1.5 py-0.5 text-[9px] font-mono text-black">
                {Math.round(item.score * 100)}%
              </span>
            )}
          </div>
        </button>
        {/* Quick actions */}
        <div
          className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ display: typeof item.score === 'number' ? 'none' : undefined }}
        >
          <button
            onClick={onSimilar}
            title="Ver parecidas"
            className="h-7 w-7 grid place-items-center rounded-full bg-black/70 backdrop-blur text-neutral-200 hover:text-brand-cyan"
          >
            <Images className="h-3.5 w-3.5" />
          </button>
          {onRemove ? (
            <button
              onClick={onRemove}
              title="Remover da coleção"
              className="h-7 w-7 grid place-items-center rounded-full bg-black/70 backdrop-blur text-neutral-200 hover:text-red-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : onSave ? (
            <button
              onClick={onSave}
              title="Salvar em coleção"
              className="h-7 w-7 grid place-items-center rounded-full bg-black/70 backdrop-blur text-neutral-200 hover:text-brand-cyan"
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
  similarSource?: ReferenceItem;
}> = ({ items, index, onClose, onNav, onSimilar, onSave, similarSource }) => {
  const item = index !== null ? items[index] : null;
  const prov = item?.provenance || {};
  const flag = item ? countryFlag(item.country) : '';
  const reduce = useReducedMotion();

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
          className="fixed inset-0 z-[70] bg-neutral-950/95 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Close */}
          <button
            onClick={onClose}
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
              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-10 w-10 grid place-items-center rounded-full bg-neutral-900/80 text-neutral-300 hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          <div
            className="h-full w-full flex flex-col lg:flex-row items-stretch"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image */}
            <div className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8">
              <motion.img
                key={item.id}
                layoutId={`card-${item.id}`}
                transition={
                  reduce ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 32 }
                }
                src={item.referenceImageUrl}
                alt={item.name}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            </div>

            {/* Meta panel */}
            <div className="lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-neutral-950/60 p-5 sm:p-6 overflow-y-auto space-y-4">
              <div>
                <h3 className="text-base font-semibold text-white leading-snug">{item.name}</h3>
                {item.studio && (
                  <p className="text-xs font-mono text-neutral-400 mt-0.5">{item.studio}</p>
                )}
              </div>

              {/* Why it matches — shared dimensions with the similarity source */}
              {typeof item.score === 'number' &&
                similarSource &&
                (() => {
                  const shared = sharedDimensions(similarSource, item);
                  return shared.length ? (
                    <div className="rounded-lg border border-brand-cyan/20 bg-brand-cyan/5 p-3">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-brand-cyan/70 mb-1.5">
                        Por que combina
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {shared.map((s) => (
                          <Badge
                            key={s}
                            variant="outline"
                            className="border-brand-cyan/30 text-brand-cyan text-[10px]"
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
                  <Badge className="bg-neutral-800 text-neutral-200 border-neutral-700 text-[11px]">
                    {flag ? (
                      <span className="mr-1">{flag}</span>
                    ) : (
                      <MapPin className="h-3 w-3 mr-1" />
                    )}
                    {item.country}
                    {prov.countryInferred && <span className="ml-1 text-neutral-500">(IA)</span>}
                  </Badge>
                )}
                {item.region && (
                  <Badge
                    variant="outline"
                    className="border-neutral-700 text-neutral-400 text-[11px]"
                  >
                    <Globe className="h-3 w-3 mr-1" />
                    {REGION_LABELS[item.region] || item.region}
                  </Badge>
                )}
                {prov.year && (
                  <Badge
                    variant="outline"
                    className="border-neutral-700 text-neutral-400 text-[11px]"
                  >
                    {prov.year}
                  </Badge>
                )}
                {prov.awardSource && (
                  <Badge
                    variant="outline"
                    className="border-neutral-700 text-neutral-400 text-[11px]"
                  >
                    {prov.awardSource}
                  </Badge>
                )}
              </div>

              {prov.designer && (
                <div>
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">Designer</span>
                  <p className="text-sm text-neutral-300">{prov.designer}</p>
                </div>
              )}

              {item.description && (
                <div>
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">
                    Descrição
                  </span>
                  <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed line-clamp-6">
                    {item.description}
                  </p>
                </div>
              )}

              {item.dimensions && (
                <div className="flex flex-wrap gap-1">
                  {Object.values(item.dimensions)
                    .flat()
                    .slice(0, 12)
                    .map((v, i) => (
                      <Badge
                        key={`${v}-${i}`}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 border-neutral-800 text-neutral-400"
                      >
                        {v}
                      </Badge>
                    ))}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
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
                    className="bg-neutral-900 border-neutral-700 text-xs"
                    onClick={() => onSave(item)}
                  >
                    <Bookmark className="h-3.5 w-3.5 mr-1.5" />
                    Salvar em coleção
                  </Button>
                )}
                {(item.sourceUrl || prov.sourceUrl) && (
                  <a
                    href={item.sourceUrl || prov.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 text-xs text-neutral-400 hover:text-brand-cyan"
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
            <div
              key={i}
              className="rounded-xl bg-neutral-900/60 animate-pulse"
              style={{ height: h }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

const FirstRun: React.FC<{ onUpload: () => void }> = ({ onUpload }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
    <div className="h-14 w-14 grid place-items-center rounded-2xl bg-neutral-900 ring-1 ring-white/10">
      <ImageIcon className="h-7 w-7 text-neutral-500" />
    </div>
    <h3 className="text-lg font-semibold text-white">Sua biblioteca de referências</h3>
    <p className="text-sm text-neutral-500 max-w-md leading-relaxed">
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
    <Search className="h-8 w-8 text-neutral-700" />
    <p className="text-sm text-neutral-400">Nenhuma referência para esse filtro</p>
    <Button
      variant="outline"
      size="sm"
      className="bg-neutral-900 border-neutral-700 text-xs"
      onClick={onClear}
    >
      <X className="h-3.5 w-3.5 mr-1.5" />
      Limpar filtros
    </Button>
  </div>
);

const ErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
    <AlertTriangle className="h-8 w-8 text-amber-500/80" />
    <p className="text-sm text-neutral-400">Não foi possível carregar as referências</p>
    <Button
      variant="outline"
      size="sm"
      className="bg-neutral-900 border-neutral-700 text-xs"
      onClick={onRetry}
    >
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
      toast.success(
        `${res.ingested} referência(s) ingerida(s)${res.failed ? `, ${res.failed} falha(s)` : ''}`
      );
      onDone(isPublic);
    } catch (e: any) {
      toast.error(e.message || 'Erro no upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => !uploading && onClose()}>
      <DialogContent className="max-w-lg bg-neutral-950 border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono text-neutral-300">
            Subir referências
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            onClick={pick}
            className="border-2 border-dashed border-neutral-700 rounded-xl p-6 text-center hover:border-brand-cyan/40 transition-colors cursor-pointer"
          >
            <Upload className="h-7 w-7 mx-auto text-neutral-500 mb-2" />
            <p className="text-sm text-neutral-300">
              {files.length > 0
                ? `${files.length} imagem(ns) selecionada(s)`
                : 'Clique para selecionar imagens (máx 10)'}
            </p>
            <p className="text-[11px] text-neutral-600 mt-1">
              A IA extrai dimensões e infere a origem automaticamente. 1 crédito por imagem.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">
                País (opcional)
              </label>
              <Select
                options={COUNTRY_OPTIONS}
                value={country}
                onChange={setCountry}
                placeholder="Auto (IA)"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">
                Designer / Estúdio
              </label>
              <Input
                value={designer}
                onChange={(e) => setDesigner(e.target.value)}
                placeholder="ex: Pentagram"
                className="bg-neutral-900 border-neutral-700 text-sm h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">
                Fonte (URL)
              </label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="bg-neutral-900 border-neutral-700 text-sm h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">
                Award / Arquivo
              </label>
              <Input
                value={awardSource}
                onChange={(e) => setAwardSource(e.target.value)}
                placeholder="ex: D&AD 2024"
                className="bg-neutral-900 border-neutral-700 text-sm h-9"
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
            <span className="text-xs text-neutral-400">
              Tornar pública na biblioteca compartilhada
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
            <Button
              variant="outline"
              size="sm"
              className="bg-neutral-900 border-neutral-700 text-xs"
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
