import React, { useRef, useEffect } from 'react';
import { useCreativeStore } from './store/creativeStore';
import { useBrandKit } from '@/contexts/BrandKitContext';
import { useCanvasHeader } from '@/components/canvas/CanvasHeaderContext';
import { CreativeSetupSidebar } from './CreativeSetupSidebar';
import { CreativeEditorSidebar } from './CreativeEditorSidebar';
import { CreativeCanvas } from './CreativeCanvas';
import { CreativeToolbar } from './CreativeToolbar';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { exportCanvasAsPng } from './lib/exportPng';
import { getPreviewDimensions } from './lib/formatDimensions';
import { toast } from 'sonner';

export const CreativeStudio: React.FC = () => {
  const { status, format, brandId } = useCreativeStore();
  const { colors } = useBrandKit();
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = React.useState({ width: 0, height: 0 });

  // Sync brandId with global CanvasHeader so useBrandKit() picks it up
  const { setLinkedGuidelineId } = useCanvasHeader();
  useEffect(() => {
    if (brandId) setLinkedGuidelineId(brandId);
  }, [brandId, setLinkedGuidelineId]);

  // Compute preview dimensions on mount + resize
  useEffect(() => {
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const padding = 64;
      const maxW = el.offsetWidth - padding * 2;
      const maxH = el.offsetHeight - padding * 2;
      setPreviewSize(getPreviewDimensions(format, maxW, maxH));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [format]);

  const accentColor = colors[0]?.hex ?? '#00e5ff';

  const handleExport = async () => {
    if (!canvasRef.current) return;
    try {
      await exportCanvasAsPng(canvasRef.current, format, `creative-${Date.now()}.png`);
      toast.success('Criativo exportado!');
    } catch (err: any) {
      toast.error(err?.message ?? 'Falha ao exportar');
    }
  };

  return (
    <div className="flex h-[calc(100vh-0px)] bg-black">
      {status === 'editing' ? (
        <CreativeEditorSidebar onExport={handleExport} />
      ) : (
        <CreativeSetupSidebar />
      )}

      <main
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden"
      >
        {status === 'generating' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-black/40 backdrop-blur-sm">
            <GlitchLoader size={32} color="#00e5ff" />
            <p className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
              Gerando criativo...
            </p>
          </div>
        )}

        {status === 'setup' && previewSize.width > 0 && (
          <div
            className="border border-dashed border-white/10 rounded-sm"
            style={{ width: previewSize.width, height: previewSize.height }}
          />
        )}

        {status === 'editing' && previewSize.width > 0 && (
          <CreativeCanvas
            ref={canvasRef}
            width={previewSize.width}
            height={previewSize.height}
            accentColor={accentColor}
          />
        )}
      </main>

      {status === 'editing' && <CreativeToolbar />}
    </div>
  );
};
