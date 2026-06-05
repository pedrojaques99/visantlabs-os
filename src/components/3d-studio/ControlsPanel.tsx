import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SendToButton } from '@/components/shared/SendToButton';
import { useTranslation } from '@/hooks/useTranslation';
import { useIsMobile } from '@/hooks/use-media-query';
import { Download } from 'lucide-react';
import { ToolPanel, ToolPanelContent } from '@/components/shared/ToolPanel';
import { SceneTab } from './panels/SceneTab';
import { LookTab } from './panels/LookTab';
import { CameraTab } from './panels/CameraTab';
import { AnimationTab } from './panels/AnimationTab';
import { EffectsTab } from './panels/EffectsTab';

const TABS = [
  { id: 'scene', label: 'Model' },
  { id: 'look', label: 'Object' },
  { id: 'camera', label: 'Scene' },
  { id: 'animate', label: 'Animate' },
  { id: 'effects', label: 'FX' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface ControlsPanelProps {
  onExport: () => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = React.memo(({ onExport }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabId>('scene');

  return (
    <ToolPanel>
      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-neutral-800/50">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 font-mono uppercase tracking-widest transition-colors',
              isMobile ? 'py-3 text-[11px]' : 'py-2 text-[10px]',
              activeTab === tab.id
                ? 'text-white border-b border-white'
                : 'text-neutral-600 hover:text-neutral-400'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <ToolPanelContent>
        {activeTab === 'scene' && <SceneTab />}
        {activeTab === 'look' && <LookTab />}
        {activeTab === 'camera' && <CameraTab />}
        {activeTab === 'animate' && <AnimationTab />}
        {activeTab === 'effects' && <EffectsTab />}
      </ToolPanelContent>

      {/* Sticky bottom — Export button */}
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-2.5 flex gap-2">
        <Button
          onClick={onExport}
          aria-label="Export"
          className="flex-1 bg-white hover:bg-neutral-200 text-black font-medium text-xs h-8"
        >
          <Download size={12} className="mr-1.5" />
          {t('studio3d.export.title')}
        </Button>
        <SendToButton source="3d-studio" outputMime="image/png" />
      </div>
    </ToolPanel>
  );
});
