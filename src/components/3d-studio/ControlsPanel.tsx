import React from 'react';
import { SendToButton } from '@/components/shared/SendToButton';
import { PanelSectionTabs, type PanelTab } from '@/components/shared/PanelSectionTabs';
import { useTranslation } from '@/hooks/useTranslation';
import { Box, Camera, Clapperboard, Palette, Sparkles, Wand2 } from '@/lib/ui/icons';
import { ToolPanel, ToolPanelExportActions } from '@/components/shared/ToolPanel';
import { EssentialsTab } from './panels/EssentialsTab';
import { SceneTab } from './panels/SceneTab';
import { LookTab } from './panels/LookTab';
import { CameraTab } from './panels/CameraTab';
import { AnimationTab } from './panels/AnimationTab';
import { EffectsTab } from './panels/EffectsTab';

interface ControlsPanelProps {
  onExport: () => void;
  /** Lazy capture of the current scene canvas as a PNG data URL (for "Send to"). */
  getCanvasPng?: () => string | undefined;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = React.memo(
  ({ onExport, getCanvasPng }) => {
    const { t } = useTranslation();
    const tabs: PanelTab[] = [
      {
        id: 'essentials',
        icon: <Sparkles size={16} />,
        label: t('studio3d.panelTabs.basics'),
        content: <EssentialsTab />,
      },
      {
        id: 'scene',
        icon: <Box size={16} />,
        label: t('studio3d.panelTabs.model'),
        content: <SceneTab />,
      },
      {
        id: 'look',
        icon: <Palette size={16} />,
        label: t('studio3d.panelTabs.object'),
        content: <LookTab />,
      },
      {
        id: 'camera',
        icon: <Camera size={16} />,
        label: t('studio3d.panelTabs.scene'),
        content: <CameraTab />,
      },
      {
        id: 'animate',
        icon: <Clapperboard size={16} />,
        label: t('studio3d.panelTabs.animate'),
        content: <AnimationTab />,
      },
      {
        id: 'effects',
        icon: <Wand2 size={16} />,
        label: t('studio3d.panelTabs.effects'),
        content: <EffectsTab />,
      },
    ];

    return (
      <ToolPanel>
        <PanelSectionTabs tabs={tabs} />
        <ToolPanelExportActions
          onExport={onExport}
          isExporting={false}
          disabled={false}
          sendTo={
            <SendToButton
              source="3d-studio"
              outputMime="image/png"
              mimeType="image/png"
              label="3D render"
              getImageBase64={getCanvasPng}
            />
          }
        />
      </ToolPanel>
    );
  }
);
