import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Film, Send, Image as ImageIcon, Volume2, VolumeX } from 'lucide-react';
import { Button } from '../ui/button';

const PROMPT_PRESETS = [
  { id: 'subtle', name: 'Subtle', prompt: 'A subtle cinematic scene with professional lighting, slow camera movement, and high aesthetic quality.' },
  { id: 'dynamic', name: 'Dynamic', prompt: 'A dynamic cinematic transition with energy, fluid motion, and vibrant atmosphere.' },
  { id: 'atmospheric', name: 'Atmospheric', prompt: 'Deep atmospheric cinematic vision with moody lighting, particles, and ethereal feel.' }
];

interface FrameAnimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnimate: (start: string, end: string, prompt: string) => void;
  sourceImage: string;
  allowSound: boolean;
  onSoundToggle: () => void;
}

export const FrameAnimateModal: React.FC<FrameAnimateModalProps> = ({
  isOpen, onClose, onAnimate, sourceImage, allowSound, onSoundToggle,
}) => {
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-2xl" onClick={onClose}
        />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 40 }}
          className="relative w-full max-w-4xl bg-neutral-950 rounded-[2rem] overflow-hidden flex flex-col max-h-[85vh] border border-border shadow-2xl"
        >
          <div className="p-7 border-b border-border flex items-center justify-between bg-neutral-900/30">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-lg">
                <Film className="text-black" size={20} strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white">Frame Animation</h2>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500">Veo 3 Pro Engine</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-full transition-all text-neutral-400 hover:text-white">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="p-10 overflow-y-auto flex flex-col gap-10">
            <div className="grid grid-cols-2 gap-10">
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-neutral-500">Start Frame</span>
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-neutral-900 border border-border group">
                  <img src={startImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Start" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/80 flex items-center gap-2"><ImageIcon size={12} /> Source Active</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-neutral-500">End Frame</span>
                <div onClick={() => endInputRef.current?.click()} role="button" tabIndex={0} aria-label="Select end frame image"
                  className="relative aspect-video rounded-2xl overflow-hidden bg-neutral-900 border border-dashed border-border/70 hover:border-neutral-500 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 group"
                >
                  {endImage ? (
                    <>
                      <img src={endImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="End" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/80 flex items-center gap-2"><Upload size={12} /> Change Frame</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center group-hover:scale-110 transition-transform border border-border/70">
                        <Upload size={20} className="text-neutral-500 group-hover:text-white transition-colors" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 group-hover:text-white transition-colors">Upload End Frame</span>
                    </>
                  )}
                  <input type="file" ref={endInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-neutral-500">Cinematic Vision</span>
                <div className="flex gap-2">
                  {PROMPT_PRESETS.map(p => (
                    <button key={p.id} onClick={() => setPrompt(p.prompt)}
                      className="px-3 py-1.5 rounded-full bg-neutral-800/50 border border-border/70 text-[9px] font-bold uppercase tracking-widest text-neutral-400 hover:bg-neutral-700 hover:text-white transition-all flex items-center gap-1.5">
                      <Film size={9} />{p.name}
                    </button>
                  ))}
                </div>
              </div>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder="Describe the cinematic transition between frames..."
                className="w-full bg-neutral-900/50 border border-border focus:border-neutral-600 rounded-2xl p-6 text-sm outline-none transition-all min-h-[140px] resize-none text-white placeholder:text-neutral-700"
              />
            </div>
          </div>

          <div className="p-7 bg-neutral-900/30 border-t border-border flex justify-end items-center gap-4">
            <span className="text-[10px] font-serif italic text-neutral-600 mr-auto">Veo 3 interpolates motion between frames</span>
            <button onClick={onSoundToggle}
              className={`p-3 rounded-xl border transition-all ${allowSound ? 'bg-white text-black border-white' : 'bg-neutral-900 text-neutral-500 border-border hover:border-neutral-600'}`}>
              {allowSound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <Button variant="default" size="default" disabled={!endImage || !prompt.trim()} onClick={() => endImage && prompt && onAnimate(startImage, endImage, prompt)}>
              <Send size={16} className="mr-2" />Generate Cinematic Video
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
