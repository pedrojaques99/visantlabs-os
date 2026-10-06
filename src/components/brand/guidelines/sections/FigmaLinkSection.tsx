import React, { useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { SectionBlock } from '../SectionBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link2, ExternalLink, Unlink, RefreshCw } from '@/lib/ui/icons';
import { toast } from 'sonner';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import type { BrandGuideline } from '@/lib/figma-types';
import { FigmaImportModal } from '../FigmaImportModal';
import { Figma } from '@/lib/ui/icons';
import { Link } from 'react-router-dom';

import { GlitchLoader } from '@/components/ui/GlitchLoader';
interface FigmaLinkSectionProps {
  guideline: BrandGuideline;
  onUpdate: (data: Partial<BrandGuideline>) => void;
  span?: string;
}

export const FigmaLinkSection: React.FC<FigmaLinkSectionProps> = ({
  guideline,
  onUpdate,
  span,
}) => {
  const { t } = useTranslation();
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
      toast.error(t('brandEditor.figmaInvalidUrl'));
      return;
    }

    const allowedHosts = ['figma.com', 'www.figma.com'];
    const isAllowedHost = allowedHosts.includes(parsedUrl.hostname);
    const path = parsedUrl.pathname || '';
    const isExpectedPath = path.startsWith('/file/') || path.startsWith('/design/');

    if (!isAllowedHost || !isExpectedPath) {
      toast.error(t('brandEditor.figmaInvalidUrl'));
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
      toast.success(t('brandEditor.figmaLinked'));
    } catch (error: any) {
      toast.error(error.message || t('brandEditor.figmaLinkFailed'));
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
      toast.success(t('brandEditor.figmaUnlinked'));
    } catch (error: any) {
      toast.error(error.message || t('brandEditor.figmaUnlinkFailed'));
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
        toast.error(t('brandEditor.figmaNoToken'), {
          description: t('brandEditor.figmaNoTokenHint'),
          action: {
            label: t('brandEditor.configure'),
            onClick: () => (window.location.href = '/profile?tab=configuration'),
          },
        });
      } else {
        toast.error(error.message || t('brandEditor.figmaPreviewFailed'));
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

    if (diffMins < 1) return t('brandEditor.timeNow');
    if (diffMins < 60) return t('brandEditor.timeMinAgo', { n: diffMins });
    if (diffHours < 24) return t('brandEditor.timeHourAgo', { n: diffHours });
    return t('brandEditor.timeDayAgo', { n: diffDays });
  };

  return (
    <SectionBlock id="figma" icon={<Figma size={14} />} title="Figma" span={span as any}>
      {isLinked ? (
        <div className="space-y-4">
          {/* Linked state */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">
                {t('brandEditor.figmaLinkedFile')}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-foreground truncate font-mono">
                  {guideline.figmaFileKey}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenInFigma}
                  className="h-5 w-5 text-muted-foreground hover:text-foreground p-0"
                  title={t('brandEditor.openInFigma')}
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
                className="h-8 px-4 text-xs gap-1.5"
              >
                {isPreviewing ? <GlitchLoader size={12} /> : <Figma size={12} />}
                {t('brandEditor.importFromFigma')}
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
            <div className="flex items-center gap-2 text-2xs text-muted-foreground">
              <RefreshCw size={10} className="text-success" />
              <span>t('brandEditor.syncLabel'): {formatSyncTime(guideline.figmaSyncedAt)}</span>
            </div>
          )}

          {/* Unlink */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUnlink}
            disabled={isUnlinking}
            className="h-7 px-2 text-2xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            {isUnlinking ? (
              <GlitchLoader size={10} className="mr-1" />
            ) : (
              <Unlink size={10} className="mr-1" />
            )}
            {t('brandEditor.unlink')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Unlinked state */}
          <p className="text-2xs text-muted-foreground">{t('brandEditor.figmaConnectHint')}</p>

          <div className="flex gap-2">
            <Input
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder={t('brandEditor.figmaUrlPlaceholder')}
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleLink()}
            />
            <Button
              onClick={handleLink}
              disabled={!figmaUrl.trim() || isLinking}
              size="sm"
              variant="outline"
              className="h-8 px-3 shrink-0"
            >
              {isLinking ? <GlitchLoader size={12} /> : <Link2 size={12} />}
            </Button>
          </div>

          <p className="text-2xs text-muted-foreground/70">{t('brandEditor.figmaSyncHint')}</p>
        </div>
      )}
    </SectionBlock>
  );
};
