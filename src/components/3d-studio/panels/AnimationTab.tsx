import React from 'react';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, type SelectOption } from '@/components/ui/select';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import { useStudio3DStore, ANIMATION_PRESETS } from '@/stores/studio3dStore';
import { useShallow } from 'zustand/react/shallow';
import type { StoreState } from './_shared';
import { ToolPanelDisclosure, ToolPanelRow } from '@/components/shared/ToolPanel';

// Animation Type options for the shared <Select> (mapped from the store SSoT).
const ANIMATION_TYPE_OPTIONS: SelectOption[] = ANIMATION_PRESETS.map((a) => ({
  value: a.id,
  label: a.label,
}));

const EASING_VALUES = ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const;

// Fine-grained subscription: only the animation/physics slice. Replaces the
// full-store `useStudio3DStore()` which re-rendered this panel on every store
// mutation (camera orbit, _cameraInfo writes, other-tab edits). Actions have
// stable identities so including them is free under useShallow.
const animationPanelSelector = (s: StoreState) => ({
  animate: s.animate,
  animateSpeed: s.animateSpeed,
  animateEasing: s.animateEasing,
  animateReverse: s.animateReverse,
  physicsCount: s.physicsCount,
  physicsGravity: s.physicsGravity,
  physicsBounciness: s.physicsBounciness,
  physicsFriction: s.physicsFriction,
  physicsSize: s.physicsSize,
  setAnimate: s.setAnimate,
  setAnimateSpeed: s.setAnimateSpeed,
  setAnimateEasing: s.setAnimateEasing,
  setAnimateReverse: s.setAnimateReverse,
  setPhysicsCount: s.setPhysicsCount,
  setPhysicsGravity: s.setPhysicsGravity,
  setPhysicsBounciness: s.setPhysicsBounciness,
  setPhysicsFriction: s.setPhysicsFriction,
  setPhysicsSize: s.setPhysicsSize,
});

export const AnimationTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const store = useStudio3DStore(useShallow(animationPanelSelector));

  // Easing options for the shared <Select> (translated labels).
  const easingOptions: SelectOption[] = EASING_VALUES.map((e) => ({
    value: e,
    label: t(`studio3d.animation.easings.${e}`),
  }));

  const [animateSpeed, setAnimateSpeed] = useDebouncedSlider(
    store.animateSpeed,
    store.setAnimateSpeed
  );
  const [physicsCount, setPhysicsCount] = useDebouncedSlider(
    store.physicsCount,
    store.setPhysicsCount
  );
  const [physicsGravity, setPhysicsGravity] = useDebouncedSlider(
    store.physicsGravity,
    store.setPhysicsGravity
  );
  const [physicsBounciness, setPhysicsBounciness] = useDebouncedSlider(
    store.physicsBounciness,
    store.setPhysicsBounciness
  );
  const [physicsFriction, setPhysicsFriction] = useDebouncedSlider(
    store.physicsFriction,
    store.setPhysicsFriction
  );
  const [physicsSize, setPhysicsSize] = useDebouncedSlider(store.physicsSize, (v: number) => {
    store.setPhysicsSize(v);
    const maxCount = Math.max(1, Math.round(100 - (v - 0.2) * (92 / 1.5)));
    if (store.physicsCount > maxCount) store.setPhysicsCount(maxCount);
  });

  const isStandardAnim = store.animate !== 'none' && store.animate !== 'physicsFall';

  return (
    <>
      {/* Essentials — Animation Type */}
      <span className="text-[11px] text-neutral-400">{t('studio3d.animation.type')}</span>
      <Select
        options={ANIMATION_TYPE_OPTIONS}
        value={store.animate}
        onChange={(v) => store.setAnimate(v as typeof store.animate)}
      />

      {/* Standard animation params — Speed / Easing / Reverse */}
      {isStandardAnim && (
        <>
          <ScrubInput
            label="Speed"
            value={animateSpeed}
            min={0.1}
            max={5}
            step={0.1}
            onChange={setAnimateSpeed}
          />

          <span className="text-[11px] text-neutral-400">{t('studio3d.animation.easing')}</span>
          <Select
            options={easingOptions}
            value={store.animateEasing}
            onChange={(v) => store.setAnimateEasing(v as typeof store.animateEasing)}
          />

          <ToolPanelRow label={t('studio3d.animation.reverse')}>
            <Switch
              checked={store.animateReverse}
              onCheckedChange={store.setAnimateReverse}
              aria-label="Reverse animation"
            />
          </ToolPanelRow>
        </>
      )}

      {/* Advanced — Physics parameters (only when physicsFall is selected) */}
      {store.animate === 'physicsFall' && (
        <ToolPanelDisclosure label="Advanced" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label="Count"
              value={physicsCount}
              min={1}
              max={Math.max(1, Math.round(100 - (store.physicsSize - 0.2) * (92 / 1.5)))}
              step={1}
              onChange={setPhysicsCount}
            />
            <ScrubInput
              label="Gravity"
              value={physicsGravity}
              min={0}
              max={30}
              step={0.5}
              onChange={setPhysicsGravity}
            />
            <ScrubInput
              label="Bounce"
              value={physicsBounciness}
              min={0}
              max={1}
              step={0.05}
              onChange={setPhysicsBounciness}
            />
            <ScrubInput
              label="Friction"
              value={physicsFriction}
              min={0}
              max={1}
              step={0.05}
              onChange={setPhysicsFriction}
            />
          </div>
          <ScrubInput
            label="Size"
            value={physicsSize}
            min={0.2}
            max={2}
            step={0.05}
            onChange={setPhysicsSize}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full text-[10px] uppercase tracking-wider h-8"
            onClick={() => useStudio3DStore.setState({ resetKey: Date.now() })}
          >
            {t('studio3d.animation.physics.reset')}
          </Button>
        </ToolPanelDisclosure>
      )}
    </>
  );
});
