import React, { useEffect, useState } from 'react';
import { usePluginStore } from '../../store';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';
import { Button } from '@/components/ui/button';
import { Layers, Download, Search } from 'lucide-react';
import { ComponentLibraryModal } from './BrandModals';

export function ComponentLibrarySection() {
  const { allComponents, componentThumbs } = usePluginStore();
  const [modalOpen, setModalOpen] = useState(false);
  const { send } = useFigmaMessages();

  useEffect(() => {
    if (allComponents.length > 0 && Object.keys(componentThumbs).length === 0) {
      send({ type: 'GET_COMPONENT_THUMBNAILS' } as any);
    }
  }, [allComponents.length]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-500 flex items-center gap-2">
          <Layers size={12} />
          Library Index
        </h3>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 hover:bg-white/5" 
          onClick={() => parent.postMessage({ pluginMessage: { type: 'GET_CONTEXT' } }, 'https://www.figma.com')} 
          title="Sincronizar Library"
        >
          <Search size={12} className="text-neutral-500" />
        </Button>
      </div>

      {allComponents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3 border border-dashed border-white/5 rounded-xl bg-neutral-950/20">
          <Layers size={24} className="text-neutral-800" />
          <p className="text-[10px] text-neutral-500 font-mono text-center">No components indexed in this file.</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-[9px] uppercase tracking-widest font-bold border-white/10"
            onClick={() => parent.postMessage({ pluginMessage: { type: 'GET_CONTEXT' } }, 'https://www.figma.com')} 
          >
            Scan Library
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {allComponents.slice(0, 4).map((comp) => {
            const thumb = comp.thumbnail || componentThumbs[comp.id];
            return (
              <div 
                key={comp.id} 
                className="group bg-neutral-950/40 border border-white/5 rounded-lg p-2 hover:border-brand-cyan/20 transition-all cursor-pointer"
                onClick={() => parent.postMessage({ pluginMessage: { type: 'SELECT_AND_ZOOM', nodeId: comp.id } }, 'https://www.figma.com')}
              >
                <div className="aspect-video bg-neutral-950 rounded flex items-center justify-center mb-1.5 overflow-hidden border border-white/5">
                  {thumb ? (
                    <img src={thumb} alt={comp.name} className="max-w-full max-h-full object-contain opacity-60 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <Layers size={14} className="text-neutral-800" />
                  )}
                </div>
                <div className="text-[9px] font-mono text-neutral-500 group-hover:text-neutral-300 truncate">
                  {comp.name}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {allComponents.length > 4 && (
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-[9px] font-bold uppercase tracking-widest h-8 border-white/5 hover:bg-white/5"
          onClick={() => setModalOpen(true)}
        >
          View all {allComponents.length} components
        </Button>
      )}

      <ComponentLibraryModal 
        isOpen={modalOpen}
        components={allComponents}
        thumbnails={componentThumbs}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
