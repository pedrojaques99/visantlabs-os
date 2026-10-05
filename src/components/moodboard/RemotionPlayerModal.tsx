import React, { useRef, useState, useEffect } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { Player, PlayerRef } from '@remotion/player';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Video, Settings2, Clock, Maximize2, MoveHorizontal, Zap } from '@/lib/ui/icons';
import { MultiSlideComposition } from './MultiSlideComposition';
import { AnimatedSlide } from './AnimatedSlide';
import {
  AnimationPreset,
  RenderSlide,
  TransitionType,
  RenderComposition,
} from '../../types/moodboard';
import { Button } from '../ui/button';
import { useRenderQueue } from '../../hooks/moodboard/useRenderQueue';
import { useTranslation } from '@/hooks/useTranslation';

interface RemotionPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  preset?: AnimationPreset;
  slides?: RenderSlide[];
  transition?: TransitionType;
  transitionDurationFrames?: number;
  name?: string;
  thumbnailUrl?: string;
}

export const RemotionPlayerModal: React.FC<RemotionPlayerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  preset = 'zoom-in',
  slides: propSlides,
  transition = 'fade',
  transitionDurationFrames = 15,
  name,
  thumbnailUrl,
}) => {
  useScrollLock(isOpen);
  const { t } = useTranslation();
  const playerRef = useRef<PlayerRef>(null);
  const { enqueue } = useRenderQueue();
  const fps = 30;

  const [zoomScale, setZoomScale] = useState(1.2);
  const [panAmount, setPanAmount] = useState(5);
  const [speed, setSpeed] = useState(1);
  const [durationPerSlide, setDurationPerSlide] = useState(5);

  useEffect(() => {
    if (isOpen) {
      setZoomScale(1.2);
      setPanAmount(5);
      setSpeed(1);
      setDurationPerSlide(5);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const baseSlides: RenderSlide[] =
    propSlides && propSlides.length > 0
      ? propSlides
      : imageUrl
        ? [{ imageUrl, preset, durationInSeconds: 5, width: 1920, height: 1080 }]
        : [];

  if (baseSlides.length === 0) return null;

  const slides = baseSlides.map((s) => ({
    ...s,
    durationInSeconds: durationPerSlide,
    zoomScale,
    panAmount,
    speed,
  }));
  const isMulti = slides.length > 1;
  const totalFrames =
    slides.reduce((sum, s) => sum + Math.round(s.durationInSeconds * fps), 0) -
    (isMulti && transition !== 'none' ? (slides.length - 1) * transitionDurationFrames : 0);
  const outputWidth = Math.max(...slides.map((s) => s.width));
  const outputHeight = Math.max(...slides.map((s) => s.height));

  const handleEnqueueRender = () => {
    const composition: RenderComposition = {
      id: `render-${Date.now()}`,
      name:
        name ||
        (isMulti
          ? t('moodboard.render.slides', { count: slides.length })
          : t('moodboard.render.clip')),
      thumbnailUrl: thumbnailUrl || slides[0].imageUrl,
      slides,
      fps,
      transition: (isMulti ? transition : 'none') as TransitionType,
      transitionDurationFrames: isMulti ? transitionDurationFrames : 0,
    };
    enqueue(composition);
    onClose();
  };

  const handleRenderSeparately = () => {
    slides.forEach((slide, i) =>
      enqueue({
        id: `render-${Date.now()}-${i}`,
        name: t('moodboard.render.clipN', { n: i + 1 }),
        thumbnailUrl: slide.imageUrl,
        slides: [slide],
        fps,
        transition: 'none',
        transitionDurationFrames: 0,
      })
    );
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="relative w-full max-w-6xl bg-neutral-950 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-2xl border border-border"
        >
          <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
            <div className="p-5 border-b border-border flex items-center justify-between bg-neutral-900/50">
              <h2 className="text-sm font-semibold text-white">
                {isMulti
                  ? t('moodboard.render.slides', { count: slides.length })
                  : t(`moodboard.item.presets.${slides[0].preset}`)}
              </h2>
              <button
                onClick={onClose}
                aria-label={t('common.close')}
                className="p-2 hover:bg-neutral-800 rounded-full transition-colors md:hidden text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[400px]">
              {isMulti ? (
                <Player
                  ref={playerRef}
                  component={MultiSlideComposition as any}
                  durationInFrames={Math.max(totalFrames, 1)}
                  compositionWidth={outputWidth}
                  compositionHeight={outputHeight}
                  fps={fps}
                  style={{ width: '100%', height: '100%' }}
                  inputProps={{ slides, transition, transitionDurationFrames, fps }}
                  controls
                  loop
                  autoPlay
                />
              ) : (
                <Player
                  ref={playerRef}
                  component={AnimatedSlide as any}
                  durationInFrames={Math.max(totalFrames, 1)}
                  compositionWidth={outputWidth}
                  compositionHeight={outputHeight}
                  fps={fps}
                  style={{ width: '100%', height: '100%' }}
                  inputProps={{
                    imageUrl: slides[0].imageUrl,
                    preset: slides[0].preset,
                    zoomScale,
                    panAmount,
                    speed,
                  }}
                  controls
                  loop
                  autoPlay
                />
              )}
            </div>

            <div className="p-5 bg-neutral-900/50 border-t border-border flex items-center justify-between">
              {/* EXCEÇÃO ao ruido-scan/mono: spec técnica do arquivo (formato, px, fps, s) */}
              <p className="text-2xs font-mono tabular-nums text-neutral-500">
                MP4, {outputWidth}x{outputHeight}, {fps} fps, {(totalFrames / fps).toFixed(1)}s
              </p>
              {isMulti ? (
                <div className="flex items-center gap-3">
                  <Button variant="secondary" size="sm" onClick={handleRenderSeparately}>
                    <Video size={14} className="mr-1" />
                    {t('moodboard.render.separate', { count: slides.length })}
                  </Button>
                  <Button variant="default" size="sm" onClick={handleEnqueueRender}>
                    <Video size={14} className="mr-1" />
                    {t('moodboard.render.combined')}
                  </Button>
                </div>
              ) : (
                <Button variant="default" size="sm" onClick={handleEnqueueRender}>
                  <Video size={14} className="mr-1" />
                  {t('moodboard.render.renderMp4')}
                </Button>
              )}
            </div>
          </div>

          <div className="w-full md:w-[300px] bg-neutral-950 flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
                <Settings2 size={14} />
                {t('moodboard.render.settings')}
              </div>
              <button
                onClick={onClose}
                aria-label={t('common.close')}
                className="hidden md:flex p-2 hover:bg-neutral-800 rounded-full transition-colors text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {[
                {
                  label: t('moodboard.render.duration'),
                  icon: <Clock size={12} />,
                  value: durationPerSlide,
                  min: 1,
                  max: 15,
                  step: 0.5,
                  unit: 's',
                  setter: setDurationPerSlide,
                },
                {
                  label: t('moodboard.render.speed'),
                  icon: <Zap size={12} />,
                  value: speed,
                  min: 0.5,
                  max: 3,
                  step: 0.1,
                  unit: 'x',
                  setter: setSpeed,
                },
                {
                  label: t('moodboard.render.zoom'),
                  icon: <Maximize2 size={12} />,
                  value: zoomScale,
                  min: 1,
                  max: 2,
                  step: 0.05,
                  unit: 'x',
                  setter: setZoomScale,
                  display: (v: number) => (v - 1).toFixed(2),
                },
                {
                  label: t('moodboard.render.pan'),
                  icon: <MoveHorizontal size={12} />,
                  value: panAmount,
                  min: 0,
                  max: 20,
                  step: 1,
                  unit: '%',
                  setter: setPanAmount,
                },
              ].map(({ label, icon, value, min, max, step, unit, setter, display }) => (
                <label
                  key={label}
                  className="flex flex-col gap-3 p-4 rounded-2xl bg-neutral-900/60 border border-border"
                >
                  <span className="flex items-center justify-between gap-2 text-xs font-medium text-neutral-400">
                    <span className="flex items-center gap-2">
                      {icon}
                      {label}
                    </span>
                    <span className="text-2xs font-mono tabular-nums text-white bg-neutral-800 px-2 py-0.5 rounded-lg border border-border/70">
                      {display ? display(value) : value}
                      {unit}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => setter(Number(e.target.value))}
                    className="w-full accent-white"
                  />
                </label>
              ))}

              <button
                onClick={() => {
                  setZoomScale(1.2);
                  setPanAmount(5);
                  setSpeed(1);
                  setDurationPerSlide(5);
                }}
                className="w-full py-3 text-xs font-medium text-neutral-500 hover:text-white transition-colors mt-auto"
              >
                {t('common.reset')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
