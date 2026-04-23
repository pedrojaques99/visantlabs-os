import React, { useState } from 'react';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Link2, ExternalLink, Unlink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';
import { FigmaImportModal } from '../FigmaImportModal';
import { Figma } from 'lucide-react';
import { Link } from 'react-router-dom';

// Figma logo SVG
const FigmaIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 24C10.208 24 12 22.208 12 20V16H8C5.792 16 4 17.792 4 20C4 22.208 5.792 24 8 24Z" fill="#0ACF83" />
    <path d="M4 12C4 9.792 5.792 8 8 8H12V16H8C5.792 16 4 14.208 4 12Z" fill="#A259FF" />
    <path d="M4 4C4 1.792 5.792 0 8 0H12V8H8C5.792 8 4 6.208 4 4Z" fill="#F24E1E" />
    <path d="M12 0H16C18.208 0 20 1.792 20 4C20 6.208 18.208 8 16 8H12V0Z" fill="#FF7262" />
    <path d="M20 12C20 14.208 18.208 16 16 16C13.792 16 12 14.208 12 12C12 9.792 13.792 8 16 8C18.208 8 20 9.792 20 12Z" fill="#1ABCFE" />
  </svg>
);

interface FigmaLinkSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const FigmaLinkSection: React.FC<FigmaLinkSectionProps> = ({ guideline, onUpdate, span }) => {
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [figmaUrl, setFigmaUrl] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    colors: any[];
    typography: any[];
    components: any[];
  }>({ colors: [], typography: [], components: [] });

  const isLinked = !!guideline.figmaFileUrl;

  const handleLink = async () => {
    const trimmedUrl = figmaUrl.trim();
    if (!trimmedUrl || !guideline.id) return;

    // Secure URL validation - parse and validate hostname
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      toast.error('URL inválida. Use uma URL do Figma (figma.com/file/... ou figma.com/design/...)');
      return;
    }

    const allowedHosts = ['figma.com', 'www.figma.com'];
    const isAllowedHost = allowedHosts.includes(parsedUrl.hostname);
    const path = parsedUrl.pathname || '';
    const isExpectedPath = path.startsWith('/file/') || path.startsWith('/design/');

    if (!isAllowedHost || !isExpectedPath) {
      toast.error('URL inválida. Use uma URL do Figma (figma.com/file/... ou figma.com/design/...)');
      return;
    }

    setIsLinking(true);
    try {
      const result = await brandGuidelineApi.linkFigmaFile(guideline.id, trimmedUrl);
      onUpdate({
        figmaFileUrl: result.figmaFileUrl,
        figmaFileKey: result.figmaFileKey,
      });
      setFigmaUrl('');
      toast.success('Arquivo Figma linkado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao linkar arquivo Figma');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!guideline.id) return;

    setIsUnlinking(true);
    try {
      await brandGuidelineApi.unlinkFigmaFile(guideline.id);
      onUpdate({
        figmaFileUrl: undefined,
        figmaFileKey: undefined,
        figmaSyncedAt: undefined,
      });
      toast.success('Arquivo Figma desvinculado');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao desvincular');
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleImportClick = async () => {
    if (!guideline.id) return;

    setIsPreviewing(true);
    try {
      const data = await brandGuidelineApi.previewFigmaFile(guideline.id);
      setPreviewData(data);
      setIsModalOpen(true);
    } catch (error: any) {
      if (error.needsToken) {
        toast.error('Token do Figma não configurado', {
          description: 'Vá em Perfil > Gerenciar para configurar seu token.',
          action: {
            label: 'Configurar',
            onClick: () => window.location.href = '/profile?tab=configuration'
          }
        });
      } else {
        toast.error(error.message || 'Erro ao carregar preview do Figma');
      }
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleOpenInFigma = () => {
    if (guideline.figmaFileUrl) {
      window.open(guideline.figmaFileUrl, '_blank');
    }
  };

  const formatSyncTime = (date?: string) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    return `${diffDays}d atrás`;
  };

  return (
    <SectionBlock
      id="figma"
      icon={<FigmaIcon size={14} />}
      title="Figma"
      span={span as any}
    >
      {isLinked ? (
        <div className="space-y-4">
          {/* Linked state */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Arquivo Linkado</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-neutral-300 truncate font-mono">
                  {guideline.figmaFileKey}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenInFigma}
                  className="h-5 w-5 text-neutral-500 hover:text-brand-cyan p-0"
                  title="Abrir no Figma"
                >
                  <ExternalLink size={10} />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="brand"
                size="sm"
                onClick={handleImportClick}
                disabled={isPreviewing}
                className="h-8 px-4 text-[10px] gap-1.5 bg-brand-cyan/20 hover:bg-brand-cyan text-brand-cyan hover:text-black border border-brand-cyan/30 transition-all font-bold shadow-[0_0_15px_rgba(0,186,242,0.1)] hover:shadow-[0_0_20px_rgba(0,186,242,0.2)]"
              >
                {isPreviewing ? <Loader2 size={12} className="animate-spin" /> : <Figma size={12} />}
                Importar do Figma
              </Button>
            </div>
          </div>

          <FigmaImportModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            guidelineId={guideline.id || ''}
            previewData={previewData}
            onImportComplete={() => {
              if (guideline.id) {
                // Trigger a refresh of the guideline data if needed
                // For now, onUpdate can be used or we let the parent handle it
                onUpdate({ figmaSyncedAt: new Date().toISOString() });
              }
            }}
          />

          {/* Sync status */}
          {guideline.figmaSyncedAt && (
            <div className="flex items-center gap-2 text-[10px] text-neutral-500">
              <RefreshCw size={10} className="text-green-500" />
              <span>Sync: {formatSyncTime(guideline.figmaSyncedAt)}</span>
            </div>
          )}

          {/* Unlink */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUnlink}
            disabled={isUnlinking}
            className="h-7 px-2 text-[10px] text-neutral-500 hover:text-red-400 hover:bg-red-500/10"
          >
            {isUnlinking ? <Loader2 size={10} className="animate-spin mr-1" /> : <Unlink size={10} className="mr-1" />}
            Desvincular
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Unlinked state */}
          <p className="text-[10px] text-neutral-500">
            Conecte um arquivo Figma para sincronizar cores, tipografia e tokens automaticamente.
          </p>

          <div className="flex gap-2">
            <Input
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="Cole a URL do arquivo Figma..."
              className="h-8 text-xs bg-white/[0.02] border-white/10 placeholder:text-neutral-600"
              onKeyDown={(e) => e.key === 'Enter' && handleLink()}
            />
            <Button
              onClick={handleLink}
              disabled={!figmaUrl.trim() || isLinking}
              size="sm"
              className="h-8 px-3 shrink-0 bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20 border border-brand-cyan/20"
            >
              {isLinking ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
            </Button>
          </div>

          <p className="text-[10px] text-neutral-600">
            O sync acontece automaticamente quando você abre o arquivo no plugin Figma.
          </p>
        </div>
      )}
    </SectionBlock>
  );
};
