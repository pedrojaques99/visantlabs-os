import React, { useRef, useState, useEffect } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Video, Settings2, Clock, Maximize2, MoveHorizontal, Zap } from 'lucide-react';
import { MultiSlideComposition } from './MultiSlideComposition';
import { AnimatedSlide } from './AnimatedSlide';
import { AnimationPreset, RenderSlide, TransitionType, RenderComposition } from '../../types/moodboard';
import { Button } from '../ui/button';
import { useRenderQueue } from '../../hooks/moodboard/useRenderQueue';

interface ControlGroupProps { label: string; icon?: React.ReactNode; children: React.ReactNode; }
const ControlGroup: React.FC<ControlGroupProps> = ({ label, icon, children }) => (
  <div className="flex flex-col gap-3 p-4 rounded-2xl bg-neutral-900/60 border border-border hover:border-border/70 transition-all">
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">{icon}{label}</div>
    <div className="text-white">{children}</div>
  </div>
);

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
  isOpen, onClose, imageUrl, preset = 'zoom-in', slides: propSlides,
  transition = 'fade', transitionDurationFrames = 15, name, thumbnailUrl,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const { enqueue } = useRenderQueue();
  const fps = 30;

  const [zoomScale, setZoomScale] = useState(1.2);
  const [panAmount, setPanAmount] = useState(5);
  const [speed, setSpeed] = useState(1);
  const [durationPerSlide, setDurationPerSlide] = useState(5);

  useEffect(() => {
    if (isOpen) { setZoomScale(1.2); setPanAmount(5); setSpeed(1); setDurationPerSlide(5); }
  }, [isOpen]);

  if (!isOpen) return null;

  const baseSlides: RenderSlide[] = propSlides && propSlides.length > 0
    ? propSlides
    : imageUrl ? [{ imageUrl, preset, durationInSeconds: 5, width: 1920, height: 1080 }] : [];

  if (baseSlides.length === 0) return null;

  const slides = baseSlides.map(s => ({ ...s, durationInSeconds: durationPerSlide, zoomScale, panAmount, speed }));
  const isMulti = slides.length > 1;
  const totalFrames = slides.reduce((sum, s) => sum + Math.round(s.durationInSeconds * fps), 0)
    - (isMulti && transition !== 'none' ? (slides.length - 1) * transitionDurationFrames : 0);
  const outputWidth = Math.max(...slides.map(s => s.width));
  const outputHeight = Math.max(...slides.map(s => s.height));

  const handleEnqueueRender = () => {
    const composition: RenderComposition = {
      id: `render-${Date.now()}`,
      name: name || (isMulti ? `${slides.length} Slides` : 'Single Clip'),
      thumbnailUrl: thumbnailUrl || slides[0].imageUrl,
      slides, fps,
      transition: (isMulti ? transition : 'none') as TransitionType,
      transitionDurationFrames: isMulti ? transitionDurationFrames : 0,
    };
    enqueue(composition);
    onClose();
  };

  const handleRenderSeparately = () => {
    slides.forEach((slide, i) => enqueue({
      id: `render-${Date.now()}-${i}`, name: `Clip ${i + 1}`,
      thumbnailUrl: slide.imageUrl, slides: [slide], fps,
      transition: 'none', transitionDurationFrames: 0,
    }));
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-2xl" onClick={onClose}
        />
        <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-6xl bg-neutral-950 rounded-[2rem] overflow-hidden flex flex-col md:flex-row shadow-2xl border border-border"
        >
          <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
            <div className="p-5 border-b border-border flex items-center justify-between bg-neutral-900/50">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <h2 className="text-sm font-bold tracking-[0.2em] uppercase text-white/80">
                  {isMulti ? `${slides.length} Slides` : slides[0].preset?.replace('-', ' ')}
                </h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-full transition-all md:hidden text-white">
                <X size={20} />
              </button>
            </div>

            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[400px]">
              {isMulti ? (
                <Player ref={playerRef} component={MultiSlideComposition as any} durationInFrames={Math.max(totalFrames, 1)}
                  compositionWidth={outputWidth} compositionHeight={outputHeight} fps={fps}
                  style={{ width: '100%', height: '100%' }}
                  inputProps={{ slides, transition, transitionDurationFrames, fps }}
                  controls loop autoPlay
                />
              ) : (
                <Player ref={playerRef} component={AnimatedSlide as any} durationInFrames={Math.max(totalFrames, 1)}
                  compositionWidth={outputWidth} compositionHeight={outputHeight} fps={fps}
                  style={{ width: '100%', height: '100%' }}
                  inputProps={{ imageUrl: slides[0].imageUrl, preset: slides[0].preset, zoomScale, panAmount, speed }}
                  controls loop autoPlay
                />
              )}
            </div>

            <div className="p-5 bg-neutral-900/50 border-t border-border flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <p className="text-[10px] text-neutral-500 uppercase tracking-[0.3em]">MP4 · {outputWidth}x{outputHeight}</p>
                <p className="text-[10px] text-neutral-600 uppercase tracking-[0.3em]">{fps} FPS · {(totalFrames / fps).toFixed(1)}s{isMulti && ` · ${transition} transitions`}</p>
              </div>
              {isMulti ? (
                <div className="flex items-center gap-3">
                  <Button variant="secondary" size="sm" onClick={handleRenderSeparately}><Video size={14} className="mr-1" />{slides.length} Separate</Button>
                  <Button variant="default" size="sm" onClick={handleEnqueueRender}><Video size={14} className="mr-1" />Combined</Button>
                </div>
              ) : (
                <Button variant="default" size="sm" onClick={handleEnqueueRender}><Video size={14} className="mr-1" />Render MP4</Button>
              )}
            </div>
          </div>

          <div className="w-full md:w-[300px] bg-neutral-950 flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500"><Settings2 size={14} />Parameters</div>
              <button onClick={onClose} className="hidden md:flex p-2 hover:bg-neutral-800 rounded-full transition-all text-white"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {[
                { label: 'Duration', icon: <Clock size={12} />, value: durationPerSlide, min: 1, max: 15, step: 0.5, unit: 's', setter: setDurationPerSlide },
                { label: 'Playback Speed', icon: <Zap size={12} />, value: speed, min: 0.5, max: 3, step: 0.1, unit: 'x', setter: setSpeed },
                { label: 'Zoom Magnitude', icon: <Maximize2 size={12} />, value: zoomScale, min: 1, max: 2, step: 0.05, unit: 'x', setter: setZoomScale, display: (v: number) => (v - 1).toFixed(2) },
                { label: 'Panning Amount', icon: <MoveHorizontal size={12} />, value: panAmount, min: 0, max: 20, step: 1, unit: '%', setter: setPanAmount },
              ].map(({ label, icon, value, min, max, step, unit, setter, display }) => (
                <ControlGroup key={label} label={label} icon={icon}>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                      <span>{label}</span>
                      <span className="text-white bg-neutral-800 px-2 py-0.5 rounded-lg border border-border/70">{display ? display(value) : value}{unit}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={value} onChange={e => setter(Number(e.target.value))} className="w-full accent-white" />
                  </div>
                </ControlGroup>
              ))}

              <button onClick={() => { setZoomScale(1.2); setPanAmount(5); setSpeed(1); setDurationPerSlide(5); }}
                className="w-full py-3 text-[10px] uppercase tracking-widest font-bold text-neutral-600 hover:text-white transition-colors mt-auto">
                Reset to Defaults
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
