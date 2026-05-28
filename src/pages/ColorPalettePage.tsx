import React, { useCallback, useRef, useState } from 'react';
import { Palette, Upload, Lock, Unlock, Copy, X, Plus, RefreshCw, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useColorPaletteStore, type PaletteColor } from '@/stores/colorPaletteStore';
import { extractColors } from '@/utils/colorExtraction';
import { fileToBase64, validateFile } from '@/utils/fileUtils';
import { getContrastRatioPublic, checkWCAGCompliance } from '@/utils/colorUtils';
import { copyToClipboard } from '@/utils/clipboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlitchLoader } from '@/components/ui/GlitchLoader';

export const ColorPalettePage: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [addingColor, setAddingColor] = useState(false);
  const [newHex, setNewHex] = useState('#');

  const imageUrl = useColorPaletteStore((s) => s.imageUrl);
  const fileName = useColorPaletteStore((s) => s.fileName);
  const colors = useColorPaletteStore((s) => s.colors);
  const maxColors = useColorPaletteStore((s) => s.maxColors);
  const isExtracting = useColorPaletteStore((s) => s.isExtracting);
  const setImage = useColorPaletteStore((s) => s.setImage);
  const setColors = useColorPaletteStore((s) => s.setColors);
  const toggleLock = useColorPaletteStore((s) => s.toggleLock);
  const removeColor = useColorPaletteStore((s) => s.removeColor);
  const addColor = useColorPaletteStore((s) => s.addColor);
  const updateColor = useColorPaletteStore((s) => s.updateColor);
  const setMaxColors = useColorPaletteStore((s) => s.setMaxColors);
  const setIsExtracting = useColorPaletteStore((s) => s.setIsExtracting);
  const reset = useColorPaletteStore((s) => s.reset);

  // Keep base64 + mimeType in a ref so we can re-extract without re-reading the file
  const imageDataRef = useRef<{ base64: string; mimeType: string } | null>(null);

  const runExtraction = useCallback(
    async (shouldRandomize = false) => {
      const data = imageDataRef.current;
      if (!data) return;
      setIsExtracting(true);
      try {
        const lockedColors = colors.filter((c) => c.locked);
        const slotsNeeded = maxColors - lockedColors.length;
        const result = await extractColors(data.base64, data.mimeType, Math.max(slotsNeeded, 1), shouldRandomize);
        const extracted: PaletteColor[] = result.colors.slice(0, slotsNeeded).map((hex) => ({ hex, locked: false }));
        setColors([...lockedColors, ...extracted]);
      } catch (err: any) {
        console.error('Color extraction failed:', err);
        toast.error(err?.message || 'Extraction failed');
      } finally {
        setIsExtracting(false);
      }
    },
    [colors, maxColors, setColors, setIsExtracting],
  );

  const handleFile = useCallback(
    async (file: File) => {
      const error = validateFile(file, 'image');
      if (error) {
        toast.error(error);
        return;
      }
      setIsExtracting(true);
      try {
        const { base64, mimeType } = await fileToBase64(file);
        imageDataRef.current = { base64, mimeType };
        const objectUrl = URL.createObjectURL(file);
        setImage(objectUrl, file.name);
        const result = await extractColors(base64, mimeType, maxColors);
        setColors(result.colors.map((hex) => ({ hex, locked: false })));
      } catch (err: any) {
        console.error('File processing failed:', err);
        toast.error(err?.message || 'Failed to process image');
      } finally {
        setIsExtracting(false);
      }
    },
    [maxColors, setImage, setColors, setIsExtracting],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (e.target) e.target.value = '';
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleCopySwatch = useCallback(async (hex: string) => {
    const ok = await copyToClipboard(hex);
    if (ok) toast.success(`Copied ${hex}`);
    else toast.error('Copy failed');
  }, []);

  const handleAddColor = useCallback(() => {
    const hex = newHex.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      addColor(hex);
      setNewHex('#');
      setAddingColor(false);
    } else {
      toast.error('Invalid hex (use #RRGGBB)');
    }
  }, [newHex, addColor]);

  // Export helpers
  const exportCSS = useCallback(async () => {
    const css = `:root {\n${colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join('\n')}\n}`;
    const ok = await copyToClipboard(css);
    if (ok) toast.success('CSS variables copied');
  }, [colors]);

  const exportTailwind = useCallback(async () => {
    const obj = colors.map((c, i) => `      '${i + 1}': '${c.hex}'`).join(',\n');
    const tw = `colors: {\n  palette: {\n${obj}\n  }\n}`;
    const ok = await copyToClipboard(tw);
    if (ok) toast.success('Tailwind config copied');
  }, [colors]);

  const exportJSON = useCallback(async () => {
    const json = JSON.stringify(
      colors.map((c, i) => ({ hex: c.hex, name: `Color ${i + 1}` })),
      null,
      2,
    );
    const ok = await copyToClipboard(json);
    if (ok) toast.success('JSON copied');
  }, [colors]);

  const exportAll = useCallback(async () => {
    const text = colors.map((c) => c.hex).join('\n');
    const ok = await copyToClipboard(text);
    if (ok) toast.success('All hex values copied');
  }, [colors]);

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-brand-cyan" />
          <h1 className="text-sm font-mono font-bold uppercase tracking-widest text-neutral-200">
            Color Palette
          </h1>
          {imageUrl && (
            <button onClick={reset} className="ml-auto text-neutral-500 hover:text-neutral-300 transition-colors" title="Reset">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Upload zone */}
        {!imageUrl ? (
          <label
            className={cn(
              'flex flex-col items-center justify-center gap-3 w-full h-48 rounded-xl border-2 border-dashed cursor-pointer transition-all',
              isDragOver ? 'border-brand-cyan bg-brand-cyan/5' : 'border-neutral-800 hover:border-neutral-600 bg-neutral-950/40',
            )}
          >
            <Upload size={24} className="text-neutral-500" />
            <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
              Drop an image or click to upload
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleInputChange}
            />
          </label>
        ) : (
          <div className="space-y-4">
            {/* Image preview + palette */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Small image preview */}
              <div className="flex-shrink-0">
                <img
                  src={imageUrl}
                  alt={fileName}
                  className="w-32 h-32 rounded-lg object-cover border border-neutral-800 bg-neutral-950"
                />
                <p className="text-[10px] font-mono text-neutral-500 mt-1 truncate max-w-[128px]">{fileName}</p>
              </div>

              {/* Palette swatches */}
              <div className="flex-1 min-w-0">
                {isExtracting ? (
                  <div className="flex items-center justify-center h-32">
                    <GlitchLoader size={20} color="brand-cyan" />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {colors.map((color, i) => (
                      <div key={i} className="group relative flex flex-col items-center gap-1">
                        <div
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-neutral-700 cursor-pointer transition-all hover:scale-105 relative"
                          style={{ backgroundColor: color.hex }}
                          onClick={() => handleCopySwatch(color.hex)}
                          title={`Click to copy ${color.hex}`}
                        >
                          {/* Lock toggle */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleLock(i); }}
                            className="absolute top-0.5 left-0.5 p-0.5 rounded bg-black/40 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {color.locked ? <Lock size={10} /> : <Unlock size={10} />}
                          </button>
                          {/* Remove */}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeColor(i); }}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/40 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={10} />
                          </button>
                          {/* Lock indicator */}
                          {color.locked && (
                            <Lock size={8} className="absolute bottom-1 left-1/2 -translate-x-1/2 text-white/80 drop-shadow" />
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-neutral-400 uppercase">{color.hex}</span>
                      </div>
                    ))}
                    {/* Add color button */}
                    {addingColor ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border border-dashed border-neutral-700 flex items-center justify-center bg-neutral-950/40">
                          <Input
                            value={newHex}
                            onChange={(e) => setNewHex(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddColor(); if (e.key === 'Escape') setAddingColor(false); }}
                            className="w-[72px] h-7 text-[10px] font-mono text-center bg-transparent border-neutral-700 px-1"
                            maxLength={7}
                            autoFocus
                          />
                        </div>
                        <button onClick={handleAddColor} className="text-[10px] font-mono text-brand-cyan hover:underline">
                          add
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingColor(true)}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg border-2 border-dashed border-neutral-700 hover:border-neutral-500 flex items-center justify-center text-neutral-500 hover:text-neutral-300 transition-all"
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-4">
              {/* Max colors slider */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-neutral-500 uppercase">Max Colors</span>
                <input
                  type="range"
                  min="5"
                  max="12"
                  step="1"
                  value={maxColors}
                  onChange={(e) => setMaxColors(parseInt(e.target.value))}
                  disabled={isExtracting}
                  className="flex-1 max-w-[200px] h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-brand-cyan"
                />
                <span className="text-[10px] font-mono text-neutral-500 w-6 text-right">{maxColors}</span>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => runExtraction(false)}
                  disabled={isExtracting}
                  className="bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                >
                  <RefreshCw size={14} />
                  <span className="ml-2">Re-extract</span>
                </Button>
                <Button
                  onClick={() => runExtraction(true)}
                  disabled={isExtracting}
                  className="bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                >
                  <Shuffle size={14} />
                  <span className="ml-2">Randomize</span>
                </Button>
              </div>
            </div>

            {/* Export section */}
            {colors.length > 0 && (
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Export</span>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={exportCSS} variant="outline" className="font-mono text-xs uppercase tracking-widest border-neutral-700">
                    <Copy size={12} className="mr-1.5" /> CSS Variables
                  </Button>
                  <Button onClick={exportTailwind} variant="outline" className="font-mono text-xs uppercase tracking-widest border-neutral-700">
                    <Copy size={12} className="mr-1.5" /> Tailwind
                  </Button>
                  <Button onClick={exportJSON} variant="outline" className="font-mono text-xs uppercase tracking-widest border-neutral-700">
                    <Copy size={12} className="mr-1.5" /> JSON
                  </Button>
                  <Button onClick={exportAll} variant="outline" className="font-mono text-xs uppercase tracking-widest border-neutral-700">
                    <Copy size={12} className="mr-1.5" /> Copy All
                  </Button>
                </div>
              </div>
            )}

            {/* WCAG Contrast Grid */}
            {colors.length >= 2 && (
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">WCAG Contrast Grid</span>
                <div className="overflow-x-auto">
                  <table className="border-collapse">
                    <thead>
                      <tr>
                        <th className="w-8 h-8" />
                        {colors.map((c, i) => (
                          <th key={i} className="w-14 h-8 text-center">
                            <div className="w-6 h-6 rounded mx-auto border border-neutral-700" style={{ backgroundColor: c.hex }} title={c.hex} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {colors.map((row, ri) => (
                        <tr key={ri}>
                          <td className="w-8 h-8">
                            <div className="w-6 h-6 rounded mx-auto border border-neutral-700" style={{ backgroundColor: row.hex }} title={row.hex} />
                          </td>
                          {colors.map((col, ci) => {
                            if (ri === ci) {
                              return <td key={ci} className="w-14 h-8 text-center text-[9px] font-mono text-neutral-700">-</td>;
                            }
                            const ratio = getContrastRatioPublic(row.hex, col.hex);
                            const wcag = checkWCAGCompliance(ratio);
                            const bg = wcag.normalAA ? 'bg-emerald-950/40' : wcag.largeAA ? 'bg-yellow-950/40' : 'bg-red-950/30';
                            return (
                              <td key={ci} className={cn('w-14 h-8 text-center text-[9px] font-mono rounded', bg)} title={wcag.normalAA ? 'AA pass' : wcag.largeAA ? 'Large AA pass' : 'Fail'}>
                                <span className={cn(wcag.normalAA ? 'text-emerald-400' : wcag.largeAA ? 'text-yellow-400' : 'text-red-400')}>
                                  {ratio.toFixed(1)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
