/**
 * ScenePresetsStrip — the quick-start gallery shared by the Essentials tab and the
 * Model tab: built-in scene presets, a Random shuffle, and (when a brand is applied)
 * the on-brand scene gallery derived from brand tokens. Self-contained: reads its own
 * store slice + brand guidelines so it can drop into any panel.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Shuffle, Palette } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStudio3DStore, SCENE_PRESETS } from '@/stores/studio3dStore';
import { ToolPanelDisclosure, ToolPanelSection } from '@/components/shared/ToolPanel';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { useTranslation } from '@/hooks/useTranslation';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { generateBrandScenes } from '@/lib/studio3d/brandScenes';
import { usePresetPreviews } from './usePresetPreviews';

const selector = (s: ReturnType<typeof useStudio3DStore.getState>) => ({
  applyScenePreset: s.applyScenePreset,
  applyConfig: s.applyConfig,
  randomize: s.randomize,
  _brandGuidelineId: s._brandGuidelineId,
});

/**
 * One quick-start group. `flat` renders it as a loose section (label + divider,
 * always open) for the essentialist Basics tab; otherwise a collapsible disclosure
 * (the Model tab's denser layout).
 */
const PresetGroup: React.FC<{
  flat: boolean;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ flat, label, icon, children }) =>
  flat ? (
    <ToolPanelSection title={label}>{children}</ToolPanelSection>
  ) : (
    <ToolPanelDisclosure label={label} icon={icon} defaultOpen>
      {children}
    </ToolPanelDisclosure>
  );

export const ScenePresetsStrip: React.FC<{ flat?: boolean }> = React.memo(({ flat = false }) => {
  const { t } = useTranslation();
  const store = useStudio3DStore(useShallow(selector));
  const presetThumbs = usePresetPreviews();
  const [hasRandomizedOnce, setHasRandomizedOnce] = useState(false);
  const [showRandomizeConfirm, setShowRandomizeConfirm] = useState(false);

  const { data: brandGuidelines = [] } = useBrandGuidelines(true);
  const appliedBrand = useMemo(
    () => brandGuidelines.find((g) => g.id === store._brandGuidelineId) ?? null,
    [brandGuidelines, store._brandGuidelineId]
  );
  const brandScenes = useMemo(() => generateBrandScenes(appliedBrand), [appliedBrand]);

  return (
    <>
      {/* Scene Presets — horizontal strip with 3D previews */}
      <PresetGroup
        flat={flat}
        label={t('studio3d.scenePresets.title')}
        icon={<Shuffle size={13} />}
      >
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent -mx-0.5 px-0.5 pb-0.5">
          {Object.entries(SCENE_PRESETS).map(([name, preset]) => (
            <button
              key={name}
              onClick={() => store.applyScenePreset(name)}
              className="shrink-0 flex flex-col items-center gap-1 group transition-all duration-150"
            >
              <div
                className="w-14 h-14 rounded-md overflow-hidden border border-white/10 group-hover:border-white/30 transition-colors"
                style={{ background: preset.background }}
              >
                {presetThumbs[name] ? (
                  <img
                    src={presetThumbs[name]}
                    alt={preset.label}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full animate-pulse bg-white/5" />
                )}
              </div>
              <span className="text-[8px] font-mono uppercase tracking-wider text-neutral-500 group-hover:text-neutral-300 transition-colors max-w-14 truncate">
                {preset.label}
              </span>
            </button>
          ))}
          <button
            onClick={() => {
              if (!hasRandomizedOnce) {
                setShowRandomizeConfirm(true);
              } else {
                store.randomize();
                toast.success('Surprise!');
              }
            }}
            className="shrink-0 flex flex-col items-center gap-1 group transition-all duration-150"
          >
            <div className="w-14 h-14 rounded-md overflow-hidden border border-dashed border-cyan-500/30 group-hover:border-cyan-500/50 flex items-center justify-center transition-colors">
              <Shuffle size={16} className="text-cyan-400" />
            </div>
            <span className="text-[8px] font-mono uppercase tracking-wider text-cyan-500 group-hover:text-cyan-300 transition-colors max-w-14 truncate">
              Random
            </span>
          </button>
        </div>
      </PresetGroup>

      {/* Brand Scenes — on-brand looks generated from the applied brand's tokens */}
      {brandScenes.length > 0 && (
        <PresetGroup
          flat={flat}
          label={`${appliedBrand?.identity?.name || appliedBrand?.name || 'Brand'} Scenes`}
          icon={<Palette size={13} />}
        >
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent -mx-0.5 px-0.5 pb-0.5">
            {brandScenes.map((scene) => (
              <button
                key={scene.key}
                onClick={() =>
                  store.applyConfig(scene.config as Parameters<typeof store.applyConfig>[0])
                }
                className="shrink-0 flex flex-col items-center gap-1 group transition-all duration-150"
                title={scene.label}
              >
                <div
                  className="w-14 h-14 rounded-md overflow-hidden border border-white/10 group-hover:border-white/30 transition-colors flex items-center justify-center"
                  style={{ background: scene.swatches[0] }}
                >
                  <div
                    className="w-7 h-7 rounded-full transition-transform group-hover:scale-110"
                    style={{
                      background: scene.swatches[1],
                      boxShadow: `0 0 0 2px ${scene.swatches[2]}`,
                    }}
                  />
                </div>
                <span className="text-[8px] font-mono uppercase tracking-wider text-neutral-500 group-hover:text-neutral-300 transition-colors max-w-14 truncate">
                  {scene.label}
                </span>
              </button>
            ))}
          </div>
        </PresetGroup>
      )}

      <ConfirmationModal
        isOpen={showRandomizeConfirm}
        onClose={() => setShowRandomizeConfirm(false)}
        onConfirm={() => {
          setHasRandomizedOnce(true);
          setShowRandomizeConfirm(false);
          store.randomize();
          toast.success('Surprise!');
        }}
        title={t('studio3d.randomizeTitle')}
        message={t('studio3d.randomizeMessage')}
        confirmText={t('studio3d.randomizeConfirm')}
        variant="warning"
      />
    </>
  );
});

ScenePresetsStrip.displayName = 'ScenePresetsStrip';
