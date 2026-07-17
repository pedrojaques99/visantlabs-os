import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useOpRunner } from '../../hooks/useOpRunner';
import { useSmartAnalyze } from '../../hooks/useSmartAnalyze';
import { usePluginStore } from '../../store';
import { OpButton } from '../common/OpButton';
import { FileJson, Layers, StickyNote, BookOpen } from 'lucide-react';
import { NamingGuideModal, SmartScanModal } from '../brand/BrandModals';
import { SMART_SCAN_REQUESTER, isSmartScanFor } from '../../lib/smartScan';

export function IntelligenceSection() {
  const { t } = useTranslation();
  const { analyze } = useSmartAnalyze();
  const isGenerating = usePluginStore((s) => s.isGenerating);
  const runner = useOpRunner({ globalBusy: isGenerating });
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [scanModalOpen, setScanModalOpen] = React.useState(false);
  const [scanItems, setScanItems] = React.useState([]);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      // Only our own scan — the logo matrix listens for this result too.
      if (msg?.type === 'SMART_SCAN_RESULT' && isSmartScanFor(msg, SMART_SCAN_REQUESTER.toolsIntelligence)) {
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
        message={{
          type: 'SMART_SCAN_SELECTION',
          requester: SMART_SCAN_REQUESTER.toolsIntelligence,
        }}
        responseTypes={['SMART_SCAN_RESULT']}
        busyLabel={t('plugin.tools.intelligence.scanning')}
        variant="brand"
        size="sm"
        title={t('plugin.tools.intelligence.smartScanTitle')}
        className="w-full h-8 font-bold uppercase tracking-wider text-[10px]"
      >
        <Layers size={12} className="mr-2" />
        {t('plugin.tools.intelligence.smartScan')}
      </OpButton>

      <div className="grid grid-cols-3 gap-2">
        <OpButton
          opId="analyzeJson"
          runner={runner}
          task={() => analyze('figma-plugin')}
          busyLabel="…"
          variant="outline"
          size="sm"
          title={t('plugin.tools.intelligence.jsonTitle')}
          className="h-8 text-[10px]"
        >
          <FileJson size={11} className="mr-1.5 text-muted-foreground" />
          JSON
        </OpButton>
        <OpButton
          opId="analyzePrompt"
          runner={runner}
          task={() => analyze('image-gen')}
          busyLabel="…"
          variant="outline"
          size="sm"
          title={t('plugin.tools.intelligence.promptTitle')}
          className="h-8 text-[10px]"
        >
          <FileJson size={11} className="mr-1.5 text-muted-foreground" />
          Prompt
        </OpButton>
        <OpButton
          opId="sticky"
          runner={runner}
          message={{
            type: 'CREATE_STICKY_PROMPT',
            name: t('plugin.tools.intelligence.designNoteName'),
            prompt:
              t('plugin.tools.intelligence.designNotePrompt'),
          }}
          responseTypes={['OPERATIONS_DONE']}
          busyLabel="…"
          variant="outline"
          size="sm"
          title={t('plugin.tools.intelligence.stickyTitle')}
          className="h-8 text-[10px] border-dashed"
        >
          <StickyNote size={11} className="mr-1.5 text-muted-foreground" />
          {t('plugin.tools.intelligence.sticky')}
        </OpButton>
      </div>

      <button
        onClick={() => setGuideOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 py-1 text-[8px] text-muted-foreground/70 hover:text-muted-foreground transition-colors uppercase tracking-widest"
      >
        <BookOpen size={9} />
        {t('plugin.tools.intelligence.namingGuide')}
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
