import React, { useRef } from 'react';
import { useCreativeStore } from './store/creativeStore';
import { useBrandKit } from '@/contexts/BrandKitContext';
import { AlignLeft, AlignCenter, AlignRight, Bold, Underline, Strikethrough, Trash2, Layers, Copy, AlignStartVertical, AlignCenterHorizontal, AlignEndVertical, AlignStartHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween, ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine, Group, Ungroup, Image as ImageIcon, RefreshCcw, Upload, Diamond, X, RotateCw, Square as SquareIcon } from 'lucide-react';
import type { TextLayerData, ShapeLayerData, LogoLayerData } from './store/creativeTypes';
import { LogoFiltersPopover } from './LogoFiltersPopover';
import type { LucideIcon } from 'lucide-react';

// ── Tiny reusable pieces ──────────────────────────────────────────────

const Divider = () => <div className="w-px h-5 bg-white/10 mx-0.5" />;

const Btn: React.FC<{
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  title: string;
  disabled?: boolean;
}> = ({ icon: Icon, onClick, active, danger, title, disabled }) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={[
      'p-1.5 rounded transition-colors',
      disabled && 'opacity-30 pointer-events-none',
      danger && 'text-neutral-400 hover:text-red-400 hover:bg-red-400/10',
      active && !danger && 'bg-brand-cyan/20 text-brand-cyan',
      !active && !danger && 'text-neutral-400 hover:text-white hover:bg-white/5',
    ]
      .filter(Boolean)
      .join(' ')}
  >
    <Icon size={14} />
  </button>
);

// ── Main toolbar ──────────────────────────────────────────────────────

// ── Background toolbar (shown when bg is selected) ───────────────────

interface BackgroundToolbarProps {
  onEditAI?: () => void;
}

export const BackgroundToolbar: React.FC<BackgroundToolbarProps> = ({ onEditAI }) => {
  const backgroundUrl = useCreativeStore((s) => s.backgroundUrl);
  const setBackgroundUrl = useCreativeStore((s) => s.setBackgroundUrl);
  const setBackgroundSelected = useCreativeStore((s) => s.setBackgroundSelected);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBackgroundUrl(url);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-neutral-900/95 border border-white/10 rounded-lg px-3 py-2 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-top-2"
    >
      <div className="flex items-center gap-1.5 pr-1">
        <ImageIcon size={12} className="text-brand-cyan" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
          Fundo
        </span>
      </div>
      <Divider />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <Btn icon={Upload} onClick={() => fileRef.current?.click()} title="Trocar fundo" />
      {backgroundUrl && onEditAI && (
        <Btn icon={Diamond} onClick={onEditAI} title="Editar com IA" />
      )}
      <Divider />
      <Btn icon={X} onClick={() => setBackgroundSelected(false)} title="Fechar" />
    </div>
  );
};

// ── Main toolbar ──────────────────────────────────────────────────────

