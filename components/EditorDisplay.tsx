import React from 'react';
import { Download, ImageIcon, Palette, Camera, MapPin, ZoomIn, ZoomOut } from 'lucide-react';
import { GlitchLoader } from './ui/GlitchLoader';
import { AngleSelector } from './mockupmachine/AngleSelector';
import type { AspectRatio } from '../types';

interface EditorDisplayProps {
  base64Image: string | null;
  isLoading: boolean;
  onView: () => void;
  onNewAngle: (angle: string) => void;
  onNewBackground: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  aspectRatio: AspectRatio;
  availableAngles?: string[];
}

export const EditorDisplay: React.FC<EditorDisplayProps> = ({ 
  base64Image, 
  isLoading, 
  onView, 
  onNewAngle, 
  onNewBackground, 
  onZoomIn, 
  onZoomOut, 
  aspectRatio,
  availableAngles = ["Eye-Level", "High Angle", "Low Angle", "Top-Down (Flat Lay)", "Dutch Angle", "Worm's-Eye View"]
}) => {
  const imageUrl = base64Image ? `data:image/png;base64,${base64Image}` : '';
  const canInteract = !isLoading && base64Image;
  
  const aspectRatioClasses: Partial<Record<AspectRatio, string>> = {
    '16:9': 'aspect-[16/9]',
    '4:3': 'aspect-[4/3]',
    '1:1': 'aspect-square',
    '9:16': 'aspect-[9/16]',
    '21:9': 'aspect-[21/9]',
    '2:3': 'aspect-[2/3]',
    '3:2': 'aspect-[3/2]',
    '3:4': 'aspect-[3/4]',
    '4:5': 'aspect-[4/5]',
    '5:4': 'aspect-[5/4]',
  };

  if (!base64Image && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-zinc-600">
        <Palette size={64} strokeWidth={1} />
        <h2 className="mt-4 text-xl font-semibold font-mono uppercase">UPLOAD A MOCKUP</h2>
        <p className="mt-1 text-sm text-zinc-500">Upload a mockup image to start editing.</p>
      </div>
    );
  }

  return (
    <section className="h-full flex items-center justify-center py-4 md:py-8">
      <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 md:px-6">
        <div
          className={`relative ${aspectRatioClasses[aspectRatio] || 'aspect-[16/9]'} bg-black/20 rounded-md overflow-hidden group border border-zinc-800/50 transition-all duration-300 hover:border-zinc-700/80 hover:shadow-2xl hover:shadow-black/30 hover:scale-[1.02] animate-fade-in w-full`}
          onClick={canInteract ? onView : undefined}
        >
          {base64Image && (
            <img 
              src={imageUrl} 
              alt="Edited mockup" 
              loading="lazy"
              className={`w-full h-full object-cover ${isLoading ? 'filter blur-sm scale-105' : ''}`} 
            />
          )}
          
          {isLoading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <GlitchLoader size={32} color="rgba(255, 255, 255, 0.8)" />
            </div>
          )}

          {!isLoading && !base64Image && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-700 overflow-hidden" role="status" aria-label="Processing mockup...">
              <ImageIcon size={40} strokeWidth={1} className="opacity-50" aria-hidden="true" />
              <div className="absolute inset-0 w-full h-full bg-transparent -translate-x-full animate-shimmer shimmer-glow"></div>
              <span className="sr-only">Processing mockup, please wait...</span>
            </div>
          )}

          {canInteract && (
            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 z-10 backdrop-blur-[2px] flex-wrap">
              <a
                href={imageUrl}
                download={`mockup-${Date.now()}.png`}
                className="p-3 bg-zinc-900/50 rounded-md text-zinc-300 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-all transform hover:scale-[1.03]"
                title="Download"
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={20} />
              </a>
              <div onClick={(e) => e.stopPropagation()}>
                <AngleSelector
                  availableAngles={availableAngles}
                  onAngleSelect={onNewAngle}
                  disabled={isLoading}
                  className="inline-flex"
                  buttonClassName="p-3 bg-zinc-900/50 rounded-md text-zinc-300 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-all transform hover:scale-[1.03]"
                />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onNewBackground(); }}
                className="p-3 bg-zinc-900/50 rounded-md text-zinc-300 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-all transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-[#52ddeb]/50 focus:ring-offset-2 focus:ring-offset-black/70"
                title="New Background (Change environment)"
                aria-label="Generate new background"
              >
                <MapPin size={20} aria-hidden="true" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onZoomIn(); }}
                className="p-3 bg-zinc-900/50 rounded-md text-zinc-300 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-all transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-[#52ddeb]/50 focus:ring-offset-2 focus:ring-offset-black/70"
                title="Zoom In (Move camera closer)"
                aria-label="Zoom in"
              >
                <ZoomIn size={20} aria-hidden="true" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onZoomOut(); }}
                className="p-3 bg-zinc-900/50 rounded-md text-zinc-300 hover:bg-brand-cyan/20 hover:text-brand-cyan transition-all transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-[#52ddeb]/50 focus:ring-offset-2 focus:ring-offset-black/70"
                title="Zoom Out (Move camera further)"
                aria-label="Zoom out"
              >
                <ZoomOut size={20} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

