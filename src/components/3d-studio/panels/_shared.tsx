import React, { useCallback, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { useTranslation } from '@/hooks/useTranslation';
import { useStudio3DStore, MATERIAL_PRESETS } from '@/stores/studio3dStore';
import { ToolPanelGrid, ToolPanelChip } from '@/components/shared/ToolPanel';

/* ── Types ──────────────────────────────────────────────── */

export type StoreState = ReturnType<typeof useStudio3DStore.getState>;

/* ── Constants ──────────────────────────────────────────── */

export const MATERIAL_CATEGORIES = ['basic', 'metals', 'surfaces', 'glass', 'special'] as const;

export const FONT_OPTIONS = [
  'DM Sans',
  'Bebas Neue',
  'Playfair Display',
  'Righteous',
  'Black Ops One',
  'Permanent Marker',
  'Rubik Mono One',
  'Pacifico',
  'Oswald',
  'Archivo Black',
  'Montserrat',
  'Poppins',
  'Raleway',
  'Abril Fatface',
  'Bangers',
  'Lobster',
  'Anton',
  'Alfa Slab One',
  'Fredoka One',
  'Press Start 2P',
  'Russo One',
  'Bungee',
  'Protest Riot',
  'Silkscreen',
  'Monoton',
  'Orbitron',
  'Cinzel',
  'Syne',
  'Space Grotesk',
  'Unbounded',
];

/* ── PBR Map Upload ─────────── */

export const PbrMapUpload: React.FC<{
  label: string;
  value: string;
  onChange: (url: string) => void;
}> = ({ label, value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-neutral-500 uppercase tracking-widest">{label}</span>
        {value && (
          <button
            onClick={() => onChange('')}
            className="text-[9px] text-neutral-600 hover:text-red-400 transition-colors"
          >
            Remove
          </button>
        )}
      </div>
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full px-2 py-1.5 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors border border-dashed border-white/10"
      >
        {value ? 'Map loaded' : `Upload ${label}`}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onChange(URL.createObjectURL(file));
          e.target.value = '';
        }}
      />
    </div>
  );
};

/* ── Light Position XYZ Sliders ─────────── */

export const LightPositionSliders: React.FC<{
  label: string;
  position: [number, number, number];
  onChange: (p: [number, number, number]) => void;
}> = ({ label, position, onChange }) => (
  <div className="space-y-1 pl-2 border-l border-white/5">
    <span className="text-[9px] text-neutral-500 uppercase tracking-widest">{label}</span>
    <div className="grid grid-cols-3 gap-1">
      {(['X', 'Y', 'Z'] as const).map((axis, i) => (
        <div key={axis} className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] text-neutral-600 font-mono">{axis}</span>
          <input
            type="number"
            value={Math.round(position[i] * 10) / 10}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (isNaN(v)) return;
              const next = [...position] as [number, number, number];
              next[i] = v;
              onChange(next);
            }}
            step={0.5}
            className="w-full bg-white/5 border border-white/10 rounded px-1 py-0.5 text-[10px] text-center text-white font-mono focus:outline-none focus:border-white/20"
          />
        </div>
      ))}
    </div>
  </div>
);

/* ── Material Category Tabs ─────────────────────────────── */

