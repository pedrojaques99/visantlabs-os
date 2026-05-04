import React, { useState, useCallback, useRef } from 'react';
import { useCreativeStore } from './store/creativeStore';
import { Diamond, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mockupApi } from '@/services/mockupApi';
import { canvasApi } from '@/services/canvasApi';
import { toast } from 'sonner';

import { GlitchLoader } from '@/components/ui/GlitchLoader'
interface Props {
  canvasWidth: number;
  canvasHeight: number;
}

export const LassoTool: React.FC<Props> = ({ canvasWidth, canvasHeight }) => {
  const activeTool = useCreativeStore((s) => s.activeTool);
  const lassoRegion = useCreativeStore((s) => s.lassoRegion);
  const setLassoRegion = useCreativeStore((s) => s.setLassoRegion);
  const setActiveTool = useCreativeStore((s) => s.setActiveTool);
  const addLayer = useCreativeStore((s) => s.addLayer);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionMode, setActionMode] = useState<'layer' | 'edit' | null>(null);

  if (activeTool !== 'lasso') return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (showActions) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / canvasWidth;
    const y = (e.clientY - rect.top) / canvasHeight;
    setDragStart({ x, y });
    setDragCurrent({ x, y });
    setIsDragging(true);
    setLassoRegion(null);
    setShowActions(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / canvasWidth));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / canvasHeight));
    setDragCurrent({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDragging || !dragStart || !dragCurrent) return;
    setIsDragging(false);

    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const w = Math.abs(dragCurrent.x - dragStart.x);
    const h = Math.abs(dragCurrent.y - dragStart.y);

    if (w < 0.02 || h < 0.02) {
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    setLassoRegion({ x, y, w, h });
    setShowActions(true);
  };

  const handleCancel = () => {
    setShowActions(false);
    setLassoRegion(null);
    setDragStart(null);
    setDragCurrent(null);
    setAiPrompt('');
    setActionMode(null);
  };

  const handleClose = () => {
    handleCancel();
    setActiveTool('select');
  };

  const handleGenerate = async () => {
    if (!aiPrompt.trim() || !lassoRegion) return;
    setIsGenerating(true);

    try {
      const result = await mockupApi.generate({
        promptText: aiPrompt,
        model: 'gemini-3.1-flash-image-preview',
        provider: 'gemini',
        aspectRatio: '1:1',
        feature: 'canvas',
      });

      const base64 = result.imageBase64;
      const imageUrl =
        result.imageUrl ||
        (base64
          ? await canvasApi.uploadImageToR2(`data:image/png;base64,${base64}`)
          : null);

      if (!imageUrl) throw new Error('Falha ao gerar imagem');

      if (actionMode === 'layer') {
        addLayer({
          type: 'logo',
          url: imageUrl,
          position: { x: lassoRegion.x, y: lassoRegion.y },
          size: { w: lassoRegion.w, h: lassoRegion.h },
        });
        toast.success('Nova layer criada na seleção!');
      } else {
        // Edit mode: also creates a layer covering the region
        addLayer({
          type: 'logo',
          url: imageUrl,
          position: { x: lassoRegion.x, y: lassoRegion.y },
          size: { w: lassoRegion.w, h: lassoRegion.h },
        });
        toast.success('Área editada com IA!');
      }

      handleCancel();
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao gerar com IA');
    } finally {
      setIsGenerating(false);
    }
  };

  // Compute visual rect for the selection
  const selRect =
    isDragging && dragStart && dragCurrent
      ? {
        left: Math.min(dragStart.x, dragCurrent.x) * canvasWidth,
        top: Math.min(dragStart.y, dragCurrent.y) * canvasHeight,
        width: Math.abs(dragCurrent.x - dragStart.x) * canvasWidth,
        height: Math.abs(dragCurrent.y - dragStart.y) * canvasHeight,
      }
      : lassoRegion
        ? {
          left: lassoRegion.x * canvasWidth,
          top: lassoRegion.y * canvasHeight,
          width: lassoRegion.w * canvasWidth,
          height: lassoRegion.h * canvasHeight,
        }
        : null;

  return (
    <>
      {/* Interaction overlay */}
      <div
        className="absolute inset-0 z-40"
        style={{ cursor: 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Dimmed overlay outside selection */}
        {selRect && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Dark overlay with cutout */}
            <div
              className="absolute inset-0 bg-black/50 transition-opacity duration-200"
              style={{
                clipPath: `polygon(
                  0% 0%, 100% 0%, 100% 100%, 0% 100%,
                  0% 0%,
                  ${selRect.left}px ${selRect.top}px,
                  ${selRect.left}px ${selRect.top + selRect.height}px,
                  ${selRect.left + selRect.width}px ${selRect.top + selRect.height}px,
                  ${selRect.left + selRect.width}px ${selRect.top}px,
                  ${selRect.left}px ${selRect.top}px
                )`,
              }}
            />
            {/* Selection border */}
            <div
              className="absolute border-2 border-brand-cyan rounded-sm shadow-[0_0_20px_rgba(0,229,255,0.15)]"
              style={{
                left: selRect.left,
                top: selRect.top,
                width: selRect.width,
                height: selRect.height,
              }}
            >
              {/* Corner handles */}
              {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
                <div
                  key={pos}
                  className="absolute w-2 h-2 bg-brand-cyan rounded-full border border-white shadow-lg"
                  style={{
                    ...(pos.includes('top') ? { top: -4 } : { bottom: -4 }),
                    ...(pos.includes('left') ? { left: -4 } : { right: -4 }),
                  }}
                />
              ))}
              {/* Size label */}
              <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-neutral-900/90 border border-white/10 rounded text-[10px] font-mono text-neutral-400 whitespace-nowrap">
                {Math.round(selRect.width)}x{Math.round(selRect.height)}px
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action panel */}
      {showActions && selRect && (
        <div
          className="absolute z-50 animate-in fade-in slide-in-from-bottom-2"
          style={{
            left: Math.min(
              selRect.left + selRect.width / 2 - 140,
              canvasWidth - 290
            ),
            top: Math.min(
              selRect.top + selRect.height + 12,
              canvasHeight - 200
            ),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-[280px] bg-neutral-900/95 border border-white/10 rounded-xl p-4 backdrop-blur-xl shadow-2xl flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Diamond size={14} className="text-brand-cyan" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-white">
                  Editar Região
                </span>
              </div>
              <button
                onClick={handleClose}
                className="p-1 rounded text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Action mode selector */}
            {!actionMode && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActionMode('layer')}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border border-white/5 bg-neutral-800/50 hover:border-brand-cyan/40 hover:bg-brand-cyan/5 transition-all group"
                >
                  <Plus size={18} className="text-neutral-400 group-hover:text-brand-cyan transition-colors" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 group-hover:text-white">
                    Nova Layer
                  </span>
                  <span className="text-[10px] text-neutral-600 text-center">
                    Cria por cima
                  </span>
                </button>
                <button
                  onClick={() => setActionMode('edit')}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border border-white/5 bg-neutral-800/50 hover:border-brand-cyan/40 hover:bg-brand-cyan/5 transition-all group"
                >
                  <Diamond size={18} className="text-neutral-400 group-hover:text-brand-cyan transition-colors" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 group-hover:text-white">
                    Editar com IA
                  </span>
                  <span className="text-[10px] text-neutral-600 text-center">
                    Altera a área
                  </span>
                </button>
              </div>
            )}

            {/* Prompt input */}
            {actionMode && (
              <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActionMode(null)}
                    className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
                  >
                    ← Voltar
                  </button>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-cyan">
                    {actionMode === 'layer' ? 'Nova Layer' : 'Editar Área'}
                  </span>
                </div>
                <textarea
                  autoFocus
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={
                    actionMode === 'layer'
                      ? 'O que criar nesta área?'
                      : 'Como editar esta região?'
                  }
                  rows={2}
                  className="w-full bg-neutral-800/60 border border-white/5 rounded-lg px-3 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-brand-cyan/40 resize-none"
                />
                <Button
                  variant="brand"
                  onClick={handleGenerate}
                  disabled={!aiPrompt.trim() || isGenerating}
                  className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <GlitchLoader size={14} />
                  ) : (
                    <>
                      <Diamond size={12} />
                      {actionMode === 'layer' ? 'Gerar Layer' : 'Aplicar Edição'}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
