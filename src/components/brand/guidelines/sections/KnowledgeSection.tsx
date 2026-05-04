import React, { useEffect, useState, useRef, useCallback } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Button } from '@/components/ui/button';
import { BookOpen, FileText, Image as ImageIcon, Link2, Type, Trash2, Upload, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { brandGuidelineApi, type BrandKnowledgeFile } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';

interface KnowledgeSectionProps {
  guideline: BrandGuideline;
  span?: string;
}

const SOURCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pdf: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  image: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  url: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  text: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
};

const sourceIcon = (source: BrandKnowledgeFile['source'], size = 14) => {
  const color = SOURCE_COLORS[source]?.text || 'text-neutral-400';
  switch (source) {
    case 'pdf': return <FileText size={size} className={color} />;
    case 'image': return <ImageIcon size={size} className={color} />;
    case 'url': return <Link2 size={size} className={color} />;
    case 'text': return <Type size={size} className={color} />;
  }
};

const relativeDate = (iso: string) => {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d atrás`;
    const months = Math.floor(days / 30);
    return `${months}m atrás`;
  } catch {
    return iso;
  }
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });

export const KnowledgeSection: React.FC<KnowledgeSectionProps> = ({ guideline, span }) => {
  const [files, setFiles] = useState<BrandKnowledgeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!guideline.id) return;
      setLoading(true);
      try {
        const list = await brandGuidelineApi.listKnowledge(guideline.id);
        if (active) setFiles(list);
      } catch (err: any) {
        if (active) toast.error(err?.message || 'Falha ao carregar arquivos');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [guideline.id]);

  const handleUpload = useCallback(async (fileList: File[]) => {
    if (!guideline.id || uploading || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const file of fileList) {
        const base64 = await fileToBase64(file);
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const source = ext === 'pdf' ? 'pdf' : 'image';
        const result = await brandGuidelineApi.uploadKnowledge(guideline.id, {
          source,
          data: base64,
          filename: file.name,
        });
        setFiles(prev => [result, ...prev]);
      }
      toast.success(`${fileList.length} arquivo${fileList.length > 1 ? 's' : ''} enviado${fileList.length > 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao enviar arquivo');
    } finally {
      setUploading(false);
    }
  }, [guideline.id, uploading]);

  const handleDelete = async (file: BrandKnowledgeFile) => {
    if (!guideline.id) return;
    if (!confirm(`Remover "${file.fileName}" da memória da marca?`)) return;
    setDeletingId(file.id);
    try {
      await brandGuidelineApi.deleteKnowledge(guideline.id, file.id);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      toast.success('Arquivo removido');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao remover arquivo');
    } finally {
      setDeletingId(null);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length) handleUpload(selected);
    e.target.value = '';
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      /\.(pdf|png|jpe?g|webp)$/i.test(f.name)
    );
    if (dropped.length) handleUpload(dropped);
  };

  const maxVectors = Math.max(1, ...files.map(f => f.vectorIds.length));

  return (
    <SectionBlock
      id="knowledge"
      span={span as any}
      icon={<BookOpen size={14} />}
      title="Brand Knowledge"
      actions={
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-neutral-500 hover:text-white"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload file"
        >
          {uploading ? (
            <span className="animate-spin inline-block w-3 h-3 border border-neutral-400 border-t-transparent rounded-full" />
          ) : (
            <Plus size={12} />
          )}
        </Button>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        multiple
        className="hidden"
        onChange={onFileInputChange}
      />

      <div
        className={`min-h-[100px] rounded-xl transition-all ${
          dragging
            ? 'ring-2 ring-blue-500/40 bg-blue-500/5 border-blue-500/30'
            : ''
        }`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="animate-spin inline-block w-4 h-4 border-2 border-neutral-600 border-t-neutral-300 rounded-full" />
          </div>
        ) : files.length === 0 ? (
          /* Empty state */
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center py-10 gap-3 rounded-xl border border-dashed border-white/10 hover:border-white/20 bg-neutral-950/30 transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <Upload size={18} className="text-neutral-500" />
            </div>
            <div className="text-center">
              <p className="text-xs text-neutral-300 font-medium">
                Arraste arquivos ou clique para enviar
              </p>
              <p className="text-[10px] text-neutral-500 font-mono mt-1">
                PDF, PNG, JPG, WEBP
              </p>
            </div>
            <p className="text-[10px] text-neutral-600 max-w-[220px] text-center leading-relaxed">
              Arquivos alimentam o motor de geração IA da marca — quanto mais contexto, melhor o output.
            </p>
          </button>
        ) : (
          /* File cards grid */
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {files.map((file) => {
              const colors = SOURCE_COLORS[file.source] || SOURCE_COLORS.text;
              const barWidth = Math.max(10, (file.vectorIds.length / maxVectors) * 100);

              return (
                <div
                  key={file.id}
                  className="group relative flex flex-col gap-2 p-3 rounded-xl border border-white/[0.06] bg-neutral-950/50 hover:border-white/[0.12] transition-all"
                >
                  {/* Header: icon + source badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0`}>
                        {sourceIcon(file.source, 13)}
                      </div>
                      <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} ${colors.border} border`}>
                        {file.source}
                      </span>
                    </div>
                    {/* Delete — hover only */}
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => handleDelete(file)}
                      disabled={deletingId === file.id}
                      className="p-1 opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all h-auto"
                      aria-label={`Remover ${file.fileName}`}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>

                  {/* Filename */}
                  <p className="text-xs text-neutral-200 font-medium truncate leading-tight">
                    {file.fileName}
                  </p>

                  {/* Vector bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors.bg.replace('/10', '/30')}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500 whitespace-nowrap">
                      {file.vectorIds.length} vec
                    </span>
                  </div>

                  {/* Date */}
                  <p className="text-[10px] text-neutral-600 font-mono">
                    {relativeDate(file.addedAt)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionBlock>
  );
};
