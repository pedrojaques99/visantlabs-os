import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Download, QrCode } from 'lucide-react';
import { loadImage } from '@/utils/imageUtils';
import { FormInput } from '../components/ui/form-input';
import { Select } from '../components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';
import { MiniAppShell } from '@/components/shared/MiniAppShell';

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
  const qrCodeRef = useRef<HTMLDivElement>(null);

  const handleReset = () => {
    setText('');
    setSize(256);
    setErrorCorrectionLevel('M');
    setBgColor('#ffffff');
    setFgColor('#000000');
    setMarginSize(4);
  };

  const handleDownload = async () => {
    if (!qrCodeRef.current) return;

    const svg = qrCodeRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    try {
      const img = await loadImage(url, null);
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `qrcode-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
          }
        }, 'image/png');
      }
    } catch {
      console.error('Failed to load SVG image');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const hasText = text.trim().length > 0;

  const panel = (
    <div className="space-y-6">
      <h2 className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Settings</h2>

      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-2">Text or URL</label>
        <FormInput
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('q.r.code.enter_text_url_or_any_data')}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-2">Size: {size}px</label>
        <input
          type="range"
          min="128"
          max="512"
          step="32"
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-full h-2 bg-zinc-800 rounded-md appearance-none cursor-pointer accent-brand-cyan"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-2">
          Error Correction Level
        </label>
        <Select
          value={errorCorrectionLevel}
          onChange={(value) => setErrorCorrectionLevel(value as ErrorCorrectionLevel)}
          options={[
            { value: 'L', label: 'L - Low (~7%)' },
            { value: 'M', label: 'M - Medium (~15%)' },
            { value: 'Q', label: 'Q - Quartile (~25%)' },
            { value: 'H', label: 'H - High (~30%)' },
          ]}
          placeholder={t('q.r.code.select_error_correction_level')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-2">Background</label>
          <FormInput
            type="color"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            className="w-full h-12"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-2">Foreground</label>
          <FormInput
            type="color"
            value={fgColor}
            onChange={(e) => setFgColor(e.target.value)}
            className="w-full h-12"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-2">
          Margin: {marginSize}px
        </label>
        <input
          type="range"
          min="0"
          max="8"
          step="1"
          value={marginSize}
          onChange={(e) => setMarginSize(Number(e.target.value))}
          className="w-full h-2 bg-zinc-800 rounded-md appearance-none cursor-pointer accent-brand-cyan"
        />
      </div>
    </div>
  );

  const statusBar = hasText ? (
    <button
      onClick={handleDownload}
      className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-brand-cyan hover:text-brand-cyan/80 transition-colors"
    >
      <Download className="w-3.5 h-3.5" />
      Download PNG
    </button>
  ) : (
    <span className="text-[10px] uppercase tracking-widest text-neutral-600">
      Enter text to generate
    </span>
  );

  return (
    <MiniAppShell
      icon={QrCode}
      title="QR Code Generator"
      documentTitle="QR Code Generator"
      onReset={handleReset}
      panel={panel}
      statusBar={statusBar}
    >
      <AnimatePresence mode="wait">
        {hasText ? (
          <motion.div
            key="qr-code"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease }}
            ref={qrCodeRef}
            className="p-6 bg-white rounded-2xl shadow-2xl shadow-black/40"
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
            className="text-center text-neutral-600"
          >
            <QrCode className="w-20 h-20 mx-auto mb-4 opacity-30" />
            <p className="font-mono text-xs uppercase tracking-widest">
              {t('q.r.code.enter_text_to_generate_qr_code')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </MiniAppShell>
  );
};
