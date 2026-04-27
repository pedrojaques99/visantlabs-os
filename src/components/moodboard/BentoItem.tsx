import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Maximize2, Download, CheckSquare, Square, Video, Play, Loader2, Film, Zap, Check, RotateCcw } from 'lucide-react';
import { CroppedImage, AnimationPreset } from '../../types/moodboard';
import { ModelSelector } from '@/components/shared/ModelSelector';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import type { ImageProvider } from '@/types/types';

interface BentoItemProps {
  crop: CroppedImage;
  index: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onUpscale: (id: string) => void;
  onAnimate: (id: string, prompt: string) => void;
  onRemotionAnimate: (url: string, preset: AnimationPreset) => void;
  onDownload: (url: string, filename: string) => void;
  onFullscreen: (url: string) => void;
  onViewVideo: (url: string) => void;
  onUpdateImage?: (file: File) => void;
  onRegenerate?: (id: string, model: string, provider: ImageProvider) => void;
  onAcceptRegenerated?: (id: string) => void;
  onDiscardRegenerated?: (id: string) => void;
  isRegenerating?: boolean;
}

const Timer: React.FC<{ startTime: number }> = ({ startTime }) => {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => setElapsed((Date.now() - startTime) / 1000), 100);
    return () => clearInterval(i);
  }, [startTime]);
  return <span className="font-mono text-[10px] tabular-nums text-neutral-600">{elapsed.toFixed(1)}s</span>;
};

