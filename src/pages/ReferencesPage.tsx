import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { authService } from '@/services/authService';
import { REGIONS, DESIGN_COUNTRIES, REGION_LABELS } from '@/lib/references/taxonomy';
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
  ...DESIGN_COUNTRIES.map((c) => ({ value: c, label: c })),
];

function fileToBase64(file: File): Promise<string> {
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

export const ReferencesPage: React.FC = () => {
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [scope, setScope] = useState<'library' | 'mine'>('library');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [activeTag, setActiveTag] = useState('');

  const [facets, setFacets] = useState<ReferenceFacets | null>(null);
  const [selected, setSelected] = useState<ReferenceItem | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Visual similarity mode
  const [similar, setSimilar] = useState<ReferenceItem[] | null>(null);
  const [similarLoading, setSimilarLoading] = useState(false);

  const searchByImageInput = useRef<HTMLInputElement>(null);

  const loadList = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      try {
        const data =
          scope === 'mine'
            ? await referencesApi.mine({ page: targetPage, limit: PAGE_SIZE })
            : await referencesApi.list({
                page: targetPage,
                limit: PAGE_SIZE,
                search: search || undefined,
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
      } catch {
        toast.error('Erro ao carregar referências');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [scope, search, country, region, activeTag]
  );

  // Load facets once
  useEffect(() => {
    referencesApi.facets().then(setFacets).catch(() => {});
  }, []);

  // Re-query when filters, scope, or an explicit refresh change (not in similarity mode)
  useEffect(() => {
    if (similar) return;
    loadList(1, false);
  }, [scope, country, region, activeTag, similar, reloadNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitSearch = () => {
    setSimilar(null);
    loadList(1, false);
  };

  const requireAuth = (): boolean => {
    if (!authService.isAuthenticated()) {
      toast.error('Faça login para enviar e buscar imagens');
      return false;
    }
    return true;
  };

  // ── Visual similarity ──────────────────────────────────────────
  const handleSearchByImage = useCallback(async (file: File) => {
    if (!requireAuth()) return;
    setSimilarLoading(true);
    setSimilar([]);
    try {
      const base64 = await fileToBase64(file);
      const data = await referencesApi.searchByImage(base64, { limit: 30 });
      setSimilar(data.references);
      if (data.references.length === 0) toast.info('Nenhuma referência parecida encontrada');
    } catch (e: any) {
      toast.error(e.message || 'Erro na busca por imagem');
      setSimilar(null);
    } finally {
      setSimilarLoading(false);
    }
  }, []);

  const clearSimilar = () => {
    setSimilar(null);
  };

  const grid = similar ?? items;

  return (
    <PageShell
      pageId="references"
      seoTitle="Reference Library — Visant Labs"
      seoDescription="Biblioteca curada de referências de design do mundo inteiro, filtrável por tag e por país de origem."
      microTitle="Library // References"
      title="Reference Library"
      description="Referências de design world-class, taggeadas por conteúdo e por país de origem. Suba uma imagem e o pipeline analisa, taggeia e popula a biblioteca — ou busque visualmente por imagens parecidas."
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
              if (f) handleSearchByImage(f);
              e.currentTarget.value = '';
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="bg-neutral-900 border-neutral-700 text-xs"
            onClick={() => {
              if (requireAuth()) searchByImageInput.current?.click();
            }}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Buscar por imagem
          </Button>
          <Button
            size="sm"
            className="bg-brand-cyan text-black hover:bg-brand-cyan/80 text-xs"
            onClick={() => {
              if (requireAuth()) setUploadOpen(true);
            }}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Subir referência
          </Button>
        </div>
      }
    >
      {/* Similarity banner */}
      {similar && (
        <div className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 px-4 py-2.5">
          <span className="flex items-center gap-2 text-xs text-brand-cyan">
            <Sparkles className="h-3.5 w-3.5" />
            {similarLoading
              ? 'Analisando imagem e buscando parecidas...'
              : `${similar.length} referência(s) visualmente parecida(s)`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-neutral-400 hover:text-neutral-200"
            onClick={clearSimilar}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        </div>
      )}

      {/* Scope toggle */}
      {!similar && (
        <div className="flex items-center gap-1 mb-4">
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
                scope === s
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300'
              )}
            >
              {s === 'library' ? 'Biblioteca' : 'Minhas refs'}
            </button>
          ))}
        </div>
      )}

      {/* Filter bar (library scope only) */}
      {!similar && scope === 'library' && (
        <div className="space-y-3 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
                placeholder="Buscar por nome, estúdio, descrição..."
                className="pl-9 bg-neutral-900 border-neutral-700 text-sm h-9"
              />
            </div>
            <div className="w-[180px]">
              <Select
                options={COUNTRY_OPTIONS}
                value={country}
                onChange={(v) => {
                  setCountry(v);
                  // Country implies region — clear region to avoid contradiction
                  if (v) setRegion('');
                }}
                placeholder="País"
              />
            </div>
            <div className="w-[180px]">
              <Select
                options={REGION_OPTIONS}
                value={region}
                onChange={(v) => {
                  setRegion(v);
                  if (v) setCountry('');
                }}
                placeholder="Região"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-9 bg-neutral-900 border-neutral-700 text-xs"
              onClick={submitSearch}
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1', isLoading && 'animate-spin')} />
              {total > 0 ? `${total} refs` : 'Buscar'}
            </Button>
          </div>

          {/* Tag facets */}
          {facets && facets.tags.length > 0 && (
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

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {(isLoading || similarLoading) &&
          grid.length === 0 &&
          Array.from({ length: 10 }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden animate-pulse"
            >
              <div className="aspect-square bg-neutral-800/50" />
              <div className="p-2 space-y-1.5">
                <div className="h-3 bg-neutral-800/50 rounded w-3/4" />
                <div className="h-2 bg-neutral-800/30 rounded w-1/2" />
              </div>
            </div>
          ))}

        {grid.map((ref) => (
          <Card
            key={ref.id}
            className="bg-neutral-900/50 border-neutral-800 overflow-hidden group cursor-pointer"
            onClick={() => setSelected(ref)}
          >
            <div className="relative aspect-square bg-neutral-950">
              <img
                src={ref.referenceImageUrl}
                alt={ref.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {ref.country && (
                <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/70 backdrop-blur px-2 py-0.5 text-[9px] font-mono text-neutral-200">
                  <MapPin className="h-2.5 w-2.5" />
                  {ref.country}
                </span>
              )}
              {typeof ref.score === 'number' && (
                <span className="absolute top-1.5 right-1.5 rounded-full bg-brand-cyan/90 px-2 py-0.5 text-[9px] font-mono text-black">
                  {Math.round(ref.score * 100)}%
                </span>
              )}
            </div>
            <CardContent className="p-2 space-y-1">
              <p className="text-xs font-medium text-neutral-200 truncate">{ref.name}</p>
              {ref.studio && (
                <p className="text-[10px] font-mono text-neutral-500 truncate">{ref.studio}</p>
              )}
              <div className="flex flex-wrap gap-0.5">
                {ref.dimensions &&
                  Object.values(ref.dimensions)
                    .flat()
                    .slice(0, 3)
                    .map((v, i) => (
                      <Badge
                        key={`${v}-${i}`}
                        variant="outline"
                        className="text-[10px] px-1 py-0 border-neutral-700 text-neutral-400"
                      >
                        {v}
                      </Badge>
                    ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {!isLoading && !similarLoading && grid.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <ImageIcon className="h-10 w-10 text-neutral-700" />
          <p className="text-sm text-neutral-400">Nenhuma referência encontrada</p>
          <p className="text-xs text-neutral-600 max-w-sm">
            Ajuste os filtros ou suba a primeira referência — o pipeline analisa e taggeia
            automaticamente.
          </p>
        </div>
      )}

      {/* Load more */}
      {!similar && page < pages && (
        <div className="flex justify-center mt-8">
          <Button
            variant="outline"
            size="sm"
            className="bg-neutral-900 border-neutral-700 text-xs"
            disabled={isLoadingMore}
            onClick={() => loadList(page + 1, true)}
          >
            {isLoadingMore ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Carregar mais ({items.length}/{total})
          </Button>
        </div>
      )}

      {uploadOpen && (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onDone={(madePublic) => {
            setUploadOpen(false);
            referencesApi.facets().then(setFacets).catch(() => {});
            setSimilar(null);
            // Show the user where their freshly-populated refs landed, and force a refresh
            setScope(madePublic ? 'library' : 'mine');
            setReloadNonce((n) => n + 1);
          }}
        />
      )}

      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
    </PageShell>
  );
};

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
          {/* Dropzone */}
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

          {/* Optional provenance */}
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

// ─── Detail Modal ────────────────────────────────────────────────

const DetailModal: React.FC<{ item: ReferenceItem; onClose: () => void }> = ({ item, onClose }) => {
  const prov = item.provenance || {};
  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-neutral-950 border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono text-neutral-300">{item.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="aspect-square bg-neutral-900 rounded-lg overflow-hidden">
            <img
              src={item.referenceImageUrl}
              alt={item.name}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-3">
            {item.studio && (
              <div>
                <span className="text-[10px] font-mono text-neutral-500 uppercase">Estúdio</span>
                <p className="text-sm text-neutral-200">{item.studio}</p>
              </div>
            )}

            {/* Provenance */}
            <div className="flex flex-wrap gap-1.5">
              {item.country && (
                <Badge className="bg-neutral-800 text-neutral-200 border-neutral-700 text-[11px]">
                  <MapPin className="h-3 w-3 mr-1" />
                  {item.country}
                  {prov.countryInferred && (
                    <span className="ml-1 text-neutral-500">(IA)</span>
                  )}
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

            <div>
              <span className="text-[10px] font-mono text-neutral-500 uppercase">Descrição</span>
              <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{item.description}</p>
            </div>

            {(item.sourceUrl || prov.sourceUrl) && (
              <a
                href={item.sourceUrl || prov.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-brand-cyan hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver fonte original
              </a>
            )}
          </div>
        </div>

        {/* Dimensions */}
        <div className="space-y-2 mt-2">
          <span className="text-[10px] font-mono text-neutral-500 uppercase">Dimensões</span>
          <div className="flex flex-wrap gap-1">
            {item.dimensions &&
              Object.entries(item.dimensions).flatMap(([key, vals]) =>
                Array.isArray(vals)
                  ? vals.map((v) => (
                      <Badge
                        key={`${key}-${v}`}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 border-neutral-700 text-neutral-300"
                      >
                        {v}
                      </Badge>
                    ))
                  : []
              )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReferencesPage;
