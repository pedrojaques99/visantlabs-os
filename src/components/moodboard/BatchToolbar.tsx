import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Download, Video, Film, Trash2, X } from 'lucide-react';
import { AnimationPreset } from '../../types/moodboard';

interface BatchToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBatchUpscale: () => void;
  onBatchDownload: () => void;
  onBatchRemove: () => void;
  onBatchRemotion: (preset: AnimationPreset) => void;
  onAISuggest: () => void;
  isAISuggesting: boolean;
}

export const BatchToolbar: React.FC<BatchToolbarProps> = ({
  selectedCount, totalCount, onSelectAll, onClearSelection,
  onBatchUpscale, onBatchDownload, onBatchRemove, onBatchRemotion,
  onAISuggest, isAISuggesting,
}) => {
  if (totalCount === 0) return null;

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex justify-center pointer-events-none"
        >
          <div className="bg-neutral-950/90 backdrop-blur-xl px-6 py-3 rounded-full border border-border shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex items-center gap-5 pointer-events-auto">
            <div className="flex items-center gap-3 pr-5 border-r border-border">
              <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center font-bold text-sm">{selectedCount}</div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">Selected</span>
                <div className="flex items-center gap-3">
                  <button onClick={onClearSelection} className="text-[9px] font-bold uppercase tracking-widest text-white hover:opacity-60 transition-colors flex items-center gap-1">Clear <X size={9} /></button>
                  {selectedCount < totalCount && (
                    <button onClick={onSelectAll} className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors">All</button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={onAISuggest} disabled={isAISuggesting} title="AI Suggest"
                className="p-2.5 rounded-full bg-neutral-800 border border-border/70 text-neutral-300 hover:text-white hover:border-neutral-500 transition-all disabled:opacity-40">
                <Video size={16} className={isAISuggesting ? 'animate-pulse' : ''} />
              </button>

              <div className="h-6 w-px bg-neutral-800 mx-1" />

              <button onClick={onBatchUpscale} title="Upscale selected"
                className="p-2.5 rounded-full bg-neutral-800 border border-border/70 text-neutral-300 hover:text-white hover:border-neutral-500 transition-all">
                <Maximize2 size={16} strokeWidth={1} />
              </button>
              <button onClick={onBatchDownload} title="Download selected"
                className="p-2.5 rounded-full bg-neutral-800 border border-border/70 text-neutral-300 hover:text-white hover:border-neutral-500 transition-all">
                <Download size={16} strokeWidth={1} />
              </button>

              <div className="h-6 w-px bg-neutral-800 mx-1" />

              <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-full border border-border">
                {(['zoom-in', 'zoom-out', 'pan-lr', 'pan-rl', 'fade-in'] as AnimationPreset[]).map(preset => (
                  <button key={preset} onClick={() => onBatchRemotion(preset)}
                    className="px-2.5 py-1.5 rounded-full hover:bg-white hover:text-black transition-all text-[8px] font-bold uppercase tracking-widest text-neutral-400">
                    {preset.split('-')[0]}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-neutral-800 mx-1" />

              <button onClick={onBatchRemove} title="Remove selected"
                className="p-2.5 rounded-full bg-neutral-800 border border-border/70 text-neutral-400 hover:text-red-400 hover:border-red-500/40 transition-all">
                <Trash2 size={16} strokeWidth={1} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