export const CreativeToolbar: React.FC = () => {
  const layers = useCreativeStore((s) => s.layers);
  const selectedLayerIds = useCreativeStore((s) => s.selectedLayerIds);
  const updateLayer = useCreativeStore((s) => s.updateLayer);
  const removeLayer = useCreativeStore((s) => s.removeLayer);
  const duplicateLayer = useCreativeStore((s) => s.duplicateLayer);
  const reorderLayer = useCreativeStore((s) => s.reorderLayer);
  const alignLayers = useCreativeStore((s) => s.alignLayers);
  const distributeLayers = useCreativeStore((s) => s.distributeLayers);
  const groupSelected = useCreativeStore((s) => s.groupSelected);
  const ungroupSelected = useCreativeStore((s) => s.ungroupSelected);
  const { colors, activeGuideline } = useBrandKit();

  const selectedCount = selectedLayerIds.length;
  if (selectedCount === 0) return null;

  const selected = selectedCount === 1
    ? layers.find((l) => l.id === selectedLayerIds[0])
    : undefined;

  const isText = selected?.data.type === 'text';
  const textData = isText ? (selected!.data as TextLayerData) : null;
  const isLogo = selected?.data.type === 'logo';
  const logoUrl = isLogo ? (selected!.data as any).url : null;
  const isShape = selected?.data.type === 'shape';
  const shapeData = isShape ? (selected!.data as ShapeLayerData) : null;

  const fonts = (activeGuideline?.typography ?? []).map((t) => t.family).filter(Boolean);
  const logos = activeGuideline?.logos ?? [];
  const media = activeGuideline?.media ?? [];
  const allVaultAssets = [...logos, ...media];

  const updateText = (patch: Partial<TextLayerData>) => updateLayer(selectedLayerIds[0], patch);
  const updateLogo = (url: string) => updateLayer(selectedLayerIds[0], { url } as any);
  const updateShape = (patch: Partial<ShapeLayerData>) => updateLayer(selectedLayerIds[0], patch as any);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-neutral-900/95 border border-white/10 rounded-lg px-3 py-2 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-top-2"
    >
      {/* ── Selection badge & Grouping ── */}
      {selectedCount > 1 ? (
        <>
          <div className="flex items-center gap-1.5 pr-1">
            <Layers size={12} className="text-brand-cyan" />
            <span className="text-[10px] font-mono text-neutral-400 tabular-nums">
              {selectedCount}
            </span>
          </div>
          <Btn icon={Group} onClick={groupSelected} title="Agrupar (Ctrl+G)" />
          <Divider />
        </>
      ) : selected?.data.type === 'group' ? (
        <>
          <Btn icon={Ungroup} onClick={ungroupSelected} title="Desagrupar (Ctrl+Shift+G)" />
          <Divider />
        </>
      ) : null}

      {/* ── Asset Swap (Vault Integration) ── */}
      {isLogo && allVaultAssets.length > 0 && (
        <>
          <div className="relative group px-1">
            <select
              value={logoUrl || ''}
              onChange={(e) => updateLogo(e.target.value)}
              className="bg-neutral-800 text-[10px] font-bold uppercase tracking-widest text-neutral-300 px-3 py-1.5 rounded-md border border-white/10 outline-none focus:border-brand-cyan/40 max-w-[120px] appearance-none cursor-pointer pr-7 transition-all hover:bg-neutral-750"
            >
              <option disabled value="">Trocar...</option>
              {allVaultAssets.map((asset, i) => (
                <option key={asset.url + i} value={asset.url}>
                  {(asset as any).name || (asset as any).label || `Asset ${i + 1}`}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500 group-hover:text-neutral-300 transition-colors">
              <RefreshCcw size={10} />
            </div>
          </div>
          <Divider />
        </>
      )}

      {/* ── Image filters + crop popover (logos only) ── */}
      {isLogo && selected && (
        <>
          <LogoFiltersPopover layerId={selectedLayerIds[0]} data={selected.data as LogoLayerData} />
          <Divider />
        </>
      )}

      {/* ── Text-specific controls ── */}
      {isText && textData && (
        <>
          {fonts.length > 0 && (
            <select
              value={textData.fontFamily}
              onChange={(e) => updateText({ fontFamily: e.target.value })}
              className="bg-neutral-800 text-white text-xs font-mono px-2 py-1 rounded border border-white/10 outline-none focus:border-brand-cyan/40 max-w-[120px]"
            >
              <option value="Inter, sans-serif">Default</option>
              {fonts.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          )}

          <input
            type="number"
            value={Math.round(textData.fontSize)}
            onChange={(e) => updateText({ fontSize: Number(e.target.value) })}
            min={8}
            max={400}
            className="w-14 bg-neutral-800 text-white text-xs font-mono px-2 py-1 rounded border border-white/10 outline-none focus:border-brand-cyan/40 tabular-nums"
          />

          <Btn icon={Bold} onClick={() => updateText({ bold: !textData.bold })} active={textData.bold} title="Negrito" />
          <Btn icon={Underline} onClick={() => updateText({ underline: !textData.underline })} active={!!textData.underline} title="Sublinhado" />
          <Btn icon={Strikethrough} onClick={() => updateText({ strikethrough: !textData.strikethrough })} active={!!textData.strikethrough} title="Tachado" />

          <div className="flex items-center gap-0.5">
            {(['left', 'center', 'right'] as const).map((a) => {
              const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
              return (
                <Btn key={a} icon={Icon} onClick={() => updateText({ align: a })} active={textData.align === a} title={`Align ${a}`} />
              );
            })}
          </div>

          {/* Color swatches */}
          {colors.length > 0 && (
            <div className="flex items-center gap-1 pl-0.5">
              {colors.slice(0, 5).map((c) => (
                <button
                  key={c.hex}
                  onClick={() => updateText({ color: c.hex })}
                  title={c.name || c.hex}
                  className="w-4.5 h-4.5 rounded-full border border-white/20 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c.hex, width: 18, height: 18 }}
                />
              ))}
              <div className="relative w-[18px] h-[18px]">
                <div
                  className="w-[18px] h-[18px] rounded-full border border-white/20 cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: textData.color }}
                  title="Cor personalizada"
                />
                <input
                  type="color"
                  value={textData.color}
                  onChange={(e) => updateText({ color: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
            </div>
          )}

          <Divider />
        </>
      )}

      {/* ── Shape-specific controls ── */}
      {isShape && shapeData && (
        <>
          {/* Fill color */}
          <div className="flex items-center gap-1 pl-0.5">
            {colors.slice(0, 5).map((c) => (
              <button
                key={c.hex}
                onClick={() => updateShape({ color: c.hex })}
                title={c.name || c.hex}
                className="rounded-full border border-white/20 hover:scale-110 transition-transform"
                style={{ backgroundColor: c.hex, width: 18, height: 18 }}
              />
            ))}
            <div className="relative w-[18px] h-[18px]">
              <div
                className="w-[18px] h-[18px] rounded-full border border-white/20 cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: shapeData.color }}
                title="Cor personalizada"
              />
              <input
                type="color"
                value={shapeData.color}
                onChange={(e) => updateShape({ color: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
          </div>

          {/* Corner radius */}
          <div className="flex items-center gap-1 pl-1" title="Arredondar cantos">
            <SquareIcon size={11} className="text-neutral-500" />
            <input
              type="number"
              value={Math.round(shapeData.cornerRadius ?? 0)}
              onChange={(e) => updateShape({ cornerRadius: Math.max(0, Number(e.target.value)) })}
              min={0}
              max={400}
              className="w-12 bg-neutral-800 text-white text-xs font-mono px-1.5 py-1 rounded border border-white/10 outline-none focus:border-brand-cyan/40 tabular-nums"
            />
          </div>

          {/* Stroke width + color */}
          <div className="flex items-center gap-1 pl-1" title="Borda">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">B</span>
            <input
              type="number"
              value={Math.round(shapeData.strokeWidth ?? 0)}
              onChange={(e) => {
                const w = Math.max(0, Number(e.target.value));
                updateShape({ strokeWidth: w, strokeColor: shapeData.strokeColor ?? '#ffffff' });
              }}
              min={0}
              max={64}
              className="w-12 bg-neutral-800 text-white text-xs font-mono px-1.5 py-1 rounded border border-white/10 outline-none focus:border-brand-cyan/40 tabular-nums"
            />
            <div className="relative w-[18px] h-[18px]">
              <div
                className="w-[18px] h-[18px] rounded-full border border-white/20 cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: shapeData.strokeColor ?? '#ffffff' }}
                title="Cor da borda"
              />
              <input
                type="color"
                value={shapeData.strokeColor ?? '#ffffff'}
                onChange={(e) => updateShape({ strokeColor: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
          </div>

          <Divider />
        </>
      )}

      {/* ── Rotation (single selection, any layer with rotation support) ── */}
      {selectedCount === 1 && selected && selected.data.type !== 'group' && (
        <>
          <div className="flex items-center gap-1" title="Rotação (graus)">
            <RotateCw size={11} className="text-neutral-500" />
            <input
              type="number"
              value={Math.round((selected.data as any).rotation ?? 0)}
              onChange={(e) => {
                let deg = Number(e.target.value) % 360;
                if (deg < 0) deg += 360;
                updateLayer(selectedLayerIds[0], { rotation: deg } as any);
              }}
              min={-360}
              max={360}
              className="w-14 bg-neutral-800 text-white text-xs font-mono px-1.5 py-1 rounded border border-white/10 outline-none focus:border-brand-cyan/40 tabular-nums"
            />
          </div>
          <Divider />
        </>
      )}

      {/* ── Spatial alignment (canvas for single, group for multi) ── */}
      <div className="flex items-center gap-0.5">
        <Btn icon={AlignStartVertical} onClick={() => alignLayers('left')} title="Alinhar à esquerda" />
        <Btn icon={AlignCenterHorizontal} onClick={() => alignLayers('center-h')} title="Centralizar horizontalmente" />
        <Btn icon={AlignEndVertical} onClick={() => alignLayers('right')} title="Alinhar à direita" />
        <Btn icon={AlignStartHorizontal} onClick={() => alignLayers('top')} title="Alinhar ao topo" />
        <Btn icon={AlignCenterVertical} onClick={() => alignLayers('center-v')} title="Centralizar verticalmente" />
        <Btn icon={AlignEndHorizontal} onClick={() => alignLayers('bottom')} title="Alinhar à base" />
      </div>

      {/* ── Distribute (3+ selected) ── */}
      {selectedCount >= 3 && (
        <>
          <Divider />
          <div className="flex items-center gap-0.5">
            <Btn icon={AlignHorizontalSpaceBetween} onClick={() => distributeLayers('horizontal')} title="Distribuir horizontalmente" />
            <Btn icon={AlignVerticalSpaceBetween} onClick={() => distributeLayers('vertical')} title="Distribuir verticalmente" />
          </div>
        </>
      )}

      {/* ── Z-order ── */}
      {selectedCount === 1 && (
        <>
          <Divider />
          <div className="flex items-center gap-0.5">
            <Btn icon={ArrowUpToLine} onClick={() => reorderLayer(selectedLayerIds[0], 'top')} title="Trazer para frente" />
            <Btn icon={ArrowUp} onClick={() => reorderLayer(selectedLayerIds[0], 'up')} title="Subir uma camada" />
            <Btn icon={ArrowDown} onClick={() => reorderLayer(selectedLayerIds[0], 'down')} title="Descer uma camada" />
            <Btn icon={ArrowDownToLine} onClick={() => reorderLayer(selectedLayerIds[0], 'bottom')} title="Enviar para trás" />
          </div>
        </>
      )}

      <Divider />

      {/* ── Duplicate & Delete ── */}
      <Btn
        icon={Copy}
        onClick={() => selectedLayerIds.forEach((id) => duplicateLayer(id))}
        title="Duplicar (Ctrl+D)"
      />
      <Btn
        icon={Trash2}
        onClick={() => selectedLayerIds.forEach((id) => removeLayer(id))}
        danger
        title="Remover (Delete)"
      />
    </div>
  );
};
