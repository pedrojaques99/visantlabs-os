import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, PanelRightOpen, PanelRightClose, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { AppShell, AppShellTopBar, AppShellPanel, AppShellStatusBar } from '@/components/ui/AppShell';
import { HalftoneCanvas } from '@/components/halftone/HalftoneCanvas';
import { HalftoneControls } from '@/components/halftone/HalftoneControls';
import { useHalftoneStore } from '@/stores/halftoneStore';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

export const HalftonePage: React.FC = () => {
  const navigate = useNavigate();
  const store = useHalftoneStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return;
    store.setIsExporting(true);
    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvasRef.current!.toBlob((b) => resolve(b!), 'image/png');
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `halftone_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      store.setIsExporting(false);
    }
  }, [store]);

  return (
    <AppShell>
      <AppShellTopBar
        left={
          <>
            <Tooltip content="Back to apps">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={() => navigate('/apps')}>
                <ChevronLeft size={16} />
              </Button>
            </Tooltip>
            <span className="text-[10px] text-neutral-600 uppercase tracking-widest font-mono ml-1">
              CMYK HALFTONE
            </span>
          </>
        }
        right={
          <>
            <Tooltip content="Reset settings">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={store.resetSettings}>
                <RotateCcw size={14} />
              </Button>
            </Tooltip>
            {!isMobile && (
              <Tooltip content={store.panelVisible ? 'Hide panel' : 'Show panel'}>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={() => store.setPanelVisible(!store.panelVisible)}>
                  {store.panelVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                </Button>
              </Tooltip>
            )}
          </>
        }
      />

      <div
        className="absolute inset-0 pt-10 transition-all duration-300"
        style={{
          paddingRight: !isMobile && store.panelVisible ? 236 : 0,
          paddingBottom: isMobile ? (mobileSheetOpen ? '55%' : 52) : 40,
        }}
      >
        <HalftoneCanvas onCanvasReady={handleCanvasReady} />
      </div>

      {!isMobile && (
        <AppShellPanel side="right" visible={store.panelVisible} width={220}>
          <HalftoneControls onExport={handleExport} />
        </AppShellPanel>
      )}

      {isMobile && (
        <div className={cn(
          'absolute left-0 right-0 bottom-0 z-20 transition-all duration-300 ease-out',
          mobileSheetOpen ? 'h-[55%]' : 'h-[52px]',
        )}>
          <button
            onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
            className="w-full flex items-center justify-center gap-1 py-2 bg-neutral-900/90 backdrop-blur-xl border-t border-white/[0.06] text-neutral-400"
          >
            {mobileSheetOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            <span className="text-[10px] uppercase tracking-widest">Controls</span>
          </button>
          {mobileSheetOpen && (
            <div className="h-[calc(100%-36px)] bg-neutral-950/95 backdrop-blur-xl overflow-hidden">
              <HalftoneControls onExport={handleExport} />
            </div>
          )}
        </div>
      )}

      {!isMobile && (
        <AppShellStatusBar>
          <span>freq {store.frequency}</span>
          <span>•</span>
          <span>dot {store.dotSize.toFixed(2)}</span>
          <span>•</span>
          <span>{['subtractive', 'additive', 'normal'][store.blendMode]}</span>
          {store.fileName && (
            <>
              <span>•</span>
              <span className="max-w-[120px] truncate">{store.fileName}</span>
            </>
          )}
        </AppShellStatusBar>
      )}
    </AppShell>
  );
};
