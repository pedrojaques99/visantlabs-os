import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Upload,
  Search,
  Trash2,
  Image as ImageIcon,
  RefreshCw,
  X,
  BarChart2,
  Copy,
  Pencil,
  Save,
  Eye,
  Loader2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/dialog';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { authService } from '@/services/authService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Reference {
  id: string;
  name: string;
  studio?: string;
  description: string;
  referenceImageUrl: string;
  dimensions: Record<string, string[]>;
  tags: string[];
  prompt: string;
  createdAt: string;
}

interface RefsResponse {
  references: Reference[];
  total: number;
  page: number;
  pages: number;
}

interface RefStats {
  totalRefs: number;
  byDimension: Record<string, Array<{ _id: string; count: number }>>;
  recentlyAdded: Array<{ id: string; name: string; createdAt: string }>;
  retrieval: { totalGenerationsWithRefs: number; totalRefsServed: number };
  ingestCost?: {
    totalUSD: number;
    inputTokens: number;
    outputTokens: number;
    r2StorageMB: number;
    apiCalls: number;
    recordsTracked: number;
  };
}

const DIMENSION_KEYS = [
  'niche',
  'aesthetic',
  'vibe',
  'lighting',
  'texture',
  'material',
  'angle',
  'color_mood',
  'mockup_type',
] as const;

const DIMENSION_LABELS: Record<string, string> = {
  niche: 'Nicho',
  aesthetic: 'Estética',
  vibe: 'Vibe',
  lighting: 'Iluminação',
  texture: 'Textura',
  material: 'Material',
  angle: 'Ângulo',
  color_mood: 'Mood',
  mockup_type: 'Tipo',
};

const authHeaders = () => ({ Authorization: `Bearer ${authService.getToken()}` });

const PAGE_SIZE = 30;

