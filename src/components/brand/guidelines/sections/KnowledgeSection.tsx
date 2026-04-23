import React, { useEffect, useState } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Button } from '@/components/ui/button';
import { BookOpen, FileText, Image as ImageIcon, Link2, Type, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { brandGuidelineApi, type BrandKnowledgeFile } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';

interface KnowledgeSectionProps {
  guideline: BrandGuideline;
  span?: string;
}

const sourceIcon = (source: BrandKnowledgeFile['source']) => {
  switch (source) {
    case 'pdf': return <FileText size={13} className="text-neutral-400" />;
    case 'image': return <ImageIcon size={13} className="text-neutral-400" />;
    case 'url': return <Link2 size={13} className="text-neutral-400" />;
    case 'text': return <Type size={13} className="text-neutral-400" />;
  }
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

export const KnowledgeSection: React.FC<KnowledgeSectionProps> = ({ guideline, span }) => {
  const [files, setFiles] = useState<BrandKnowledgeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  return (
    <SectionBlock
      id="knowledge"
      span={span as any}
      icon={<BookOpen size={14} />}
      title="Brand Knowledge"
    >
      {loading ? (
        <p className="text-xs text-neutral-500 font-mono">Carregando…</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-neutral-500 font-mono">
          Nenhum arquivo ingerido ainda. Envie PDFs, imagens ou URLs pelo Admin Chat vinculado a essa marca para alimentar a memória RAG.
        </p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 bg-neutral-950/40 border border-neutral-800/50 rounded-xl hover:border-neutral-700/60 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {sourceIcon(file.source)}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-200 font-medium truncate">{file.fileName}</p>
                  <p className="text-[10px] text-neutral-500 font-mono">
                    {file.source} · {file.vectorIds.length} vetor{file.vectorIds.length === 1 ? '' : 'es'} · {formatDate(file.addedAt)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                type="button"
                onClick={() => handleDelete(file)}
                disabled={deletingId === file.id}
                className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                aria-label={`Remover ${file.fileName}`}
              >
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SectionBlock>
  );
};
