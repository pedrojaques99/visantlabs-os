import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useImageLabStore, type ImageLabMode } from '@/stores/imageLabStore';
import { HalftoneRenderer } from '@/components/halftone/HalftoneRenderer';
import { RisoRenderer, extractDominantColors } from '@/components/riso/RisoRenderer';
import { useHalftoneStore } from '@/stores/halftoneStore';
import { useRisoStore } from '@/stores/risoStore';
import { loadImage } from '@/utils/imageUtils';

const MODES = [
  { id: 'halftone' as const, label: 'Halftone' },
  { id: 'texture' as const, label: 'Texture' },
  { id: 'riso' as const, label: 'Riso' },
] as const;

const PREVIEW_SIZE = 64;

function downscaleImage(img: HTMLImageElement, maxSize: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  const aspect = img.naturalWidth / img.naturalHeight;
  if (aspect > 1) {
    canvas.width = maxSize;
    canvas.height = Math.round(maxSize / aspect);
  } else {
    canvas.width = Math.round(maxSize * aspect);
    canvas.height = maxSize;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const small = new Image();
  small.src = canvas.toDataURL('image/png');
  small.width = canvas.width;
  small.height = canvas.height;
  return small;
}

interface ModePreviewSwitcherProps {
  mode: ImageLabMode;
  onChange: (m: ImageLabMode) => void;
}

export const ModePreviewSwitcher: React.FC<ModePreviewSwitcherProps> = React.memo(
  ({ mode, onChange }) => {
    const sourceUrl = useImageLabStore((s) => s.sourceUrl);
    const [previews, setPreviews] = useState<Record<string, string>>({});

    const generatePreviews = useCallback(async (url: string) => {
      if (!url) {
        setPreviews({});
        return;
      }

      try {
        const fullImg = await loadImage(url);
        const small = downscaleImage(fullImg, PREVIEW_SIZE);
        await loadImage(small.src);

        // Halftone preview
        try {
          const hCanvas = document.createElement('canvas');
          hCanvas.width = small.width;
          hCanvas.height = small.height;
          const hRenderer = new HalftoneRenderer(hCanvas);
          if (hRenderer.init()) {
            hRenderer.setupTexture(small);
            hRenderer.render(useHalftoneStore.getState().getSettings());
            setPreviews((p) => ({ ...p, halftone: hCanvas.toDataURL('image/jpeg', 0.6) }));
            hRenderer.destroy();
          }
        } catch {
          /* best-effort */
        }

        // Texture preview (simple tint)
        try {
          const tCanvas = document.createElement('canvas');
          tCanvas.width = small.width;
          tCanvas.height = small.height;
          const ctx = tCanvas.getContext('2d')!;
          ctx.drawImage(small, 0, 0);
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = '#8b5cf6';
          ctx.fillRect(0, 0, tCanvas.width, tCanvas.height);
          setPreviews((p) => ({ ...p, texture: tCanvas.toDataURL('image/jpeg', 0.6) }));
        } catch {
          /* best-effort */
        }

        // Riso preview
        try {
          const rCanvas = document.createElement('canvas');
          rCanvas.width = small.width;
          rCanvas.height = small.height;
          const rRenderer = new RisoRenderer(rCanvas);
          if (rRenderer.init()) {
            rRenderer.setupTexture(small);
            const risoState = useRisoStore.getState();
            const settings = risoState.getSettings();

            if (settings.layers.length === 0) {
              const tmpC = document.createElement('canvas');
              tmpC.width = small.width;
              tmpC.height = small.height;
              tmpC.getContext('2d')!.drawImage(small, 0, 0);
              const imgData = tmpC.getContext('2d')!.getImageData(0, 0, tmpC.width, tmpC.height);
              const colors = extractDominantColors(imgData, 3);
              const layers = colors.map((c, i) => ({
                color: c,
                hex: `#${c.map((v: number) => v.toString(16).padStart(2, '0')).join('')}`,
                visible: true,
                alpha: 0.85,
                angle: i * 22.5,
                offsetX: [1, -1, 1][i],
                offsetY: [-1, 1, 1][i],
              }));
              rRenderer.render({ ...settings, layers });
            } else {
              rRenderer.render(settings);
            }

            setPreviews((p) => ({ ...p, riso: rCanvas.toDataURL('image/jpeg', 0.6) }));
            rRenderer.destroy();
          }
        } catch {
          /* best-effort */
        }
      } catch {
        // preview generation is best-effort
      }
    }, []);

    useEffect(() => {
      generatePreviews(sourceUrl);
    }, [sourceUrl, generatePreviews]);

    return (
      <div className="flex items-center ml-3 bg-neutral-900/60 rounded-md p-0.5 border border-neutral-800/50">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest transition-all duration-150 rounded-[3px]',
              mode === m.id
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-neutral-600 hover:text-neutral-400'
            )}
          >
            {previews[m.id] && (
              <img src={previews[m.id]} alt="" className="w-5 h-5 rounded-sm object-cover" />
            )}
            {m.label}
          </button>
        ))}
      </div>
    );
  }
);
ModePreviewSwitcher.displayName = 'ModePreviewSwitcher';
