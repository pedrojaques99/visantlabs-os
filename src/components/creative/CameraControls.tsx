import React from 'react';
import { Grid3x3, Keyboard } from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  StageDock,
  StageDockDivider,
  StageDockZoom,
  stageDockButton,
} from '@/components/shared/StageDock';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useCreativeStore } from './store/creativeStore';

interface Props {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onCheatsheet: () => void;
}

export const CameraControls: React.FC<Props> = ({
  scale,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onCheatsheet,
}) => {
  const { t } = useTranslation();
  const gridEnabled = useCreativeStore((s) => s.gridEnabled);
  const setGridEnabled = useCreativeStore((s) => s.setGridEnabled);

  return (
    <StageDock className="bottom-3">
      <StageDockZoom zoom={scale} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFit={onZoomReset} />
      <StageDockDivider />
      <Tooltip content={t('toolDock.snap')}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('toolDock.snap')}
          aria-pressed={gridEnabled}
          className={cn(stageDockButton, gridEnabled && 'bg-accent text-foreground')}
          onClick={() => setGridEnabled(!gridEnabled)}
        >
          <Grid3x3 size={14} />
        </Button>
      </Tooltip>
      <Tooltip content={t('toolDock.shortcuts')}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('toolDock.shortcuts')}
          className={stageDockButton}
          onClick={onCheatsheet}
        >
          <Keyboard size={14} />
        </Button>
      </Tooltip>
    </StageDock>
  );
};
