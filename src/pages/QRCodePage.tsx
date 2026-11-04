import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { QrCode } from '@/lib/ui/icons';
import { loadImage } from '@/utils/imageUtils';
import { FormInput } from '../components/ui/form-input';
import { Select } from '../components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { MiniAppShell } from '@/components/shared/MiniAppShell';
import { QuickActions } from '@/components/shared/QuickActions';
import { InlineColorPicker } from '@/components/shared/ToolPanel';
import { copyImageAsPng } from '@/utils/clipboard';

const ease = [0.4, 0, 0.2, 1] as const;

type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export const QRCodePage: React.FC = () => {
  const { t } = useTranslation();
  const [text, setText] = useState<string>('');
  const [size, setSize] = useState<number>(256);
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<ErrorCorrectionLevel>('M');
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [fgColor, setFgColor] = useState<string>('#000000');
  const [marginSize, setMarginSize] = useState<number>(4);
  const [qrNode, setQrNode] = useState<HTMLDivElement | null>(null);
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null);

  const handleReset = () => {
    setText('');
    setSize(256);
    setErrorCorrectionLevel('M');
    setBgColor('#ffffff');
    setFgColor('#000000');
    setMarginSize(4);
  };

  const hasText = text.trim().length > 0;

  // PNG único para baixar, copiar e enviar. Espera o nó existir: a saída animada do estado
  // vazio atrasa a montagem do QR.
  useEffect(() => {
    if (!hasText || !qrNode) {
      setPngDataUrl(null);
      return;
    }
    const svg = qrNode.querySelector('svg');
    if (!svg) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const svgData = new XMLSerializer().serializeToString(svg);
      const url = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }));
      try {
        const img = await loadImage(url, null);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx || cancelled) return;
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setPngDataUrl(canvas.toDataURL('image/png'));
      } catch {
        console.error('Failed to load SVG image');
      } finally {
        URL.revokeObjectURL(url);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hasText, qrNode, text, size, errorCorrectionLevel, bgColor, fgColor, marginSize]);

  const handleDownload = () => {
    if (!pngDataUrl) return;
    const link = document.createElement('a');
    link.href = pngDataUrl;
    link.download = `qrcode-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = async () => {
    if (!pngDataUrl) return;
    const result = await copyImageAsPng(pngDataUrl);
    if (result.success) toast.success(t('miniTools.copied'));
    else toast.error(result.error || t('miniTools.copyFailed'));
  };

  const panel = (
    <div className="space-y-6">
      <h2 className="text-2xs font-medium text-muted-foreground">{t('miniTools.settings')}</h2>

      <div>
        <label className="block text-xs font-medium text-foreground mb-2">
          {t('miniTools.qr.text')}
        </label>
        <FormInput
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('q.r.code.enter_text_url_or_any_data')}
          className="w-full"
        />
      </div>

      <NodeSlider
        label={t('miniTools.qr.size')}
        value={size}
        min={128}
        max={512}
        step={32}
        onChange={setSize}
        formatValue={(v) => `${v}px`}
        resetValue={256}
      />

      <div>
        <label className="block text-xs font-medium text-foreground mb-2">
          {t('miniTools.qr.errorCorrection')}
        </label>
        <Select
          value={errorCorrectionLevel}
          onChange={(value) => setErrorCorrectionLevel(value as ErrorCorrectionLevel)}
          options={[
            { value: 'L', label: t('miniTools.qr.levelL') },
            { value: 'M', label: t('miniTools.qr.levelM') },
            { value: 'Q', label: t('miniTools.qr.levelQ') },
            { value: 'H', label: t('miniTools.qr.levelH') },
          ]}
          placeholder={t('q.r.code.select_error_correction_level')}
        />
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-foreground mb-2">
            {t('miniTools.qr.background')}
          </label>
          <InlineColorPicker
            value={bgColor}
            onChange={setBgColor}
            label={t('miniTools.qr.background')}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-2">
            {t('miniTools.qr.foreground')}
          </label>
          <InlineColorPicker
            value={fgColor}
            onChange={setFgColor}
            label={t('miniTools.qr.foreground')}
          />
        </div>
      </div>

      <NodeSlider
        label={t('miniTools.qr.margin')}
        value={marginSize}
        min={0}
        max={8}
        step={1}
        onChange={setMarginSize}
        formatValue={(v) => `${v}px`}
        resetValue={4}
      />

      {pngDataUrl && (
        <QuickActions
          toolId="qrcode"
          outputMime="image/png"
          summary={t('miniTools.qr.ready')}
          onDownloadAll={handleDownload}
          onCopy={handleCopy}
          assetData={{ imageBase64: pngDataUrl, mimeType: 'image/png', label: 'qrcode.png' }}
        />
      )}
    </div>
  );

  return (
    <MiniAppShell
      icon={QrCode}
      title={t('apps.qrCode.name')}
      toolId="qrcode"
      documentTitle={t('apps.qrCode.name')}
      onReset={handleReset}
      presets={{
        toolId: 'qrcode',
        getData: () => ({ size, errorCorrectionLevel, bgColor, fgColor, marginSize }),
        applyData: (data) => {
          const next = { size, errorCorrectionLevel, bgColor, fgColor, marginSize, ...data };
          setSize(next.size);
          setErrorCorrectionLevel(next.errorCorrectionLevel);
          setBgColor(next.bgColor);
          setFgColor(next.fgColor);
          setMarginSize(next.marginSize);
        },
      }}
      panel={panel}
    >
      <AnimatePresence mode="wait">
        {hasText ? (
          <motion.div
            key="qr-code"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease }}
            ref={setQrNode}
            className="p-6 bg-white rounded-xl shadow-2xl shadow-black/40"
          >
            <QRCodeSVG
              value={text}
              size={size}
              level={errorCorrectionLevel}
              bgColor={bgColor}
              fgColor={fgColor}
              marginSize={marginSize}
            />
          </motion.div>
        ) : (
          <motion.div
            key="empty-state"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease }}
            className="text-center text-muted-foreground"
          >
            <QrCode className="w-20 h-20 mx-auto mb-4 opacity-30" />
            <p className="text-xs">{t('q.r.code.enter_text_to_generate_qr_code')}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </MiniAppShell>
  );
};
