import React, { useState, useCallback } from 'react';
import { Upload, Search, Trash2, Image as ImageIcon, RefreshCw, X, Filter } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { MicroTitle } from '../ui/MicroTitle';
import { authService } from '@/services/authService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Reference {
  id: string;
  name: string;
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

const DIMENSION_KEYS = ['niche', 'aesthetic', 'vibe', 'lighting', 'texture', 'material', 'angle', 'color_mood', 'mockup_type'] as const;

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

export const AdminReferenceLibrary: React.FC = () => {
  const [refs, setRefs] = useState<Reference[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchRefs = useCallback(async (p = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (search) params.set('search', search);
      for (const [key, val] of Object.entries(activeFilters)) {
        if (val) params.set(key, val);
      }
      const resp = await fetch(`/api/admin/references?${params}`, {
        headers: { Authorization: `Bearer ${authService.getToken()}` },
      });
      if (!resp.ok) throw new Error('Failed to fetch');
      const data: RefsResponse = await resp.json();
      setRefs(data.references);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages);
      setHasLoaded(true);
    } catch {
      toast.error('Erro ao carregar referências');
    } finally {
      setIsLoading(false);
    }
  }, [search, activeFilters]);

  const handleUpload = useCallback(async (files: FileList) => {
    setIsUploading(true);
    try {
      const images: { data: string; name: string }[] = [];
      for (const file of Array.from(files).slice(0, 10)) {
        const base64 = await fileToBase64(file);
        images.push({ data: base64, name: file.name });
      }

      const resp = await fetch('/api/admin/references/ingest', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authService.getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      if (!resp.ok) throw new Error('Upload failed');
      const data = await resp.json();
      toast.success(`${data.ingested} referência(s) ingerida(s)${data.failed ? `, ${data.failed} falha(s)` : ''}`);
      fetchRefs(1);
    } catch {
      toast.error('Erro no upload');
    } finally {
      setIsUploading(false);
    }
  }, [fetchRefs]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const resp = await fetch(`/api/admin/references/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authService.getToken()}` },
      });
      if (!resp.ok) throw new Error('Delete failed');
      toast.success('Referência removida');
      setRefs(prev => prev.filter(r => r.id !== id));
      setTotal(prev => prev - 1);
    } catch {
      toast.error('Erro ao remover');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, [handleUpload]);

  if (!hasLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ImageIcon className="h-12 w-12 text-neutral-600" />
        <p className="text-neutral-400 text-sm">Biblioteca de referências visuais curadas para o agente de mockups</p>
        <Button onClick={() => fetchRefs(1)} variant="outline" size="sm" className="bg-neutral-800 border-neutral-700">
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
        className="border-2 border-dashed border-neutral-700 rounded-xl p-6 text-center hover:border-brand-cyan/50 transition-colors cursor-pointer"
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
            <span className="text-xs text-neutral-500">AI auto-extrai dimensões: nicho, estética, vibe, luz, textura, material, ângulo</span>
          </div>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchRefs(1)}
            placeholder="Buscar referências..."
            className="pl-9 bg-neutral-900 border-neutral-700 text-sm h-8"
          />
        </div>

        {DIMENSION_KEYS.map(key => (
          activeFilters[key] ? (
            <Badge
              key={key}
              variant="secondary"
              className="cursor-pointer bg-brand-cyan/20 text-brand-cyan border-brand-cyan/30 text-[10px]"
              onClick={() => {
                const next = { ...activeFilters };
                delete next[key];
                setActiveFilters(next);
              }}
            >
              {DIMENSION_LABELS[key]}: {activeFilters[key]}
              <X className="h-2.5 w-2.5 ml-1" />
            </Badge>
          ) : null
        ))}

        <Button onClick={() => fetchRefs(1)} size="sm" variant="outline" className="h-8 bg-neutral-800 border-neutral-700 text-xs">
          <RefreshCw className={cn("h-3 w-3 mr-1", isLoading && "animate-spin")} />
          {total > 0 ? `${total} refs` : 'Buscar'}
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {refs.map(ref => (
          <Card key={ref.id} className="bg-neutral-900/50 border-neutral-800 overflow-hidden group">
            <div className="relative aspect-square bg-neutral-950">
              <img
                src={ref.referenceImageUrl}
                alt={ref.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-neutral-300 line-clamp-2">{ref.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300 shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleDelete(ref.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <CardContent className="p-2 space-y-1">
              <p className="text-xs font-medium text-neutral-200 truncate">{ref.name}</p>
              <div className="flex flex-wrap gap-0.5">
                {ref.dimensions && Object.entries(ref.dimensions).slice(0, 4).map(([key, vals]) => (
                  Array.isArray(vals) && vals.slice(0, 1).map(v => (
                    <Badge
                      key={`${key}-${v}`}
                      variant="outline"
                      className="text-[8px] px-1 py-0 border-neutral-700 text-neutral-400 cursor-pointer hover:border-brand-cyan/50 hover:text-brand-cyan"
                      onClick={() => {
                        setActiveFilters(prev => ({ ...prev, [key]: v }));
                        fetchRefs(1);
                      }}
                    >
                      {v}
                    </Badge>
                  ))
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => fetchRefs(page - 1)}
            className="h-7 text-xs bg-neutral-800 border-neutral-700"
          >
            Anterior
          </Button>
          <span className="text-xs text-neutral-500">{page}/{pages}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => fetchRefs(page + 1)}
            className="h-7 text-xs bg-neutral-800 border-neutral-700"
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
};

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