export const BentoItem: React.FC<BentoItemProps> = React.memo(({
  crop, index, isSelected, onToggleSelect, onRemove, onUpscale,
  onAnimate, onRemotionAnimate, onDownload, onFullscreen, onViewVideo, onUpdateImage,
  onRegenerate, onAcceptRegenerated, onDiscardRegenerated, isRegenerating,
}) => {
  const [prompt, setPrompt] = useState(crop.animationPrompt || '');
  const [regenModel, setRegenModel] = useState<string>(GEMINI_MODELS.IMAGE_FLASH);
  const [regenProvider, setRegenProvider] = useState<ImageProvider>('gemini');

  const handleAnimate = () => {
    if (!prompt.trim()) return;
    onAnimate(crop.id, prompt);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`group relative overflow-hidden bg-neutral-900/40 backdrop-blur-sm transition-all duration-500 rounded-2xl border ${isSelected ? 'border-white ring-1 ring-white/20' : 'border-border hover:border-border/70'}`}
    >
      <div className="flex flex-col sm:flex-row h-full min-h-[220px]">
        {/* Left — Image */}
        <div className="relative w-full sm:w-[42%] overflow-hidden cursor-zoom-in border-r border-border bg-neutral-950">
          {crop.url ? (
            <>
              <img
                src={crop.regeneratedUrl || crop.thumbnailUrl || crop.url}
                alt={`Item ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onClick={() => onFullscreen(crop.regeneratedUrl || crop.upscaledUrl || crop.url)}
                loading="lazy"
              />
              {crop.regeneratedUrl && (
                <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-sm p-2 flex items-center justify-between gap-2 z-20">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-purple-400 flex items-center gap-1">
                    <Zap size={9} />AI Result
                  </span>
                  <div className="flex gap-1.5">
                    <button onClick={e => { e.stopPropagation(); onDiscardRegenerated?.(crop.id); }}
                      className="p-1.5 rounded-lg bg-neutral-800 border border-border/70 text-neutral-400 hover:text-red-400 hover:border-red-500/40 transition-all" title="Discard">
                      <RotateCcw size={11} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); onAcceptRegenerated?.(crop.id); }}
                      className="p-1.5 rounded-lg bg-white text-black hover:opacity-90 transition-all" title="Accept">
                      <Check size={11} />
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={e => { e.stopPropagation(); onToggleSelect(crop.id); }}
                className={`absolute top-3 left-3 p-2 rounded-xl backdrop-blur-md transition-all z-20 border shadow-lg ${isSelected ? 'bg-white text-black border-white scale-110' : 'bg-black/40 text-white border-white/20 opacity-0 group-hover:opacity-100'}`}
              >
                {isSelected ? <CheckSquare size={16} strokeWidth={2} /> : <Square size={16} strokeWidth={1.5} />}
              </button>
            </>
          ) : (
            <div className="h-full flex items-center justify-center p-8 text-center hover:bg-neutral-800/30 transition-colors group/upload relative cursor-pointer">
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => { const f = e.target.files?.[0]; if (f && onUpdateImage) onUpdateImage(f); }} accept="image/*" />
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-neutral-800 border border-dashed border-border/70 flex items-center justify-center group-hover/upload:scale-110 transition-transform">
                  <Play size={18} className="text-neutral-500 rotate-90" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-600">Click to add image</span>
              </div>
            </div>
          )}

          <button onClick={e => { e.stopPropagation(); onRemove(crop.id); }}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40 backdrop-blur-md text-neutral-400 border border-white/10 opacity-0 group-hover:opacity-100 hover:bg-red-500/80 hover:text-white transition-all z-10"
          >
            <X size={14} strokeWidth={1.5} />
          </button>

          {crop.isUpscaling && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
              <Loader2 size={20} className="text-white animate-spin" />
              <span className="text-[9px] uppercase tracking-[0.3em] font-bold text-neutral-400">Upscaling</span>
              {crop.upscaleStartTime && <Timer startTime={crop.upscaleStartTime} />}
            </div>
          )}

          {crop.isAnimating && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
              <Loader2 size={20} className="text-white animate-spin" />
              <span className="text-[9px] uppercase tracking-[0.3em] font-bold text-neutral-400">Animating</span>
              {crop.animationStartTime && <Timer startTime={crop.animationStartTime} />}
            </div>
          )}

          {crop.videoUrl && !crop.isAnimating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all cursor-pointer" onClick={() => onViewVideo(crop.videoUrl!)} role="button" tabIndex={0} aria-label="View video">
              <Play size={28} className="text-white drop-shadow-2xl translate-x-0.5" fill="currentColor" />
            </div>
          )}
        </div>

        {/* Right — Controls */}
        <div className="flex-1 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-[0.2em]">ITEM #{index + 1}</span>
              <div className="flex gap-1.5">
                {!crop.upscaledUrl && !crop.isUpscaling && crop.url && (
                  <button onClick={() => onUpscale(crop.id)} title="Upscale to 4K"
                    className="p-2 rounded-lg bg-neutral-800/50 border border-border/70 text-neutral-400 hover:text-white hover:border-neutral-500 transition-all text-[8px] font-bold uppercase tracking-widest flex items-center gap-1">
                    <Maximize2 size={13} strokeWidth={1.5} /> 4K
                  </button>
                )}
                <button onClick={() => onDownload(crop.upscaledUrl || crop.url, `item-${index + 1}${crop.upscaledUrl ? '-4k' : ''}.jpg`)}
                  disabled={!crop.url}
                  className="p-2 rounded-lg bg-neutral-800/50 border border-border/70 text-neutral-400 hover:text-white hover:border-neutral-500 transition-all disabled:opacity-30">
                  <Download size={13} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {crop.url && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5"><Film size={11} className="text-neutral-600" /><span className="text-[8px] font-bold uppercase tracking-widest text-neutral-600">Remotion Direction</span></div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['zoom-in', 'zoom-out', 'pan-lr', 'pan-rl', 'fade-in'] as AnimationPreset[]).map(p => (
                      <button key={p} onClick={() => onRemotionAnimate(crop.upscaledUrl || crop.url, p)}
                        className="px-2.5 py-1 rounded-lg border border-border bg-neutral-900/50 text-[9px] font-medium text-neutral-400 hover:bg-white hover:text-black hover:border-white transition-all capitalize">
                        {p.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5"><Video size={11} className="text-neutral-600" /><span className="text-[8px] font-bold uppercase tracking-widest text-neutral-600">Veo 3 Animation</span></div>
                  <div className="flex gap-2">
                    <input type="text" value={prompt} onChange={e => setPrompt(e.target.value)}
                      placeholder="Animation prompt..."
                      className="flex-1 bg-neutral-900/50 border border-border focus:border-neutral-600 rounded-lg px-3 py-2 text-[10px] text-white placeholder:text-neutral-700 outline-none transition-all"
                      onKeyDown={e => e.key === 'Enter' && handleAnimate()}
                    />
                    <button onClick={handleAnimate} disabled={!prompt.trim() || !crop.url || crop.isAnimating}
                      className="px-3 py-2 rounded-lg bg-white text-black text-[9px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-30">
                      <Video size={13} />
                    </button>
                  </div>
                </div>

                {onRegenerate && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5"><Zap size={11} className="text-neutral-600" /><span className="text-[8px] font-bold uppercase tracking-widest text-neutral-600">Regenerate with AI</span></div>
                    <div className="flex gap-2 items-center">
                      <ModelSelector
                        type="image"
                        variant="node"
                        selectedModel={regenModel}
                        onModelChange={(model, provider) => { setRegenModel(model); if (provider) setRegenProvider(provider); }}
                        className="flex-1"
                      />
                      <button
                        onClick={() => onRegenerate(crop.id, regenModel, regenProvider)}
                        disabled={!crop.url || isRegenerating}
                        className="px-3 py-2 rounded-lg bg-neutral-800 border border-border text-neutral-300 hover:bg-white hover:text-black text-[9px] font-bold uppercase tracking-widest transition-all disabled:opacity-30 flex items-center gap-1.5 shrink-0"
                      >
                        {isRegenerating ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {crop.upscaledUrl && (
            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[8px] font-bold tracking-widest text-neutral-500 uppercase">4K Ready</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

BentoItem.displayName = 'BentoItem';
