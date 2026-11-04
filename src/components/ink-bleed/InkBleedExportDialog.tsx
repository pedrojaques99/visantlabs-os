import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SectionLabel } from '@/components/shared/ToolPanel';
import { useTranslation } from '@/hooks/useTranslation';
import { Download } from '@/lib/ui/icons';
import { downloadBlob } from '@/utils/clipboard';
import {
  describeSize,
  exportGif,
  exportMp4,
  InkTooLargeError,
  exportPng,
  exportSvg,
  isMp4Supported,
} from '@/lib/ink-bleed/exporter';
import { useInkBleedStore } from '@/stores/inkBleedStore';

type Format = 'png' | 'svg' | 'mp4' | 'gif';
type Background = 'paper' | 'transparent';

const SCALES = [1, 2, 4] as const;

interface InkBleedExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** On a phone the send-to action lives here, because the panel has no room for it. */
  sendTo?: React.ReactNode;
}

export const InkBleedExportDialog: React.FC<InkBleedExportDialogProps> = ({
  isOpen,
  onClose,
  sendTo,
}) => {
  const { t } = useTranslation();
  const doc = useInkBleedStore((s) => s.doc);
  const logo = useInkBleedStore((s) => s.logo);
  const progress = useInkBleedStore((s) => s.progress);

  const [format, setFormat] = useState<Format>('png');
  // 4× passes the canvas limit of many phones, and most of them cannot use it anyway.
  // Read directly: useIsMobile only answers after the first render, too late for a default.
  const [scale, setScale] = useState<(typeof SCALES)[number]>(() =>
    window.matchMedia('(max-width: 767px), (max-height: 500px)').matches ? 2 : 4
  );
  const [background, setBackground] = useState<Background>('paper');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const paperIsTransparent = doc.paper.paperType === 'transparent';
  const transparent = paperIsTransparent || background === 'transparent';
  const mp4Available = isMp4Supported();
  const isMotion = format === 'mp4' || format === 'gif';
  const size = describeSize(doc, scale);
  const seconds = doc.motion.duration / doc.motion.speed;

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  const run = async () => {
    setBusy(true);
    setDone(0);
    const stamp = Date.now();
    try {
      if (format === 'png') {
        const blob = await exportPng({ doc, logo, progress, scale, transparent });
        downloadBlob(blob, `ink-bleed_${size.width}x${size.height}_${stamp}.png`);
      } else if (format === 'svg') {
        const blob = await exportSvg({ doc, logo, progress, transparent });
        downloadBlob(blob, `ink-bleed_${stamp}.svg`);
      } else {
        const controller = new AbortController();
        abortRef.current = controller;
        const encode = format === 'mp4' ? exportMp4 : exportGif;
        const blob = await encode({ doc, logo, onProgress: setDone, signal: controller.signal });
        downloadBlob(blob, `ink-bleed_${stamp}.${format}`);
      }
      toast.success(t('inkBleed.export.done', { format: format.toUpperCase() }));
      onClose();
    } catch (error) {
      if (error instanceof InkTooLargeError && scale > 1) {
        const smaller = scale === 4 ? 2 : 1;
        setScale(smaller);
        toast.warning(t('inkBleed.export.tooLarge', { scale: smaller }));
      } else if ((error as Error).name !== 'AbortError') {
        console.error('[ink-bleed] export failed', error);
        toast.error(
          t(
            (error as Error).message.startsWith('Font not available')
              ? 'inkBleed.export.fontFailed'
              : 'inkBleed.export.failed'
          )
        );
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const percent = Math.round(done * 100);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('inkBleed.export.title')}
      size="sm"
      mobileDrawer
      footer={
        <div className="flex items-center justify-end gap-2">
          {sendTo && <div className="mr-auto">{sendTo}</div>}
          {busy && isMotion && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => abortRef.current?.abort()}
            >
              {t('common.cancel')}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            className="text-xs gap-2"
            disabled={busy}
            onClick={run}
          >
            <Download size={13} />
            {busy
              ? isMotion
                ? t('inkBleed.export.rendering', { percent })
                : t('common.exporting')
              : t('inkBleed.export.download', { format: format.toUpperCase() })}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <SegmentedControl
          aria-label={t('inkBleed.export.format')}
          size="sm"
          fullWidth
          disabled={busy}
          value={format}
          onChange={setFormat}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'svg', label: 'SVG' },
            { value: 'mp4', label: 'MP4', disabled: !mp4Available },
            { value: 'gif', label: 'GIF' },
          ]}
        />

        {format === 'png' && (
          <div className="space-y-1.5">
            <SectionLabel>{t('inkBleed.export.size')}</SectionLabel>
            <SegmentedControl
              aria-label={t('inkBleed.export.size')}
              size="sm"
              fullWidth
              disabled={busy}
              value={String(scale)}
              onChange={(v) => setScale(Number(v) as (typeof SCALES)[number])}
              options={SCALES.map((s) => ({ value: String(s), label: `${s}×` }))}
            />
            <p className="text-2xs tabular-nums text-muted-foreground">
              {t('inkBleed.export.sizeDetail', {
                width: size.width,
                height: size.height,
                widthCm: size.widthCm,
                heightCm: size.heightCm,
              })}
            </p>
          </div>
        )}

        {!isMotion && !paperIsTransparent && (
          <div className="space-y-1.5">
            <SectionLabel>{t('inkBleed.export.background')}</SectionLabel>
            <SegmentedControl
              aria-label={t('inkBleed.export.background')}
              size="sm"
              fullWidth
              disabled={busy}
              value={background}
              onChange={setBackground}
              options={[
                { value: 'paper', label: t('inkBleed.export.withPaper') },
                { value: 'transparent', label: t('inkBleed.export.transparent') },
              ]}
            />
          </div>
        )}

        {format === 'svg' && (
          <p className="text-2xs leading-relaxed text-muted-foreground">
            {t('inkBleed.export.svgHint')}
          </p>
        )}

        {isMotion && (
          <p className="text-2xs leading-relaxed text-muted-foreground">
            {format === 'mp4'
              ? t('inkBleed.export.mp4Hint', { seconds: seconds.toFixed(1) })
              : t('inkBleed.export.gifHint', { seconds: seconds.toFixed(1) })}
            {paperIsTransparent && ` ${t('inkBleed.export.motionNoAlpha')}`}
          </p>
        )}

        {busy && isMotion && (
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full origin-left bg-foreground"
              style={{ transform: `scaleX(${done})` }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
