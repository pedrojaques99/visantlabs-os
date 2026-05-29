import React from 'react';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useStudio3DStore,
  ANIMATION_PRESETS,
} from '@/stores/studio3dStore';
import {
  ToolPanelSection, ToolPanelGrid, ToolPanelChip, ToolPanelRow,
} from '@/components/shared/ToolPanel';

export const AnimationTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const store = useStudio3DStore();

  const [animateSpeed, setAnimateSpeed] = useDebouncedSlider(store.animateSpeed, store.setAnimateSpeed);
  const [physicsCount, setPhysicsCount] = useDebouncedSlider(store.physicsCount, store.setPhysicsCount);
  const [physicsGravity, setPhysicsGravity] = useDebouncedSlider(store.physicsGravity, store.setPhysicsGravity);
  const [physicsBounciness, setPhysicsBounciness] = useDebouncedSlider(store.physicsBounciness, store.setPhysicsBounciness);
  const [physicsFriction, setPhysicsFriction] = useDebouncedSlider(store.physicsFriction, store.setPhysicsFriction);
  const [physicsSize, setPhysicsSize] = useDebouncedSlider(store.physicsSize, (v: number) => {
    store.setPhysicsSize(v);
    const maxCount = Math.max(1, Math.round(100 - (v - 0.2) * (92 / 1.5)));
    if (store.physicsCount > maxCount) store.setPhysicsCount(maxCount);
  });

  return (
    <>
      {/* Animation Type — always visible */}
      <ToolPanelSection title={t('studio3d.animation.type')}>
        <ToolPanelGrid>
          {ANIMATION_PRESETS.map((a) => (
            <ToolPanelChip key={a.id} active={store.animate === a.id} onClick={() => store.setAnimate(a.id)}>
              {a.label}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
      </ToolPanelSection>

      {/* Physics params */}
      {store.animate === 'physicsFall' && (
        <ToolPanelSection title="PHYSICS">
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Count" value={physicsCount} min={1} max={Math.max(1, Math.round(100 - (store.physicsSize - 0.2) * (92 / 1.5)))} step={1} onChange={setPhysicsCount} />
            <ScrubInput label="Gravity" value={physicsGravity} min={0} max={30} step={0.5} onChange={setPhysicsGravity} />
            <ScrubInput label="Bounce" value={physicsBounciness} min={0} max={1} step={0.05} onChange={setPhysicsBounciness} />
            <ScrubInput label="Friction" value={physicsFriction} min={0} max={1} step={0.05} onChange={setPhysicsFriction} />
          </div>
          <ScrubInput label="Size" value={physicsSize} min={0.2} max={2} step={0.05} onChange={setPhysicsSize} />
          <Button variant="outline" size="sm" className="w-full text-[10px] uppercase tracking-wider h-8" onClick={() => useStudio3DStore.setState({ resetKey: Date.now() })}>
            {t('studio3d.animation.physics.reset')}
          </Button>
        </ToolPanelSection>
      )}

      {/* Standard animation params */}
      {store.animate !== 'none' && store.animate !== 'physicsFall' && (
        <ToolPanelSection title="CONTROLS">
          <ScrubInput label="Speed" value={animateSpeed} min={0.1} max={5} step={0.1} onChange={setAnimateSpeed} />
          <ToolPanelGrid>
            {(['linear', 'easeIn', 'easeOut', 'easeInOut'] as const).map((e) => (
              <ToolPanelChip key={e} active={store.animateEasing === e} onClick={() => store.setAnimateEasing(e)}>
                {t(`studio3d.animation.easings.${e}`)}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
          <ToolPanelRow label={t('studio3d.animation.reverse')}>
            <Switch checked={store.animateReverse} onCheckedChange={store.setAnimateReverse} aria-label="Reverse animation" />
          </ToolPanelRow>
        </ToolPanelSection>
      )}
    </>
  );
});
