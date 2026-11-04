import React from 'react';
import { StageDockTransport } from '@/components/shared/StageDock';
import { useIsMobile } from '@/hooks/use-media-query';
import { useInkBleedStore } from '@/stores/inkBleedStore';

interface InkBleedTransportProps {
  onTogglePlay: () => void;
  onOpenChange: (open: boolean) => void;
}

/** Lives apart from the page: the time changes every frame, and only this reads it. */
export const InkBleedTransport: React.FC<InkBleedTransportProps> = ({
  onTogglePlay,
  onOpenChange,
}) => {
  const isMobile = useIsMobile();
  const progress = useInkBleedStore((s) => s.progress);
  const isPlaying = useInkBleedStore((s) => s.isPlaying);
  const duration = useInkBleedStore((s) => s.doc.motion.duration);
  const setProgress = useInkBleedStore((s) => s.setProgress);
  const setPlaying = useInkBleedStore((s) => s.setPlaying);
  const now = `${(progress * duration).toFixed(1)}s`;

  return (
    <StageDockTransport
      playing={isPlaying}
      onToggle={onTogglePlay}
      value={progress}
      max={1}
      step={0.002}
      onSeek={(value) => {
        setPlaying(false);
        setProgress(value);
      }}
      readout={isMobile ? now : `${now} / ${duration.toFixed(1)}s`}
      onOpenChange={onOpenChange}
    />
  );
};
