import React from 'react';
import { useOpRunner } from '../../hooks/useOpRunner';
import { useSmartAnalyze } from '../../hooks/useSmartAnalyze';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { FileJson, Layers, StickyNote, BookOpen } from 'lucide-react';
import { NamingGuideModal, SmartScanModal } from '../brand/BrandModals';

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
    <div className="space-y-2">
      <OpButton
        opId="smartScan"
        runner={runner}
        message={{ type: 'SMART_SCAN_SELECTION' }}
        responseTypes={['SMART_SCAN_RESULT']}
        busyLabel="Scanning…"
        variant="brand"
        size="sm"
        title="Detect tokens, colors, typography, and components in the selection"
        className="w-full h-8 font-bold uppercase tracking-wider text-[10px]"
      >
        <Layers size={12} className="mr-2" />
        Smart Scan
      </OpButton>

      <div className="grid grid-cols-3 gap-2">
        <OpButton
          opId="analyzeJson"
          runner={runner}
          task={() => analyze('figma-plugin')}
          busyLabel="…"
          variant="outline"
          size="sm"
          title="Export selection structure as JSON for AI consumption"
          className="h-8 text-[10px]"
        >
          <FileJson size={11} className="mr-1.5 text-neutral-500" />
          JSON
        </OpButton>
        <OpButton
          opId="analyzePrompt"
          runner={runner}
          task={() => analyze('image-gen')}
          busyLabel="…"
          variant="outline"
          size="sm"
          title="Generate an image-gen prompt describing the selection"
          className="h-8 text-[10px]"
        >
          <FileJson size={11} className="mr-1.5 text-neutral-500" />
          Prompt
        </OpButton>
        <OpButton
          opId="sticky"
          runner={runner}
          message={{
            type: 'CREATE_STICKY_PROMPT',
            name: 'Design Note',
            prompt:
              'Escreva aqui suas considerações sobre o design para que a IA possa usar como contexto.',
          }}
          responseTypes={['OPERATIONS_DONE']}
          busyLabel="…"
          variant="outline"
          size="sm"
          title="Add a sticky note for AI to read as design context"
          className="h-8 text-[10px] border-dashed"
        >
          <StickyNote size={11} className="mr-1.5 text-neutral-500" />
          Sticky
        </OpButton>
      </div>

      <button
        onClick={() => setGuideOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 py-1 text-[8px] text-neutral-600 hover:text-neutral-400 transition-colors uppercase tracking-widest"
      >
        <BookOpen size={9} />
        Naming Guide
      </button>

      <NamingGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      <SmartScanModal
        isOpen={scanModalOpen}
        items={scanItems}
        onClose={() => setScanModalOpen(false)}
        onApply={() => setScanModalOpen(false)}
      />
    </div>
  );
}
