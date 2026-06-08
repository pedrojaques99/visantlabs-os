import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Download, QrCode } from 'lucide-react';
import { useLayout } from '@/hooks/useLayout';
import { loadImage } from '@/utils/imageUtils';
import { FormInput } from '../components/ui/form-input';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { useTranslation } from '@/hooks/useTranslation';
import { MiniToolShell } from '@/components/shared/MiniToolShell';

const ease = [0.4, 0, 0.2, 1] as const;
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease },
};
const fadeScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: 0.3, ease },
};

type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export const QRCodePage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useLayout();
  const [text, setText] = useState<string>('');
  const [size, setSize] = useState<number>(256);
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<ErrorCorrectionLevel>('M');
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [fgColor, setFgColor] = useState<string>('#000000');
  const [marginSize, setMarginSize] = useState<number>(4);
  const qrCodeRef = useRef<HTMLDivElement>(null);

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

  return (
    <MiniToolShell icon={QrCode} title="QR Code Generator" maxWidth="6xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease }}
          className="space-y-6"
        >
          <div className="bg-neutral-950/70 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white mb-6">Settings</h2>

            {/* Text Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-300 mb-2">Text or URL</label>
              <FormInput
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('q.r.code.enter_text_url_or_any_data')}
                className="w-full"
              />
            </div>

            {/* Size */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-300 mb-2">Size: {size}px</label>
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

            {/* Error Correction Level */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
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

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Background Color
                </label>
                <FormInput
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-full h-12"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Foreground Color
                </label>
                <FormInput
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="w-full h-12"
                />
              </div>
            </div>

            {/* Margin Size */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
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
        </motion.div>

        {/* QR Code Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1, ease }}
          className="space-y-6"
        >
          <div className="bg-neutral-950/70 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white mb-6">Preview</h2>

            <div className="flex flex-col items-center justify-center min-h-[400px]">
              <AnimatePresence mode="wait">
                {hasText ? (
                  <motion.div
                    key="qr-code"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, ease }}
                    ref={qrCodeRef}
                    className="p-4 bg-white rounded-md"
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
                    className="text-center text-zinc-500"
                  >
                    <QrCode className="w-24 h-24 mx-auto mb-4 opacity-40" />
                    <p className="font-mono text-sm">
                      {t('q.r.code.enter_text_to_generate_qr_code')}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {hasText && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.25, ease }}
                  className="mt-6 flex justify-center"
                >
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDownload}
                    className="bg-brand-cyan hover:bg-brand-cyan/80 text-black font-semibold px-6 py-3 rounded-md flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Download PNG
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </MiniToolShell>
  );
};
