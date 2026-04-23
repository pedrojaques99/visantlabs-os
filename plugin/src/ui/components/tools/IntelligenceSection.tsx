import React from 'react';
import { useOpRunner } from '../../hooks/useOpRunner';
import { useSmartAnalyze } from '../../hooks/useSmartAnalyze';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { FileJson, Layers, StickyNote, BookOpen } from 'lucide-react';
import { NamingGuideModal, SmartScanModal } from '../brand/BrandModals';
import { useFigmaMessages } from '../../hooks/useFigmaMessages';

export function IntelligenceSection() {
  const { analyze } = useSmartAnalyze();
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const runner = useOpRunner({ globalBusy: isGenerating });
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [scanModalOpen, setScanModalOpen] = React.useState(false);
  const [scanItems, setScanItems] = React.useState([]);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (msg?.type === 'SMART_SCAN_RESULT') {
        setScanItems(msg.items || []);
        setScanModalOpen(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <OpButton
          opId="smartScan"
          runner={runner}
          message={{ type: 'SMART_SCAN_SELECTION' }}
          responseTypes={['SMART_SCAN_RESULT']}
          busyLabel="Scanning selection…"
          variant="brand"
          size="sm"
          className="w-full h-9 font-bold uppercase tracking-wider text-[10px]"
        >
          <Layers size={14} className="mr-2" />
          Smart Scan Selection
        </OpButton>
      </div>

      <OpButton
        opId="analyzeJson"
        runner={runner}
        task={() => analyze('figma-plugin')}
        busyLabel="Analyzing…"
        variant="outline"
        size="sm"
        className="w-full h-8 text-[10px]"
      >
        <FileJson size={12} className="mr-2 text-neutral-500" />
        Analyze to JSON
      </OpButton>

      <div className="pt-2 border-t border-white/5 space-y-3">
        <OpButton
          opId="sticky"
          runner={runner}
          message={{
            type: 'CREATE_STICKY_PROMPT',
            name: 'Design Note',
            prompt: 'Escreva aqui suas considerações sobre o design para que a IA possa usar como contexto.'
          }}
          responseTypes={['OPERATIONS_DONE']}
          busyLabel="Criando sticky…"
          variant="outline"
          size="sm"
          className="w-full h-8 text-[10px] border-dashed"
        >
          <StickyNote size={12} className="mr-2 text-neutral-500" />
          Add Context Sticky Note
        </OpButton>

        <button 
          onClick={() => setGuideOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 text-[9px] font-bold text-neutral-500 uppercase tracking-[0.2em] hover:text-brand-cyan transition-colors"
        >
          <BookOpen size={10} />
          Naming Guide
        </button>
      </div>

      <NamingGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      <SmartScanModal 
        isOpen={scanModalOpen} 
        items={scanItems} 
        onClose={() => setScanModalOpen(false)}
        onApply={(items) => {
          // Logic to apply categorized items (syncing to store etc)
          console.log('Applied scan items:', items);
          setScanModalOpen(false);
        }}
      />
    </div>
  );
}
