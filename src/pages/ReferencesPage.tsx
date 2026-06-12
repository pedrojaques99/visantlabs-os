import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
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
  referencesApi,
  type ReferenceItem,
  type ReferenceFacets,
  type ReferenceUploadInput,
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
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const [scope, setScope] = useState<'library' | 'mine'>('library');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [activeTag, setActiveTag] = useState('');

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
  const hasActiveFilters = !!(debouncedSearch || country || region || activeTag);
  const grid = similar ? similar.items : items;

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
    [scope, debouncedSearch, country, region, activeTag]
  );

  // facets once
  useEffect(() => {
    referencesApi.facets().then(setFacets).catch(() => {});
  }, []);

  // debounce the search box (instant search)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => clearTimeout(t);
  }, [search]);

  // re-query on any filter/scope change (unless in similarity mode)
  useEffect(() => {
    if (similar) return;
    loadList(1, false);
  }, [scope, debouncedSearch, country, region, activeTag, similar, reloadNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || similar) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && !isLoadingMore && pageRef.current < pages) {
          loadList(pageRef.current + 1, true);
        }
      },
      { rootMargin: '600px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [pages, isLoading, isLoadingMore, similar, loadList]);

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
    setSimilarLoading(true);
    setSimilar({ label: `parecidas com "${ref.name}"`, items: [] });
    try {
      const data = await referencesApi.similarTo(ref.id, 40);
      setSimilar({ label: `parecidas com "${ref.name}"`, items: data.references });
      if (data.references.length === 0) toast.info('Sem parecidas ainda — popule mais a biblioteca');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao buscar parecidas');
      setSimilar(null);
    } finally {
      setSimilarLoading(false);
    }
  }, []);

  const clearSimilar = () => setSimilar(null);

  // ── Drag & paste to search ─────────────────────────────────────
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
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
      else if (e.key === 'ArrowRight') setLightboxIndex((i) => (i === null ? i : Math.min(grid.length - 1, i + 1)));
      else if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, grid.length]);

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
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
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
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                {similarLoading ? 'Buscando parecidas...' : `${similar.items.length} · ${similar.label}`}
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

        {/* Scope toggle + filters */}
        {!similar && (
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {(['library', 'mine'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      if (s === 'mine' && !authService.isAuthenticated()) {
                        toast.error('Faça login para ver suas referências');
                        return;
                      }
                      setScope(s);
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors',
                      scope === s ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    {s === 'library' ? 'Biblioteca' : 'Minhas refs'}
                  </button>
                ))}
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
        {error ? (
          <ErrorState onRetry={() => loadList(1, false)} />
        ) : (isLoading || similarLoading) && grid.length === 0 ? (
          <MasonrySkeleton cols={cols} />
        ) : grid.length === 0 ? (
          hasActiveFilters ? (
            <NoResults
              onClear={() => {
                setSearch('');
                setCountry('');
                setRegion('');
                setActiveTag('');
              }}
            />
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
                    onOpen={() => setLightboxIndex(idx)}
                    onSimilar={() => runSimilarTo(item)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Infinite-scroll sentinel */}
        {!similar && <div ref={sentinelRef} className="h-1" />}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-6 gap-2 text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Carregando mais...</span>
          </div>
        )}
        {!similar && grid.length > 0 && page >= pages && (
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
              referencesApi.facets().then(setFacets).catch(() => {});
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
              <Sparkles className="h-8 w-8" />
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
      />
    </div>
  );
};

// ─── Filter controls (shared desktop/mobile) ─────────────────────

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
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome, estúdio, descrição..."
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
}> = ({ item, onOpen, onSimilar }) => {
  const [loaded, setLoaded] = useState(false);
  const flag = countryFlag(item.country);
  const src = item.thumbnailUrl || item.referenceImageUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '120px' }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="group relative">
        <button
          onClick={onOpen}
          className="block w-full text-left rounded-xl overflow-hidden bg-neutral-900 ring-1 ring-white/5 hover:ring-white/15 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
        >
          <div className="relative" style={{ aspectRatio: loaded ? undefined : '4 / 5' }}>
            {!loaded && <div className="absolute inset-0 animate-pulse bg-neutral-800/50" />}
            <img
              src={src}
              alt={item.name}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              className={cn(
                'w-full h-auto block transition-all duration-700 ease-out',
                loaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-md scale-105'
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
              <span className="absolute top-2 left-2 text-base leading-none drop-shadow" title={item.country}>
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
        {/* "Parecidas" quick action */}
        <button
          onClick={onSimilar}
          title="Ver parecidas"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 grid place-items-center rounded-full bg-black/70 backdrop-blur text-neutral-200 hover:text-brand-cyan"
          style={{ display: typeof item.score === 'number' ? 'none' : undefined }}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </button>
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
}> = ({ items, index, onClose, onNav, onSimilar }) => {
  const item = index !== null ? items[index] : null;
  const prov = item?.provenance || {};
  const flag = item ? countryFlag(item.country) : '';

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
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                src={item.referenceImageUrl}
                alt={item.name}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            </div>

            {/* Meta panel */}
            <div className="lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-neutral-950/60 p-5 sm:p-6 overflow-y-auto space-y-4">
              <div>
                <h3 className="text-base font-semibold text-white leading-snug">{item.name}</h3>
                {item.studio && <p className="text-xs font-mono text-neutral-400 mt-0.5">{item.studio}</p>}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {item.country && (
                  <Badge className="bg-neutral-800 text-neutral-200 border-neutral-700 text-[11px]">
                    {flag ? <span className="mr-1">{flag}</span> : <MapPin className="h-3 w-3 mr-1" />}
                    {item.country}
                    {prov.countryInferred && <span className="ml-1 text-neutral-500">(IA)</span>}
                  </Badge>
                )}
                {item.region && (
                  <Badge variant="outline" className="border-neutral-700 text-neutral-400 text-[11px]">
                    <Globe className="h-3 w-3 mr-1" />
                    {REGION_LABELS[item.region] || item.region}
                  </Badge>
                )}
                {prov.year && (
                  <Badge variant="outline" className="border-neutral-700 text-neutral-400 text-[11px]">
                    {prov.year}
                  </Badge>
                )}
                {prov.awardSource && (
                  <Badge variant="outline" className="border-neutral-700 text-neutral-400 text-[11px]">
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
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">Descrição</span>
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
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Ver parecidas
                </Button>
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
  const columns = Array.from({ length: cols }, (_, ci) => heights.filter((_, i) => i % cols === ci));
  return (
    <div className="flex gap-3 items-start">
      {columns.map((col, ci) => (
        <div key={ci} className="flex-1 min-w-0 flex flex-col gap-3">
          {col.map((h, i) => (
            <div key={i} className="rounded-xl bg-neutral-900/60 animate-pulse" style={{ height: h }} />
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
    <Button size="sm" className="bg-brand-cyan text-black hover:bg-brand-cyan/80 text-xs mt-1" onClick={onUpload}>
      <Upload className="h-3.5 w-3.5 mr-1.5" />
      Subir primeira referência
    </Button>
  </div>
);

const NoResults: React.FC<{ onClear: () => void }> = ({ onClear }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
    <Search className="h-8 w-8 text-neutral-700" />
    <p className="text-sm text-neutral-400">Nenhuma referência para esse filtro</p>
    <Button variant="outline" size="sm" className="bg-neutral-900 border-neutral-700 text-xs" onClick={onClear}>
      <X className="h-3.5 w-3.5 mr-1.5" />
      Limpar filtros
    </Button>
  </div>
);

const ErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
    <AlertTriangle className="h-8 w-8 text-amber-500/80" />
    <p className="text-sm text-neutral-400">Não foi possível carregar as referências</p>
    <Button variant="outline" size="sm" className="bg-neutral-900 border-neutral-700 text-xs" onClick={onRetry}>
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
          <DialogTitle className="text-sm font-mono text-neutral-300">Subir referências</DialogTitle>
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
              <label className="text-[10px] font-mono text-neutral-500 uppercase">País (opcional)</label>
              <Select options={COUNTRY_OPTIONS} value={country} onChange={setCountry} placeholder="Auto (IA)" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">Designer / Estúdio</label>
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
              <label className="text-[10px] font-mono text-neutral-500 uppercase">Fonte (URL)</label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="bg-neutral-900 border-neutral-700 text-sm h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-neutral-500 uppercase">Award / Arquivo</label>
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
            <span className="text-xs text-neutral-400">Tornar pública na biblioteca compartilhada</span>
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
