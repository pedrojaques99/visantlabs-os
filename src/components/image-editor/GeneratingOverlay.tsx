import React, { useState, useEffect, useRef } from 'react';
import { useImageEditorStore } from '@/stores/imageEditorStore';
import { GlitchPickaxe } from '@/components/ui/GlitchPickaxe';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { EDITOR_STATUS_MESSAGES } from '@/constants/imageEditorTokens';

export const GeneratingOverlay: React.FC = () => {
  const isGenerating = useImageEditorStore((s) => s.isGenerating);
  const generatingStartTime = useImageEditorStore((s) => s.generatingStartTime);

  const [elapsed, setElapsed] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (!isGenerating) {
      setElapsed(0);
      setStatusIndex(0);
      return;
    }

    intervalRef.current = setInterval(() => {
      if (generatingStartTime) {
        setElapsed(Math.floor((Date.now() - generatingStartTime) / 1000));
      }
    }, 1000);

    const statusInterval = setInterval(() => {
      setStatusIndex((i) => (i + 1) % EDITOR_STATUS_MESSAGES.length);
    }, 3000);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(statusInterval);
    };
  }, [isGenerating, generatingStartTime]);

  if (!isGenerating) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const handleCancel = () => {
    useImageEditorStore.getState().setGenerating(false);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <div className="absolute inset-0 bg-neutral-900/40 pointer-events-none" />
      <div className="relative flex flex-col items-center gap-3 p-6 rounded-2xl bg-neutral-900/80 backdrop-blur-xl border border-white/10">
        <GlitchPickaxe size={28} />
        <GlitchLoader size="sm" />
        <p className="text-xs text-neutral-400 font-mono animate-fade-in">
          {EDITOR_STATUS_MESSAGES[statusIndex]}
        </p>
        {elapsed > 0 && (
          <span className="text-[10px] text-neutral-500/50 font-mono">
            {timeStr}
          </span>
        )}
        <button
          onClick={handleCancel}
          className="mt-1 px-3 py-1 text-[10px] font-mono text-neutral-500 hover:text-neutral-300 border border-neutral-700 hover:border-neutral-500 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