export const MaterialCategoryTabs: React.FC<{ activeCat: string; store: StoreState }> = React.memo(
  ({ activeCat, store }) => {
    const { t } = useTranslation();
    const [openCat, setOpenCat] = useState(activeCat);

    const handleCat = useCallback((cat: string) => {
      setOpenCat((prev) => (prev === cat ? '' : cat));
    }, []);

    return (
      <div className="space-y-1.5">
        <ToolPanelGrid cols={3}>
          {MATERIAL_CATEGORIES.map((cat) => (
            <ToolPanelChip key={cat} active={openCat === cat} onClick={() => handleCat(cat)}>
              {t(`studio3d.material.categories.${cat}`)}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        {openCat && (
          <ToolPanelGrid cols={3}>
            {MATERIAL_PRESETS.filter((m) => m.category === openCat).map((m) => (
              <ToolPanelChip
                key={m.id}
                active={store.material === m.id}
                onClick={() => store.setMaterial(m.id)}
              >
                <span className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full border flex-shrink-0',
                      store.material === m.id ? 'border-white/40' : 'border-white/10'
                    )}
                    style={{ backgroundColor: m.color || '#666' }}
                  />
                  <span className="text-[8px] uppercase tracking-wider leading-tight text-center truncate w-full">
                    {m.label}
                  </span>
                </span>
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
        )}
      </div>
    );
  }
);

/* ── Procedural textures ──────────────────────────────── */

export function makeCanvas(size: number) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return { canvas: c, ctx: c.getContext('2d')! };
}

export function perlinNoise(
  ctx: CanvasRenderingContext2D,
  size: number,
  scale: number,
  intensity: number
) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / scale,
        ny = y / scale;
      const v1 = Math.sin(nx * 1.2 + ny * 0.8) * 0.5;
      const v2 = Math.sin(nx * 2.5 - ny * 1.7) * 0.25;
      const v3 = Math.sin(nx * 5.1 + ny * 4.3) * 0.125;
      const fine = (Math.random() - 0.5) * 0.3;
      const n = (v1 + v2 + v3 + fine) * intensity;
      const base = d[i];
      const v = Math.max(0, Math.min(255, base + n * 128));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function generateGrainTexture(size = 1024): string {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  perlinNoise(ctx, size, 80, 0.6);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const fine = (Math.random() - 0.5) * 40;
    d[i] = Math.max(0, Math.min(255, d[i] + fine));
    d[i + 1] = d[i + 2] = d[i];
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

export function generateScratchTexture(size = 1024): string {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let layer = 0; layer < 3; layer++) {
    const count = [400, 200, 80][layer];
    const alpha = [0.12, 0.2, 0.35][layer];
    const width = [0.3, 0.6, 1.0][layer];
    const maxLen = [40, 80, 120][layer];
    ctx.lineWidth = width;
    for (let i = 0; i < count; i++) {
      const bright = 128 + (Math.random() - 0.5) * 80;
      ctx.strokeStyle = `rgba(${bright},${bright},${bright},${alpha})`;
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 5 + Math.random() * maxLen;
      const angle = (Math.random() - 0.5) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segments = 3 + Math.floor(Math.random() * 4);
      let cx = x,
        cy = y;
      for (let s = 0; s < segments; s++) {
        const drift = (Math.random() - 0.5) * 4;
        cx += Math.cos(angle) * (len / segments);
        cy += Math.sin(angle) * (len / segments) + drift;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }
  return canvas.toDataURL('image/png');
}

export function generateNoiseTexture(size = 1024): string {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  perlinNoise(ctx, size, 40, 1.0);
  return canvas.toDataURL('image/png');
}

export function generateStuccoTexture(size = 1024): string {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  perlinNoise(ctx, size, 60, 0.8);
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 4;
    const bright = 100 + Math.random() * 60;
    ctx.fillStyle = `rgba(${bright},${bright},${bright},0.15)`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + Math.random()), Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas.toDataURL('image/png');
}

export const PROCEDURAL_TEXTURES = [
  { id: 'grain', label: 'Grain', generate: generateGrainTexture },
  { id: 'scratch', label: 'Scratch', generate: generateScratchTexture },
  { id: 'noise', label: 'Noise', generate: generateNoiseTexture },
  { id: 'stucco', label: 'Stucco', generate: generateStuccoTexture },
] as const;

/* ── Texture Controls ─────────────────────────────────── */

export const TextureControls: React.FC<{
  store: StoreState;
  textureOpacity: number;
  setTextureOpacity: (v: number) => void;
  textureRotation: number;
  setTextureRotation: (v: number) => void;
}> = React.memo(
  ({ store, textureOpacity, setTextureOpacity, textureRotation, setTextureRotation }) => {
    const { t } = useTranslation();
    const textureInputRef = useRef<HTMLInputElement>(null);
    const [activeProc, setActiveProc] = useState<string | null>(null);

    const handleTextureUpload = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        store.setTexture(url);
        setActiveProc(null);
        e.target.value = '';
      },
      [store]
    );

    const applyProcedural = useCallback(
      (pt: (typeof PROCEDURAL_TEXTURES)[number]) => {
        store.setTexture(pt.generate());
        setActiveProc(pt.id);
      },
      [store]
    );

    const hasTexture = !!store.texture;

    return (
      <div className="space-y-2">
        <ToolPanelGrid>
          {PROCEDURAL_TEXTURES.map((pt) => (
            <ToolPanelChip
              key={pt.id}
              active={activeProc === pt.id}
              onClick={() => applyProcedural(pt)}
            >
              {pt.label}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        <button
          onClick={() => textureInputRef.current?.click()}
          className="w-full px-2 py-1.5 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors border border-dashed border-white/10"
        >
          {t('studio3d.texture.upload')}
        </button>
        <input
          ref={textureInputRef}
          type="file"
          accept="image/*"
          onChange={handleTextureUpload}
          className="hidden"
          aria-label="Upload texture"
        />
        {hasTexture && (
          <div className="pt-2 space-y-3">
            <NodeSlider
              label={t('studio3d.texture.opacity')}
              value={textureOpacity}
              min={0}
              max={1}
              step={0.01}
              onChange={setTextureOpacity}
            />
            <NodeSlider
              label={t('studio3d.texture.repeat')}
              value={store.textureRepeat}
              min={0.5}
              max={10}
              step={0.5}
              onChange={store.setTextureRepeat}
            />
            <NodeSlider
              label="Rotation"
              value={textureRotation}
              min={0}
              max={6.28}
              step={0.1}
              onChange={setTextureRotation}
            />
            {activeProc && (
              <button
                onClick={() =>
                  applyProcedural(PROCEDURAL_TEXTURES.find((p) => p.id === activeProc)!)
                }
                className="w-full py-1 rounded text-[10px] uppercase tracking-wider text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                {t('studio3d.texture.regenerate')}
              </button>
            )}
            <button
              onClick={() => {
                store.setTexture('');
                setActiveProc(null);
              }}
              className="w-full py-1 rounded text-[10px] uppercase tracking-wider text-neutral-600 hover:text-red-400 transition-colors"
            >
              {t('studio3d.texture.remove')}
            </button>
          </div>
        )}
      </div>
    );
  }
);