export const AdminReferenceLibrary: React.FC = () => {
  const [refs, setRefs] = useState<Reference[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedRef, setSelectedRef] = useState<Reference | null>(null);
  const [stats, setStats] = useState<RefStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);

  const fetchRefs = useCallback(
    async (p = 1, append = false) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      try {
        const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
        if (search) params.set('search', search);
        for (const [key, val] of Object.entries(activeFilters)) {
          if (val) params.set(key, val);
        }
        const resp = await fetch(`/api/admin/references?${params}`, { headers: authHeaders() });
        if (!resp.ok) throw new Error('Failed to fetch');
        const data: RefsResponse = await resp.json();
        if (append) {
          setRefs((prev) => {
            const existingIds = new Set(prev.map((r) => r.id));
            const fresh = data.references.filter((r) => !existingIds.has(r.id));
            return [...prev, ...fresh];
          });
        } else {
          setRefs(data.references);
        }
        setTotal(data.total);
        pageRef.current = data.page;
        setHasMore(data.page < data.pages);
        setHasLoaded(true);
      } catch {
        toast.error('Erro ao carregar referências');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [search, activeFilters]
  );

  // Re-fetch when filters change
  useEffect(() => {
    if (hasLoaded) fetchRefs(1);
  }, [activeFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          fetchRefs(pageRef.current + 1, true);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, fetchRefs]);

  const fetchStats = useCallback(async () => {
    try {
      const resp = await fetch('/api/admin/references/stats', { headers: authHeaders() });
      if (!resp.ok) throw new Error('Failed');
      setStats(await resp.json());
      setShowStats(true);
    } catch {
      toast.error('Erro ao carregar stats');
    }
  }, []);

  const handleUpload = useCallback(
    async (files: FileList) => {
      setIsUploading(true);
      try {
        const images: { data: string; name: string }[] = [];
        for (const file of Array.from(files).slice(0, 10)) {
          images.push({ data: await fileToBase64(file), name: file.name });
        }
        const resp = await fetch('/api/admin/references/ingest', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ images }),
        });
        if (!resp.ok) throw new Error('Upload failed');
        const data = await resp.json();
        toast.success(
          `${data.ingested} referência(s) ingerida(s)${
            data.failed ? `, ${data.failed} falha(s)` : ''
          }`
        );
        setRefs([]);
        fetchRefs(1);
      } catch {
        toast.error('Erro no upload');
      } finally {
        setIsUploading(false);
      }
    },
    [fetchRefs]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const resp = await fetch(`/api/admin/references/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (!resp.ok) throw new Error('Delete failed');
        toast.success('Referência removida');
        setRefs((prev) => prev.filter((r) => r.id !== id));
        setTotal((prev) => prev - 1);
        if (selectedRef?.id === id) setSelectedRef(null);
      } catch {
        toast.error('Erro ao remover');
      }
    },
    [selectedRef]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files);
    },
    [handleUpload]
  );

  if (!hasLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ImageIcon className="h-12 w-12 text-neutral-600" />
        <p className="text-neutral-400 text-sm">
          Biblioteca de referências visuais curadas para o agente de mockups
        </p>
        <Button
          onClick={() => fetchRefs(1)}
          variant="outline"
          size="sm"
          className="bg-neutral-800 border-neutral-700"
        >
          <RefreshCw className="h-3 w-3 mr-2" />
          Carregar Referências
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-neutral-700 rounded-xl p-6 text-center hover:border-neutral-700 transition-colors cursor-pointer"
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = 'image/*';
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) handleUpload(files);
          };
          input.click();
        }}
      >
        {isUploading ? (
          <div className="flex items-center justify-center gap-2 text-brand-cyan">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm">Analisando e ingerindo imagens com AI...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-neutral-400">
            <Upload className="h-8 w-8" />
            <span className="text-sm">Arraste imagens ou clique para upload (máx 10)</span>
            <span className="text-xs text-neutral-500">
              AI auto-extrai dimensões: nicho, estética, vibe, luz, textura, material, ângulo
            </span>
          </div>
        )}
      </div>

      {/* Search + Filters + Stats toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setRefs([]);
                fetchRefs(1);
              }
            }}
            placeholder="Buscar referências..."
            className="pl-9 bg-neutral-900 border-neutral-700 text-sm h-8"
          />
        </div>

        {DIMENSION_KEYS.map((key) =>
          activeFilters[key] ? (
            <Badge
              key={key}
              variant="secondary"
              className="cursor-pointer bg-brand-cyan/20 text-brand-cyan border-brand-cyan/30 text-[10px]"
              onClick={() => {
                const next = { ...activeFilters };
                delete next[key];
                setActiveFilters(next);
                setRefs([]);
              }}
            >
              {DIMENSION_LABELS[key]}: {activeFilters[key]}
              <X className="h-2.5 w-2.5 ml-1" />
            </Badge>
          ) : null
        )}

        <Button
          onClick={() => {
            setRefs([]);
            fetchRefs(1);
          }}
          size="sm"
          variant="outline"
          className="h-8 bg-neutral-800 border-neutral-700 text-xs"
        >
          <RefreshCw className={cn('h-3 w-3 mr-1', isLoading && 'animate-spin')} />
          {total > 0 ? `${total} refs` : 'Buscar'}
        </Button>

        <Button
          onClick={fetchStats}
          size="sm"
          variant="outline"
          className="h-8 bg-neutral-800 border-neutral-700 text-xs"
        >
          <BarChart2 className="h-3 w-3 mr-1" />
          Stats
        </Button>
      </div>

      {/* Analytics Panel */}
      {showStats && stats && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
              Analytics
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0 text-neutral-500"
              onClick={() => setShowStats(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total Refs" value={stats.totalRefs} />
            <StatCard label="Gerações c/ refs" value={stats.retrieval.totalGenerationsWithRefs} />
            <StatCard label="Refs servidas" value={stats.retrieval.totalRefsServed} />
          </div>

          {stats.ingestCost && stats.ingestCost.recordsTracked > 0 && (
            <div className="grid grid-cols-4 gap-3">
              <StatCard label="Custo Ingest" value={`$${stats.ingestCost.totalUSD.toFixed(4)}`} />
              <StatCard label="R2 Storage" value={`${stats.ingestCost.r2StorageMB} MB`} />
              <StatCard label="API Calls" value={stats.ingestCost.apiCalls} />
              <StatCard
                label="Tokens"
                value={`${(
                  (stats.ingestCost.inputTokens + stats.ingestCost.outputTokens) /
                  1000
                ).toFixed(0)}K`}
              />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {Object.entries(stats.byDimension).map(([key, items]) => (
              <div key={key} className="space-y-1">
                <span className="text-[10px] font-mono text-neutral-500 uppercase">
                  {DIMENSION_LABELS[key] || key}
                </span>
                <div className="flex flex-wrap gap-0.5">
                  {(items || []).slice(0, 5).map((item) => (
                    <Badge
                      key={item._id}
                      variant="outline"
                      className="text-[10px] px-1 py-0 border-neutral-700 text-neutral-400 cursor-pointer hover:border-neutral-700"
                      onClick={() => {
                        setActiveFilters((prev) => ({ ...prev, [key]: item._id }));
                        setRefs([]);
                      }}
                    >
                      {item._id} ({item.count})
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {isLoading &&
          refs.length === 0 &&
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
        {refs.map((ref) => (
          <Card
            key={ref.id}
            className="bg-neutral-900/50 border-neutral-800 overflow-hidden group cursor-pointer"
            onClick={() => setSelectedRef(ref)}
          >
            <div className="relative aspect-square bg-neutral-950">
              <img
                src={ref.referenceImageUrl}
                alt={ref.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Eye className="h-5 w-5 text-neutral-300" />
              </div>
            </div>
            <CardContent className="p-2 space-y-1">
              <p className="text-xs font-medium text-neutral-200 truncate">{ref.name}</p>
              {ref.studio && (
                <p className="text-[10px] font-mono text-neutral-500 truncate">{ref.studio}</p>
              )}
              <div className="flex flex-wrap gap-0.5">
                {ref.dimensions &&
                  Object.entries(ref.dimensions)
                    .slice(0, 4)
                    .map(
                      ([key, vals]) =>
                        Array.isArray(vals) &&
                        vals.slice(0, 1).map((v) => (
                          <Badge
                            key={`${key}-${v}`}
                            variant="outline"
                            className="text-[10px] px-1 py-0 border-neutral-700 text-neutral-400"
                          >
                            {v}
                          </Badge>
                        ))
                    )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />
      {isLoadingMore && (
        <div className="flex items-center justify-center py-4 gap-2 text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Carregando mais...</span>
        </div>
      )}
      {!hasMore && refs.length > 0 && (
        <p className="text-center text-[10px] text-neutral-600 py-2">
          {refs.length} de {total} referências
        </p>
      )}

      {/* Detail Modal */}
      {selectedRef && (
        <ReferenceDetailModal
          ref_={selectedRef}
          onClose={() => setSelectedRef(null)}
          onDelete={(id) => {
            handleDelete(id);
            setSelectedRef(null);
          }}
          onUpdate={(updated) => {
            setRefs((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setSelectedRef(updated);
          }}
        />
      )}
    </div>
  );
};

// ─── Detail Modal ────────────────────────────────────────────

interface DetailModalProps {
  ref_: Reference;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdate: (ref: Reference) => void;
}

const ReferenceDetailModal: React.FC<DetailModalProps> = ({
  ref_,
  onClose,
  onDelete,
  onUpdate,
}) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(ref_.name);
  const [description, setDescription] = useState(ref_.description);
  const [prompt, setPrompt] = useState(ref_.prompt);
  const [dimensions, setDimensions] = useState<Record<string, string[]>>(ref_.dimensions || {});
  const [dimInput, setDimInput] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(ref_.name);
    setDescription(ref_.description);
    setPrompt(ref_.prompt);
    setDimensions(ref_.dimensions || {});
    setEditing(false);
  }, [ref_.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const resp = await fetch(`/api/admin/references/${ref_.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, prompt, dimensions }),
      });
      if (!resp.ok) throw new Error('Save failed');
      const data = await resp.json();
      toast.success('Referência atualizada');
      onUpdate({ ...ref_, name, description, prompt, dimensions, ...data.updated });
      setEditing(false);
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const addDimensionTag = (key: string) => {
    const val = (dimInput[key] || '').trim().toLowerCase();
    if (!val) return;
    const current = dimensions[key] || [];
    if (current.includes(val)) return;
    setDimensions({ ...dimensions, [key]: [...current, val] });
    setDimInput({ ...dimInput, [key]: '' });
  };

  const removeDimensionTag = (key: string, val: string) => {
    const current = dimensions[key] || [];
    setDimensions({ ...dimensions, [key]: current.filter((v) => v !== val) });
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-neutral-950 border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono text-neutral-300">
            {editing ? 'Editar Referência' : 'Detalhes da Referência'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Image */}
          <div className="aspect-square bg-neutral-900 rounded-lg overflow-hidden">
            <img
              src={ref_.referenceImageUrl}
              alt={ref_.name}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Info */}
          <div className="space-y-3">
            {/* Name */}
            <div>
              <label className="text-[10px] font-mono text-neutral-500 uppercase">Nome</label>
              {editing ? (
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-neutral-900 border-neutral-700 text-sm h-8 mt-1"
                />
              ) : (
                <p className="text-sm text-neutral-200 mt-0.5">{ref_.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-mono text-neutral-500 uppercase">
                Descrição AI
              </label>
              {editing ? (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-md text-sm p-2 mt-1 text-neutral-200 resize-none"
                />
              ) : (
                <p className="text-xs text-neutral-400 mt-0.5 line-clamp-4">{ref_.description}</p>
              )}
            </div>

            {/* Prompt */}
            <div>
              <div className="flex items-center gap-1">
                <label className="text-[10px] font-mono text-neutral-500 uppercase">Prompt</label>
                {!editing && ref_.prompt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0 text-neutral-500 hover:text-brand-cyan"
                    onClick={() => {
                      navigator.clipboard.writeText(ref_.prompt);
                      toast.success('Prompt copiado');
                    }}
                  >
                    <Copy className="h-2.5 w-2.5" />
                  </Button>
                )}
              </div>
              {editing ? (
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={2}
                  placeholder="Prompt que gerou este mockup (se conhecido)"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-md text-sm p-2 mt-1 text-neutral-200 resize-none"
                />
              ) : (
                <p className="text-xs text-neutral-400 mt-0.5 italic">{ref_.prompt || '—'}</p>
              )}
            </div>

            {/* Metadata */}
            <div className="text-[10px] text-neutral-600 font-mono">
              ID: {ref_.id} · {new Date(ref_.createdAt).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>

        {/* Dimensions */}
        <div className="space-y-2 mt-2">
          <label className="text-[10px] font-mono text-neutral-500 uppercase">Dimensões</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {DIMENSION_KEYS.map((key) => (
              <div
                key={key}
                className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-2 space-y-1"
              >
                <span className="text-[10px] font-mono text-neutral-500 uppercase">
                  {DIMENSION_LABELS[key]}
                </span>
                <div className="flex flex-wrap gap-0.5">
                  {(dimensions[key] || []).map((val) => (
                    <Badge
                      key={val}
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1.5 py-0 border-neutral-700 text-neutral-300',
                        editing && 'cursor-pointer hover:border-destructive/50 hover:text-destructive'
                      )}
                      onClick={editing ? () => removeDimensionTag(key, val) : undefined}
                    >
                      {val}
                      {editing && <X className="h-2 w-2 ml-0.5" />}
                    </Badge>
                  ))}
                  {(dimensions[key] || []).length === 0 && !editing && (
                    <span className="text-[10px] text-neutral-600 italic">—</span>
                  )}
                </div>
                {editing && (
                  <div className="flex gap-1 mt-1">
                    <Input
                      value={dimInput[key] || ''}
                      onChange={(e) => setDimInput({ ...dimInput, [key]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addDimensionTag(key)}
                      placeholder="add..."
                      className="h-6 text-[10px] bg-neutral-950 border-neutral-700 flex-1"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-neutral-500"
                      onClick={() => addDimensionTag(key)}
                    >
                      +
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-800">
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive text-xs"
            onClick={() => onDelete(ref_.id)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Excluir
          </Button>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs bg-neutral-800 border-neutral-700"
                  onClick={() => {
                    setEditing(false);
                    setName(ref_.name);
                    setDescription(ref_.description);
                    setPrompt(ref_.prompt);
                    setDimensions(ref_.dimensions || {});
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="text-xs bg-brand-cyan text-black hover:bg-brand-cyan/80"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Salvar
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="text-xs bg-neutral-800 border-neutral-700"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Editar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Stat Card ───────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-center">
    <p className="text-lg font-bold text-brand-cyan">
      {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
    </p>
    <p className="text-[10px] font-mono text-neutral-500 uppercase">{label}</p>
  </div>
);

// ─── Helpers ─────────────────────────────────────────────────

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
