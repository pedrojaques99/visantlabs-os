import React, { useState, useRef } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Film, Send, Volume2, VolumeX } from '@/lib/ui/icons';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Thumb } from '@/components/ui/Thumb';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { useTranslation } from '@/hooks/useTranslation';

// Prompts vão pro Veo: ficam em inglês de propósito (o modelo responde melhor).
const PROMPT_PRESETS = [
  {
    id: 'subtle',
    prompt:
      'A subtle cinematic scene with professional lighting, slow camera movement, and high aesthetic quality.',
  },
  {
    id: 'dynamic',
    prompt: 'A dynamic cinematic transition with energy, fluid motion, and vibrant atmosphere.',
  },
  {
    id: 'atmospheric',
    prompt: 'Deep atmospheric cinematic vision with moody lighting, particles, and ethereal feel.',
  },
] as const;

interface FrameAnimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnimate: (start: string, end: string, prompt: string) => void;
  sourceImage: string;
  allowSound: boolean;
  onSoundToggle: () => void;
}

export const FrameAnimateModal: React.FC<FrameAnimateModalProps> = ({
  isOpen,
  onClose,
  onAnimate,
  sourceImage,
  allowSound,
  onSoundToggle,
}) => {
  useScrollLock(isOpen);
  const { t } = useTranslation();
  const [startImage] = useState<string>(sourceImage);
  const [endImage, setEndImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const endInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setEndImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  const frameLabel = 'text-xs font-medium text-muted-foreground';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="frame-animate-title"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="relative w-full max-w-4xl bg-popover rounded-xl overflow-hidden flex flex-col max-h-[85vh] border border-border shadow-2xl"
        >
          <div className="px-6 py-5 border-b border-border flex items-center justify-between">
            <h2 id="frame-animate-title" className="text-lg font-semibold text-foreground">
              {t('moodboard.frame.title')}
            </h2>
            <button
              onClick={onClose}
              aria-label={t('common.close')}
              className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex flex-col gap-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <span className={frameLabel}>{t('moodboard.frame.start')}</span>
                <div className="relative aspect-video rounded-xl overflow-hidden bg-muted border border-border">
                  <Thumb src={startImage} className="w-full h-full object-cover" alt="" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className={frameLabel}>{t('moodboard.frame.end')}</span>
                <button
                  type="button"
                  onClick={() => endInputRef.current?.click()}
                  className="relative aspect-video rounded-xl overflow-hidden bg-muted border border-dashed border-border/70 hover:border-border-hover transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 group"
                >
                  {endImage ? (
                    <>
                      <Thumb src={endImage} className="w-full h-full object-cover" alt="" />
                      <span
                        className={cn(
                          // EXCEÇÃO ao ui-scale/opacidade-cru: scrim sobre mídia
                          'absolute inset-0 bg-black/50 flex items-center justify-center gap-2 text-xs font-medium text-white',
                          hoverReveal
                        )}
                      >
                        <Upload size={12} /> {t('moodboard.frame.changeEnd')}
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload
                        size={20}
                        className="text-muted-foreground group-hover:text-foreground transition-colors"
                      />
                      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        {t('moodboard.frame.uploadEnd')}
                      </span>
                    </>
                  )}
                </button>
                <input
                  type="file"
                  ref={endInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="frame-animate-prompt" className={frameLabel}>
                  {t('moodboard.frame.motion')}
                </label>
                <div className="flex gap-2">
                  {PROMPT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPrompt(p.prompt)}
                      className="px-3 py-1.5 rounded-full bg-muted border border-border/70 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      {t(`moodboard.frame.presets.${p.id}`)}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                id="frame-animate-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t('moodboard.frame.promptPlaceholder')}
                className="w-full bg-muted border border-border focus:border-ring rounded-xl p-5 text-sm outline-none transition-colors min-h-[140px] resize-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="px-6 py-5 border-t border-border flex justify-end items-center gap-3">
            <button
              onClick={onSoundToggle}
              aria-pressed={allowSound}
              aria-label={t('moodboard.frame.sound')}
              title={t('moodboard.frame.sound')}
              className={`p-3 rounded-xl border transition-colors ${
                allowSound
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-muted text-muted-foreground border-border hover:border-border-hover'
              }`}
            >
              {allowSound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <Button
              variant="default"
              size="default"
              disabled={!endImage || !prompt.trim()}
              onClick={() => endImage && prompt && onAnimate(startImage, endImage, prompt)}
            >
              <Send size={16} className="mr-2" />
              {t('moodboard.frame.generate')}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
