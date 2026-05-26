import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, QrCode } from 'lucide-react';
import { useLayout } from '@/hooks/useLayout';
import { loadImage } from '@/utils/imageUtils';
import { downloadBlob } from '@/utils/clipboard';
import { FormInput } from '../components/ui/form-input';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { useTranslation } from '@/hooks/useTranslation';

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
            downloadBlob(blob, `qrcode-${Date.now()}.png`);
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
    <div className="min-h-screen bg-neutral-950 text-zinc-300 pt-12 md:pt-14 relative overflow-hidden">
      <div className="fixed inset-0 z-0">

      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <QrCode className="w-8 h-8 text-brand-cyan" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">{t('q.r.code.qr_code_generator')}</h1>
          </div>
          <p className="text-zinc-400 font-mono text-sm">
            Generate QR codes from text, URLs, or any data
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-neutral-950/70 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-6">Settings</h2>

              {/* Text Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Text or URL
                </label>
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
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Size: {size}px
                </label>
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
          </div>

          {/* QR Code Display */}
          <div className="space-y-6">
            <div className="bg-neutral-950/70 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
              <h2 className="text-xl font-semibold text-white mb-6">Preview</h2>

              <div className="flex flex-col items-center justify-center min-h-[400px]">
                {hasText ? (
                  <div ref={qrCodeRef} className="p-4 bg-white rounded-md">
                    <QRCodeSVG
                      value={text}
                      size={size}
                      level={errorCorrectionLevel}
                      bgColor={bgColor}
                      fgColor={fgColor}
                      marginSize={marginSize}
                    />
                  </div>
                ) : (
                  <div className="text-center text-zinc-500">
                    <QrCode className="w-24 h-24 mx-auto mb-4 opacity-40" />
                    <p className="font-mono text-sm">{t('q.r.code.enter_text_to_generate_qr_code')}</p>
                  </div>
                )}
              </div>

              {hasText && (
                <div className="mt-6 flex justify-center">
                  <Button variant="brand"
                    onClick={handleDownload}
                    className="bg-brand-cyan hover:bg-brand-cyan/80 text-black font-semibold px-6 py-3 rounded-md flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Download PNG
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

